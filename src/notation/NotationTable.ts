/**
 * The notation in force for a model: its hints, the conventions, and what
 * applies to each symbol.
 *
 * Resolves every hint to its target, check it against the declarations (arity
 * of functions, unknown names) and keep, for each symbol, how it is written.
 * NotationWriter, and the writer of each language built on it, work from the
 * table.
 *
 * The analysis of a model, from the application, gives global(name), the
 * declaration of a symbol ({kind, args, params}), check.symbols, the
 * symbols of the checker ({name, kind, builtin}), and comments.
 *
 * @author Roberto Metere
 * @license MIT
 */
class NotationTable {
  /**
   * Default binding levels of user operators (the operators of the
   * languages are below 12).
   * 
   * TODO: 
   *
   * @type {Object}
   */
  static LEVELS = { infix: 20, prefix: 70, postfix: 80 };

  /**
   * Builds the table of a model.
   *
   * @param {Analysis} analysis The Analysis of the model.
   * @param {Object} opts {pp: content of the .pp file, conventions:
   *   Conventions of the user}.
   * @return {Object} The table.
   */
  static build(analysis: any, { pp = "", conventions = null }: any = {}) {
    const t = new NotationTable(conventions || Conventions.load());
    if (analysis) {
      t.load(analysis, pp);
    }
    
    return t;
  }

  userConventions: any;
  conv: any;
  symbols: Map<any, any>;
  labels: Map<any, any>;
  colors: Map<any, any>;
  hidden: Set<any>;
  symmetric: Set<any>;
  inouts: Map<string, any>;
  problems: any[];
  hints: any[];
  analysis: any;

  /**
   * Starts an empty table.
   *
   * @param {Object} conventions The conventions of the user.
   */
  constructor(conventions: any) {
    this.userConventions = conventions;
    this.conv = conventions;
    this.symbols = new Map();
    this.labels = new Map();
    this.colors = new Map();
    this.hidden = new Set();
    this.symmetric = new Set();
    this.inouts = new Map();
    this.problems = [];
    this.hints = [];
    this.analysis = null;
  }

  /**
   * Gives the arity and kind of a symbol of the model.
   *
   * @param {string} name The identifier.
   * @return {Object} {arity, kind} or null when the model does not know it.
   */
  symbolInfo(name: string) {
    const a = this.analysis;
    if (!a) {
      return null;
    }
    
    const g = a.global(name);
    if (g) {
      switch (g.kind) {
        case "fun":
        case "letfun":
        case "pred":
          return { arity: g.args.length, kind: g.kind };
          
        case "event":
        case "table":
          return { arity: g.args.length, kind: g.kind };
        
        case "process":
          return { arity: (g.params || []).length, kind: "process" };
        
        case "name":
        case "type":
        default:
          return { arity: 0, kind: g.kind };
      }
    }
    
    for (const s of a.check.symbols.values()) {
      if (s.name === name && !s.builtin) {
        return { arity: 0, kind: s.kind };
      }
    }
    
    // A builtin type of the language, which has a convention of its own
    if (Object.prototype.hasOwnProperty.call(Conventions.DEFAULTS, Conventions.typeKey(name))) {
      return { arity: 0, kind: "type" };
    }
    
    return null;
  }

  /**
   * Reads the hints of a model and of its .pp text.
   *
   * @param {Analysis} analysis The Analysis.
   * @param {Object} pp The .pp text.
   */
  load(analysis: any, pp: any) {
    this.analysis = analysis;
    const { hints, problems } = HintParser.collect(analysis, pp);
    this.hints = hints;
    this.problems.push(...problems);
    const overrides = {};
    
    for (const h of hints) {
      if (h.kind === "convention") {
        if (!Object.prototype.hasOwnProperty.call(Conventions.DEFAULTS, h.key)) {
          this.warn(h, I18n.t("@convention: unknown convention {name}", { name: h.key }));
        } else {
          overrides[h.key] = h.value;
        }
      }
    }
    
    if (Object.keys(overrides).length) {
      this.conv = this.userConventions.with(overrides);
    }
    
    for (const h of hints) {
      if (h.kind === "convention") {
        continue;
      }
      if (h.kind === "inout") {
        this.addInout(h);
        continue;
      }

      const target = h.target ? { name: h.target, kind: "named" } : HintParser.inferTarget(h);
      if (!target) {
        this.warn(h, h.origin === "pp" ? I18n.t("@{kind} in a .pp file needs an explicit target", { kind: h.kind })
          : I18n.t("@{kind}: I cannot tell what this hint applies to; name its target after it", { kind: h.kind }));
        continue;
      }
      
      if (["notation", "infix", "prefix", "postfix"].includes(h.kind)) {
        this.addNotation(h, target);
      } else {
        this.addDecoration(h, target);
      }
    }
    this.checkInouts();
  }

  /**
   * Records the name that an @inout hint gives to the output or the input
   * after its comment.
   *
   * @param {Object} h The hint.
   */
  addInout(h: any) {
    const target = HintParser.inferTarget(h);
    const side = target && target.kind === "action" && StudioCore.app.messageSide ? StudioCore.app.messageSide(target.node) : null;
    if (!side) {
      this.warn(h, I18n.t("@inout goes in a comment just before an output or an input"));
      return;
    }
    this.inouts.set("action:" + target.path.join("."), { name: h.key, side: side, hint: h });
  }

