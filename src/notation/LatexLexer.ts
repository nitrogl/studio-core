/**
 * Tokens of the LaTeX math of the Design mode, normalised so that templates
 * and input compare.
 * 
 *
 * Reads both the templates (conventions and @notation hints) and what the
 * user types. Normalising both the same way is what lets a template match a
 * text: spacing commands and size modifiers disappear, "\left(" is "(", "x_1"
 * is "x_{1}", "\mathsf{senc}" is one word token, "{#1}" is "#1" in a
 * template, "\htmlClass{st-type}{T}" is T, and "\htmlClass{st-raw}{\mathtt{...}}"
 * is raw code of the model ("\class" works as "\htmlClass").
 *
 * Token: {t, v, sp, start, end}; t is one of
 *
 *   'cmd'    a command such as "\leftarrow" (v = "\leftarrow")
 *   'sym'    a backslash and one symbol such as "\|" or "\{" (v = "\|")
 *   'word'   a styled word: "\mathsf{senc}" (v = 'senc', style = "\mathsf")
 *   'letter' one letter, 'digits' a run of digits, 'char' one character
 *   '{' '}' '^' '_'
 *   'hole'   #1..#9 (v = 1..9), #* (v = '*'), # (v = 0) in templates only
 *   'raw'    raw code of the model (v = the code)
 *
 * sp is true when spacing preceded the token.
 *
 * @author Roberto Metere
 * @license MIT
 */
class LatexLexer {
  /**
   * Commands that only change the spacing.
   *
   * @type {Set<string>}
   */
  static SPACING: Set<string> = new Set(["\\,", "\\;", "\\:", "\\!", "\\ ", "\\quad", "\\qquad", "\\enspace", "\\thinspace", "\\medspace", "\\thickspace", "\\space", "\\>", "\\nobreakspace"]);

  /**
   * Commands that only change the size of the next delimiter.
   *
   * @type {Set<string>}
   */
  static SIZES: Set<string> = new Set(["\\big", "\\Big", "\\bigg", "\\Bigg", "\\bigl", "\\bigr", "\\bigm", "\\Bigl", "\\Bigr", "\\Bigm", "\\biggl", "\\biggr", "\\biggm", "\\Biggl", "\\Biggr", "\\Biggm", "\\displaystyle", "\\textstyle", "\\scriptstyle"]);

  /**
   * Commands that style a word: their argument is an identifier or a keyword.
   *
   * @type {Set<string>}
   */
  static WORDS: Set<string> = new Set(["\\mathsf", "\\mathit", "\\mathrm", "\\mathtt", "\\mathbf", "\\mathcal", "\\mathbb", "\\mathfrak", "\\boldsymbol", "\\text", "\\textsf", "\\textit", "\\textrm", "\\texttt", "\\textbf", "\\operatorname"]);

  /**
   * Delimiters that \left and \right only resize.
   *
   * @type {Set<string>}
   */
  static PLAIN_DELIMS: Set<string> = new Set(["(", ")", "[", "]", "\\langle", "\\rangle", "\\{", "\\}", "\\lbrack", "\\rbrack"]);

  /**
   * Synonyms mapped to one spelling.
   *
   * @type {Object}
   */
  static SYNONYMS = {
    "\\lbrack": "[", "\\rbrack": "]", "\\ne": "\\neq", "\\le": "\\leq", "\\ge": "\\geq", "\\wedge": "\\land", "\\vee": "\\lor",
    "\\lnot": "\\neg", "\\gets": "\\leftarrow", "\\to": "\\rightarrow", "\\vert": "|", "\\mid": "|", "\\lvert": "|", "\\rvert": "|",
    "\\Vert": "\\|", "\\lVert": "\\|", "\\rVert": "\\|", "\\implies": "\\Longrightarrow", "\\colon": ":"
  };

  /**
   * Tokenises and normalise a text.
   *
   * @param {string} src The LaTeX.
   * @param {boolean} template True for templates (holes allowed, "{#1}"
   *   unwrapped).
   * @return {Object} {tokens, errors}.
   */
  static tokenize(src: string, template: boolean = false) {
    const lex = new LatexLexer(src, template);
    lex.scan();
    lex.balance();
    return { tokens: lex.normalize(lex.tokens), errors: lex.errors };
  }

  /**
   * Checks that the braces of the groups match, as TeX would.
   */
  balance() {
    const open = [];
    for (const t of this.tokens) {
      if (t.t === "{") {
        open.push(t);
      } else if (t.t === "}" && !open.pop()) {
        this.errors.push({ message: I18n.t("a brace } closes no {"), start: t.start, end: t.end });
        return;
      }
    }
    if (open.length) {
      this.errors.push({ message: I18n.t("a brace { is not closed"), start: open[0].start, end: this.src.length });
    }
  }

  src: string;
  template: boolean;
  pos: number;
  tokens: any[];
  errors: any[];
  space: boolean;

