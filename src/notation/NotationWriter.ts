/**
 * Writes identifiers, types and applications of symbols in LaTeX, with the
 * notation of the model (NotationTable) and the conventions. The writer of
 * each language extends it with its terms, patterns, actions and
 * declarations.
 *
 *   - a symbol with a notation is written with it, the others with the style
 *     of their kind ("\mathsf" for functions, italic for variables); 
 *   - an identifier with underscores is written with a subscript:
 *     k_A is "k_{A}", k_A_B is "k_{A\_B}"; a word of several letters goes in
 *     its style ("\mathit{nonce}") so that it reads as one identifier;
 *   - a type is a symbol like the others: a hint "@notation '\mathcal{K}'"
 *     before "type key" writes key as \mathcal{K} everywhere, otherwise it
 *     takes the style of types; either way it is wrapped in
 *     "\htmlClass{st-type}{...}", which the stylesheet frames in the colour
 *     of types;
 *   - what has no LaTeX form is written as raw code of the model,
 *     "\htmlClass{st-raw}{\mathtt{...}}";
 *   - for FormulaView, the writer of a language marks each piece with its
 *     place in the code (located), when origin is set.
 *
 * @author Roberto Metere
 * @license MIT
 */
class NotationWriter {
  /**
   * Level of atoms (level of anything that never needs parentheses).
   *
   * @type {number}
   */
  static ATOM = 100;

  /**
   * The key of the data that marks a piece of a formula with its place in
   * the code: \htmlData{st-range=a-b}{...}, which KaTeX writes as the
   * attribute data-st-range.
   *
   * @type {string}
   */
  static RANGE = "st-range";

  table: NotationTable;
  conv: any;
  analysis: any;
  origin: number | null;

  /**
   * Prepares a writer.
   *
   * @param {NotationTable} table The NotationTable of the model (with its
   *   conventions and its analysis).
   */
  constructor(table: NotationTable) {
    this.table = table;
    this.conv = table ? table.conv : new Conventions();
    this.analysis = table ? table.analysis : null;
    this.origin = null;
  }

  /**
   * Marks the LaTeX of a piece of the model with its place in the code, for
   * FormulaView: from origin, the start of the part of the code that the
   * formula writes (see FormulaView.setItems).
   *
   * @param {string} tex The LaTeX of the piece.
   * @param {number} start The offset of the piece in the code.
   * @param {number} end The offset after it.
   * @return {string} The LaTeX, marked; as it is when origin is null or the
   *   piece has no place after it.
   */
  located(tex: string, start: number, end: number): string {
    if (this.origin === null || !(start >= this.origin) || !(end > start)) {
      return tex;
    }
    return "\\htmlData{" + NotationWriter.RANGE + "=" + (start - this.origin) + "-" + (end - this.origin) + "}{" + tex + "}";
  }

