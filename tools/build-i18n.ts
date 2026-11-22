/**
 * @file Builds the translations of a studio, for its own script
 * (scripts/build-i18n.ts): the file to translate, lang/template.pot, with
 * every message of the page and of the scripts that it loads; the PO file
 * of each language, in lang/, brought up to date with the messages; and
 * lang/languages.js, the script that gives the messages and the languages
 * to the page (see I18n).
 *
 * The script of a studio says what to read:
 *
 *   const result = main({
 *       root: path.join(import.meta.dirname, "..")
 *     , project: "[backend] [version]"
 *     , page: "index.html"
 *     , skip: file => file.startsWith("engine/")
 *     , source: file => file.replace(/^js\//, "src/").replace(/\.js$/, ".ts")
 *     , folders: ["src"]
 *     , author: "Roberto Metere"
 *     , license: "CECILL-B"
 *   }, process.argv.slice(2));
 *
 * and takes these options:
 *
 *   (none)             writes the files
 *   --check            writes nothing, and fails when a file is not up to
 *                      date or when a translation is refused
 *   --new CODE         starts lang/CODE.po, a language to translate
 *   --compendium FILE  translates the messages that have no translation yet
 *                      with those of another PO file of the same language
 *                      (the translation of the other studio, for instance)
 *
 * A message that is gone from the code stays at the end of the PO files,
 * obsolete (#~), so that no translation is lost: it comes back with its
 * message, or as a suggestion, marked fuzzy, for a new message much like
 * it. A translation that loses a placeholder of its message, or that brings
 * a tag, is reported and left out of the script (see I18n.review).
 *
 * The files are brought up to date, and the script written, by I18n
 * (updatePo, toScript), which a studio uses too: the Language pane gives
 * the same script for the translations that it loads, so that a language
 * reaches everyone without this tool (see LanguagePane).
 *
 * A minified script brings its messages in the template next to it: the
 * page of a studio loads studio-core/studio-core.min.js, whose messages are
 * in studio-core/studio-core.pot. The core writes that template when it
 * builds its dist/:
 *
 *   node tools/build-i18n.ts --pot dist/studio-core.pot src/StudioCore.ts ...
 *
 * @author Roberto Metere
 * @license MIT
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * The script of the languages, from the root of the studio.
 *
 * @type {string}
 */
const LANGUAGES = "lang/languages.js";

/**
 * The file to translate, from the root of the studio.
 *
 * @type {string}
 */
const TEMPLATE = "lang/template.pot";

/**
 * The plural forms of the languages that a new file fills in by itself, as
 * the manual of gettext gives them; the translator writes the others.
 *
 * @type {Array<Array<string>>}
 */
const PLURALS: string[][] = [
    ["zh ja ko vi th", "nplurals=1; plural=0;"]
  , ["en de nl sv da nb nn no fi et el he it es pt ca bg eo", "nplurals=2; plural=(n != 1);"]
  , ["fr pt-br", "nplurals=2; plural=(n > 1);"]
  , ["ru uk be sr hr bs", "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);"]
  , ["pl", "nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);"]
  , ["cs sk", "nplurals=3; plural=(n==1 ? 0 : n>=2 && n<=4 ? 1 : 2);"]
  , ["ro", "nplurals=3; plural=(n==1 ? 0 : (n==0 || (n%100 > 0 && n%100 < 20)) ? 1 : 2);"]
  , ["lt", "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && (n%100<10 || n%100>=20) ? 1 : 2);"]
  , ["lv", "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n != 0 ? 1 : 2);"]
  , ["sl", "nplurals=4; plural=(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3);"]
  , ["ar", "nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);"]
];

/**
 * Loads the class I18n of the core into a context of its own.
 *
 * @return {Object} The class I18n.
 */
