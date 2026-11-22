/**
 * The part of a model that an interactive prover has checked, as Proof
 * General keeps it in Emacs: the prover takes the sentences of the text one
 * at a time (StudioCore.app.sentences), the sentences it checked stay
 * checked until an edit changes them, and its answer to each one (the
 * goals, the messages) stays with it.
 *
 * The studio gives the session of its prover:
 *
 *   run(sentence)   checks a sentence, {index, start, end, text}, and
 *                   resolves to the answer: {ok, error: {message, start,
 *                   end}} where start and end, optional, are offsets in
 *                   the sentence, and whatever the studio shows (goals,
 *                   messages); a run stopped by interrupt resolves to
 *                   {ok: false, interrupted: true}
 *   undo(count)     goes back to the state after the first count sentences
 *                   (a prover that cannot undo starts again and replays
 *                   them)
 *   interrupt()     optional, stops the sentence being checked
 *
 * The studio moves with next(), back(), goTo(offset), all() and reset(),
 * and gives every new text to setText: an edit retracts the sentences that
 * it changes, and those after them. The code view draws regions(), the
 * problems take problem(), and the goals pane shows answerAt(offset).
 *
 * @author Roberto Metere
 * @license MIT
 */
class ProofScript {
  /**
   * The class of the region that the prover checked.
   *
   * @type {string}
   */
  static CHECKED = "st-checked";

  /**
   * The class of the region that waits for the prover.
   *
   * @type {string}
   */
  static QUEUED = "st-queued";

  /**
   * The class of the sentence that the prover refused.
   *
   * @type {string}
   */
  static FAILED = "st-failed";

  session: any;
  onChange: (script: ProofScript) => void;
  text: string;
  sentences: { start: number; end: number }[];
  checked: any[];
  wanted: number;
  pending: any;
  failure: any;
  running: boolean;
  work: Promise<void>;

  /**
   * @param {Object} params The parameters.
   * @param {Object} params.session The session of the prover: run, undo and
   *   interrupt.
   * @param {Function} params.onChange Called after every change of the
   *   state, with the script.
   * @param {string} params.text The text, "" by default.
   */
  constructor(params: { session: any; onChange?: (script: ProofScript) => void; text?: string }) {
    this.session = params.session;
    this.onChange = params.onChange || (() => {});
    this.text = "";
    this.sentences = [];
    this.checked = [];
    this.wanted = 0;
    this.pending = null;
    this.failure = null;
    this.running = false;
    this.work = Promise.resolve();
    this.setText(params.text || "");
  }

  /**
   * Says whether a sentence that the prover took is still in the text, with
   * the same place and the same code.
   *
   * @param {Object} taken The sentence, {index, start, end, text}.
   * @return {boolean} True when the text still has it.
   */
  holds(taken: any): boolean {
    const now = this.sentences[taken.index];
    return !!now && now.start === taken.start && now.end === taken.end && this.text.slice(now.start, now.end) === taken.text;
  }

  /**
   * Takes a new text: the sentences that the edit changed are retracted,
   * with those after them.
   *
   * @param {string} text The text.
   */
  setText(text: string) {
    this.text = text;
    this.sentences = StudioCore.app.sentences(text);
    let kept = 0;
    while (kept < this.checked.length && this.holds(this.checked[kept])) {
      kept++;
    }
    if (kept < this.checked.length) {
      this.wanted = Math.min(this.wanted, kept);
    }
    if (this.pending && !this.holds(this.pending)) {
      this.wanted = Math.min(this.wanted, this.pending.index);
    }
    if (this.failure && !this.holds(this.failure)) {
      this.failure = null;
    }
    this.wanted = Math.min(this.wanted, this.sentences.length);
    this.stopUnwanted();
    this.go();
  }

  /**
   * Checks one sentence more.
   */
  next() {
    this.target(Math.max(this.wanted, this.checked.length) + 1);
  }

  /**
   * Retracts the last sentence checked, and drops those waiting.
   */
  back() {
    this.target(Math.min(this.wanted, this.checked.length) - 1);
  }

  /**
   * Checks the sentences that end before an offset, and retracts the others.
   *
   * @param {number} offset The offset, usually the caret.
   */
  goTo(offset: number) {
    this.target(this.sentences.filter(sentence => sentence.end <= offset).length);
  }

  /**
   * Checks the whole text.
   */
  all() {
    this.target(this.sentences.length);
  }

  /**
   * Retracts every sentence.
   */
  reset() {
    this.target(0);
  }

  /**
   * Stops the sentence being checked, and those waiting after it.
   */
  interrupt() {
    this.wanted = this.checked.length;
    this.stopUnwanted();
    this.changed();
  }

  /**
   * Stops the sentence being checked when it is no longer wanted, if the
   * session can.
   */
  stopUnwanted() {
    if (this.pending && this.pending.index >= this.wanted && this.session.interrupt) {
      this.session.interrupt();
    }
  }