  /**
   * Warns of the names of @inout that only outputs, or only inputs, have.
   */
  checkInouts() {
    const sides = new Map();
    this.inouts.forEach(entry => {
      sides.set(entry.name, (sides.get(entry.name) || new Set()).add(entry.side));
    });
    this.inouts.forEach(entry => {
      if (!sides.get(entry.name).has("in")) {
        this.warn(entry.hint, I18n.t("@inout {name}: no input has this name", { name: entry.name }));
      } else if (!sides.get(entry.name).has("out")) {
        this.warn(entry.hint, I18n.t("@inout {name}: no output has this name", { name: entry.name }));
      }
    });
  }

  /**
   * Records a problem with a hint.
   *
   * @param {Object} h The hint.
   * @param {string} message The message.
   */
  warn(h: any, message: string) {
    this.problems.push({ severity: "warning", message, start: h.start, end: h.end, source: "notation", origin: h.origin });
  }

  /**
   * Records how a symbol is written.
   *
   * @param {Object} h The hint.
   * @param {Object} target {name, names?, kind}.
   */
  addNotation(h: any, target: any) {
    if (target.kind === "action") {
      this.decorate("action", target.path.join("."), h);
      return;
    }
    const names = target.names || [target.name];
    for (const name of names) {
      const info = this.symbolInfo(name);
      if (!info && h.target) {
        this.warn(h, I18n.t("@{kind}: {name} is not declared", { kind: h.kind, name: name }));
      }
      const arity = info ? info.arity : 0;
      const entry = this.makeEntry(h, name, arity, info ? info.kind : null);
      
      if (!entry) {
        continue;
      }
      
      if (this.symbols.has(name) && this.symbols.get(name).origin === "model" && h.origin === "pp") {
        continue;
      }
      
      this.symbols.set(name, entry);
    }
  }