  /**
   * Prepares the scan of a text.
   *
   * @param {string} src The LaTeX.
   * @param {boolean} template True for templates.
   */
  constructor(src: string, template: boolean) {
    this.src = String(src === undefined || src === null ? "" : src);
    this.template = template;
    this.pos = 0;
    this.tokens = [];
    this.errors = [];
    this.space = false;
  }

  /**
   * Adds a token.
   *
   * @param {Object} t Its type.
   * @param {Object} v Its value.
   * @param {number} start Its first offset.
   * @param {Object} extra More fields.
   */
  push(t: any, v: any, start: number, extra: any = {}) {
    this.tokens.push({ t, v, sp: this.space, start, end: this.pos, ...extra });
    this.space = false;
  }

  /**
   * Reads the content of a braced group starting at the current position
   * (after "{").
   *
   * @return {Object} The raw text of the group, braces balanced.
   */
  readGroupText() {
    let depth = 1;
    const start = this.pos;
    while (this.pos < this.src.length) {
      const c = this.src[this.pos];
      if (c === "\\") {
        this.pos += 2;
        continue;
      }
      if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;

        if (depth === 0) {
          break;
        }
      }
      this.pos++;
    }
    const text = this.src.slice(start, this.pos);
    if (this.pos < this.src.length) {
      this.pos++;
    } else {
      this.errors.push({ message: I18n.t("a brace { is not closed"), start: start - 1, end: this.src.length });
    }
    return text;
  }

  /**
   * Skips spaces and read a braced argument, or a single character.
   *
   * @return {string} The text of the argument, or null when there is none.
   */
  readArgument(): string {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) {
      this.pos++;
    }
    if (this.src[this.pos] === "{") {
      this.pos++;
      return this.readGroupText();
    }
    if (this.pos < this.src.length) {
      return this.src[this.pos++];
    }
    return null;
  }

  /**
   * Unescapes the text of a styled word (\_ is _, spaces vanish).
   *
   * @param {string} s The text.
   * @return {string} The word.
   */
  static unescapeWord(s: string): string {
    return s.replace(/\\_/g, "_").replace(/\\([{}#$%&])/g, "$1").replace(/\\[,;:! ]/g, "").replace(/\{([^{}]*)\}/g, "$1").replace(/\s+/g, "");
  }

  /**
   * Unescapes raw code written in "\mathtt" ("\_" is _, "\ " is a
   * space).
   *
   * @param {string} s The text.
   * @return {string} The code.
   */
  static unescapeRaw(s: string): string {
    return s.replace(/\\textbackslash(\{\})?/g, "\u0000").replace(/\\hat\{\}/g, "^").replace(/\\ /g, " ").replace(/\\_/g, "_")
      .replace(/\\([{}#$%&])/g, "$1").replace(/~/g, " ").replace(/\u0000/g, "\\");
  }

  /**
   * Scans the whole text into raw tokens.
   */
  scan() {
    const s = this.src;
    while (this.pos < s.length) {
      const start = this.pos;
      const c = s[this.pos];
      if (/\s/.test(c)) {
        this.pos++;
        this.space = true;
        continue;
      }
      if (c === "%") {
        while (this.pos < s.length && s[this.pos] !== "\n") {
          this.pos++;
        }

        continue;
      }
      if (c === "\\") {
        const m = /^\\([A-Za-z]+)/.exec(s.slice(this.pos));
        if (m) {
          this.pos += m[0].length;
          const name = "\\" + m[1];
          if (LatexLexer.WORDS.has(name)) {
            const arg = this.readArgument();
            this.push("word", LatexLexer.unescapeWord(arg === undefined || arg === null ? "" : arg), start, { style: name, raw: arg === undefined || arg === null ? "" : arg });
            continue;
          }
          if (name === "\\class" || name === "\\htmlClass") {
            const cls = this.readArgument();
            if (cls === "st-raw") {
              let body = this.readArgument() || "";
              const tt = /^\s*\\mathtt\s*\{([\s\S]*)\}\s*$/.exec(body);
              if (tt) {
                body = tt[1];
              }
              this.push("raw", LatexLexer.unescapeRaw(body), start);
              continue;
            }
            // other classes only colour or frame their argument: I keep the argument as a group
            this.push("{", "{", start, { implicit: true });
            this.skipSpaces();
            if (s[this.pos] === "{") {
              this.pos++;
              const inner = LatexLexer.tokenize(this.readGroupText(), this.template).tokens;
              this.tokens.push(...inner.map(t => ({ ...t, start: t.start + start, end: t.end + start })));
            }
            this.push("}", "}", this.pos, { implicit: true });
            continue;
          }
          if (name === "\\textcolor" || name === "\\colorbox") {
            this.readArgument();
            continue;
          }
          if (name === "\\color") {
            this.readArgument();
            continue;
          }
          if (name === "\\hspace" || name === "\\kern" || name === "\\mspace") {
            this.readArgument();
            this.space = true;
            continue;
          }
          if (LatexLexer.SPACING.has(name)) {
            this.space = true;
            continue;
          }
          this.push("cmd", LatexLexer.SYNONYMS[name] === undefined || LatexLexer.SYNONYMS[name] === null ? name : LatexLexer.SYNONYMS[name], start);
          continue;
        }
        const two = s.slice(this.pos, this.pos + 2);
        this.pos += 2;
        if (LatexLexer.SPACING.has(two)) {
          this.space = true;
          continue;
        }
        const v = LatexLexer.SYNONYMS[two] === undefined || LatexLexer.SYNONYMS[two] === null ? two : LatexLexer.SYNONYMS[two];
        this.push("sym", v, start);
        continue;
      }
      if (c === "~") {
        this.pos++;
        this.space = true;
        continue;
      }
      if (c === "{" || c === "}" || c === "^" || c === "_") {
        this.pos++;
        this.push(c, c, start);
        continue;
      }
      if (c === "#" && this.template) {
        this.pos++;
        const d = s[this.pos];
        if (d && /[1-9]/.test(d)) {
          this.pos++;
          this.push("hole", Number(d), start);
          continue;
        }
        if (d === "*") {
          this.pos++;
          this.push("hole", "*", start);
          continue;
        }
        this.push("hole", 0, start);
        continue;
      }
      if (/[0-9]/.test(c)) {
        while (this.pos < s.length && /[0-9]/.test(s[this.pos])) {
          this.pos++;
        }
        this.push("digits", s.slice(start, this.pos), start);
        continue;
      }
      if (/[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff]/.test(c)) {
        this.pos++;
        this.push("letter", c, start);
        continue;
      }
      this.pos++;
      if (c === "\u2190") {
        this.push("cmd", "\\leftarrow", start);
        continue;
      }
      this.push("char", c, start);
    }
  }

  /**
   * Skips spaces.
   */
  skipSpaces() {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) {
      this.pos++;
    }
  }

  /**
   * Normalises raw tokens: sizes, "\left" and "\right", scripts and holes in
   * braces.
   *
   * @param {Array} toks The raw tokens.
   * @return {Object} The normalised tokens.
   */
  normalize(toks: any[]) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === "cmd" && LatexLexer.SIZES.has(t.v)) {
        if (toks[i + 1]) {
          toks[i + 1] = { ...toks[i + 1], sp: toks[i + 1].sp || t.sp };
        }
        continue;
      }
      if (t.t === "cmd" && (t.v === "\\left" || t.v === "\\right")) {
        const d = toks[i + 1];
        if (!d) {
          continue;
        }
        i++;
        const dv = d.v;
        if (LatexLexer.PLAIN_DELIMS.has(dv)) {
          out.push({ ...d, v: LatexLexer.SYNONYMS[dv] === undefined || LatexLexer.SYNONYMS[dv] === null ? dv : LatexLexer.SYNONYMS[dv], sp: t.sp, start: t.start });
        } else {
          out.push({ t: "cmd", v: String(t.v) + dv, sp: t.sp, start: t.start, end: d.end });
        }
        continue;
      }
      out.push(t);
    }
    // x_1 is x_{1}: a script applies to one token or one group, I make the group explicit
    const res = [];
    for (let i = 0; i < out.length; i++) {
      const t = out[i];
      res.push(t);
      if ((t.t === "_" || t.t === "^") && out[i + 1] && out[i + 1].t !== "{") {
        const n = out[i + 1];
        let parts = [n];
        // "_\mathsf{x}" or "_x" or "_12": one token; "_\class..." already gave a group
        if (n.t === "digits" && n.v.length > 1) {
          parts = [{ ...n, v: n.v[0], end: n.start + 1 }];
        }
        res.push({ t: "{", v: "{", sp: false, start: n.start, end: n.start, implicit: true });
        res.push(...parts.map(p => ({ ...p, sp: false })));
        res.push({ t: "}", v: "}", sp: false, start: n.end, end: n.end, implicit: true });
        if (n.t === "digits" && n.v.length > 1) {
          out[i + 1] = { ...n, v: n.v.slice(1), start: n.start + 1, sp: false };
        } else {
          i++;
        }
      }
    }
    if (!this.template) {
      return res;
    }
    // in templates, braces around a single hole only protect it: "{#1}" is "#1"
    const fin = [];
    for (let i = 0; i < res.length; i++) {
      const t = res[i];
      if (t.t === "{" && res[i + 1] && res[i + 1].t === "hole" && res[i + 2] && res[i + 2].t === "}" && !(i > 0 && (res[i - 1].t === "_" || res[i - 1].t === "^"))) {
        fin.push({ ...res[i + 1], sp: t.sp || res[i + 1].sp });
        i += 2;
        continue;
      }
      fin.push(t);
    }
    return fin;
  }

  /**
   * Tells whether two tokens are the same literal (the spacing does not
   * count).
   *
   * @param {Object} a A token.
   * @param {Object} b A token.
   * @return {boolean} True when equal.
   */
  static same(a: any, b: any): boolean {
    if (!a || !b) {
      return false;
    }
    if (a.t !== b.t) {
      return false;
    }
    return a.v === b.v;
  }
}
// ----------------------------------------------------------------
