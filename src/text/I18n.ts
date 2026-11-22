/**
 * The translations of the interface.
 * This documentation is a little long because someone external to this
 * project may want to just translate it to another language but without
 * having technical skills.
 * On the other hand, a developer may want to know how to write a piece
 * of text that is supposed to be translateable.
 *
 * The messages are written in English in the code, and each language gives
 * their translations in a PO file, the format of gettext that most tools of
 * translation read and write.
 * A message may hold placeholders, {name}, that the code fills, and
 * a message that depends on a number has a plural (msgid_plural):
 * nplurals forms, and plural, an expression of n in the syntax of C that
 * gives the form for n.
 *
 * The code marks its messages:
 *
 *   I18n.t("Save the model")
 *   I18n.t("{count} goals", { count: 3 })
 *   I18n.n("{count} goal", "{count} goals", n)
 *   I18n.mark("Settings")
 *
 * and the page marks its elements: data-i18n translates the text of an
 * element (not that of its children) and its title, placeholder and
 * aria-label, or only the attributes that it lists (data-i18n="title");
 * data-i18n-html translates its whole content, whose tags and links a
 * translation keeps.
 *
 * A message that has no translation shows in English. The same class reads
 * and writes PO files, for the studio (a translation loaded by the user)
 * and for the scripts (the template, the languages that the studio ships).
 * It also brings a PO file up to date with the messages and writes the
 * script of the languages, lang/languages.js, as the build of the
 * translations does: a studio gives that script itself, so that a language
 * reaches everyone without any tool (see LanguagePane).
 *
 * @author Roberto Metere
 * @license MIT
 */
class I18n {
  /**
   * The language of the messages in the code.
   *
   * @type {string}
   */
  static SOURCE = "en";

  /**
   * The Plural-Forms of English, the language of the code.
   *
   * @type {string}
   */
  static ENGLISH_PLURAL = "nplurals=2; plural=(n != 1);";

  /**
   * The attributes of an element marked data-i18n that are translated with
   * its text.
   *
   * @type {Array<string>}
   */
  static ATTRIBUTES: string[] = ["title", "placeholder", "aria-label"];

  /**
   * The elements of HTML that a message may hold: review checks that a
   * translation brings no other, and reads the rest, such as "proverif
   * <file>", as text.
   *
   * @type {Set<string>}
   */
  static HTML: Set<string> = new Set(["a", "abbr", "b", "br", "code", "em", "i", "kbd", "li", "ol", "p", "pre", "q", "s", "small", "span", "strong", "sub", "sup", "u", "ul"]);

  /**
   * The elements of HTML that have no content, for the reading of a page.
   *
   * @type {Set<string>}
   */
  static VOID: Set<string> = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

  /**
   * The named characters of HTML that a page may use, and their values.
   *
   * @type {Object<string, string>}
   */
  static ENTITIES: Record<string, string> = {
      amp: "&"
    , lt: "<"
    , gt: ">"
    , quot: "\""
    , apos: "'"
    , nbsp: String.fromCharCode(160)
    , copy: String.fromCharCode(169)
    , times: String.fromCharCode(215)
    , agrave: String.fromCharCode(224)
    , egrave: String.fromCharCode(232)
    , eacute: String.fromCharCode(233)
    , igrave: String.fromCharCode(236)
    , ograve: String.fromCharCode(242)
    , ugrave: String.fromCharCode(249)
    , hellip: String.fromCharCode(8230)
    , larr: String.fromCharCode(8592)
    , rarr: String.fromCharCode(8594)
  };

  /**
   * What the template of a translation says to whoever fills it in, as
   * comments at the top of the file.
   *
   * @type {Array<string>}
   */
  static INSTRUCTIONS: string[] = [
      "For each message, msgid is the English text and msgstr its translation:"
    , "write the translation between the quotes of msgstr, and leave msgid as"
    , "it is. Keep the placeholders in braces, such as {count}, which the"
    , "studio fills in, and the tags of the messages that have some, such as"
    , "<b>...</b>. A message left empty, '', shows in English."
    , ""
    , "In the header below, write the code of the language after Language"
    , "(zh for Chinese, fr for French, es for Spanish...), its name in the"
    , "language itself after X-Language-Name, and its plural forms after"
    , "Plural-Forms, for instance:"
    , "  Chinese, Japanese, Korean, Vietnamese    nplurals=1; plural=0;"
    , "  English, German, Italian, Spanish        nplurals=2; plural=(n != 1);"
    , "  French, Portuguese of Brazil             nplurals=2; plural=(n > 1);"
    , " (see https://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html)"
    , "A message with a plural (msgid_plural) has a msgstr[0], msgstr[1]... for"
    , "each form. Poedit (poedit.net) does all of this with a form."
    , ""
    , "Load the file in {app} (View, Language, Load a translation) to see the"
    , "interface in the new language at once, as often as needed. Then send"
    , "it to whoever maintains {app}: they load it in the same way, and put it"
    , "in the folder lang/, next to the page, with the languages.js that {app}"
    , "then gives, and the language is there for everyone."
  ];

  /**
   * The notice of the script of the languages: the name and the version of
   * the studio, the author and the licence of the script, which a script
   * written again by the page carries too (see toScript).
   *
   * @type {Object}
   */
  static notice = { project: "", author: "Roberto Metere", license: "MIT" };

  /**
   * The languages that the studio knows, by the code in lower case with a
   * hyphen ("it", "zh-cn"): {code, name, plural, count, rule, messages,
   * origin}. English, the language of the code, needs none.
   *
   * @type {Map<string, Object>}
   */
  static languages: Map<string, any> = new Map();

  /**
   * The language in use, or null for English.
   *
   * @type {Object|null}
   */
  static current: any = null;

  /**
   * The languages that the studio ships, by key, which a translation loaded
   * by the user may hide until it is removed.
   *
   * @type {Map<string, Object>}
   */
  static builtIn: Map<string, any> = new Map();

  /**
   * The messages of the application, in the order of the template: {id,
   * plural, references}, for the file to translate.
   *
   * @type {Array<Object>}
   */
  static entries: any[] = [];

  /**
   * Gives the key of a code of language: in lower case, with a hyphen.
   *
   * @param {string} code A code: "it", "zh_CN", "pt-BR".
   * @return {string} The key: "it", "zh-cn", "pt-br".
   */
  static key(code: string): string {
    return String(code || "").trim().replace(/_/g, "-").toLowerCase();
  }

