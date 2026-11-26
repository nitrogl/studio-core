/**
 * What the shared parts of the studios know of the application that uses
 * them: its name and id, the language of its models, the lexer of its code
 * view, and how its hints find their targets. The application calls
 * configure() once, before it uses any other class of the core.
 *
 * @author Roberto Metere
 * @license MIT
 */
class StudioCore {
  /**
   * The version of the core.
   *
   * @type {string}
   */
  static VERSION = "3.6.0";

  /**
   * The application, as configure() set it (see defaults()).
   *
   * @type {Object}
   */
  static app: StudioApp = StudioCore.defaults();

  /**
   * Gives the settings of an application that sets none.
   *
   * @return {Object} id (the prefix of the keys in the browser storage and
   *   the tag of the metadata comment), name, language (of the models),
   *   extension (of their files), engineSource (the source of the problems
   *   that the verifier itself reports), tokenize(text) (the lexer of the
   *   code view: {tokens: [{type, value, start, end}], comments: [{start,
   *   end}]}, identifiers being of type "IDENT"), tokenClass(token, text)
   *   (the class of a token that is not a symbol of the model: "kw", "kw2",
   *   "num", "str", "op" or ""), hintOwners(analysis) and hintTarget(owner)
   *   (what the hints of a comment apply to; see HintParser),
   *   messageSide(node) (whether a process action sends a message, "out",
   *   receives one, "in", or neither, null; for the hint @inout),
   *   explain(what) (the short description of a block of the diagram, {kind},
   *   or of a keyword, {keyword}, as {title, text}, or null; see Explainer),
   *   comment (the delimiters of a comment of the language, {open, close},
   *   close being "" for a comment that ends with its line), indentAfter (the
   *   end of a line after which Enter indents one level more), diagram (the
   *   kinds of blocks that DiagramView draws in their own way: the end of a
   *   chain and its label, a branch, a parallel composition, a replication),
   *   colours (the colours of the theme that the user may change,
   *   ThemeSettings.COLOURS when the studio gives none), symbolClasses (the
   *   class of each kind of symbol in the code view, over
   *   CodeHighlighter.KIND_CLASS), sentences(text) (the parts of a text that
   *   an interactive prover takes one at a time, [{start, end}] in order; the
   *   whole text by default; see ProofScript).
   */
  static defaults(): StudioApp {
    return {
        id: "studio"
      , name: "Studio"
      , language: "Model"
      , extension: ".txt"
      , engineSource: "engine"
      , tokenize: () => ({ tokens: [], comments: [] })
      , tokenClass: () => ""
      , hintOwners: () => new Map()
      , hintTarget: () => null
      , messageSide: () => null
      , explain: () => null
      , comment: { open: "(*", close: "*)" }
      , indentAfter: /(=|\bin|\bthen|\belse|\(|\bdo)\s*$/
      , diagram: {
            end: "Nil"
          , branch: "Branch"
          , parallel: "Par"
          , replication: "Repl"
          , endLabel: node => node && node.yield ? "yield" : "0"
        }
      , sentences: text => (text.trim() ? [{ start: 0, end: text.length }] : [])
    };
  }

  /**
   * Tells the core about the application.
   *
   * @param {Object} app What differs from defaults(); its conventions, when
   *   it has some ({DEFAULTS, FIELDS, GROUPS}), are added to those of the
   *   core with Conventions.define.
   */
  static configure(app: Partial<StudioApp>) {
    const defaults = StudioCore.defaults();
    StudioCore.app = {...defaults, ...app, diagram: {...defaults.diagram, ...app.diagram}};
    
    if (app.conventions) {
      Conventions.define(app.conventions);
    }
  }

  /**
   * Writes a comment of the language around a text.
   *
   * @param {string} body The text, on one line when the comment ends with
   *   its line.
   * @return {string} The comment, for instance "(* @infix '+' *)".
   */
  static comment(body: string): string {
    const { open, close } = StudioCore.app.comment;
    return open + " " + body + (close ? " " + close : "");
  }

  /**
   * Gives the key of the browser storage for some settings of the
   * application.
   *
   * @param {string} name The settings: "conventions", "appearance" or
   *   "engine".
   * @return {string} The key, for instance "piestudio.appearance".
   */
  static storageKey(name: string): string {
    return StudioCore.app.id + "." + name;
  }

  /**
   * Gives the zoom of the page, which the size of the interface sets
   * (ThemeSettings): a distance on the screen, as the pointer and
   * getBoundingClientRect give it, divided by the zoom is a length of the
   * page, for CSS and SVG.
   *
   * @return {number} The zoom, 1 for none.
   */
  static zoom(): number {
    const body = typeof document === "undefined" ? null : document.body as any;
    if (!body) {
      return 1;
    }
    if (typeof body.currentCSSZoom === "number" && body.currentCSSZoom > 0) {
      return body.currentCSSZoom;
    }
    return body.offsetWidth ? body.getBoundingClientRect().width/body.offsetWidth : 1;
  }

  /**
   * Makes a panel that jQuery UI resizes follow the pointer under the zoom
   * of the page: resizable changes its size by the distance that the
   * pointer moved on the screen, which is the zoom times a length of the
   * page.
   *
   * @param {Object} ui What resizable gives to its resize event: its size
   *   changes.
   */
  static resizing(ui: any) {
    const zoom = StudioCore.zoom();
    ui.size.width = ui.originalSize.width + (ui.size.width - ui.originalSize.width)/zoom;
    ui.size.height = ui.originalSize.height + (ui.size.height - ui.originalSize.height)/zoom;
  }

  /**
   * Keeps the item that jQuery UI's sortable drags under the pointer, under
   * the zoom of the page: sortable places it by the distance that the
   * pointer moved on the screen. Its sort event calls it.
   *
   * @param {Object} ui What sortable gives to its sort event.
   * @param {string} axis The only axis that the item moves along, "x" or
   *   "y", or none.
   */
  static sorting(ui: any, axis: string = "") {
    const zoom = StudioCore.zoom();
    if (zoom !== 1) {
      ui.helper.css(axis === "y" ? { top: ui.position.top/zoom } : axis === "x" ? { left: ui.position.left/zoom } : { left: ui.position.left/zoom, top: ui.position.top/zoom });
    }
  }

  /**
   * Loads the page again, after a change that the page cannot follow (the
   * language of the interface), keeping a state for the next start: the
   * studio reads it back with resumed. The state lasts for the tab only.
   *
   * @param {Object} state What the studio keeps, which JSON can hold: its
   *   model, the history of its changes...
   */
  static reload(state: any) {
    try {
      sessionStorage.setItem(StudioCore.storageKey("resume"), JSON.stringify(state));
    } catch (e) {
      // Without the storage of the tab, or when it is full, the studio starts from what it saved
    }
    location.reload();
  }

  /**
   * Gives the state that reload kept, once: the next start has none.
   *
   * @return {Object|null} The state, or null.
   */
  static resumed() {
    try {
      const key = StudioCore.storageKey("resume");
      const text = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
      return text === null ? null : JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  /**
   * Gives the model that the address of the page carries, once, and takes
   * it out of the address: the buttons under the code extracts of the
   * manuals open a studio with #model=<base64url of the UTF-8 text>&file=
   * <name>.
   *
   * @param {Array<string>} extensions The extensions of the models of the
   *   studio, without their dot ("pv"); another name is left out.
   * @return {Object|null} {text, fileName}, the file name being null when
   *   the address gives none, or null when it carries no model.
   */
  static linkedModel(extensions: string[]): { text: string; fileName: string | null } | null {
    if (typeof location === "undefined") {
      return null;
    }
    const params = new URLSearchParams(location.hash.slice(1));
    const model = params.get("model");
    if (!model) {
      return null;
    }
    history.replaceState(null, "", location.pathname + location.search);
    try {
      const bytes = Uint8Array.from(atob(model.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
      const name = params.get("file") || "";
      const known = new RegExp("^[\\w.-]+\\.(" + extensions.join("|") + ")$");
      return { text: new TextDecoder().decode(bytes).replace(/\r\n?/g, "\n"), fileName: known.test(name) ? name : null };
    } catch (e) {
      return null;
    }
  }
}
// ----------------------------------------------------------------

interface StudioApp {
  id: string;
  name: string;
  language: string;
  extension: string;
  engineSource: string;
  tokenize(text: string): { tokens: any[]; comments: any[] };
  tokenClass(token: any, text: string): string;
  hintOwners(analysis: any): Map<any, any>;
  hintTarget(owner: any): any;
  messageSide(node: any): string | null;
  explain(what: { kind?: string; keyword?: string }): { title: string; text: string } | null;
  comment: { open: string; close: string };
  indentAfter: RegExp;
  diagram: { end: string; branch: string; parallel: string; replication: string; endLabel(node: any): string };
  colours?: { key: string; label: string }[];
  symbolClasses?: Record<string, string>;
  sentences(text: string): { start: number; end: number }[];
  conventions?: any;
  [key: string]: any;
}
// ----------------------------------------------------------------
