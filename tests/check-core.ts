/**
 * @file Checks the classes of the core that need no browser: the settings
 * of the application, the history of edits, positions in a text, the
 * metadata comment, the conventions that a language adds, the notation of
 * symbols, types included, and the names of messages, as a small language
 * of its own would use them.
 *
 * Usage: node tests/check-core.ts
 *
 * @author Roberto Metere
 * @license MIT
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { loadClasses, checker } from "./load.ts";
import * as build from "../tools/build-i18n.ts";

const { check, failures } = checker();
const core = loadClasses();

// A tiny language: two declarations, each after a comment with a hint
const text = "(* @notation '\\mathcal{K}' *)\ntype key.\n(* @infix '\\oplus' *)\nfun xor(bitstring, bitstring): bitstring.\n";
const second = text.indexOf("(* @infix");
const comments = [
    { text: text.slice(0, text.indexOf("*)") + 2), start: 0, end: text.indexOf("*)") + 2 }
  , { text: text.slice(second, text.indexOf("*)", second) + 2), start: second, end: text.indexOf("*)", second) + 2 }
];
const declarations = { key: { kind: "type" }, xor: { kind: "fun", args: ["bitstring", "bitstring"] } };
const analysis = { text: text, comments: comments, global: name => declarations[name] || null, check: { symbols: new Map() } };
core.StudioCore.configure({
    id: "demo"
  , name: "Demo"
  , language: "Demo"
  , extension: ".demo"
  , conventions: {
        DEFAULTS: { out: "\\mathsf{out}_{#1}({#2})" }
      , FIELDS: { out: ["channel", "message"] }
      , GROUPS: [{ title: "Actions", keys: ["out"] }, { title: "Colours", keys: ["attackerColor"] }]
    }
  , hintOwners: () => new Map([[comments[0].start, { kind: "decl", node: { name: "key" }, index: 0 }], [comments[1].start, { kind: "decl", node: { name: "xor" }, index: 1 }]])
  , hintTarget: owner => ({ name: owner.node.name, kind: "decl", index: owner.index })
});

// The settings of the application
check(core.StudioCore.storageKey("theme") === "demo.theme" && core.StudioCore.app.tokenize("x").tokens.length === 0, "the application: its keys, and defaults for what it does not give");

// The conventions: the core's, and those the language adds
const groups = core.Conventions.GROUPS.map(group => group.title).join(", ");
const conventions = new core.Conventions({ out: "\\mathsf{send}_{#1}({#2})", unknown: "x" });
check(groups === "Actions, Terms, Identifiers, Colours" && core.Conventions.FIELDS.out.length === 2 && conventions.get("out") === "\\mathsf{send}_{#1}({#2})"
  && conventions.get("typeStyle") === "\\mathsf{#}" && conventions.get("unknown") === "", "conventions defined by a language: " + groups);

// The notation of symbols: a type with a hint, a type in the style of types,
// an infix function, an identifier with a subscript
const table = core.NotationTable.build(analysis, { conventions: new core.Conventions() });
const writer = new core.NotationWriter(table);
check(table.problems.length === 0, "the hints apply to the declarations they precede" + (table.problems.length ? ": " + table.problems[0].message : ""));
check(writer.type("key") === "\\htmlClass{st-type}{\\mathcal{K}}", "a type with a notation: " + writer.type("key"));
check(writer.type("nonce") === "\\htmlClass{st-type}{\\mathsf{nonce}}", "a type in the style of types: " + writer.type("nonce"));
check(writer.application("xor", [{ tex: "x", level: 100 }, { tex: "y", level: 100 }], "fun") === "x \\oplus y", "an infix function: x \\oplus y");
check(writer.ident("k_A", "var") === "k_{A}" && writer.ident("nonce", "var") === "\\mathit{nonce}", "identifiers: k_{A}, \\mathit{nonce}");
const raw = core.LatexLexer.tokenize("\\htmlClass{st-raw}{\\mathtt{a\\_b}}", false).tokens[0];
check(raw && raw.t === "raw" && raw.v === "a_b", "raw code reads back from its class: " + JSON.stringify(raw));

// Messages named by @inout: an output and the input of another process
// that receives it, not the input of its own process; a name that no input
// has, and a hint before an action that is no message
const flow = "(* @inout m1 *)\nout.\n(* @inout m1 *)\nin.\n(* @inout m1 *)\nin.\n(* @inout lost *)\nout.\n(* @inout m1 *)\nnew.\n";
const flowComments = [...flow.matchAll(/\(\*[^*]*\*\)/g)].map(m => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
const actions = ["Out", "In", "In", "Out", "New"].map((kind, i) => ({ kind: "action", node: { kind: kind }, path: ["process", i] }));
const settings = core.StudioCore.app;
core.StudioCore.configure({ ...settings, hintOwners: () => new Map(flowComments.map((comment, i) => [comment.start, actions[i]]))
  , messageSide: node => (node.kind === "Out" ? "out" : node.kind === "In" ? "in" : null) });
const flowTable = core.NotationTable.build({ text: flow, comments: flowComments, global: () => null, check: { symbols: new Map() } }, { conventions: new core.Conventions() });
const named = flowTable.namedLinks(actions.map((action, i) => ({ id: "b" + i, path: action.path, party: i === 1 ? "B" : "A" })));
const flowProblems = flowTable.problems.map(problem => problem.message).join(" | ");
check(flowTable.hasInouts() && flowTable.inout("process.1") === "m1" && named.length === 1 && named[0].from.id === "b0" && named[0].to.id === "b1" && named[0].name === "m1"
  && flowProblems === "@inout goes in a comment just before an output or an input | @inout lost: no input has this name",
  "@inout names the messages: " + named.map(link => link.from.id + " -> " + link.to.id).join(", ") + "; " + flowProblems);
core.StudioCore.configure(settings);

// The history of the text
const history = new core.EditHistory("a");
history.commit("ab");
history.commit("abc");
const undone = history.undo();
const redone = history.redo();
check(undone.text === "ab" && redone.text === "abc", "undo and redo");

// The history and the model kept while the page loads again
history.markSaved();
history.commit("abcd", { label: "Add d" });
history.undo();
const storage = new Map();
let reloads = 0;
core.sessionStorage = { setItem: (key, value) => storage.set(key, String(value)), getItem: key => (storage.has(key) ? storage.get(key) : null), removeItem: key => storage.delete(key) };
core.location = { reload: () => reloads++ };
core.StudioCore.reload({ fileName: "a.demo", history: history.snapshot() });
const resumed = core.StudioCore.resumed();
const again = new core.EditHistory("");
const restored = again.restore(resumed.history);
check(reloads === 1 && storage.size === 0 && core.StudioCore.resumed() === null && restored && again.text === "abc" && !again.dirty && again.canRedo
  && again.redo().text === "abcd" && again.undoLabel === "Add d" && !again.restore({ text: "x", done: [{ diff: null }], undone: [] }) && again.text === "abcd",
  "the history goes through a new load of the page, once; what is not a history is refused");

// Positions, and errors written as the verifiers write them
const index = new core.LineIndex("first\nsecond line\n");
const at = index.pos(8);
check(at.line === 2 && at.col === 2, "offset 8 is line 2, column 2: " + JSON.stringify(at));

// The metadata comment, with the tag of the application
const meta = core.StudioMeta.format({ lanes: { A: { x: 1, y: 2 } } });
check(meta.startsWith("(* demo: {") && core.StudioMeta.isMeta(meta) && !/demo:/.test(core.StudioMeta.strip("model\n" + meta + "\n")),
  "the metadata comment carries the id of the application");

// A language whose comments end with their line, and other block kinds
const app = core.StudioCore.app;
core.StudioCore.configure({ ...app, comment: { open: "//", close: "" }, diagram: { end: "Stop" } });
const line = core.StudioMeta.format({ lanes: { A: { x: 1, y: 2 } }, nolink: ["*)"] });
const lineText = "principal A[]\n\n" + line + "\n";
const lineRead = core.StudioMeta.read([{ text: line, start: lineText.indexOf(line), end: lineText.indexOf(line) + line.length }]);
check(line === "// demo: {\"lanes\":{\"A\":{\"x\":1,\"y\":2}},\"nolink\":[\"*)\"]}" && core.StudioMeta.isMeta(line) && lineRead.value.lanes.A.y === 2
  && core.StudioMeta.strip(lineText) === "principal A[]\n\n" && core.HintParser.format("label", "Alice") === "// @label 'Alice'",
  "comments that end with their line: " + line);
check(core.StudioCore.app.diagram.end === "Stop" && core.StudioCore.app.diagram.parallel === "Par" && core.StudioCore.app.diagram.endLabel(null) === "0",
  "the kinds of blocks of the diagram, the studio's over the defaults");
core.StudioCore.configure(app);
const escaped = core.StudioMeta.format({ nolink: ["a*)b"] });
check(escaped.includes("a\\u002a)b") && core.StudioMeta.read([{ text: escaped, start: 0, end: escaped.length }]).value.nolink[0] === "a*)b"
  && core.HintParser.format("label", "A") === "(* @label 'A' *)", "the delimiters inside the metadata are escaped: " + escaped.split("\n")[1]);

// A zip of two files
const zip = core.ZipWriter.make([{ name: "a.demo", text: "a" }, { name: "b.demo", text: "b" }]);
check(zip[0] === 0x50 && zip[1] === 0x4b, "a zip of two files: " + zip.length + " bytes");

// Translations: English by default, a language from a PO file, plurals
const I18n = core.I18n;
check(I18n.t("Save the model") === "Save the model" && I18n.t("{count} goals of {name}", { count: 3, name: "nsl" }) === "3 goals of nsl"
  && I18n.n("{count} goal", "{count} goals", 1) === "1 goal" && I18n.n("{count} goal", "{count} goals", 0) === "0 goals" && I18n.mark("Settings") === "Settings",
  "English, the language of the code, needs no translation");

const po = [
    "# A translation, with what a PO file may hold"
  , "msgid \"\""
  , "msgstr \"\""
  , "\"Language: it\\n\""
  , "\"Plural-Forms: nplurals=2; plural=(n != 1);\\n\""
  , "\"X-Language-Name: Italiano\\n\""
  , ""
  , "#: index.html:3"
  , "msgid \"Save the model\""
  , "msgstr \"Salva il modello\""
  , ""
  , "#. A message of several lines, with quotes"
  , "msgid \"\""
  , "\"Line one\\n\""
  , "\"and \\\"two\\\"\""
  , "msgstr \"Riga uno\\ne \\\"due\\\"\""
  , ""
  , "msgid \"{count} goal\""
  , "msgid_plural \"{count} goals\""
  , "msgstr[0] \"{count} obiettivo\""
  , "msgstr[1] \"{count} obiettivi\""
  , ""
  , "#, fuzzy"
  , "msgid \"Open a model\""
  , "msgstr \"Chiudi\""
  , ""
  , "#~ msgid \"Gone\""
  , "#~ msgstr \"Andato\""
  , ""
].join("\n");
const parsed = I18n.parsePo(po);
const italian = I18n.fromPo(po, "built-in");
check(parsed.header.Language === "it" && parsed.entries.length === 5 && parsed.entries[1].id === "Line one\nand \"two\"" && parsed.entries[4].obsolete
  && parsed.problems.length === 0 && italian.name === "Italiano" && italian.messages["Open a model"] === undefined && italian.messages["Gone"] === undefined,
  "a PO file: header, lines, escapes, plurals; fuzzy and obsolete messages left out");
const reread = I18n.parsePo(I18n.writePo({ comments: ["Again"], header: [["Language", "it"]], entries: parsed.entries }));
check(JSON.stringify(reread.entries.map(entry => [entry.id, entry.plural, entry.strings, entry.obsolete]))
  === JSON.stringify(parsed.entries.map(entry => [entry.id, entry.plural, entry.strings, entry.obsolete])) && reread.header.Language === "it",
  "a PO file written and read again is the same");
I18n.register(italian);
I18n.setTemplate([["Save the model", null, "index.html:3"], ["{count} goal", "{count} goals", "a.js:1 b.js:2"], ["Untranslated", null, ""]]);

const chosen = [I18n.choose("auto", ["it-IT", "en"]), I18n.choose("auto", ["fr-FR", "de"]), I18n.choose("zh", []), I18n.choose("en", ["it"])];
I18n.use("it");
check(chosen.join() === "it,en,en,en" && I18n.language() === "it" && I18n.t("Save the model") === "Salva il modello" && I18n.t("Untranslated") === "Untranslated"
  && I18n.n("{count} goal", "{count} goals", 1) === "1 obiettivo" && I18n.n("{count} goal", "{count} goals", 7) === "7 obiettivi",
  "Italian in use: " + I18n.t("Save the model") + ", " + I18n.n("{count} goal", "{count} goals", 7) + "; what is missing shows in English");
const listed = I18n.list();
const template = I18n.parsePo(I18n.toPo(null, "Demo 0.1"));
const improved = I18n.parsePo(I18n.toPo("it", "Demo 0.1"));
check(listed.length === 2 && listed[1].translated === 2 && listed[1].total === 3 && template.entries.length === 3 && template.entries.every(entry => entry.strings.every(string => string === ""))
  && template.entries[1].references.join(" ") === "a.js:1 b.js:2" && improved.header.Language === "it" && improved.entries[0].strings[0] === "Salva il modello",
  "the file to translate: the template, or a language to improve");
I18n.register({ code: "it", name: "Mio italiano", plural: "nplurals=2; plural=(n != 1);", messages: { "Save the model": "Salvalo" }, origin: "loaded" });
const mine = I18n.t("Save the model");
I18n.unregister("it");
check(mine === "Salvalo" && I18n.t("Save the model") === "Salva il modello", "a translation loaded by the user hides the one shipped, until it is removed");
I18n.use("en");
const rule = header => {
  const forms = I18n.pluralForms(header);
  return [0, 1, 2, 3, 5, 11, 21, 22, 25, 101, 111].map(forms.rule).join("");
};
check(rule("nplurals=1; plural=0;") === "00000000000" && rule("nplurals=2; plural=(n > 1);") === "00111111111"
  && rule("nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);") === "20112221222"
  && rule("nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);") === "01233444454"
  && rule("nplurals=2; plural=alert(1);") === "10111111111" && rule("") === "10111111111",
  "plural forms of Chinese, French, Polish and Arabic; an expression that is not one is refused");

const script = "/**\n * I18n.t(\"In a comment\")\n */\nconst a = I18n.t(\"Hello {name}\", { name: x });\n"
  + "const b = I18n.n(\"{count} file\", \"{count} files\", n);\nconst c = I18n.mark(\"A long \" +\n  \"message\");\nconst d = I18n.t(title);\nconst e = I18n.t(\"Bad \" + name);\n"
  + "const f = I18n.t(\"A \\\"quoted\\\" word\");\n";
const fromScript = I18n.extract(script, "script", "a.js");
check(fromScript.messages.map(message => message.id + (message.plural ? "|" + message.plural : "")).join(" / ") === "Hello {name} / {count} file|{count} files / A long message / A \"quoted\" word"
  && fromScript.messages[1].references[0] === "a.js:5" && fromScript.problems.length === 1 && fromScript.problems[0].reference === "a.js:9",
  "the messages of a script: literals, plurals, marks; not the comments; a message built with + is reported");

const page = "<ul>\n  <li><a data-i18n href=\"#\" title=\"Open it\"><i class=\"fas\"></i>Open a   model<kbd>Ctrl+O</kbd></a></li>\n</ul>\n"
  + "<span data-i18n=\"title\" title=\"The model\">untitled.demo</span>\n"
  + "<template id=\"about\"><p data-i18n-html>Free: see <a href=\"LICENSE\">LICENSE</a>, by Cad&eacute;.</p></template>\n";
const fromPage = I18n.extract(page, "page", "index.html");
check(fromPage.messages.map(message => message.id).join(" / ") === "Open a model / Open it / The model / Free: see <a href=\"LICENSE\">LICENSE</a>, by Cad" + String.fromCharCode(233) + "."
  && fromPage.messages[3].references[0] === "index.html:5",
  "the messages of a page: texts and titles, or the attributes listed, and the content of an element with its tags, in templates too");

// The build of the translations of a studio: the template, a language
// brought up to date, the script of the languages, a new language
check(I18n.review("Run proverif <file> on <b>it</b>", null, ["Esegui proverif <file> su <b>questo</b>"]) === null
  && I18n.review("Run proverif <file>", null, ["Esegui proverif <questo file>"]) === null
  && I18n.review("Run proverif <file>", null, ["Esegui <b>proverif</b>"]) !== null
  && I18n.review("{count} goal", "{count} goals", ["un obiettivo", "{count} obiettivi"]) === null
  && I18n.review("Open {file}", null, ["Apri"]) !== null && I18n.review("Open {file}", null, ["Apri {name}"]) !== null,
  "the review of a translation: its placeholders, its tags of HTML, and angle brackets that are text");
const studio = fs.mkdtempSync(path.join(os.tmpdir(), "studio-i18n-"));
fs.mkdirSync(path.join(studio, "js"));
fs.mkdirSync(path.join(studio, "lang"));
fs.writeFileSync(path.join(studio, "index.html"), "<p data-i18n>Hello</p>\n<script src=\"js/jquery.min.js\"></script>\n<script src=\"js/a.js\"></script>\n"
  + "<!-- <script src=\"js/old.js\"></script> -->\n<script src=\"lang/languages.js\"></script>\n");
fs.writeFileSync(path.join(studio, "js", "a.js"), "const a = I18n.t(\"Save {file}\", { file: f });\nconst b = I18n.n(\"{count} goal\", \"{count} goals\", n);\n"
  + "const c = I18n.t(\"Open the model of the protocol now\");\nconst d = I18n.t(\"Hello\");\n");
fs.writeFileSync(path.join(studio, "lang", "it.po"), ["# Mine", "msgid \"\"", "msgstr \"\"", "\"Language: it\\n\"", "\"Plural-Forms: nplurals=2; plural=(n != 1);\\n\"", "",
  "msgid \"Hello\"", "msgstr \"Ciao\"", "", "msgid \"Save {file}\"", "msgstr \"Salva\"", "", "msgid \"Open the model of the protocol\"", "msgstr \"Apri il modello del protocollo\"", "",
  "msgid \"Gone\"", "msgstr \"Andato\"", ""].join("\n"));
const output = [];
const config = { root: studio, project: "Demo 1.0", page: "index.html", license: "MIT", log: line => output.push(line) };
const read = file => fs.readFileSync(path.join(studio, file), "utf8");
const built = build.main(config, []);
const italianPo = read("lang/it.po");
const languagesJs = read("lang/languages.js");
const browser = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(import.meta.dirname, "..", "js", "text", "I18n.js"), "utf8") + "\n" + languagesJs + "\nthis.I18n = I18n;", browser);
const shipped = browser.I18n.languages.get("it");
check(!built.ok && built.written.join() === "lang/template.pot,lang/it.po,lang/languages.js" && italianPo.startsWith("# Mine\nmsgid \"\"\nmsgstr \"\"\n\"Project-Id-Version: Demo 1.0\\n\"")
  && /#: index.html:1 js\/a.js:4\nmsgid "Hello"\nmsgstr "Ciao"/.test(italianPo) && /#, fuzzy\nmsgid "Open the model of the protocol now"\nmsgstr "Apri il modello del protocollo"/.test(italianPo)
  && /#~ msgid "Gone"\n#~ msgstr "Andato"/.test(italianPo) && /msgid "\{count\} goal"\nmsgid_plural "\{count\} goals"\nmsgstr\[0\] ""\nmsgstr\[1\] ""/.test(italianPo)
  && browser.I18n.entries.length === 4 && shipped && shipped.messages["Hello"] === "Ciao" && !("Save {file}" in shipped.messages) && !/Apri/.test(languagesJs) && !/[^\x00-\x7e]/.test(languagesJs)
  && output.some(line => /^ERROR lang\/it.po:\d+: the translation leaves out \{file\}: "Save \{file\}"$/.test(line)),
  "the build: the template, a language brought up to date (a suggestion for a changed message, an obsolete one), the script without what is refused");