  /**
   * Adds a language, or replaces the one of the same code.
   *
   * @param {Object} language {code, name, plural, messages, origin}: plural
   *   is the Plural-Forms of its PO file ("nplurals=2; plural=(n != 1);"),
   *   messages the translations by English message (a string, or an array
   *   of strings for a message with a plural), and origin "built-in" or
   *   "loaded" (by the user).
   * @return {Object} The language, as the studio holds it.
   */
  static register(language: any) {
    const forms = I18n.pluralForms(language.plural);
    const entry = {
        code: String(language.code)
      , name: language.name || I18n.nameOf(language.code)
      , plural: language.plural || I18n.ENGLISH_PLURAL
      , count: forms.count
      , rule: forms.rule
      , messages: language.messages || {}
      , origin: language.origin || "built-in"
    };
    const key = I18n.key(entry.code);
    I18n.languages.set(key, entry);
    
    if (entry.origin === "built-in") {
      I18n.builtIn.set(key, entry);
    }
    
    if (I18n.current && I18n.key(I18n.current.code) === key) {
      I18n.current = entry;
    }
    
    return entry;
  }

  /**
   * Removes a language that the user loaded: the studio shows again the one
   * that it ships with the same code, if any.
   *
   * @param {string} code Its code.
   */
  static unregister(code: string) {
    const key = I18n.key(code);
    const shipped = I18n.builtIn.get(key) || null;
    
    if (shipped) {
      I18n.languages.set(key, shipped);
    } else {
      I18n.languages.delete(key);
    }
    
    if (I18n.current && I18n.key(I18n.current.code) === key) {
      I18n.current = shipped;
    }
  }

  /**
   * Records the messages of the application, for the file to translate,
   * and the notice of the script that gives them.
   *
   * @param {Array<Array>} entries The messages, [id, plural, references]:
   *   the English message, its plural or null, and where it is
   *   ("index.html:12").
   * @param {Object} notice {project, author, license}, for the script that
   *   toScript writes; the notice stays as it was without it.
   */
  static setTemplate(entries: any[][], notice: any = null) {
    I18n.entries = entries.map(entry => ({ id: entry[0], plural: entry[1] || null, references: entry[2] ? String(entry[2]).split(" ") : [] }));
    
    if (notice) {
      I18n.notice = { ...I18n.notice, ...notice };
    }
  }

  /**
   * Chooses the language of the interface: the one that the user chose, or,
   * automatically, the first language of the browser that the studio knows.
   *
   * @param {string} preference A code, or "auto".
   * @param {Array<string>} wanted The languages of the browser, by
   *   preference ("it-IT", "en-GB"...).
   * @return {string} The code of the language.
   */
  static choose(preference: string, wanted: readonly string[] = []): string {
    if (preference && preference !== "auto") {
      return I18n.languages.has(I18n.key(preference)) ? I18n.languages.get(I18n.key(preference)).code : I18n.SOURCE;
    }
    
    for (const tag of wanted || []) {
      // I try the whole tag, then its language: "pt-BR", then "pt"
      const key = I18n.key(tag);
      for (const candidate of [key, key.split("-")[0]]) {
        if (candidate === I18n.SOURCE) {
          return I18n.SOURCE;
        }
        if (I18n.languages.has(candidate)) {
          return I18n.languages.get(candidate).code;
        }
      }
    }
    
    return I18n.SOURCE;
  }

  /**
   * Starts the translations of a page: the translations that the user
   * loaded, the language chosen (or that of the browser), and the elements
   * of the page.
   *
   * @param {string} preference The language chosen: a code, or "auto".
   * @param {Object<string, string>} loaded The translations that the user
   *   loaded, by code: their PO files.
   * @return {string} The code of the language in use.
   */
  static start(preference: string, loaded: Record<string, string> = {}): string {
    Object.keys(loaded || {}).forEach(code => {
      try {
        I18n.register(I18n.fromPo(loaded[code], "loaded"));
      } catch (e) {
        // I leave out a translation that cannot be read: the pane shows why when it is loaded
      }
    });
    
    const code = I18n.use(I18n.choose(preference, typeof navigator !== "undefined" ? navigator.languages || [] : []));
    
    if (typeof document !== "undefined") {
      I18n.translatePage(document);
    }
    
    return code;
  }

  /**
   * Puts a language in use.
   *
   * @param {string} code Its code; English when the studio does not know it.
   * @return {string} The code of the language in use.
   */
  static use(code: string): string {
    const key = I18n.key(code);
    
    I18n.current = key !== I18n.SOURCE && I18n.languages.has(key) ? I18n.languages.get(key) : null;
    
    if (typeof document !== "undefined" && document.documentElement) {
      // The page takes the tag of the language as HTML writes it: zh-CN for zh_CN
      document.documentElement.setAttribute("lang", I18n.language().replace(/_/g, "-"));
    }
    
    return I18n.language();
  }

  /**
   * @return {string} The code of the language in use.
   */
  static language(): string {
    return I18n.current ? I18n.current.code : I18n.SOURCE;
  }

  /**
   * Translates a message.
   *
   * @param {string} text The message, in English.
   * @param {Object} values The values of its placeholders, {name: value}.
   * @return {string} The translation, or the message when it has none.
   */
  static t(text: string, values: any = null): string {
    const messages = I18n.current ? I18n.current.messages : null;
    const translation = messages && typeof messages[text] === "string" && messages[text] !== "" ? messages[text] : text;
    
    return values ? I18n.format(translation, values) : translation;
  }

  /**
   * Translates a message that depends on a number: the form of the number
   * in the language in use, with the number in the placeholder {count}.
   *
   * @param {string} singular The message for one, in English.
   * @param {string} plural The message for several, in English.
   * @param {number} count The number.
   * @param {Object} values The values of the other placeholders.
   * @return {string} The translation, or the English message when it has
   *   none.
   */
  static n(singular: string, plural: string, count: number, values: any = null): string {
    const forms = I18n.current ? I18n.current.messages[singular] : null;
    let text = null;
    
    if (Array.isArray(forms)) {
      const form = forms[I18n.current.rule(count)];
      text = typeof form === "string" && form !== "" ? form : null;
    }
    
    if (text === null) {
      text = count === 1 ? singular : plural;
    }
    
    return I18n.format(text, { count: count, ...(values || {}) });
  }

  /**
   * Marks a message for the file to translate, where it cannot be
   * translated yet (the static tables of the classes): the code translates
   * it with I18n.t where it shows.
   *
   * @param {string} text The message, in English.
   * @return {string} The message, unchanged.
   */
  static mark(text: string): string {
    return text;
  }