function loadI18n() {
  // Next to the build of the core (a studio's studio-core/, the core's dist/), or in the core
  const bundle = path.join(import.meta.dirname, "..", "studio-core.min.js");
  const file = fs.existsSync(bundle) ? bundle : path.join(import.meta.dirname, "..", "js", "text", "I18n.js");
  const context = vm.createContext({ console: console, TextEncoder: TextEncoder, TextDecoder: TextDecoder });
  vm.runInContext(fs.readFileSync(file, "utf8") + "\nthis.I18n = I18n;", context, { filename: file });
  return context.I18n;
}
// ----------------------------------------------------------------

/**
 * Reads the options of the command line.
 *
 * @param {Array<string>} args The options.
 * @return {Object} {check, create, compendium, help, error}.
 */
function readOptions(args: string[]) {
  const options = { check: false, create: null, compendium: null, help: false, error: null };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--check") {
      options.check = true;
    } else if (args[i] === "--new" && i + 1 < args.length) {
      options.create = args[++i];
    } else if (args[i] === "--compendium" && i + 1 < args.length) {
      options.compendium = args[++i];
    } else if (args[i] === "--help" || args[i] === "-h") {
      options.help = true;
    } else {
      options.error = "Unknown option " + args[i] + ": the options are --check, --new CODE and --compendium FILE";
    }
  }
  
  if (options.create !== null && !/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/.test(options.create)) {
    options.error = "--new takes the code of a language: zh, fr, pt-BR...";
  }
  
  return options;
}
// ----------------------------------------------------------------

/**
 * Gives the plural forms of a language, when PLURALS has them.
 *
 * @param {Object} I18n The class I18n.
 * @param {string} code The code of the language.
 * @return {string} The Plural-Forms, or the placeholder of gettext for the
 *   translator to fill in.
 */
function pluralOf(I18n: any, code: string): string {
  const key = I18n.key(code);
  
  for (const candidate of [key, key.split("-")[0]]) {
    const found = PLURALS.find(entry => entry[0].split(" ").includes(candidate));
    if (found) {
      return found[1];
    }
  }
  
  return "nplurals=INTEGER; plural=EXPRESSION;";
}
// ----------------------------------------------------------------

/**
 * Lists the sources of the messages: the page, then the scripts that it
 * loads, in its order, but the libraries (.min.js), the script of the
 * languages, and those that the studio skips. A minified script with a
 * template next to it (studio-core.min.js, studio-core.pot) gives that
 * template.
 *
 * @param {Object} I18n The class I18n.
 * @param {Object} config The studio.
 * @return {Array<Object>} The sources, {file, kind}: the file from the root,
 *   and "page", "script" or "pot".
 */
function listSources(I18n: any, config: any) {
  const page = fs.readFileSync(path.join(config.root, config.page), "utf8");
  const sources = [{ file: config.page, kind: "page" }];
  
  const visit = node => (node.children || []).forEach(child => {
    if (child.name === "script") {
      const src = child.attributes.find(attribute => attribute.name === "src");
      const file = src && src.value ? path.posix.normalize(I18n.decode(src.value)) : null;
      const template = file ? file.replace(/\.min\.js$/, ".pot") : null;
      if (file && /\.min\.js$/.test(file) && fs.existsSync(path.join(config.root, template))) {
        sources.push({ file: template, kind: "pot" });
      } else if (file && !/\.min\.js$/.test(file) && file !== LANGUAGES && !(config.skip && config.skip(file))) {
        sources.push({ file: config.source ? config.source(file) : file, kind: "script" });
      }
    }
    visit(child);
  });
  
  visit(I18n.parseHtml(page));
  
  return sources;
}
// ----------------------------------------------------------------

/**
 * Reads the messages of a template, as I18n.extract gives those of a
 * source.
 *
 * @param {Object} I18n The class I18n.
 * @param {string} text The template.
 * @return {Object} {messages, problems}: the messages, {id, plural,
 *   references}, and no problems.
 */
function fromTemplate(I18n: any, text: string) {
  const messages = I18n.parsePo(text).entries
    .filter(entry => !entry.obsolete && entry.context === null && entry.id !== "")
    .map(entry => ({ id: entry.id, plural: entry.plural, references: entry.references }));
  
  return { messages: messages, problems: [] };
}
// ----------------------------------------------------------------