fs.writeFileSync(path.join(studio, "lang", "it.po"), italianPo.replace("msgstr \"Salva\"", "msgstr \"Salva {file}\"").replace("#, fuzzy\n", ""));
const stale = build.main(config, ["--check"]);
build.main(config, []);
const fresh = build.main(config, ["--check"]);
check(!stale.ok && output.some(line => line === "ERROR lang/languages.js is not up to date: run node scripts/build-i18n.ts") && fresh.ok && fresh.written.length === 0
  && /"Save \{file\}": "Salva \{file\}"/.test(read("lang/languages.js")) && /Apri il modello del protocollo/.test(read("lang/languages.js")),
  "--check: a file not up to date fails, then passes once the build has run");
const started = build.main(config, ["--new", "zh"]);
const chinese = read("lang/zh.po");
check(started.ok && /"Language: zh\\n"/.test(chinese) && /"Plural-Forms: nplurals=1; plural=0;\\n"/.test(chinese) && /msgid "\{count\} goal"\nmsgid_plural "\{count\} goals"\nmsgstr\[0\] ""\n\n/.test(chinese)
  && /code: "zh"/.test(read("lang/languages.js")) && build.main(config, ["--new", "zh"]).ok === false,
  "--new starts a language, with its plural forms, once");
fs.rmSync(studio, { recursive: true, force: true });

