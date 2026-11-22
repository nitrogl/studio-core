/**
 * Pretty-printing hints written in the comments of a model or in a .pp file.
 *
 * A hint is a "@word" inside a comment. When it gives no target, it applies
 * to the declaration (or the process action) that follows the comment:
 *
 * <pre>
 *    (* @infix '\|' *)                       binary function: x \| y
 *    fun concat(bitstring, bitstring): bitstring.
 *
 *    (* @notation '\left. #1 \right|_1' *)   template, #k is the k-th argument;
 *    equation forall a: t, b: t; fst(concat(a, b)) = a.     the target is fst
 * </pre>
 *
 * Deferred hints name their target explicitly. They go in any comment (for
 * example a block at the end of the model) or in a .pp file next to it:
 *
 * <pre>
 *    (**
 * Pretty printing
 * @infix '+' plus 6
 * @notation '^' exp
 * )
 * </pre>
 * 
 * where 6 is the optional binding level of parentheses.
 *
 * The hints:
 *
 * <pre>
 *    @notation 'tex' [target]      how a symbol is written; #1..#9 are its arguments.
 *                                  Without #k: a constant, a name, a type or a variable
 *                                  is written tex; a unary function is a prefix, a
 *                                  binary one an infix operator.
 *    @infix 'op' [target] [level]  binary function written "#1 op #2"
 *    @prefix 'op' [target] [level] unary function written "op #1"
 *    @postfix 'op' [target] [level] unary function written "#1 op"
 *    @label 'text' [target]        label of a process (party), a goal, an action
 *    @color 'css colour' [target]  colour of a party or an action
 *    @hide [target]                the party is not drawn
 *    @symmetric [target]           the process is drawn twice, mirrored
 *    @inout id                     before an output or an input: the arrow of a message
 *                                  joins the outputs and the inputs of the same id; once
 *                                  a model names one, the diagram draws these arrows only
 *    @convention kind 'tex'        a convention of the model (see Conventions.js), the
 *                                  notation of a builtin type among them: type:bitstring
 *    @library 'file'               a library that the model needs, which the studio
 *                                  loads with it (see libraries)
 * </pre>
 *
 * Quotes are single or double; a quote inside is written twice ('' or "").
 *
 * @author Roberto Metere
 * @license MIT
 */
class HintParser {
  /**
   * Hints and whether they take a quoted argument.
   *
   * @type {Object}
   */
  static KINDS = {
      notation: { quoted: true, level: false }
    , infix: { quoted: true, level: true }
    , prefix: { quoted: true, level: true }
    , postfix: { quoted: true, level: true }
    , label: { quoted: true, level: false }
    , color: { quoted: true, level: false }
    , hide: { quoted: false, level: false }
    , symmetric: { quoted: false, level: false }
    , convention: { quoted: true, level: false, keyFirst: true }
    , inout: { quoted: false, level: false, id: true }
  };

