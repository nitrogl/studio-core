/**
 * @file Checks my conventions of the source style to keep readability high
 *
 * Usage: node tests/check-style.ts
 *
 * @author Roberto Metere
 * @license MIT
 */

import fs from "node:fs";
import path from "node:path";
import { root, checker } from "./load.ts";

const { check, failures } = checker();
const MARKER = "// " + "-".repeat(64);

/**
 * Lists the files of a folder, recursively.
 *
 * @param {string} folder The folder, from the root.
 * @param {RegExp} pattern The names to keep.
 * @return {Array<string>} The files, from the root.
 */
function list(folder: string, pattern: RegExp): string[] {
  const result = [];
  fs.readdirSync(path.join(root, folder), { withFileTypes: true }).forEach(entry => {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      result.push(...list(file, pattern));
    } else if (pattern.test(entry.name)) {
      result.push(file);
    }
  });
  return result;
}
// ----------------------------------------------------------------

/**
 * Checks one script.
 *
 * @param {string} file The script, from the root.
 * @return {Array<string>} The problems, with their lines.
 */
function checkScript(file: string): string[] {
  const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
  const problems = [];
  const documented = i => i > 0 && /^\s*\*\/$/.test(lines[i - 1]);
  let inComment = false;
  let inClass = false;
  lines.forEach((line, i) => {
    const where = file + ":" + (i + 1) + ": ";
    const trimmed = line.trim();
    if (trimmed.startsWith("/*")) {
      inComment = true;
    }
    const comment = inComment || trimmed.startsWith("//");
    if (comment && /---|===|\*\*\*|___|~~~|###/.test(trimmed.replace(/^\/\*\*/, "")) && line !== MARKER) {
      problems.push(where + "separator in a comment");
    }
    if (!comment && line.includes(String.fromCharCode(96))) {
      problems.push(where + "template literal");
    }
    if (/^class \w+/.test(line)) {
      inClass = true;
    } else if (line === "}") {
      inClass = false;
    }
    if (/^class \w+/.test(line) || /^function \w+\(/.test(line)) {
      if (!documented(i)) {
        problems.push(where + "no JSDoc before " + trimmed);
      }
      let end = i + 1;
      while (end < lines.length && lines[end] !== "}") {
        end++;
      }
      if (lines[end + 1] !== MARKER) {
        problems.push(file + ":" + (end + 1) + ": no end marker after " + trimmed);
      }
    }
    if (inClass && (/^  (static |async |get |set )*[A-Za-z_][\w$]*\(.*\)(: .+)? \{$/.test(line) || /^  static [\w$]+(: [^=]+)?( =|;)/.test(line))) {
      if (!documented(i)) {
        problems.push(where + "no JSDoc before " + trimmed);
      }
    }
    if (line === MARKER && lines[i - 1] !== "}") {
      problems.push(where + "end marker not after a top-level class or function");
    }
    if (trimmed.endsWith("*/")) {
      inComment = false;
    }
  });
  return problems;
}
// ----------------------------------------------------------------

const scripts = list("src", /\.ts$/).concat(list("types", /\.ts$/), list("tools", /\.ts$/), list("tests", /\.ts$/));
const others = ["README.md", "dist.sh"].concat(list("css", /\.css$/));

scripts.forEach(file => {
  const problems = checkScript(file);
  check(problems.length === 0, file + (problems.length ? "\n  " + problems.join("\n  ") : ""));
});
scripts.concat(others).forEach(file => {
  const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
  const bad = lines.map((line, i) => (/[^\x00-\x7f]/.test(line) ? i + 1 : 0)).filter(Boolean);
  if (bad.length) {
    check(false, file + ": not ASCII at lines " + bad.join(", "));
  }
});
check(true, scripts.length + " scripts and " + others.length + " other files are ASCII");

process.exit(failures() ? 1 : 0);