// The script of the languages that the Language pane gives for a
// translation loaded from a file is the one that the build writes once the
// file is in lang/, and so is the file that it gives back
const site = fs.mkdtempSync(path.join(os.tmpdir(), "studio-i18n-"));
fs.mkdirSync(path.join(site, "js"));
fs.mkdirSync(path.join(site, "lang"));
fs.writeFileSync(path.join(site, "index.html"), "<p data-i18n>Hello</p>\n<script src=\"js/a.js\"></script>\n<script src=\"lang/languages.js\"></script>\n");
fs.writeFileSync(path.join(site, "js", "a.js"), "const a = I18n.t(\"Save {file}\", { file: f });\nconst b = I18n.n(\"{count} goal\", \"{count} goals\", n);\n");
const siteConfig = { root: site, project: "Demo 1.0", page: "index.html", author: "A. Teacher", license: "MIT", log: () => {} };
const readSite = file => fs.readFileSync(path.join(site, file), "utf8");
build.main(siteConfig, ["--new", "it"]);
fs.writeFileSync(path.join(site, "lang", "it.po"), readSite("lang/it.po").replace("msgid \"Hello\"\nmsgstr \"\"", "msgid \"Hello\"\nmsgstr \"Ciao\""));
build.main(siteConfig, []);
const student = readSite("lang/template.pot").replace("\"Language: \\n\"", "\"Language: zh_CN\\n\"")
  .replace("nplurals=INTEGER; plural=EXPRESSION;", "nplurals=1; plural=0;").replace("\"X-Language-Name: \\n\"", "\"X-Language-Name: \u4e2d\u6587\\n\"")
  .replace("msgid \"Hello\"\nmsgstr \"\"", "msgid \"Hello\"\nmsgstr \"\u4f60\u597d\"")
  .replace("msgid_plural \"{count} goals\"\nmsgstr[0] \"\"", "msgid_plural \"{count} goals\"\nmsgstr[0] \"{count} \u4e2a\u76ee\u6807\"");