  /**
   * Fills the placeholders of a message.
   *
   * @param {string} text The message, with placeholders such as {count}.
   * @param {Object} values The values, by name; a placeholder without a
   *   value stays as it is.
   * @return {string} The message, filled.
   */
  static format(text: string, values: any): string {
    return String(text).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name) => (values && Object.prototype.hasOwnProperty.call(values, name)
      && values[name] !== undefined && values[name] !== null ? String(values[name]) : match));
  }

  /**
   * Lists the placeholders of a message, for the checks of a translation.
   *
   * @param {string} text The message.
   * @return {Array<string>} The names, sorted, once each.
   */
  static placeholders(text: string): string[] {
    const names = new Set<string>();
    String(text || "").replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name) => {
      names.add(name);
      return match;
    });
    
    return Array.from(names).sort();
  }

  /**
   * Gives the name of a language in the language itself.
   *
   * @param {string} code The code of the language.
   * @return {string} Its name ("Italiano" for "it"), or the code when the
   *   browser does not know it.
   */
  static nameOf(code: string): string {
    const tag = I18n.key(code);
    
    if (tag === I18n.SOURCE) {
      return "English";
    }
    
    try {
      const name = new Intl.DisplayNames([tag], { type: "language" }).of(tag);
      return name && name !== tag ? name.charAt(0).toLocaleUpperCase(tag) + name.slice(1) : String(code);
    } catch (e) {
      return String(code);
    }
  }

  /**
   * Lists the languages of the interface, English first.
   *
   * @return {Array<Object>} {code, name, origin, translated, total}.
   */
  static list() {
    const total = I18n.entries.length;
    const result = [{ code: I18n.SOURCE, name: "English", origin: "built-in", translated: total, total: total }];
    
    I18n.languages.forEach(language => {
      result.push({ code: language.code, name: language.name, origin: language.origin, translated: I18n.translated(language), total: total });
    });
    
    return result;
  }

  /**
   * Counts the messages of the template that a language translates.
   *
   * @param {Object} language The language.
   * @return {number} How many have a translation.
   */
  static translated(language: any): number {
    return I18n.entries.filter(entry => {
      const value = language.messages[entry.id];
      return Array.isArray(value) ? value.some(form => form) : typeof value === "string" && value !== "";
    }).length;
  }

  /**
   * Reads the Plural-Forms of a language.
   *
   * @param {string} header "nplurals=2; plural=(n != 1);".
   * @return {Object} {count, rule}: the number of forms, and the function
   *   that gives the form of a number; those of English when the header
   *   cannot be read.
   */
  static pluralForms(header: string) {
    const english = { count: 2, rule: n => (n === 1 ? 0 : 1) };
    const count = /nplurals\s*=\s*(\d+)/.exec(header || "");
    const expression = /(?:^|;)\s*plural\s*=\s*([^;]+)/.exec(header || "");
    
    if (!count || !expression || Number(count[1]) < 1) {
      return english;
    }
    
    const forms = Number(count[1]);
    let evaluate = null;
    try {
      evaluate = I18n.compilePlural(expression[1]);
    } catch (e) {
      return english;
    }
    
    const rule = n => {
      const index = Math.trunc(Number(evaluate(Math.abs(Math.trunc(Number(n) || 0)))));
      return index >= 0 && index < forms ? index : 0;
    };
    
    return { count: forms, rule: rule };
  }

  /**
   * Compiles the expression of the plural forms, in the syntax of C, into a
   * function, without evaluating any code of the file: n, integers,
   * parentheses, ! - * / % + < <= > >= == != && || and ? :.
   *
   * @param {string} expression The expression, such as "(n != 1)".
   * @return {function(number):number} The function of n.
   * @throws {Error} When the expression cannot be read.
   */
  static compilePlural(expression: string): ((arg0: number) => number) {
    const tokens = String(expression).match(/\d+|n|&&|\|\||==|!=|<=|>=|[-+*\/%<>!?:()]|\S/g) || [];
    let at = 0;
    const peek = () => tokens[at];
    const take = (expected?: string) => {
      const token = tokens[at++];
      if (expected !== undefined && token !== expected) {
        throw new Error("plural: " + expected + " expected");
      }
      return token;
    };
    
    // A level of binary operators, left associative, above the next level
    const level = (next: () => (n: number) => number, operators: Record<string, (a: number, b: number) => number>) => () => {
      let left = next();
      while (Object.prototype.hasOwnProperty.call(operators, peek())) {
        const apply = operators[take()];
        const right = next();
        const before = left;
        left = n => apply(before(n), right(n));
      }
      return left;
    };
    
    let conditional: () => (n: number) => number = null;
    const primary = (): ((n: number) => number) => {
      const token = take();
      if (token === "n") {
        return n => n;
      }
      
      if (/^\d+$/.test(token || "")) {
        const value = Number(token);
        return () => value;
      }

      if (token === "(") {
        const inner = conditional();
        take(")");
        return inner;
      }
      
      if (token === "!") {
        const inner = primary();
        return n => (inner(n) ? 0 : 1);
      }
      
      if (token === "-") {
        const inner = primary();
        return n => -inner(n);
      }
      
      throw new Error("plural: unexpected " + token);
    };
    
    const multiplicative = level(primary, { "*": (a, b) => a*b, "/": (a, b) => (b ? Math.trunc(a/b) : 0), "%": (a, b) => (b ? a % b : 0) });
    const additive = level(multiplicative, { "+": (a, b) => a + b, "-": (a, b) => a - b });
    const relational = level(additive, { "<": (a, b) => (a < b ? 1 : 0), "<=": (a, b) => (a <= b ? 1 : 0), ">": (a, b) => (a > b ? 1 : 0), ">=": (a, b) => (a >= b ? 1 : 0) });
    const equality = level(relational, { "==": (a, b) => (a === b ? 1 : 0), "!=": (a, b) => (a !== b ? 1 : 0) });
    const and = level(equality, { "&&": (a, b) => (a && b ? 1 : 0) });
    const or = level(and, { "||": (a, b) => (a || b ? 1 : 0) });
    
    conditional = () => {
      const condition = or();
      if (peek() !== "?") {
        return condition;
      }
      take("?");
      const yes = conditional();
      take(":");
      const no = conditional();
      return n => (condition(n) ? yes(n) : no(n));
    };
    const result = conditional();
    
    if (at !== tokens.length) {
      throw new Error("plural: unexpected " + peek());
    }
    
    return result;
  }

  /**
   * Translates the elements of a page that are marked data-i18n and
   * data-i18n-html, and those of its templates.
   *
   * @param {Element|DocumentFragment} root The page, or a part of it.
   */
  static translatePage(root: Element | DocumentFragment) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }
    
    root.querySelectorAll("template").forEach(template => I18n.translatePage(template.content));
    root.querySelectorAll("[data-i18n]").forEach(element => {
      const listed = I18n.normalize(element.getAttribute("data-i18n"));
      if (!listed) {
        element.childNodes.forEach(node => {
          const key = node.nodeType === 3 ? I18n.normalize(node.nodeValue) : "";

          if (key) {
            // I keep the blanks around the text, which the layout may need
            node.nodeValue = /^\s*/.exec(node.nodeValue)[0] + I18n.t(key) + /\s*$/.exec(node.nodeValue)[0];
          }
        });
      }
      (listed ? listed.split(" ") : I18n.ATTRIBUTES).forEach(name => {
        const value = element.getAttribute(name);
    
        if (value && I18n.normalize(value)) {
          element.setAttribute(name, I18n.t(I18n.normalize(value)));
        }
      });
    });
    
    root.querySelectorAll("[data-i18n-html]").forEach(element => {
      const source = I18n.normalize(element.innerHTML);
      const translation = I18n.t(source);
      if (translation !== source) {
        const safe = I18n.sanitize(translation, source, element.ownerDocument);
        if (safe !== null) {
          element.innerHTML = safe;
        }
      }
      
      // The links of the messages open in another tab, so that the studio stays
      element.querySelectorAll("a[href]").forEach(link => {
        if (!/^#/.test(link.getAttribute("href"))) {
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener");
        }
      });
    });
  }

  /**
   * Checks the HTML of a translation against that of its message: it may
   * only use the elements and the attributes (with their values) of the
   * message, so that a translation cannot bring a script or another link.
   *
   * @param {string} html The translation.
   * @param {string} source The message, in English.
   * @param {Document} doc The document of the page.
   * @return {string|null} The HTML to show, or null when the translation
   *   uses something else.
   */
  static sanitize(html: string, source: string, doc: Document): string | null {
    const allowed = new Set();
    const collect = (node: Node) => {
      (node.childNodes as NodeListOf<Element>).forEach(child => {
        if (child.nodeType === 1) {
          const name = child.tagName.toLowerCase();
          allowed.add(name);
          Array.from(child.attributes).forEach(attribute => allowed.add(name + " " + attribute.name + "=" + attribute.value));
          collect(child);
        }
      });
    };
    const original = doc.createElement("template");
    original.innerHTML = source;
    collect(original.content);
    const box = doc.createElement("template");
    box.innerHTML = html;
    let safe = true;
    
    const check = (node: Node) => {
      Array.from(node.childNodes as NodeListOf<Element>).forEach(child => {
        if (child.nodeType === 1) {
          const name = child.tagName.toLowerCase();
          if (!allowed.has(name) || Array.from(child.attributes).some(attribute => !allowed.has(name + " " + attribute.name + "=" + attribute.value))) {
            safe = false;
          }
          check(child);
        } else if (child.nodeType !== 3) {
          child.remove();
        }
      });
    };
    check(box.content);
    
    return safe ? box.innerHTML : null;
  }

  /**
   * Collapses the blanks of a text, as the keys of the page are written.
   *
   * @param {string} text The text.
   * @return {string} The text on one line, without blanks at its ends.
   */
  static normalize(text: string): string {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  /**
   * Reads a PO file.
   *
   * @param {string} text The file.
   * @return {Object} {header, entries, problems}: the fields of the header
   *   by name; the messages, {context, id, plural, strings, comments,
   *   extracted, references, flags, obsolete, line}, line being where the
   *   message starts; and the lines that could not be read, {line, text}.
   */
  static parsePo(text: string) {
    const entries = [];
    const problems = [];
    let entry = null;
    let field = null;
    const fresh = line => ({ context: null, id: null, plural: null, strings: [], comments: [], extracted: [], references: [], flags: [], obsolete: false, line: line });
    
    const close = () => {
      if (entry && entry.id !== null) {
        entries.push(entry);
      }
      entry = null;
      field = null;
    };
    
    let source = String(text || "");
    if (source.charCodeAt(0) === 0xfeff) {
      source = source.slice(1);
    }
    source.split(/\r?\n/).forEach((raw, index) => {
      let line = raw.trim();
      let obsolete = false;
      if (line.startsWith("#~")) {
        obsolete = true;
        line = line.slice(2).trim();
      }
      if (line === "") {
        if (!obsolete) {
          close();
        }
        return;
      }
      if (!obsolete && line.charAt(0) === "#") {
        // A comment after the translations of a message starts the next one
        if (entry && entry.strings.length) {
          close();
        }
        entry = entry || fresh(index + 1);
        const kind = line.charAt(1);
        const body = line.slice(2).trim();
        
        if (kind === ".") {
          entry.extracted.push(body);
        } else if (kind === ":") {
          entry.references.push(...body.split(/\s+/).filter(reference => reference !== ""));
        } else if (kind === ",") {
          entry.flags.push(...body.split(",").map(flag => flag.trim()).filter(flag => flag !== ""));
        } else if (kind !== "|") {
          entry.comments.push(line.slice(1).replace(/^ /, ""));
        }
        
        return;
      }
      const keyword = /^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s+(".*")$/.exec(line);
      
      if (keyword) {
        const name = keyword[1];
        if (entry && ((name === "msgctxt" && (entry.id !== null || entry.context !== null)) || (name === "msgid" && entry.id !== null))) {
          close();
        }
        entry = entry || fresh(index + 1);
        entry.obsolete = entry.obsolete || obsolete;
        const value = I18n.unquote(keyword[3]);
        
        if (name === "msgctxt") {
          entry.context = value;
          field = "context";
        } else if (name === "msgid") {
          entry.id = value;
          field = "id";
        } else if (name === "msgid_plural") {
          entry.plural = value;
          field = "plural";
        } else {
          field = keyword[2] === undefined ? 0 : Number(keyword[2]);
          entry.strings[field] = value;
        }
        
        return;
      }
      
      if (/^".*"$/.test(line) && entry && field !== null) {
        const value = I18n.unquote(line);
        
        if (field === "context") {
          entry.context += value;
        } else if (field === "id") {
          entry.id += value;
        } else if (field === "plural") {
          entry.plural += value;
        } else {
          entry.strings[field] += value;
        }
        
        return;
      }
      problems.push({ line: index + 1, text: raw });
    });
    close();
    const header = {};
    const first = entries.find(item => item.id === "" && item.context === null && !item.obsolete);
    
    if (first) {
      String(first.strings[0] || "").split("\n").forEach(line => {
        const colon = line.indexOf(":");
        
        if (colon > 0) {
          header[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
        }
      });
    }
    return { header: header, entries: entries.filter(item => item !== first), problems: problems };
  }

  /**
   * Reads a quoted string of a PO file.
   *
   * @param {string} quoted The string, with its quotes.
   * @return {string} Its text.
   */
  static unquote(quoted: string): string {
    const escapes = { n: "\n", t: "\t", r: "\r" };
    return quoted.slice(1, -1).replace(/\\(.)/g, (match, c) => (Object.prototype.hasOwnProperty.call(escapes, c) ? escapes[c] : c));
  }

  /**
   * Writes a string of a PO file, with its quotes.
   *
   * @param {string} text The text.
   * @return {string} The quoted string.
   */
  static quote(text: string): string {
    return "\"" + String(text).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\t/g, "\\t").replace(/\r/g, "\\r").replace(/\n/g, "\\n") + "\"";
  }

  /**
   * Writes a PO file.
   *
   * @param {Object} file {comments, header, entries}: the comments at the
   *   top, the fields of the header as [name, value] pairs, and the
   *   messages, as parsePo reads them.
   * @return {string} The file.
   */
  static writePo(file: any): string {
    const lines = [];
    const field = (prefix, name, text) => {
      // A text of several lines goes on lines of its own, as gettext writes it
      const parts = String(text).match(/[^\n]*\n|[^\n]+$/g) || [""];
     
      if (parts.length > 1) {
        lines.push(prefix + name + " \"\"");
        parts.forEach(part => lines.push(prefix + I18n.quote(part)));
      } else {
        lines.push(prefix + name + " " + I18n.quote(text));
      }
    };
    (file.comments || []).forEach(comment => lines.push(comment ? "# " + comment : "#"));
    lines.push("msgid \"\"", "msgstr \"\"");
    (file.header || []).forEach(pair => lines.push(I18n.quote(pair[0] + ": " + pair[1] + "\n")));
    
    (file.entries || []).forEach(entry => {
      lines.push("");
      (entry.comments || []).forEach(comment => lines.push(comment ? "# " + comment : "#"));
      (entry.extracted || []).forEach(comment => lines.push("#. " + comment));
      let references = "";
      (entry.references || []).forEach(reference => {
        if (references && references.length + reference.length > 76) {
          lines.push("#: " + references);
          references = "";
        }
        references += (references ? " " : "") + reference;
      });
      if (references) {
        lines.push("#: " + references);
      }
      if ((entry.flags || []).length) {
        lines.push("#, " + entry.flags.join(", "));
      }
      const prefix = entry.obsolete ? "#~ " : "";
      if (entry.context !== null && entry.context !== undefined) {
        field(prefix, "msgctxt", entry.context);
      }
      field(prefix, "msgid", entry.id);
      if (entry.plural !== null && entry.plural !== undefined) {
        field(prefix, "msgid_plural", entry.plural);
        const strings = entry.strings && entry.strings.length ? entry.strings : ["", ""];
        strings.forEach((string, i) => field(prefix, "msgstr[" + i + "]", string || ""));
      } else {
        field(prefix, "msgstr", (entry.strings || [])[0] || "");
      }
    });
    
    return lines.join("\n") + "\n";
  }

  /**
   * Reads a translation from a PO file. A message marked fuzzy, which the
   * translator was not sure of, is left out, as gettext does, and so is a
   * translation that review refuses: the message shows in English.
   *
   * @param {string} text The PO file.
   * @param {string} origin "built-in" or "loaded".
   * @return {Object} {code, name, plural, messages, origin, problems,
   *   refused}: problems are the lines that could not be read, {line, text},
   *   and refused the translations left out, {line, id, reason}.
   * @throws {Error} When the file names no language.
   */
  static fromPo(text: string, origin: string = "loaded") {
    const po = I18n.parsePo(text);
    const code = String(po.header["Language"] || "").trim();
    if (!code) {
      throw new Error(I18n.t("The file does not say its language: write its code after Language, in its header (Language: zh for Chinese)."));
    }
    const messages = {};
    const refused = [];
    
    po.entries.forEach(entry => {
      if (entry.obsolete || entry.flags.includes("fuzzy") || entry.context !== null) {
        return;
      }
      
      const reason = I18n.review(entry.id, entry.plural, entry.strings);
      if (reason) {
        refused.push({ line: entry.line, id: entry.id, reason: reason });
        return;
      }
      
      if (entry.plural !== null) {
        if (entry.strings.some(string => string)) {
          messages[entry.id] = entry.strings.map(string => string || "");
        }
      } else if (entry.strings[0]) {
        messages[entry.id] = entry.strings[0];
      }
    });
    
    return {
        code: code
      , name: po.header["X-Language-Name"] || I18n.nameOf(code)
      , plural: po.header["Plural-Forms"] || I18n.ENGLISH_PLURAL
      , messages: messages
      , origin: origin
      , problems: po.problems
      , refused: refused
    };
  }

  /**
   * Checks the translation of a message: it keeps the placeholders of the
   * message (a form of a plural may leave out {count}), and it uses only
   * the tags of the message, with their attributes, as sanitize allows.
   *
   * @param {string} id The message, in English.
   * @param {string|null} plural Its plural, or null.
   * @param {Array<string>} strings The translation, or its forms; the empty
   *   ones are not translated yet.
   * @return {string|null} What is wrong, or null when nothing is.
   */
  static review(id: string, plural: string | null, strings: string[]): string | null {
    const names = I18n.placeholders(id + " " + (plural || ""));
    const braces = list => list.map(name => "{" + name + "}").join(", ");
    const tags = text => {
      const found = new Set();
      // An element that is not of HTML is text: its content is read on
      const visit = node => (node.children || []).forEach(child => {
        if (child.name && I18n.HTML.has(child.name)) {
          found.add(child.name);
          child.attributes.forEach(attribute => found.add(child.name + " " + attribute.name + "=" + (attribute.value === null ? "" : I18n.decode(attribute.value))));
        }
        
        visit(child);
      });
      visit(I18n.parseHtml(text));
      return found;
    };
    const allowed = tags(id + " " + (plural || ""));
    for (const text of strings || []) {
      if (!text) continue;
      
      const used = I18n.placeholders(text);
      const missing = names.filter(name => !used.includes(name) && !(plural && name === "count"));
      const unknown = used.filter(name => !names.includes(name));
      
      if (missing.length) {
        return I18n.t("the translation leaves out {placeholders}", { placeholders: braces(missing) });
      }
      
      if (unknown.length) {
        return I18n.t("the translation has {placeholders}, which the message does not have", { placeholders: braces(unknown) });
      }
     
      if (Array.from(tags(text)).some(tag => !allowed.has(tag))) {
        return I18n.t("the translation has tags or links that the message does not have");
      }
    }
    return null;
  }

  /**
   * Writes the file to translate: the template of every message, or a
   * language with its translations, to improve it.
   *
   * @param {string|null} code The language, or null for the template.
   * @param {string} project The name and the version of the application.
   * @return {string} The PO file.
   */
  static toPo(code: string | null, project: string): string {
    const language = code ? I18n.languages.get(I18n.key(code)) : null;
    const app = String(project).split(" ")[0];
    const title = language ? app + " in " + language.name + " (" + language.code + ")." : "The template of the translations of " + app + ".";

    // TODO perhaps simplify this return in the next life
    return I18n.writePo({
        comments: [title, ""].concat(I18n.INSTRUCTIONS.map(line => line.replace(/\{app\}/g, app)))
      , header: [
            ["Project-Id-Version", project]
          , ["Language", language ? language.code : ""]
          , ["MIME-Version", "1.0"]
          , ["Content-Type", "text/plain; charset=UTF-8"]
          , ["Content-Transfer-Encoding", "8bit"]
          , ["Plural-Forms", language ? language.plural : "nplurals=INTEGER; plural=EXPRESSION;"]
          , ["X-Language-Name", language ? language.name : ""]
        ]
      , entries: I18n.entries.map(entry => {
          const value = language ? language.messages[entry.id] : null;
          const strings = entry.plural ? (Array.isArray(value) ? value : new Array(language ? language.count : 2).fill("")) : [typeof value === "string" ? value : ""];
          return { context: null, id: entry.id, plural: entry.plural, strings: strings, references: entry.references };
        })
    });
  }

  /**
   * Writes a string as a literal of a script, in ASCII: the other
   * characters as escapes.
   *
   * @param {string} text The string.
   * @return {string} The literal, in double quotes.
   */
  static toLiteral(text: string): string {
    return JSON.stringify(String(text)).replace(/[^\x00-\x7e]/g, c => "\\" + "u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  }

  /**
   * Writes the script of the languages, lang/languages.js: the template that
   * setTemplate recorded, with its notice, and the languages given, by
   * code, each without the messages that it does not translate. The build
   * of the translations writes it from the PO files of lang/, and a studio
   * from the languages that it has, the same way.
   *
   * @param {Array<Object>} languages The languages, as fromPo reads them:
   *   {code, name, plural, messages}.
   * @return {string} The script.
   */
  static toScript(languages: any[]): string {
    const literal = text => I18n.toLiteral(text);
    const notice = I18n.notice;
    const app = String(notice.project).split(" ")[0];
    const lines = [
        "/**"
      , " * The languages of " + app + ", written from the files of lang/ by"
      , " * scripts/build-i18n.js, or by the studio itself (View, Language): do"
      , " * not edit by hand. The template lists the messages of the studio, for"
      , " * the file to translate that it gives, and each language is a PO file of"
      , " * lang/, without the messages that are not translated yet, which show in"
      , " * English."
      , " *"
      , " * @author " + notice.author
      , " * @license " + notice.license
      , " */"
      , "I18n.setTemplate(["
    ];
    I18n.entries.forEach((entry, i) => {
      lines.push((i ? "  , " : "    ") + "[" + literal(entry.id) + ", " + (entry.plural === null ? "null" : literal(entry.plural)) + ", " + literal(entry.references.join(" ")) + "]");
    });
    lines.push("], { project: " + literal(notice.project) + ", author: " + literal(notice.author) + ", license: " + literal(notice.license) + " });");
    languages.slice().sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)).forEach(language => {
      const ids = I18n.entries.map(entry => entry.id).filter(id => Object.prototype.hasOwnProperty.call(language.messages, id));
      lines.push(
          "I18n.register({"
        , "    code: " + literal(language.code)
        , "  , name: " + literal(language.name)
        , "  , plural: " + literal(language.plural)
        , "  , origin: \"built-in\""
        , "  , messages: {" + (ids.length ? "" : "}")
      );
      ids.forEach((id, i) => {
        const value = language.messages[id];
        lines.push((i ? "      , " : "        ") + literal(id) + ": " + (Array.isArray(value) ? "[" + value.map(literal).join(", ") + "]" : literal(value)));
      });
      if (ids.length) {
        lines.push("    }");
      }
      lines.push("});");
    });
    return lines.join("\n") + "\n";
  }

  /**
   * Reads the comments at the top of a PO file, before its header, which
   * the file keeps when it is brought up to date.
   *
   * @param {string} text The file.
   * @return {Array<string>} The comments, without their #.
   */
  static topComments(text: string): string[] {
    const comments = [];
    const lines = String(text).replace(new RegExp("^" + String.fromCharCode(0xfeff)), "").split(/\r?\n/);
    for (const line of lines) {
      if (line !== "#" && !line.startsWith("# ")) {
        break;
      }
      comments.push(line.slice(2));
    }
    return comments;
  }

  /**
   * Gives the header of a PO file of a language: its fields, in their
   * order, with the project and the encoding of the build.
   *
   * @param {Object} fields The fields of the file, by name.
   * @param {string} project The name and the version of the studio.
   * @return {Array<Array<string>>} The fields, [name, value].
   */
  static headerOf(fields: any, project: string): string[][] {
    const pairs = Object.keys(fields).map(name => [name, fields[name]]);
    const set = (name, value, first) => {
      const pair = pairs.find(item => item[0] === name);
      
      if (pair) {
        pair[1] = value;
      } else if (first) {
        pairs.unshift([name, value]);
      } else {
        pairs.push([name, value]);
      }
    };
    set("Project-Id-Version", project, true);
    set("Content-Type", "text/plain; charset=UTF-8", false);
    set("Content-Transfer-Encoding", "8bit", false);
    
    return pairs;
  }

  /**
   * Tells how much two messages look alike, by their words.
   *
   * @param {string} a A message.
   * @param {string} b Another one.
   * @return {number} From 0 (no word in common) to 1 (the same words).
   */
  static likeness(a: string, b: string): number {
    const words = text => text.toLowerCase().split(/[^a-z0-9{}]+/).filter(word => word !== "");
    
    const left = words(a);
    const right = words(b);
    if (!left.length || !right.length || Math.min(left.length, right.length) < 0.6*Math.max(left.length, right.length)) {
      return 0;
    }
    
    const counts = new Map();
    left.forEach(word => counts.set(word, (counts.get(word) || 0) + 1));
    let common = 0;
    right.forEach(word => {
      if (counts.get(word)) {
        counts.set(word, counts.get(word) - 1);
        common++;
      }
    });
    
    return 2*common/(left.length + right.length);
  }

  /**
   * Brings the messages of a PO file up to date with those of the template:
   * their order and their references. A message keeps its translation, its
   * comments and its flags; one without a translation takes that of the
   * compendium, or, marked fuzzy, that of a message much like it that is
   * gone; the messages that are gone stay at the end, obsolete.
   *
   * @param {Object} po The file, as parsePo reads it.
   * @param {number} forms The number of plural forms of the language.
   * @param {Map<string, Object>} compendium Translations, by message.
   * @return {Object} {entries, twice, fromCompendium, suggested}: the
   *   messages of the file, those that it has twice, and how many the
   *   compendium and the suggestions translated.
   */
  static merge(po: any, forms: number, compendium: Map<string, any>) {
    const translated = entry => entry.strings.some(string => string);
    const fit = (strings, plural) => Array.from({ length: plural ? forms : 1 }, (unused, i) => strings[i] || "");
    const current = new Set(I18n.entries.map(message => message.id));
    const old = new Map();
    const twice = [];
    
    po.entries.forEach(entry => {
      if (entry.context !== null) {
        return;
      }
      const known = old.get(entry.id);
      if (!known || (known.obsolete && !entry.obsolete)) {
        old.set(entry.id, entry);
      } else if (!entry.obsolete) {
        twice.push(entry);
      }
    });
    
    let fromCompendium = 0;
    let suggested = 0;
    
    const entries = I18n.entries.map(message => {
      const entry = { context: null, id: message.id, plural: message.plural, strings: fit([], message.plural), comments: [], extracted: [], references: message.references, flags: [], obsolete: false };
      const known = old.get(message.id);
      const other = compendium.get(message.id);
      if (known && !translated(known) && other && (other.plural === null) === (message.plural === null)) {
        // An empty translation takes that of the compendium
        entry.comments = known.comments;
        entry.flags = known.flags.filter(flag => flag !== "fuzzy");
        entry.strings = fit(other.strings, message.plural);
        fromCompendium++;
      } else if (known) {
        entry.comments = known.comments;
        entry.flags = known.flags.slice();
        
        if ((known.plural === null) === (message.plural === null)) {
          entry.strings = fit(known.strings, message.plural);
        } else {
          // The message gained or lost its plural: its translation is a suggestion
          const first = known.strings.find(string => string) || "";
          entry.strings = fit(new Array(forms).fill(first), message.plural);
          if (first && !entry.flags.includes("fuzzy")) {
            entry.flags.push("fuzzy");
          }
        }
      } else if (other && (other.plural === null) === (message.plural === null)) {
        entry.strings = fit(other.strings, message.plural);
        fromCompendium++;
      }
      
      return entry;
    });
    
    let gone = po.entries.filter(entry => (entry.context !== null || !current.has(entry.id)) && translated(entry) && twice.indexOf(entry) < 0);
    entries.forEach(entry => {
      if (translated(entry)) {
        return;
      }
    
      let best = null;
      let score = 0.7;
      gone.forEach(candidate => {
        const like = candidate.context === null && (candidate.plural === null) === (entry.plural === null) ? I18n.likeness(entry.id, candidate.id) : 0;
        if (like >= score) {
          best = candidate;
          score = like;
        }
      });
      if (best) {
        entry.strings = fit(best.strings, entry.plural);
        entry.flags = ["fuzzy"];
        entry.comments = best.comments;
        gone = gone.filter(candidate => candidate !== best);
        suggested++;
      }
    });
    const obsolete = gone.map(entry => ({ ...entry, references: [], extracted: [], obsolete: true }));
    
    return { entries: entries.concat(obsolete), twice: twice, fromCompendium: fromCompendium, suggested: suggested };
  }

  /**
   * Brings a PO file up to date with the template, as the build of the
   * translations does (see merge): the file keeps the comments at its top
   * and its header, with the project of the build.
   *
   * @param {string} text The PO file.
   * @param {string} project The name and the version of the studio.
   * @param {Map<string, Object>} compendium Translations for the messages
   *   that have none, by message, as parsePo reads them.
   * @return {Object} {text, problems, twice, fromCompendium, suggested}:
   *   the file brought up to date, or as it is when some of its lines cannot
   *   be read, which problems gives as parsePo does; the messages that it has
   *   twice, the first of which stays; and how many messages the compendium
   *   and the suggestions translated.
   */
  static updatePo(text: string, project: string, compendium: Map<string, any> = new Map()) {
    const po = I18n.parsePo(text);
    if (po.problems.length) {
      return { text: text, problems: po.problems, twice: [], fromCompendium: 0, suggested: 0 };
    }
    
    const merged = I18n.merge(po, I18n.pluralForms(po.header["Plural-Forms"]).count, compendium);
    
    return {
        text: I18n.writePo({ comments: I18n.topComments(text), header: I18n.headerOf(po.header, project), entries: merged.entries })
      , problems: []
      , twice: merged.twice
      , fromCompendium: merged.fromCompendium
      , suggested: merged.suggested
    };
  }

  /**
   * Lists the messages of a source of the application, for the template:
   * the calls of I18n.t, I18n.n and I18n.mark with literal messages in a
   * script, and the elements marked data-i18n and data-i18n-html in a page,
   * with the keys that translatePage computes for them.
   *
   * @param {string} text The source.
   * @param {string} kind "script" or "page".
   * @param {string} file Its name, for the references.
   * @return {Object} {messages, problems}: {id, plural, references} each,
   *   and the calls whose message is not a literal, {reference, text}.
   */
  static extract(text: string, kind: string, file: string) {
    const lineOf = offset => text.slice(0, offset).split("\n").length;
    const messages = [];
    const problems = [];
    
    if (kind === "page") {
      const visit = node => {
        const marked = (node.attributes || []).find(attribute => attribute.name === "data-i18n");
        if (marked) {
          const listed = I18n.normalize(marked.value === null ? "" : marked.value);
          node.children.forEach(child => {
            const key = !listed && child.text !== undefined ? I18n.normalize(I18n.decode(child.text)) : "";
            if (key) {
              messages.push({ id: key, plural: null, references: [file + ":" + lineOf(child.offset)] });
            }
          });
          const names = listed ? listed.split(" ") : I18n.ATTRIBUTES;
          node.attributes.forEach(attribute => {
            const key = names.includes(attribute.name) && attribute.value !== null ? I18n.normalize(I18n.decode(attribute.value)) : "";
            if (key) {
              messages.push({ id: key, plural: null, references: [file + ":" + lineOf(node.offset)] });
            }
          });
        }
        if ((node.attributes || []).some(attribute => attribute.name === "data-i18n-html")) {
          messages.push({ id: I18n.normalize(I18n.serialize(node.children)), plural: null, references: [file + ":" + lineOf(node.offset)] });
        }
        (node.children || []).forEach(visit);
      };
      visit(I18n.parseHtml(text));
      return { messages: messages, problems: problems };
    }
    
    /*
     * The comments of the scripts, on lines of their own, are not code: I
     * blank them, keeping the offsets of the rest
     */
    let block = false;
    const code = text.split("\n").map(line => {
      const trimmed = line.trim();
      const comment = block || trimmed.startsWith("/*") || trimmed.startsWith("//") || trimmed.startsWith("*");
      if (block || trimmed.startsWith("/*")) {
        block = !trimmed.includes("*/");
      }
      return comment ? line.replace(/\S/g, " ") : line;
    }).join("\n");
    const call = /\bI18n\.(t|n|mark)\(/g;
    
    let match;
    while ((match = call.exec(code)) !== null) {
      const reference = file + ":" + lineOf(match.index);
      const first = I18n.readLiteral(code, call.lastIndex);
      
      if (!first) {
        // A message in a variable was marked where it was written
        continue;
      }
      
      if (first.mixed) {
        problems.push({ reference: reference, text: code.slice(match.index, first.end) });
        continue;
      }
      
      let plural = null;
      if (match[1] === "n") {
        const comma = /\s*,\s*/y;
        comma.lastIndex = first.end;
        const second = comma.exec(code) ? I18n.readLiteral(code, comma.lastIndex) : null;
        
        if (!second || second.mixed) {
          problems.push({ reference: reference, text: code.slice(match.index, first.end) });
          continue;
        }
        plural = second.value;
      }
      messages.push({ id: first.value, plural: plural, references: [reference] });
    }
    
    return { messages: messages, problems: problems };
  }

  /**
   * Reads a string literal of a script, or several joined with +.
   *
   * @param {string} text The script.
   * @param {number} at Where the literal may start, after blanks.
   * @return {Object|null} {value, end, mixed}: the text, where the literal
   *   ends, and whether a + joins it to something else than a literal; null
   *   when no literal starts there.
   */
  static readLiteral(text: string, at: number) {
    let value = "";
    let read = false;
    let position = at;
    for (;;) {
      const blank = /\s*/y;
      blank.lastIndex = position;
      blank.exec(text);
      position = blank.lastIndex;
      
      if (text.charAt(position) !== "\"") {
        return read ? { value: value, end: position, mixed: false } : null;
      }
      
      let end = position + 1;
      let raw = "";
      while (end < text.length && text.charAt(end) !== "\"") {
        const step = text.charAt(end) === "\\" ? 2 : 1;
        raw += text.slice(end, end + step);
        end += step;
      }
      
      value += I18n.unescapeScript(raw);
      position = end + 1;
      read = true;
      
      const plus = /\s*\+\s*/y;
      plus.lastIndex = position;
      if (!plus.exec(text)) {
        return { value: value, end: position, mixed: false };
      }
      
      if (text.charAt(plus.lastIndex) !== "\"") {
        return { value: value, end: plus.lastIndex, mixed: true };
      }
      
      position = plus.lastIndex;
    }
  }

  /**
   * Reads the escapes of a string literal of a script.
   *
   * @param {string} raw The text between the quotes.
   * @return {string} The string.
   */
  static unescapeScript(raw: string): string {
    const escapes = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v" };
    
    // TODO simplify? regex is easy here, but perhaps the rest could be better organised
    return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (match, code) => {
      if (/^u/.test(code) && code.length > 1) {
        return String.fromCodePoint(parseInt(code.replace(/[u{}]/g, ""), 16));
      }
      
      if (/^x/.test(code) && code.length === 3) {
        return String.fromCharCode(parseInt(code.slice(1), 16));
      }
      
      return Object.prototype.hasOwnProperty.call(escapes, code) ? escapes[code] : code;
    });
  }

  /**
   * Reads a page into a tree, enough for the elements that it marks:
   * elements {name, attributes, children, offset} and texts {text,
   * offset}; the comments, the scripts and the styles are left out.
   *
   * @param {string} text The page.
   * @return {Object} The root, whose children are the top elements.
   */
  static parseHtml(text: string) {
    const root = { name: "#root", attributes: [], children: [], offset: 0 };
    const stack = [root];
    const tag = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([A-Za-z][\w-]*)\s*>|<([A-Za-z][\w-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>]+))?)*)\s*(\/?)>/g;
    let at = 0;
    let match;
    
    while ((match = tag.exec(text)) !== null) {
      if (match.index > at) {
        stack[stack.length - 1].children.push({ text: text.slice(at, match.index), offset: at });
      }
      at = tag.lastIndex;
      
      if (match[1]) {
        const name = match[1].toLowerCase();
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].name === name) {
            stack.length = i;
            break;
          }
        }
      } else if (match[2]) {
        const name = match[2].toLowerCase();
        const element = { name: name, attributes: I18n.parseAttributes(match[3] || ""), children: [], offset: match.index };
        stack[stack.length - 1].children.push(element);
        if (name === "script" || name === "style") {
          // Their content is not text of the page
          const close = text.toLowerCase().indexOf("</" + name, at);
          at = close < 0 ? text.length : close;
          tag.lastIndex = at;
        } else if (!I18n.VOID.has(name) && !match[4]) {
          stack.push(element);
        }
      }
    }
    
    if (at < text.length) {
      stack[stack.length - 1].children.push({ text: text.slice(at), offset: at });
    }
    
    return root;
  }

  /**
   * Reads the attributes of a tag.
   *
   * @param {string} text The attributes, as written in the tag.
   * @return {Array<Object>} {name, value}: value is null for an attribute
   *   without one.
   */
  static parseAttributes(text: string) {
    const result = [];
    const attribute = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;
    
    let match;
    while ((match = attribute.exec(text)) !== null) {
      const value = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : null;
      result.push({ name: match[1].toLowerCase(), value: value });
    }
    
    return result;
  }

  /**
   * Writes nodes of the tree of parseHtml as a browser writes the content
   * of an element (innerHTML), so that a key computed from the source of a
   * page is the one that the page computes.
   *
   * @param {Array<Object>} nodes The nodes.
   * @return {string} Their HTML.
   */
  static serialize(nodes: any[]): string {
    return nodes.map(node => {
      if (node.text !== undefined) {
        return I18n.escape(I18n.decode(node.text), false);
      }
      
      const attributes = node.attributes.map(attribute => " " + attribute.name + "=\"" + I18n.escape(attribute.value === null ? "" : I18n.decode(attribute.value), true) + "\"").join("");
      
      return "<" + node.name + attributes + ">" + (I18n.VOID.has(node.name) ? "" : I18n.serialize(node.children) + "</" + node.name + ">");
    }).join("");
  }

  /**
   * Escapes a text as a browser writes it in HTML.
   *
   * @param {string} text The text.
   * @param {boolean} attribute Whether it is the value of an attribute.
   * @return {string} The escaped text.
   */
  static escape(text: string, attribute: boolean): string {
    const escaped = String(text).replace(/&/g, "&amp;").split(String.fromCharCode(160)).join("&nbsp;");
    
    return attribute ? escaped.replace(/"/g, "&quot;") : escaped.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /**
   * Reads the characters that a page writes with their names or numbers.
   *
   * @param {string} text The text, with &eacute;, &#233;...
   * @return {string} The text, with the characters.
   */
  static decode(text: string): string {
    return String(text).replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, code) => {
      if (code.charAt(0) === "#") {
        return String.fromCodePoint(/^#[xX]/.test(code) ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
      }
      
      return Object.prototype.hasOwnProperty.call(I18n.ENTITIES, code) ? I18n.ENTITIES[code] : match;
    });
  }
}
// ----------------------------------------------------------------