/**
 * Gathers the messages of the sources, in the order where they first show.
 *
 * @param {Object} I18n The class I18n.
 * @param {string} root The folder of the studio.
 * @param {Array<Object>} sources The sources.
 * @return {Object} {entries, errors}: the messages, {id, plural,
 *   references}, and what keeps a message out of the template.
 */
function gather(I18n: any, root: string, sources: any[]) {
  const byId = new Map();
  const errors = [];
  
  sources.forEach(source => {
    const text = fs.readFileSync(path.join(root, source.file), "utf8");
    const found = source.kind === "pot" ? fromTemplate(I18n, text) : I18n.extract(text, source.kind, source.file);
    found.problems.forEach(problem => errors.push(problem.reference + ": the message is not written in quotes, so the file to translate cannot list it: "
      + problem.text.replace(/\s+/g, " ")));
    found.messages.forEach(message => {
      const known = byId.get(message.id);
      if (!known) {
        byId.set(message.id, { id: message.id, plural: message.plural, references: message.references.slice() });
        return;
      }
      if ((known.plural || null) !== (message.plural || null)) {
        errors.push(message.references[0] + ": " + JSON.stringify(message.id) + " has another plural at " + known.references[0]);
      }
      message.references.forEach(reference => {
        if (!known.references.includes(reference)) {
          known.references.push(reference);
        }
      });
    });
  });
  
  return { entries: Array.from(byId.values()), errors: errors };
}
// ----------------------------------------------------------------

/**
 * Finds the scripts of the studio (in its folders of sources) that mark
 * messages but that the page does not load: their messages are missing
 * from the template.
 *
 * @param {string} root The folder of the studio.
 * @param {Array<Object>} sources The sources.
 * @param {Array<string>} folders The folders of the sources, from the root.
 * @return {Array<string>} The scripts, from the root.
 */