const inPage = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(import.meta.dirname, "..", "js", "text", "I18n.js"), "utf8") + "\n" + readSite("lang/languages.js") + "\n"
  + fs.readFileSync(path.join(import.meta.dirname, "..", "js", "view", "LanguagePane.js"), "utf8") + "\nthis.I18n = I18n;\nthis.LanguagePane = LanguagePane;", inPage);
const givenScript = inPage.LanguagePane.script({ zh_CN: student }, inPage.I18n.notice.project);
const givenPo = inPage.I18n.updatePo(student, inPage.I18n.notice.project).text;
fs.writeFileSync(path.join(site, "lang", "student.po"), student);
const withStudent = build.main(siteConfig, []);
check(withStudent.ok && givenScript === readSite("lang/languages.js") && givenPo === readSite("lang/student.po") && build.main(siteConfig, ["--check"]).ok
  && /code: "zh_CN"/.test(givenScript) && /code: "it"/.test(givenScript) && / \* @author A\. Teacher\n/.test(givenScript)
  && /msgstr\[0\] "\{count\} \u4e2a\u76ee\u6807"/.test(givenPo) && !/^msgstr\[1\]/m.test(givenPo) && inPage.I18n.notice.project === "Demo 1.0",
  "the Language pane gives the script of the languages and the file of a translation that it loads as the build writes them in lang/");