  /**
   * Builds the notation entry of a symbol.
   *
   * @param {Object} h The hint.
   * @param {string} name The symbol.
   * @param {number} arity Its arity.
   * @param {string} symKind The kind of the symbol (fun, name, type, event,
   *   ...).
   * @return {Object} {name, arity, form, tex, tokens, level, symKind, origin}
   *   or null.
   */
  makeEntry(h: any, name: string, arity: number, symKind: string) {
    let form = h.kind;
    let tex = h.value || "";
    const holes = (tex.match(/#[1-9]/g) || []).map(x => Number(x[1]));
    
    if (form === "notation" && !holes.length) {
      switch (arity) {
        case 0:
          form = "constant";
          break;
          
        case 1:
          form = "prefix";
          break;
          
        case 2:
          form = "infix";
          break;
          
        default:
          form = "function";
          break;
      };
    }
    
    switch (form) {
      case "infix":
        if (arity !== 2 && symKind) {
          this.warn(h, I18n.n("@{kind}: {name} has {count} argument; an infix notation needs 2", "@{kind}: {name} has {count} arguments; an infix notation needs 2", arity, { kind: h.kind, name }));
        }
        tex = "{#1} " + h.value + " {#2}";
        break;
        
      case "prefix":
        if (arity !== 1 && symKind) {
          this.warn(h, I18n.n("@{kind}: {name} has {count} argument; a prefix notation needs 1", "@{kind}: {name} has {count} arguments; a prefix notation needs 1", arity, { kind: h.kind, name }));
        }
        tex = h.value + " {#1}";
        break;
        
      case "postfix":
        if (arity !== 1 && symKind) {
          this.warn(h, I18n.n("@{kind}: {name} has {count} argument; a postfix notation needs 1", "@{kind}: {name} has {count} arguments; a postfix notation needs 1", arity, { kind: h.kind, name }));
        }
        tex = "{#1} " + h.value;
        break;
        
      case "function":
        tex = h.value + "(" + Array.from(
          { length: arity },
          (_, i) => "{#" + (i + 1) + "}"
        ).join(", ") + ")";
        form = "notation";
        break;
        
      case "notation": {
        const max = Math.max(...holes);
        if (symKind && max > arity) {
          this.warn(h, I18n.n("@notation: {name} has {count} argument but the notation uses #{hole}", "@notation: {name} has {count} arguments but the notation uses #{hole}", arity, { name, hole: max }));
        }
        break;
      }
    }
    
    const lexed = LatexLexer.tokenize(tex, true);
    if (lexed.errors.length) {
      this.warn(h, "@" + h.kind + ": " + lexed.errors[0].message);
      return null;
    }
    
    // Cool, but I ain't gonna understand easily, split it to a var level?
    const level = h.level === undefined || h.level === null ? (form === "infix" ? NotationTable.LEVELS.infix : form === "prefix" ? NotationTable.LEVELS.prefix : form === "postfix" ? NotationTable.LEVELS.postfix : 100) : h.level;
    return { name, arity, form, tex, tokens: lexed.tokens, level, symKind, origin: h.origin, hint: h };
  }

  /**
   * Records a label, a colour, a hidden or a mirrored element.
   *
   * @param {Object} h The hint.
   * @param {Object} target {name} or {kind: 'action', path} or {kind:
   *   'QueryDecl', index}.
   */
  addDecoration(h: any, target: any) {
    if (target.kind === "action") {
      this.decorate("action", target.path.join("."), h);
      return;
    }
    if (target.name) {
      this.decorate("symbol", target.name, h);
      return;
    }
    if (target.index !== undefined) {
      this.decorate("decl", String(target.index), h);
    }
  }

  /**
   * Stores one decoration under a key.
   *
   * @param {string} scope 'symbol', 'decl' or 'action'.
   * @param {number} id The name, the index of the declaration or the path of
   *   the action.
   * @param {Object} h The hint.
   */
  decorate(scope: string, id: string, h: any) {
    const key = scope + ":" + id;
    switch (h.kind) {
      case "label":
        this.labels.set(key, h.value);
        break;
        
      case "color":
        this.colors.set(key, h.value);
        break;
        
      case "hide":
        this.hidden.add(key); 
        break;
        
      case "symmetric":
        this.symmetric.add(key);
        break;
        
      case "notation":
      case "infix":
      case "prefix":
      case "postfix": {
          const lexed = LatexLexer.tokenize(h.value || "", true);
          this.labels.set(key + "#tex", h.value);
          if (lexed.errors.length) {
            this.warn(h, "@" + h.kind + ": " + lexed.errors[0].message);
          }
        }
        break;
        
      default:
        break;
    }
  }

  /**
   * Gives the notation of a symbol.
   *
   * @param {string} name The identifier.
   * @return {Object} The entry or undefined.
   */
  notationOf(name: string) {
    return this.symbols.get(name);
  }

  /**
   * Gives the label of a process, a declaration or an action.
   *
   * @param {string} scope 'symbol', 'decl' or 'action'.
   * @param {number} id The identifier, index or path.
   * @return {string} The label or undefined.
   */
  label(scope: string, id: number): string {
    return this.labels.get(scope + ":" + id);
  }

  /**
   * Gives the colour of an element.
   *
   * @param {string} scope 'symbol', 'decl' or 'action'.
   * @param {number} id The identifier, index or path.
   * @return {Object} The colour or undefined.
   */
  color(scope: string, id: number) {
    return this.colors.get(scope + ":" + id);
  }

  /**
   * Tells whether an element is hidden in the diagram.
   *
   * @param {string} scope 'symbol', 'decl' or 'action'.
   * @param {number} id The identifier, index or path.
   * @return {boolean} True when hidden.
   */
  isHidden(scope: string, id: number): boolean {
    return this.hidden.has(scope + ":" + id);
  }

  /**
   * Tells whether a process is shown mirrored by a hint.
   *
   * @param {string} name The process.
   * @return {boolean} True when @symmetric applies.
   */
  isSymmetric(name: string): boolean {
    return this.symmetric.has("symbol:" + name);
  }

  /**
   * Gives the name that an @inout hint gives to an output or an input.
   *
   * @param {string} path The path of the action.
   * @return {string} The name, or undefined.
   */
  inout(path: string): string {
    const entry = this.inouts.get("action:" + path);
    return entry ? entry.name : undefined;
  }

  /**
   * Tells whether the model names its messages with @inout hints, so that
   * the diagram draws those arrows only.
   *
   * @return {boolean} True when an output or an input has a name.
   */
  hasInouts(): boolean {
    return this.inouts.size > 0;
  }

  /**
   * Pairs the outputs and the inputs that @inout hints name: each output
   * goes to the inputs of the same name, except those of its own process.
   *
   * @param {Array<Object>} blocks The outputs and the inputs of the diagram,
   *   {path, party}: the path of the action, and the process that runs it,
   *   when copies of a process run the same actions (or undefined).
   * @return {Array<Object>} The messages, {from, to, name}: the block of
   *   the output, the block of the input, and their name.
   */
  namedLinks(blocks: any[]) {
    const named = blocks.map(block => ({ block: block, entry: this.inouts.get("action:" + block.path.join(".")) })).filter(item => item.entry);
    const links = [];
    named.filter(item => item.entry.side === "out").forEach(output => {
      named.filter(item => item.entry.side === "in" && item.entry.name === output.entry.name).forEach(input => {
        if (output.block.party === undefined || output.block.party !== input.block.party) {
          links.push({ from: output.block, to: input.block, name: output.entry.name });
        }
      });
    });
    return links;
  }

  /**
   * Lists the notations whose template starts with a literal token (prefix or
   * closed forms).
   *
   * @return {Array} The entries.
   */
  nudEntries() {
    return [...this.symbols.values()].filter(e => e.tokens.length && e.tokens[0].t !== "hole");
  }

  /**
   * Lists the notations whose template starts with #1 (infix and postfix
   * forms).
   *
   * @return {Array} The entries.
   */
  ledEntries() {
    return [...this.symbols.values()].filter(e => e.tokens.length > 1 && e.tokens[0].t === "hole");
  }
}
// ----------------------------------------------------------------