  /**
   * Sets how many sentences must be checked, and starts the prover.
   *
   * @param {number} count The number of sentences.
   */
  target(count: number) {
    this.wanted = Math.max(0, Math.min(count, this.sentences.length));
    this.failure = null;
    this.stopUnwanted();
    this.go();
  }

  /**
   * Starts the work of the prover, unless it works already: the work
   * follows the target until it reaches it.
   */
  go() {
    if (!this.running) {
      this.running = true;
      this.work = this.steps();
    }
    this.changed();
  }

  /**
   * @return {Promise} Resolved when the prover has nothing more to do.
   */
  idle(): Promise<void> {
    return this.work;
  }

  /**
   * Runs and undoes sentences until the checked ones are those wanted.
   *
   * @return {Promise} Resolved when they are.
   */
  async steps() {
    try {
      for (;;) {
        if (this.checked.length > this.wanted) {
          const count = this.wanted;
          await this.session.undo(count);
          this.checked.length = Math.min(this.checked.length, count);
        } else if (this.checked.length < this.wanted && !this.failure) {
          await this.step();
        } else {
          // No await since the last test: nothing can ask for more before the work ends
          return;
        }
        this.changed();
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Runs the next sentence, and keeps the answer of the prover.
   *
   * @return {Promise} Resolved when the prover answered.
   */
  async step() {
    const index = this.checked.length;
    const sentence = this.sentences[index];
    const taken = { index: index, start: sentence.start, end: sentence.end, text: this.text.slice(sentence.start, sentence.end) };
    this.pending = taken;
    this.changed();
    let answer;
    try {
      answer = await this.session.run(taken);
    } catch (e) {
      answer = { ok: false, error: { message: String(e && (e as Error).message || e) } };
    }
    this.pending = null;
    if (answer && answer.ok) {
      this.checked.push({ ...taken, answer: answer });
    } else {
      this.wanted = Math.min(this.wanted, index);
      if (!(answer && answer.interrupted) && this.holds(taken)) {
        this.failure = this.failed(taken, answer || {});
      }
    }
  }

  /**
   * Describes the refusal of a sentence, with the place of its error in the
   * text.
   *
   * @param {Object} taken The sentence.
   * @param {Object} answer The answer of the prover.
   * @return {Object} The sentence, with its answer, and the start, the end
   *   and the message of the error.
   */
  failed(taken: any, answer: any) {
    const error = answer.error || {};
    const length = taken.end - taken.start;
    const from = error.start >= 0 && error.start <= length ? error.start : 0;
    const to = error.end > from && error.end <= length ? error.end : length;
    return { ...taken, answer: answer, errorStart: taken.start + from, errorEnd: taken.start + to, message: String(error.message || "") };
  }

  /**
   * Tells the studio that the state changed.
   */
  changed() {
    this.onChange(this);
  }

  /**
   * @return {number} The offset where the checked part of the text ends.
   */
  checkedEnd(): number {
    return this.checked.length ? this.checked[this.checked.length - 1].end : 0;
  }

  /**
   * Gives the regions of the text for the code view (CodeView.setRegions):
   * what the prover checked, what waits for it, and the sentence that it
   * refused.
   *
   * @return {Array<Object>} The regions, {start, end, cls}.
   */
  regions() {
    const regions = [];
    const end = this.checkedEnd();
    if (end > 0) {
      regions.push({ start: 0, end: end, cls: ProofScript.CHECKED });
    }
    const queued = Math.max(this.wanted, this.pending ? this.pending.index + 1 : 0);
    if (queued > this.checked.length && this.sentences[queued - 1]) {
      regions.push({ start: end, end: this.sentences[queued - 1].end, cls: ProofScript.QUEUED });
    }
    if (this.failure) {
      regions.push({ start: this.failure.start, end: this.failure.end, cls: ProofScript.FAILED });
    }
    return regions;
  }

  /**
   * Gives the error of the sentence that the prover refused, as a problem
   * of the code view.
   *
   * @return {Object|null} {start, end, message, severity, source}, or null.
   */
  problem() {
    const failure = this.failure;
    if (!failure) {
      return null;
    }
    return { start: failure.errorStart, end: failure.errorEnd, message: failure.message, severity: "error", source: StudioCore.app.engineSource };
  }

  /**
   * Gives the answer of the prover after the last sentence checked before
   * an offset: the goals there.
   *
   * @param {number} offset The offset, usually the caret.
   * @return {Object|null} The answer, or null before the first sentence.
   */
  answerAt(offset: number) {
    let found = null;
    for (const sentence of this.checked) {
      if (sentence.end > offset) {
        break;
      }
      found = sentence.answer;
    }
    return found;
  }

  /**
   * @return {Object|null} The answer of the prover after the last sentence
   *   checked: the current goals.
   */
  last() {
    return this.checked.length ? this.checked[this.checked.length - 1].answer : null;
  }
}
// ----------------------------------------------------------------