fs.rmSync(site, { recursive: true, force: true });

// An interactive prover, as Proof General drives one: the sentences end with
// a full stop, the prover takes them one at a time, and refuses "fail."
const before = core.StudioCore.app;
core.StudioCore.configure({ ...before, sentences: source => [...source.matchAll(/\S[^.]*\./g)].map(m => ({ start: m.index, end: m.index + m[0].length })) });
const calls = [];
const session = {
    run: sentence => new Promise(resolve => setTimeout(() => {
      calls.push("run " + sentence.text);
      resolve(sentence.text === "fail." ? { ok: false, error: { message: "refused", start: 0, end: 4 } } : { ok: true, goals: "after " + sentence.text });
    }, 1))
  , undo: count => {
      calls.push("undo " + count);
      return Promise.resolve();
    }
};
const proof = "lemma a. proof. trivial. qed.\n";
const prover = new core.ProofScript({ session: session, text: proof });
prover.next();
prover.next();
await prover.idle();
const regions = JSON.stringify(prover.regions());
check(prover.checked.length === 2 && regions === "[{\"start\":0,\"end\":15,\"cls\":\"st-checked\"}]" && prover.answerAt(20).goals === "after proof."
  && calls.join(", ") === "run lemma a., run proof.", "the prover checks one sentence at a time: " + regions);
