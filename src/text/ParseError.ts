/**
 * A syntax error (or an error that the verifier raises while parsing).
 *
 * @author Roberto Metere
 * @license MIT
 */
class ParseError extends Error {
  start: number;
  end: number;
  detail: string;

  /**
   * Builds a parse error.
   *
   * @param {string} message The message of the verifier ("Syntax error"
   *   for syntax errors).
   * @param {number} start First offset.
   * @param {number} end Offset after the faulty text.
   * @param {string} detail What was expected, for the editor.
   */
  constructor(message: string, start: number, end: number, detail?: string) {
    super(message);
    this.start = start;
   this.end = end;
    this.detail = detail;
  }
}
// ----------------------------------------------------------------
