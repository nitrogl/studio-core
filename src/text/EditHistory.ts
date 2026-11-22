/**
 * Unlimited undo and redo over the text of a model.
 *
 * The text of the model is the single source of truth (the layout of the
 * diagram lives in comments/external files)
 * One history should covers code edits, diagram edits and moves.
 * Each step is stored as a minimal diff to optimize memory use.
 * 
 * TODO: Now consecutive typing is coalesced into one step if they happen close
 * enough each other; its granularity is here fixed, but could be a setting
 * option in the menu.
 *
 * @author Roberto Metere
 * @license MIT
 */
class EditHistory {
  /**
   * Steps of the same kind closer than this (ms) are merged.
   *
   * @type {number}
   */
  static COALESCE_MS = 1500;

  text: string;
  done: any[];
  undone: any[];
  listeners: Set<any>;
  savedIndex: number;

  /**
   * Starts a history.
   *
   * @param {string} text The initial text.
   */
  constructor(text: string = "") {
    this.text = text;
    this.done = [];
    this.undone = [];
    this.listeners = new Set();
    this.savedIndex = 0;
  }

  /**
   * Records a change to a new text.
   *
   * @param {Object} newText The new text.
   * @param {Object} opts {label, coalesce, selectionBefore, selectionAfter};
   *   steps with the same coalesce key merge; a step without a label is an
   *   edit.
   * @return {boolean} False when nothing changed.
   */
  commit(newText: any, { label = null, coalesce = null, selectionBefore = null, selectionAfter = null }: any = {}): boolean {
    if (newText === this.text) {
      return false;
    }
    
    label = label || I18n.t("Edit");
    const now = Date.now();
    const last = this.done[this.done.length - 1];
    
    if (coalesce && last && last.coalesce === coalesce && now - last.time < EditHistory.COALESCE_MS && !this.undone.length && this.done.length > this.savedIndex) {
      const before = TextDiff.backward(this.text, last.diff);
      last.diff = TextDiff.between(before, newText);
      last.time = now;
      last.selectionAfter = selectionAfter;
      this.text = newText;
      this.emit();
      return true;
    }
    
    this.done.push({ diff: TextDiff.between(this.text, newText), label, time: now, coalesce, selectionBefore, selectionAfter });
    this.undone = [];
    
    if (this.savedIndex > this.done.length - 1) {
      this.savedIndex = -1;
    }
    
    this.text = newText;
    this.emit();
    
    return true;
  }

  /**
   * Tells whether a step can be undone.
   */
  get canUndo() {
    return this.done.length > 0;
  }

  /**
   * Tells whether a step can be redone.
   */
  get canRedo() {
    return this.undone.length > 0;
  }

  /**
   * Gives the number of steps remembered.
   */
  get size() {
    return this.done.length + this.undone.length;
  }

  /**
   * Tells whether the text changed since it was last saved.
   */
  get dirty() {
    return this.savedIndex !== this.done.length;
  }

  /**
   * Gives the label of the step undo would undo, or null.
   */
  get undoLabel() {
    return this.done.length ? this.done[this.done.length - 1].label : null;
  }

  /**
   * Gives the label of the step redo would redo, or null.
   */
  get redoLabel() {
    return this.undone.length ? this.undone[this.undone.length - 1].label : null;
  }

  /**
   * Remembers that the current text is saved.
   */
  markSaved() {
    this.savedIndex = this.done.length;
    this.emit();
  }

  /**
   * Undoes the last step.
   *
   * @return {Object} {text, entry, selection} or null.
   */
  undo() {
    const e = this.done.pop();
    if (!e) {
      return null;
    }
    this.text = TextDiff.backward(this.text, e.diff);
    this.undone.push(e);
    this.emit();
    return { text: this.text, entry: e, selection: e.selectionBefore };
  }

  /**
   * Redoes the last undone step.
   *
   * @return {Object} {text, entry, selection} or null.
   */
  redo() {
    const e = this.undone.pop();
    if (!e) {
      return null;
    }
    this.text = TextDiff.forward(this.text, e.diff);
    this.done.push(e);
    this.emit();
    return { text: this.text, entry: e, selection: e.selectionAfter };
  }

  /**
   * Jumps to the state after a number of applied steps.
   *
   * @param {number} n The number of steps (0 is the initial text).
   * @return {string} The text.
   */
  goTo(n: number): string {
    while (this.done.length > n && this.canUndo) {
      this.undo();
    }
    
    while (this.done.length < n && this.canRedo) {
      this.redo();
    }
    
    return this.text;
  }

  /**
   * Lists the steps for a history panel.
   *
   * @return {Object} [{index, label, time, applied}].
   */
  timeline() {
    return [
        ...this.done.map((e, i) => ({ index: i + 1, label: e.label, time: e.time, applied: true }))
      , ...this.undone.slice().reverse().map((e, i) => ({ index: this.done.length + i + 1, label: e.label, time: e.time, applied: false }))
    ];
  }

  /**
   * Forgets everything and start again from a text (after opening a file).
   *
   * @param {string} text The new text.
   */
  reset(text: string) {
    this.text = text;
    this.done = [];
    this.undone = [];
    this.savedIndex = 0;
    this.emit();
  }

  /**
   * Gives the history as data that JSON can hold, to keep it while the page
   * loads again (see StudioCore.reload).
   *
   * @return {Object} {text, done, undone, savedIndex}.
   */
  snapshot() {
    return { text: this.text, done: this.done, undone: this.undone, savedIndex: this.savedIndex };
  }

  /**
   * Takes back a history that snapshot gave.
   *
   * @param {Object} snapshot The history, {text, done, undone, savedIndex}.
   * @return {boolean} False when it is not one: the history stays as it is.
   */
  restore(snapshot: any): boolean {
    const steps = list => Array.isArray(list) && list.every(e => e && e.diff && typeof e.diff.at === "number"
      && typeof e.diff.removed === "string" && typeof e.diff.inserted === "string");
    
    if (!snapshot || typeof snapshot.text !== "string" || !steps(snapshot.done) || !steps(snapshot.undone)) {
      return false;
    }
    
    this.text = snapshot.text;
    this.done = snapshot.done;
    this.undone = snapshot.undone;
    this.savedIndex = typeof snapshot.savedIndex === "number" ? snapshot.savedIndex : -1;
    this.emit();
    
    return true;
  }

  /**
   * Adds a listener.
   *
   * @param {Function} fn Called with the history after each change.
   * @return {Object} A function that removes the listener.
   */
  subscribe(fn: Function) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Notifies the listeners.
   */
  emit() {
    for (const fn of this.listeners) {
      fn(this);
    }
  }
}
// ----------------------------------------------------------------