function forgotten(root: string, sources: any[], folders: string[]): string[] {
  const loaded = new Set(sources.map(source => source.file));
  const result = [];
  const walk = folder => {
    if (!fs.existsSync(path.join(root, folder))) {
      return;
    }
    
    fs.readdirSync(path.join(root, folder), { withFileTypes: true }).forEach(entry => {
      const file = folder + "/" + entry.name;
      
      if (entry.isDirectory()) {
        walk(file);
      } else if (/\.(js|ts)$/.test(entry.name) && !/\.(min\.js|d\.ts)$/.test(entry.name) && !loaded.has(file)
        && /\bI18n\.(t|n|mark)\(/.test(fs.readFileSync(path.join(root, file), "utf8"))) {
        result.push(file);
      }
    });
  };
  
  folders.forEach(walk);
  
  return result;
}
// ----------------------------------------------------------------

/**
 * Starts the PO file of a new language.
 *
 * @param {Object} I18n The class I18n.
 * @param {string} project The name and the version of the studio.
 * @param {Object} language {code, name, plural}.
 * @return {string} The file, without messages: the build adds them.
 */
function startPo(I18n: any, project: string, language: any): string {
  const app = String(project).split(" ")[0];
  
  return I18n.writePo({
      comments: [app + " in " + language.name + " (" + language.code + ").", ""].concat(I18n.INSTRUCTIONS.map(line => line.replace(/\{app\}/g, app)))
    , header: [
          ["Project-Id-Version", project]
        , ["Language", language.code]
        , ["MIME-Version", "1.0"]
        , ["Content-Type", "text/plain; charset=UTF-8"]
        , ["Content-Transfer-Encoding", "8bit"]
        , ["Plural-Forms", language.plural]
        , ["X-Language-Name", language.name]
      ]
    , entries: []
  });
}
// ----------------------------------------------------------------

/**
 * Writes the template of the messages of some sources, for a script that
 * is minified: the core's dist.sh gives its sources, and the studios read
 * the template next to the script (see listSources).
 *
 * @param {string} out The template to write.
 * @param {Array<string>} files The sources, in the order they load.
 * @param {string} prefix What the references start with, the folder of the
 *   script in a studio.
 * @return {number} How many messages the template has.
 */
function writeTemplate(out: string, files: string[], prefix: string): number {
  const I18n = loadI18n();
  const gathered = gather(I18n, process.cwd(), files.map(file => ({ file: file, kind: "script" })));
  
  if (gathered.errors.length) {
    gathered.errors.forEach(error => console.log("ERROR " + error));
    process.exit(1);
  }
  
  I18n.setTemplate(gathered.entries.map(entry => [entry.id, entry.plural, entry.references.map(reference => prefix + reference).join(" ")]));
  fs.writeFileSync(out, I18n.toPo(null, "studio-core"));
  
  return gathered.entries.length;
}
// ----------------------------------------------------------------

/**
 * Builds the translations of a studio.
 *
 * @param {Object} config The studio: root (its folder), project (its name
 *   and version), page (the page that loads its scripts, from the root),
 *   skip(file) (true for a script whose messages are not translated),
 *   source(file) (the file whose messages a script of the page carries:
 *   its TypeScript source), folders (where the sources are, ["js"] by
 *   default), author and license (of the script of the languages), log(line) (where
 *   to write; the console by default).
 * @param {Array<string>} args The options.
 * @return {Object} {ok, written}: false when a file is not up to date
 *   (--check) or when there are errors, and the files written.
 */
function main(config: any, args: string[]) {
  const log = config.log || (line => console.log(line));
  const options = readOptions(args || []);
  
  if (options.help || options.error) {
    log((options.error ? options.error + "\n\n" : "") + "Usage: node scripts/build-i18n.ts [--check] [--new CODE] [--compendium FILE]");
    return { ok: !options.error, written: [] };
  }
  
  const I18n = loadI18n();
  const root = config.root;
  const sources = listSources(I18n, config);
  const gathered = gather(I18n, root, sources);
  const errors = gathered.errors.slice();
  const outputs = new Map();
  const report = [];
  
  forgotten(root, sources, config.folders || ["js"]).forEach(file => errors.push(file + " marks messages, but " + config.page + " does not load it: they are not in the template"));
  I18n.setTemplate(gathered.entries.map(entry => [entry.id, entry.plural, entry.references.join(" ")])
    , { project: config.project, author: config.author || "Roberto Metere", license: config.license || "MIT" });
  outputs.set(TEMPLATE, I18n.toPo(null, config.project));
  report.push(TEMPLATE + ": " + gathered.entries.length + " messages, from " + config.page + " and " + (sources.length - 1) + (sources.length === 2 ? " script" : " scripts"));

  // The PO files of lang/, by file, and the new one that the options start
  const folder = path.join(root, "lang");
  const texts = new Map();
  (fs.existsSync(folder) ? fs.readdirSync(folder) : []).filter(name => /\.po$/.test(name)).sort().forEach(name => {
    texts.set("lang/" + name, fs.readFileSync(path.join(folder, name), "utf8"));
  });
  const codeOf = text => I18n.key(I18n.parsePo(text).header["Language"] || "");
  const has = code => Array.from(texts.values()).some(text => codeOf(text) === I18n.key(code));
  const compendium = new Map();
  let compendiumCode = null;
  
  if (options.compendium) {
    const po = I18n.parsePo(fs.readFileSync(options.compendium, "utf8"));
    compendiumCode = I18n.key(po.header["Language"] || "");
    po.entries.forEach(entry => {
      if (!entry.obsolete && entry.context === null && !entry.flags.includes("fuzzy") && entry.strings.some(string => string) && !I18n.review(entry.id, entry.plural, entry.strings)) {
        compendium.set(entry.id, entry);
      }
    });
    
    if (!compendiumCode) {
      errors.push(options.compendium + ": the file does not say its language (Language, in its header)");
    } else if (!has(compendiumCode)) {
      const code = po.header["Language"].trim();
      texts.set("lang/" + code + ".po", startPo(I18n, config.project, {
          code: code
        , name: po.header["X-Language-Name"] || I18n.nameOf(code)
        , plural: po.header["Plural-Forms"] || pluralOf(I18n, code)
      }));
    }
  }
  if (options.create) {
    const code = options.create.replace(/_/g, "-");
    if (has(code)) {
      errors.push("lang/ has the language " + code + " already");
    } else {
      texts.set("lang/" + code + ".po", startPo(I18n, config.project, { code: code, name: I18n.nameOf(code), plural: pluralOf(I18n, code) }));
    }
  }

  // Each language, brought up to date and read back as the page will read it
  const languages = [];
  const seen = new Map();
  texts.forEach((text, file) => {
    const po = I18n.parsePo(text);
    const code = String(po.header["Language"] || "").trim();
    
    if (!code) {
      errors.push(file + ": the file does not say its language: write its code after Language, in its header (Language: zh for Chinese)");
      return;
    }
    
    if (seen.has(I18n.key(code))) {
      errors.push(file + ": " + seen.get(I18n.key(code)) + " is the language " + code + " too");
      return;
    }
    
    seen.set(I18n.key(code), file);
    const updated = I18n.updatePo(text, config.project, I18n.key(code) === compendiumCode ? compendium : new Map());
    const output = updated.text;
    // A file with lines that cannot be read stays as it is, for its translator to see them
    updated.problems.forEach(problem => errors.push(file + ":" + problem.line + ": this line cannot be read: " + problem.text.trim()));
    updated.twice.forEach(entry => errors.push(file + ":" + entry.line + ": " + JSON.stringify(entry.id) + " is in the file twice: this one is left out"));
    
    if (!updated.problems.length) {
      outputs.set(file, output);
    }
    
    if (updated.fromCompendium) {
      report.push(file + ": " + updated.fromCompendium + " translations from " + options.compendium);
    }
    
    if (updated.suggested) {
      report.push(file + ": " + updated.suggested + " translations suggested for changed messages, marked fuzzy: check them, and remove the mark");
    }
    
    const language = I18n.fromPo(output, "built-in");
    language.refused.forEach(refused => errors.push(file + ":" + refused.line + ": " + refused.reason + ": " + JSON.stringify(refused.id)));
    if (/INTEGER|EXPRESSION/.test(language.plural)) {
      errors.push(file + ": write the plural forms of the language after Plural-Forms, in its header (see the comments at the top of the file)");
    }
    
    languages.push(language);
    const done = gathered.entries.filter(entry => Object.prototype.hasOwnProperty.call(language.messages, entry.id)).length;
    const fuzzy = I18n.parsePo(output).entries.filter(entry => !entry.obsolete && entry.flags.includes("fuzzy") && entry.strings.some(string => string)).length;
    report.push(file + ": " + language.name + " (" + language.code + "), " + done + " of " + gathered.entries.length + " messages translated"
      + (fuzzy ? ", " + fuzzy + " marked fuzzy, to check" : ""));
  });
  languages.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  outputs.set(LANGUAGES, I18n.toScript(languages));
  report.push(LANGUAGES + ": " + ["English"].concat(languages.map(language => language.name)).join(", "));

  // The files, written or compared
  const written = [];
  outputs.forEach((text, file) => {
    const target = path.join(root, file);
    const same = fs.existsSync(target) && fs.readFileSync(target, "utf8") === text;
    
    if (same) {
      return;
    }
    
    if (options.check) {
      errors.push(file + " is not up to date: run node scripts/build-i18n.ts");
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
      written.push(file);
    }
  });
  report.forEach(line => log(line));
  
  if (written.length) {
    log("Wrote " + written.join(", "));
  }
  
  errors.forEach(error => log("ERROR " + error));
  
  return { ok: errors.length === 0, written: written };
}
// ----------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename && process.argv[2] === "--pot") {
  const count = writeTemplate(process.argv[3], process.argv.slice(4), "studio-core/");
  console.log("Wrote " + process.argv[3] + ": " + count + " messages");
}

export { main, writeTemplate, PLURALS };