prover.setText("lemma a. proof.\n  trivial. qed.\nlemma b.");
check(prover.checked.length === 2 && calls.length === 2, "an edit after the checked sentences keeps them");
prover.goTo(proof.length + 2);
await prover.idle();
check(prover.checked.length === 4 && prover.last().goals === "after qed.", "going to an offset checks the sentences before it: " + prover.checked.length);
prover.setText("lemma b. proof.\n  trivial. qed.\nlemma b.");
await prover.idle();
check(prover.checked.length === 0 && calls[calls.length - 1] === "undo 0" && JSON.stringify(prover.regions()) === "[]", "an edit of a checked sentence retracts it, and those after it");
prover.setText("lemma c. fail. qed.");
prover.all();
await prover.idle();
const problem = prover.problem();
check(prover.checked.length === 1 && problem && problem.start === 9 && problem.end === 13 && problem.message === "refused"
  && prover.regions().map(region => region.cls).join(" ") === "st-checked st-failed", "a refused sentence stops the prover, with its error in the code");
prover.setText("lemma c. done. qed.");
prover.next();
const waiting = prover.regions().map(region => region.cls).join(" ");
prover.setText("lemma d. done. qed.");
await prover.idle();
check(prover.problem() === null && waiting === "st-checked st-queued" && prover.checked.length === 0, "an edit while the prover works retracts what it changes");
let stop = null;
const slow = {
    run: () => new Promise(resolve => {
      stop = () => resolve({ ok: false, interrupted: true });
    })
  , undo: () => Promise.resolve()
  , interrupt: () => stop()
};

const halted = new core.ProofScript({ session: slow, text: "a. b." });
halted.all();
halted.interrupt();
await halted.idle();
check(halted.checked.length === 0 && halted.problem() === null && halted.regions().length === 0, "an interrupted sentence is neither checked nor refused");

const located = new core.NotationWriter(null);
located.origin = 10;
check(located.located("x", 12, 15) === "\\htmlData{st-range=2-5}{x}" && new core.NotationWriter(null).located("x", 12, 15) === "x",
  "the writer marks a piece with its place in the code, from the start of its row");
core.StudioCore.configure(before);
check(core.StudioCore.app.sentences("a. b.").length === 1 && core.StudioCore.app.sentences(" ").length === 0, "by default, the text is one sentence");

process.exit(failures() ? 1 : 0);