  /**
   * Escapes code of the model for "\mathtt" in math mode.
   *
   * @param {string} s The code.
   * @return {string} The LaTeX.
   */
  static escapeRaw(s: string): string {
    return String(s).replace(/\\/g, "\\textbackslash{}").replace(/([{}#$%&_])/g, "\\$1").replace(/\^/g, "\\hat{}").replace(/ /g, "\\ ");
  }

  /**
   * Writes raw code of the model.
   *
   * @param {number} code The code.
   * @return {string} The LaTeX.
   */
  raw(code: string): string {
    return "\\htmlClass{st-raw}{\\mathtt{" + NotationWriter.escapeRaw(code) + "}}";
  }

  /**
   * Applies an identifier style ("\mathsf{#}") to a word.
   *
   * @param {Object} style The style template.
   * @param {string} word The word.
   * @return {string} The LaTeX.
   */
  static styled(style: any, word: string): string {
    return style.includes("#") ? style.replace("#", word) : style + "{" + word + "}";
  }

  /**
   * Writes one segment of an identifier (the parts between underscores).
   *
   * @param {Object} seg The segment.
   * @param {Object} style The style of the identifier.
   * @param {boolean} plainLetters True when single letters stay as they are
   *   (variables).
   * @param {boolean} sub True inside the subscript.
   * @return {string} The LaTeX.
   */
  segment(seg: any, style: any, plainLetters: boolean, sub: boolean): string {
    if (seg === "") {
      return "";
    }
    
    if (sub && /^[0-9]+$/.test(seg)) {
      return seg;
    }
    
    if (plainLetters && /^[A-Za-z\u00c0-\u00ff]'*$/.test(seg)) {
      return seg;
    }
    
    return NotationWriter.styled(style, seg);
  }

  /**
   * Writes an identifier in a style, with the subscript encoding of
   * underscores.
   *
   * @param {string} name The identifier.
   * @param {Object} style The style template.
   * @param {boolean} plainLetters True when single letters stay as they are.
   * @return {string} The LaTeX.
   */
  encode(name: string, style: any, plainLetters: boolean): string {
    const segs = name.split("_");
    const base = this.segment(segs[0], style, plainLetters, false);
    
    if (segs.length === 1) {
      return base;
    }
    
    const subs = segs.slice(1).map(s => this.segment(s, style, true, true));
    return base + "_{" + subs.join("\\_") + "}";
  }

  /**
   * Gives the role of an identifier in the model (what style it gets).
   *
   * @param {string} name The identifier.
   * @param {boolean} applied True when it is applied to arguments.
   * @return {Object} 'fun', 'const', 'type', 'event', 'table', 'process',
   *   'pred' or 'var'.
   */
  role(name: string, applied: boolean): string {
    const g = this.analysis ? this.analysis.global(name) : null;
    if (!g) {
      return applied ? "fun" : "var";
    }
    
    switch (g.kind) {
      case "fun":
        return g.args.length || applied ? "fun" : "const";
        
      case "letfun":
        return "fun";
        
      case "type":
        return "type";
        
      case "event":
        return "event";
        
      case "table":
        return "table";
        
      case "process":
        return "process";
        
      case "pred":
        return "pred";
        
      default:
        return applied ? "fun" : "var";
    }
  }

  /**
   * Writes an identifier with its notation or the style of its role.
   *
   * @param {string} name The identifier.
   * @param {Object} role The role (see role()), or null to find it.
   * @return {string} The LaTeX.
   */
  ident(name: string, role: any = null): string {
    const e = this.table ? this.table.notationOf(name) : null;
    
    if (e && e.form === "constant") {
      return e.tex;
    }
    
    const r = role || this.role(name, false);
    const c = this.conv;
    
    // A builtin type has a notation of its own, which the user may change
    if (r === "type" && c.get(Conventions.typeKey(name))) {
      return c.get(Conventions.typeKey(name));
    }
    
    switch (r) {
      case "fun":
      case "pred":
        return this.encode(name, c.get("funStyle"), false);
        
      case "const":
        return this.encode(name, c.get("constStyle"), false);
        
      case "type":
        return this.encode(name, c.get("typeStyle"), false);
        
      case "event":
        return this.encode(name, c.get("eventStyle"), false);
        
      case "table":
        return this.encode(name, c.get("tableStyle"), false);
        
      case "process":
        return this.encode(name, c.get("processStyle"), false);
        
      default:
        return this.encode(name, c.get("varStyle"), true);
    }
  }

  /**
   * Writes a type: with its notation, or in the style of types, framed by
   * the st-type class.
   *
   * @param {string} name The type.
   * @return {string} The LaTeX.
   */
  type(name: string): string {
    return "\\htmlClass{st-type}{" + this.ident(name, "type") + "}";
  }

  /**
   * Puts the parts into a template: #k (or {#k}) becomes the k-th part.
   *
   * A part keeps braces only where TeX needs a group: after _ and ^, or when
   * it ends with a control word that the template would glue to a letter.
   * Without the extra braces the formula is the one a person would type, and
   *
   * @param {string} template The template.
   * @param {Array} parts The parts, by number (1-based); parts['*'] for #*.
   * @return {string} The LaTeX.
   */
  static fill(template: string, parts: any): string {
    return template.replace(/(_|\^)?(?<!\\)\{#([1-9*])\}|(_|\^)?#([1-9*])/g, (m, s1, k1, s2, k2) => {
      const script = s1 || s2 || "";
      const k = k1 || k2;
      const part = String(parts[k] === undefined || parts[k] === null ? "" : parts[k]);
      
      if (script) {
        return script + "{" + part + "}";
      }
      
      // a list (#*) is not one group: its commas must stay visible to the reader
      if (k !== "*" && /\\[A-Za-z]+$/.test(part)) {
        return "{" + part + "}";
      }
      
      return part;
    });
  }

  /**
   * Puts parentheses around a rendering when its level is too low.
   *
   * @param {Object} r {tex, level}.
   * @param {number} min The lowest level that needs no parentheses.
   * @return {string} The LaTeX.
   */
  static paren(r: any, min: number): string {
    return r.level >= min ? r.tex : "\\left(" + r.tex + "\\right)";
  }

  /**
   * Writes an application with the notation of its symbol.
   *
   * @param {Object} e The notation entry.
   * @param {Array} args The renderings of the arguments, {tex, level}.
   * @return {Object} {tex, level}.
   */
  applyNotation(e: any, args: any[]) {
    const toks = e.tokens;
    const first = toks[0];
    const last = toks[toks.length - 1];
    const leftEdge = first && first.t === "hole" ? first.v : null;
    const rightEdge = last && last.t === "hole" && toks.length > 1 ? last.v : null;
    const closed = leftEdge === null && rightEdge === null;
    const level = closed ? NotationWriter.ATOM : e.level;
    const parts = {};
    // the base of a script (g^{a}, k_{A}): an atom needs no parentheses, unless it carries a script itself
    const scriptBase = leftEdge !== null && toks[1] && (toks[1].t === "^" || toks[1].t === "_");
    
    args.forEach((a, i) => {
      const k = i + 1;
      let min = 0;
    
      if (k === leftEdge) {
        min = e.form === "infix" ? level : level + 1;
      }
      
      if (k === rightEdge) {
        min = e.form === "infix" ? level + 1 : level;
      }
      
      if (k === leftEdge && scriptBase && a.level >= NotationWriter.ATOM && !NotationWriter.endsWithScript(a.tex)) {
        min = 0;
      }
      
      parts[k] = NotationWriter.paren(a, min);
    });
    
    return { tex: NotationWriter.fill(e.tex, parts), level };
  }

  /**
   * Tells whether some LaTeX ends with a subscript or a superscript (x_1,
   * g^{a}), which a second script on the same base would clash with.
   *
   * @param {string} tex The LaTeX.
   * @return {boolean} True when it does.
   */
  static endsWithScript(tex: string): boolean {
    const s = tex.trimEnd();
    const n = s.length;
    
    if (n < 2) {
      return false;
    }
    
    if (s[n - 1] !== "}" || s[n - 2] === "\\") {
      return s[n - 2] === "^" || s[n - 2] === "_";
    }
    
    let depth = 0;
    for (let i = n - 1; i >= 0; i--) {
      if (s[i - 1] === "\\") {
        i--;
        continue;
      }
    
      if (s[i] === "}") {
        depth++;
      } else if (s[i] === "{" && --depth === 0) {
        return i > 0 && (s[i - 1] === "^" || s[i - 1] === "_");
      }
    }
    
    return false;
  }

  /**
   * Writes the application of an event, a table, a process or a function with
   * its notation.
   *
   * @param {string} name The symbol.
   * @param {Array} args The renderings of the arguments ({tex, level}), or
   *   null without parentheses.
   * @param {Object} role Its role.
   * @return {string} The LaTeX.
   */
  application(name: string, args: any[], role: any): string {
    const e = this.table ? this.table.notationOf(name) : null;
    if (e && e.form !== "constant" && args && e.arity === args.length) {
      return this.applyNotation(e, args).tex;
    }
    const head = this.ident(name, role);
    return args === null ? head : head + "(" + args.map(a => a.tex).join(", ") + ")";
  }

  /**
   * Shows how a symbol of some arity is written, with x_1, x_2 for its
   * arguments.
   *
   * @param {string} name The symbol.
   * @param {number} arity Its arity.
   * @param {Object} role Its role.
   * @return {string} The LaTeX.
   */
  symbolPreview(name: string, arity: number, role: any): string {
    const args = Array.from({ length: arity }, (_, i) => ({ tex: "x_{" + (i + 1) + "}", level: NotationWriter.ATOM }));
    const e = this.table ? this.table.notationOf(name) : null;
    
    if (e && e.form === "constant") {
      return e.tex;
    }
    
    if (e && e.arity === arity && arity > 0) {
      return this.applyNotation(e, args).tex;
    }
    
    return arity ? this.application(name, args, role) : this.ident(name, role);
  }
}
// ----------------------------------------------------------------
