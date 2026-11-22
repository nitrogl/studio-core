/**
 * Conversion between character offsets and line/column positions.
 *
 * @author Roberto Metere
 * @license MIT
 */
class LineIndex {
  src: string;
  starts: number[];

  /**
   * Indexes the line starts of a text ("\n", "\r" and "\r\n" all end a line,
   * as in pitlexer.mll).
   *
   * @param {string} src The text.
   */
  constructor(src: string) {
    this.src = src;
    this.starts = [0];
    
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === "\n") {
        this.starts.push(i + 1);
      } else if (c === "\r") {
        if (src[i + 1] === "\n") {
          this.starts.push(i + 2);
          i++;
        } else {
          this.starts.push(i + 1);
        }
      }
    }
  }

  /**
   * Finds the line and column of an offset.
   *
   * @param {number} offset A character offset.
   * @return {Object} {line, col}: 1-based line, 0-based column.
   */
  pos(offset: number) {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= offset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    
    return { line: lo + 1, col: offset - this.starts[lo] };
  }

  /**
   * Gives the offset where a line starts.
   *
   * @param {number} line A 1-based line number.
   * @return {number} The offset of its first character.
   */
  lineStart(line: number): number {
    const start = this.starts[line - 1];
    return start === undefined ? this.src.length : start;
  }

  /**
   * Gives the offset where a line ends (before its line break).
   *
   * @param {number} line A 1-based line number.
   * @return {number} The offset after its last character.
   */
  lineEnd(line: number): number {
    const next = this.starts[line];
    if (next === undefined) {
      return this.src.length;
    }
    
    let e = next;
    while (e > this.starts[line - 1] && (this.src[e - 1] === "\n" || this.src[e - 1] === "\r")) {
      e--;
    }
    return e;
  }

  /**
   * Gives the number of lines.
   */
  get lineCount() {
    return this.starts.length;
  }

  /**
   * Gives the offset of a line and column.
   *
   * @param {number} line 1-based line.
   * @param {number} col 0-based column.
   * @return {number} The offset, clamped to the line.
   */
  offset(line: number, col: number): number {
    const s = this.lineStart(line);
    return Math.min(s + col, this.lineEnd(line));
  }

  /**
   * Formats an extent the way ProVerif and CryptoVerif do: "line 5, characters 13-14".
   *
   * @param {number} start First offset.
   * @param {number} end Offset after the extent.
   * @return {Object} The location text.
   */
  extent(start: number, end: number) {
    const a = this.pos(start);
    const b = this.pos(end);
    const chStart = a.col + 1;
    const chEnd = b.col;
    
    if (a.line === b.line) {
      if (chStart >= chEnd) {
        return "line " + a.line + ", character " + chStart;
      }
      return "line " + a.line + ", characters " + chStart + "-" + chEnd;
    }
    
    return "line " + a.line + ", character " + chStart + " - line " + b.line + ", character " + chEnd;
  }

  /**
   * Formats an error message exactly as ProVerif and CryptoVerif print it.
   *
   * @param {Object} err {message, start, end}.
   * @param {string} fileName The file name to show.
   * @return {Object} The two-line error text.
   */
  formatError(err: any, fileName: string = "model" + StudioCore.app.extension) {
    const msg = err.message + (/[.?!]$/.test(err.message) ? "" : ".");
    
    return "File \"" + fileName + "\", " + this.extent(err.start, err.end) + ":\nError: " + msg;
  }
}
// ----------------------------------------------------------------