  /**
   * Lists the files that a model names with @library hints in its comments,
   * in their order, once each: the libraries that it needs.
   *
   * @param {Array<Object>} comments The comments of the model, [{text,
   *   start}].
   * @return {Array<Object>} The files, {name, start, end}: the name as the
   *   model writes it, and where the hint is.
   */
  static libraries(comments: any[]) {
    const found = [];
    (comments || []).forEach(comment => {
      const pattern = /@library\s+(?:'((?:[^']|'')*)'|"((?:[^"]|"")*)")/g;
      let m;
      while ((m = pattern.exec(comment.text || ""))) {
        const name = (m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2].replace(/""/g, "\"")).trim();
        if (name && !found.some(item => item.name === name)) {
          found.push({ name: name, start: (comment.start || 0) + m.index, end: (comment.start || 0) + m.index + m[0].length });
        }
      }
    });
    
    return found;
  }

  /**
   * Lists the hints of an analysed model and of an optional .pp text.
   *
   * @param {Analysis} analysis The Analysis of the model.
   * @param {Object} ppText The content of the .pp file, or ''.
   * @return {Object} {hints, problems}; a hint is {kind, value, target,
   *   targetNode, level, key, origin, start, end}.
   */
  static collect(analysis: any, ppText: any = "") {
    const hints = [];
    const problems = [];
    const owners = HintParser.owners(analysis);
    for (const c of analysis.comments || []) {
      if (!c.text.includes("@")) {
        continue;
      }
      if (StudioMeta.isMeta(c.text)) {
        continue;
      }
      const owner = owners.get(c.start) || null;
      HintParser.parseText(c.text, c.start, owner, "model", hints, problems);
    }
    if (ppText) {
      HintParser.parseText(ppText, 0, null, "pp", hints, problems);
    }
    return { hints, problems };
  }

  /**
   * Maps the start of each leading comment to what it describes, as the
   * application tells (StudioCore.app.hintOwners).
   *
   * @param {Object} analysis The analysis of the model.
   * @return {Map} Map from comment start to {kind: 'decl' | 'action', node,
   *   index, path}.
   */
  static owners(analysis: any): Map<any, any> {
    return StudioCore.app.hintOwners ? StudioCore.app.hintOwners(analysis) : new Map();
  }

  /**
   * Reads the hints of one comment or of a .pp text.
   *
   * @param {string} text The text.
   * @param {number} base The offset of the text in the model (for locations).
   * @param {Object} owner What the comment describes, or null.
   * @param {Object} origin 'model' or 'pp'.
   * @param {Object} hints The array to fill.
   * @param {Array} problems The array of problems to fill.
   */
  static parseText(text: string, base: number, owner: any, origin: any, hints: any, problems: any[]) {
    const re = /@([A-Za-z]+)\b/g;
    let m;
    while ((m = re.exec(text))) {
      const kind = m[1];
      const spec = HintParser.KINDS[kind];
      const start = base + m.index;
      if (!spec) {
        continue;
      }
      let i = m.index + m[0].length;
      const hint = { kind, value: null, target: null, targetNode: null, level: null, key: null, origin, owner, start, end: base + i };
      const skip = () => {
        while (i < text.length && /[ \t]/.test(text[i])) {
          i++;
        }
      };
      if (spec.keyFirst) {
        skip();
        // A convention, or the notation of a builtin type: type:bitstring
        const km = /^[A-Za-z][A-Za-z0-9_]*(:[A-Za-z_][A-Za-z0-9_']*)?/.exec(text.slice(i));
        if (!km) {
          problems.push({ severity: "warning", message: I18n.t("@{kind}: the name of a convention is expected", { kind: kind }), start, end: base + i });
          continue;
        }
        hint.key = km[0];
        i += km[0].length;
      }
      if (spec.id) {
        skip();
        const im = /^[A-Za-z0-9_][A-Za-z0-9_']*/.exec(text.slice(i));
        if (!im) {
          problems.push({ severity: "warning", message: I18n.t("@{kind}: a name is expected, the same on an output and on the inputs that receive it", { kind: kind }), start, end: base + i });
          continue;
        }
        hint.key = im[0];
        hint.end = base + i + im[0].length;
        hints.push(hint);
        continue;
      }
      if (spec.quoted) {
        skip();
        const q = text[i];
        if (q !== "'" && q !== "\"") {
          problems.push({ severity: "warning", message: kind === "color" ? I18n.t("@{kind}: a quoted colour is expected", { kind: kind }) : I18n.t("@{kind}: a quoted text is expected", { kind: kind }), start, end: base + i });
          continue;
        }
        let j = i + 1;
        let value = "";
        for (;;) {
          if (j >= text.length) {
            break;
          }
          if (text[j] === q) {
            if (text[j + 1] === q) {
              value += q;
              j += 2;
              continue;
            }
            break;
          }
          value += text[j];
          j++;
        }
        if (j >= text.length) {
          problems.push({ severity: "warning", message: I18n.t("@{kind}: the quote is not closed", { kind: kind }), start, end: base + text.length });
          continue;
        }
        hint.value = value;
        i = j + 1;
      }
      
      // an optional explicit target, then an optional level, on the same line
      skip();
      const tm = /^[A-Za-z][A-Za-z0-9_']*/.exec(text.slice(i));
      if (tm && !/^(is|for|of|the|a|an)$/.test(tm[0])) {
        hint.target = tm[0];
        hint.targetNode = { name: tm[0], start: base + i, end: base + i + tm[0].length };
        i += tm[0].length;
        skip();
      }
      if (spec.level) {
        const lm = /^[0-9]+/.exec(text.slice(i));
        if (lm) {
          hint.level = Number(lm[0]);
          i += lm[0].length;
        }
      }
      hint.end = base + i;
      
      // the comment explains its own syntax ("... is a short for @notation ..."): I keep only the first hint of a line
      hints.push(hint);
      const nl = text.indexOf("\n", i);
      const rest = nl < 0 ? text.slice(i) : text.slice(i, nl);
      if (/@[A-Za-z]/.test(rest) && /short|same as|equivalent|means/i.test(rest)) {
        re.lastIndex = nl < 0 ? text.length : nl;
      }
    }
  }

  /**
   * Finds the symbol a hint without explicit target applies to.
   *
   * @param {Object} hint The hint.
   * @return {Object} {name, kind} or null; kind is the kind of the
   *   declaration, which the application finds (StudioCore.app.hintTarget).
   */
  static inferTarget(hint: any) {
    const o = hint.owner;
    if (!o) {
      return null;
    }
    if (o.kind === "action") {
      return { name: null, kind: "action", path: o.path, node: o.node };
    }
    
    return StudioCore.app.hintTarget ? StudioCore.app.hintTarget(o) : null;
  }

  /**
   * Writes a hint as the text of a comment (the inverse of parseText for one
   * hint).
   *
   * @param {string} kind The hint.
   * @param {string} value Its quoted value, or null.
   * @param {Object} target An explicit target, or null.
   * @return {Object} The comment, with the delimiters of the language, for
   *   example "(* @notation '\\mathsf{H}' *)".
   */
  static format(kind: string, value: string, target: any = null) {
    const q = value === null || value === undefined ? "" : " '" + String(value).replace(/'/g, "''") + "'";
    
    return StudioCore.comment("@" + kind + q + (target ? " " + target : ""));
  }
}
// ----------------------------------------------------------------
