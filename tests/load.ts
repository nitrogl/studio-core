/**
 * @file Loads the classes of the core that need no browser into a context,
 * as a page does with its script tags, for the checks that run under Node.
 *
 * @author Roberto Metere
 * @license MIT
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.join(import.meta.dirname, "..");

/**
 * The classes that need no browser, in the order of a page.
 *
 * @type {Array<string>}
 */
const CLASSES: string[] = [
    "StudioCore", "text/I18n", "text/LineIndex", "text/LineBuffer", "text/ParseError", "text/TextDiff", "text/EditHistory", "text/EditError"
  , "text/ZipWriter", "text/StudioMeta", "notation/Conventions", "notation/LatexLexer", "notation/HintParser"
  , "notation/NotationTable", "notation/NotationWriter", "notation/TikzWriter", "engine/ProofScript"
];

/**
 * Loads the classes into a new context.
 *
 * @return {Object} The context, where every class is defined.
 */
function loadClasses() {
  const context = vm.createContext({ console: console, TextEncoder: TextEncoder, TextDecoder: TextDecoder });
  CLASSES.forEach(file => {
    const name = path.basename(file);
    const source = fs.readFileSync(path.join(root, "js", file + ".js"), "utf8");
    vm.runInContext(source + "\nthis." + name + " = " + name + ";", context, { filename: file + ".js" });
  });
  return context;
}
// ----------------------------------------------------------------

/**
 * Counts the checks, and prints each one.
 *
 * @return {Object} check(ok, label), and failures() for the exit code.
 */
function checker() {
  let failures = 0;
  return {
      check: (ok, label) => {
        console.log((ok ? "PASS " : "FAIL ") + label);
        if (!ok) {
          failures++;
        }
      }
    , failures: () => failures
  };
}
// ----------------------------------------------------------------

export { root, loadClasses, checker };
