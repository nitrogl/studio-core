/**
 * How the Design mode writes each construct in LaTeX; the user can change
 * every convention.
 *
 * A convention is a LaTeX template. In the templates of actions, #1, #2 are
 * the parts of the action (see FIELDS); in the styles of identifiers, # is
 * the identifier. The conventions of the user live in the local storage of
 * the browser; a model can override some of them with @convention hints.
 *
 * The core defines the conventions that every language shares: the logical
 * operators of terms, the styles of identifiers (functions, constants,
 * types, events, tables, processes, variables) and the colours of types,
 * events, tables and private channels. Each application adds the actions of
 * its language, and anything else, with define().
 *
 * @author Roberto Metere
 * @license MIT
 */
class Conventions {
  /**
   * The default conventions.
   *
   * @type {Object}
   */
  static DEFAULTS = {
    // terms
      tuple: "\\langle {#*} \\rangle"
    , eq: "="
    , neq: "\\neq"
    , and: "\\land"
    , or: "\\lor"
    , not: "\\neg"
    , leq: "\\leq"
    , geq: "\\geq"
    , lt: "<"
    , gt: ">"
    , implies: "\\Longrightarrow"
    , forall: "\\forall {#1}.\\ {#2}"
    , typed: "{#1}{:}{#2}"
      // styles of identifiers (# is the identifier); single letters of variables stay as they are
    , funStyle: "\\mathsf{#}"
    , constStyle: "\\mathsf{#}"
    , typeStyle: "\\mathsf{#}"
    , eventStyle: "\\mathsf{#}"
    , tableStyle: "\\mathsf{#}"
    , processStyle: "\\mathsf{#}"
    , varStyle: "\\mathit{#}"
      // colours of the boxes (CSS)
    , typeColor: "#1597b8"
    , eventColor: "#198754"
    , tableColor: "#6f42c1"
    , privateColor: "#6b7a90"
  };

  /**
   * The parts of each action, in the order of #1, #2 (translated where they
   * show).
   *
   * @type {Object}
   */
  static FIELDS = {
    forall: [I18n.mark("variables"), I18n.mark("formula")]
  };

  /**
   * Groups and labels of the settings panel: the titles are the keys of the
   * groups, translated where they show.
   *
   * @type {Array}
   */
  static GROUPS = [
      { title: I18n.mark("Terms"), keys: ["tuple", "eq", "neq", "and", "or", "not", "leq", "geq", "lt", "gt", "implies", "forall", "typed"] }
    , { title: I18n.mark("Identifiers"), keys: ["funStyle", "constStyle", "typeStyle", "eventStyle", "tableStyle", "processStyle", "varStyle"] }
    , { title: I18n.mark("Colours"), keys: ["typeColor", "eventColor", "tableColor", "privateColor"] }
  ];

  /**
   * Adds the conventions of a language to those of the core.
   *
   * @param {Object} spec {DEFAULTS, FIELDS, GROUPS}: the new conventions and
   *   their defaults, the parts of the new actions, and groups of the
   *   settings panel. A group with the title of an existing one adds its
   *   keys to it; the other groups come first, in their order.
   */
  static define(spec: any) {
    Object.assign(Conventions.DEFAULTS, spec.DEFAULTS || {});
    Object.assign(Conventions.FIELDS, spec.FIELDS || {});
    const added = [];
    (spec.GROUPS || []).forEach(group => {
      const known = Conventions.GROUPS.find(g => g.title === group.title);
      if (known) {
        group.keys.forEach(key => {
          if (!known.keys.includes(key)) {
            known.keys.push(key);
          }
        });
      } else {
        added.push({ title: group.title, keys: group.keys.slice() });
      }
    });
    Conventions.GROUPS.unshift(...added);
  }

  /**
   * Gives the key of the notation of a builtin type.
   *
   * @param {string} name The type.
   * @return {string} The key, "type:" and the name.
   */
  static typeKey(name: string): string {
    return "type:" + name;
  }

  values: any;

  /**
   * Creates conventions.
   *
   * @param {Array} overrides The values that differ from the defaults.
   */
  constructor(overrides: Record<string,  string> = {}) {
    this.values = { ...Conventions.DEFAULTS };
    for (const [k, v] of Object.entries(overrides || {})) {
      if (Object.prototype.hasOwnProperty.call(Conventions.DEFAULTS, k) && typeof v === "string") {
        this.values[k] = v;
      }
    }
  }

  /**
   * Loads the conventions of the user.
   *
   * @param {Storage} storage A Storage (localStorage), or null.
   * @return {Object} The conventions.
   */
  static load(storage: Storage = Conventions.defaultStorage()) {
    let saved: Record<string,  string> = {};
    try {
      const raw = storage ? storage.getItem(StudioCore.storageKey("conventions")) : null;
      if (raw) {
        saved = JSON.parse(raw) || {};
      }
    } catch (e) {
      // the storage may be unavailable (private window): I fall back to the defaults
      saved = {};
    }
    return new Conventions(saved);
  }

  /**
   * Gives the local storage when there is one.
   *
   * @return {Object|null} LocalStorage or null.
   */
  static defaultStorage() {
    try {
      return typeof localStorage !== "undefined" ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Saves the conventions that differ from the defaults.
   *
   * @param {Storage} storage A Storage, or null.
   */
  save(storage: Storage = Conventions.defaultStorage()) {
    try {
      if (storage) {
        storage.setItem(StudioCore.storageKey("conventions"), JSON.stringify(this.overrides()));
      }
    } catch (e) {
      // nothing to do: the conventions still apply to this session
    }
  }

  /**
   * Gives the values that differ from the defaults.
   *
   * @return {Object} An object.
   */
  overrides() {
    const out = {};
    for (const [k, v] of Object.entries(this.values)) {
      if (v !== Conventions.DEFAULTS[k]) {
        out[k] = v;
      }
    }
    
    return out;
  }

  /**
   * Gives a convention.
   *
   * @param {string} key The convention.
   * @return {Object} Its template.
   */
  get(key: string) {
    return (this.values[key] === undefined || this.values[key] === null ? Conventions.DEFAULTS[key] : this.values[key]) || "";
  }

  /**
   * Gives conventions with some values changed (for the @convention hints of
   * a model).
   *
   * @param {Array} overrides The new values.
   * @return {Object} New conventions.
   */
  with(overrides: Record<string, string>) {
    return new Conventions({ ...this.overrides(), ...overrides });
  }

  /**
   * Gives conventions where one value is set (or reset when value is null).
   *
   * @param {string} key The convention.
   * @param {string} value Its template, or null for the default.
   * @return {Object} New conventions.
   */
  set(key: string, value: string) {
    const o = this.overrides();
    if (value === null || value === Conventions.DEFAULTS[key]) {
      delete o[key];
    } else {
      o[key] = value;
    }
    
    return new Conventions(o);
  }
}
// ----------------------------------------------------------------
