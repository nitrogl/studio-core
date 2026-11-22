/**
 * The code of a model as coloured HTML: keywords, symbols by kind, comments
 * and hints. The tokens come from the lexer of the application
 * (StudioCore.app.tokenize), which also tells what is not a symbol
 * (StudioCore.app.tokenClass).
 *
 * Colours identifiers by what they are in the model (types, functions, names,
 * events, tables, processes), so the code reads with the same colours as the
 * diagram: events green, tables purple, types cyan.
 *
 * TODO think about "complex" structures to highlight, e.g., across multiple
 * lines of code
 *
 * @author Roberto Metere
 * @license MIT
 */
class CodeHighlighter {
  /**
   * The class of each kind of symbol.
   *
   * @type {Object}
   */
  static KIND_CLASS = { type: "st-tk-type", fun: "st-tk-fun", letfun: "st-tk-fun", event: "st-tk-event", table: "st-tk-table", name: "st-tk-name", process: "st-tk-proc", pred: "st-tk-pred" };

  /**
   * The hints of the notation inside comments.
   * The idea of using hints this way was taken from MetaCP.
   *
   * @type {RegExp}
   */
  static HINT: RegExp = /@(?:notation|infix|prefix|postfix|label|color|hide|symmetric|convention|library)\b(?:\s+(?:'(?:[^']|'')*'|"(?:[^"]|"")*"))?/g;

  /**
   * Escapes text for HTML.
   *
   * @param {string} s The text.
   * @return {string} The escaped text.
   */
  static escape(s: string): string {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /**
   * Gives the class of a symbol kind.
   *
   * @param {string} kind The kind of the symbol (from the checker).
   * @return {Object} The class or ''.
   */
  static kindClass(kind: string) {
    const own = map => (map && Object.prototype.hasOwnProperty.call(map, kind) ? map[kind] : "");
    
    return own(StudioCore.app.symbolClasses) || own(CodeHighlighter.KIND_CLASS);
  }

  /**
   * Computes the coloured ranges of a text.
   *
   * @param {string} text The code.
   * @param {Analysis} analysis An Analysis (of this text or an older one), or
   *   null.
   * @return {Object} [{start, end, cls}] sorted by start.
   */
  static marks(text: string, analysis: any = null) {
    const lexed = StudioCore.app.tokenize(text);
    const out = [];
    const sameText = analysis && analysis.text === text;
    const occ = new Map();
    
    if (sameText && analysis.check && analysis.check.occurrences) {
      for (const o of analysis.check.occurrences) {
        const s = analysis.check.symbols.get(o.sym);
        if (s) {
          occ.set(o.start, s.kind);
        }
      }
    }
    
    const kindOf = tok => {
      if (occ.has(tok.start)) {
        return occ.get(tok.start);
      }
      
      if (!analysis) {
        return null;
      }
      
      const g = analysis.global(tok.value);
      
      return g ? g.kind : null;
    };
    
    for (const tok of lexed.tokens) {
      if (tok.type === "EOF") {
        continue;
      }
    
      let cls = tok.type === "IDENT" ? CodeHighlighter.kindClass(kindOf(tok)) : "";
      if (!cls) {
        const other = StudioCore.app.tokenClass(tok, text);
        cls = other ? "st-tk-" + other : "";
      }

      if (cls) {
        out.push({ start: tok.start, end: tok.end, cls });
      }
    }
    
    for (const c of lexed.comments) {
      out.push({ start: c.start, end: c.end, cls: "st-tk-com" });
      CodeHighlighter.HINT.lastIndex = 0;
      const body = text.slice(c.start, c.end);

      let m;
      while ((m = CodeHighlighter.HINT.exec(body))) {
        out.push({ start: c.start + m.index, end: c.start + m.index + m[0].length, cls: "st-tk-hint" });
      }
    }
    out.sort((a, b) => a.start - b.start || b.end - a.end);

    return out;
  }

  /**
   * Writes a range of a text as spans, combining layers of classes.
   *
   * @param {string} text The text.
   * @param {number} from The first offset.
   * @param {number} to The offset after the last.
   * @param {Array} layers Arrays of {start, end, cls}; later layers add their
   *   class.
   * @return {Object} The HTML.
   */
  static spans(text: string, from: number, to: number, layers: any[]) {
    const n = to - from;
    if (n <= 0) {
      return "";
    }

    const cls = new Array(n).fill("");
    for (const layer of layers) {
      for (const m of layer) {
        if (m.end <= from || m.start >= to) {
          continue;
        }
        
        const a = Math.max(m.start, from) - from;
        const b = Math.min(Math.max(m.end, m.start + 1), to) - from;
        
        for (let i = a; i < b; i++) {
          cls[i] = cls[i] ? cls[i] + " " + m.cls : m.cls;
        }
      }
    }
    
    let html = "";
    let i = 0;
    while (i < n) {
      let j = i + 1;
      while (j < n && cls[j] === cls[i]) {
        j++;
      }
      
      const s = CodeHighlighter.escape(text.slice(from + i, from + j));
      html += cls[i] ? "<span class=\"" + cls[i] + "\">" + s + "</span>" : s;
      i = j;
    }
    
    return html;
  }

  /**
   * Colours a short piece of code (a block, a declaration).
   *
   * @param {number} code The code.
   * @param {Analysis} analysis The Analysis of the model, for the kinds of the
   *   symbols.
   * @return {Object} The HTML.
   */
  static snippet(code: string, analysis: any = null) {
    const text = String(code === undefined || code === null ? "" : code);
    
    return CodeHighlighter.spans(text, 0, text.length, [CodeHighlighter.marks(text, analysis ? { global: n => analysis.global(n), text: null } : null)]);
  }
}
// ----------------------------------------------------------------
