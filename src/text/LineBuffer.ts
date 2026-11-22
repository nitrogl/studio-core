/**
 * Collects indented output lines and the comments attached to nodes.
 *
 * @author Roberto Metere
 * @license MIT
 */
class LineBuffer {
  lines: any[];
  opts: any;

  /**
   * Starts an empty buffer.
   *
   * @param {Object} opts Printer options (indent, comments).
   */
  constructor(opts: any) {
    this.lines = [];
    this.opts = opts;
  }

  /**
   * Adds a line.
   *
   * @param {number} level Indentation level.
   * @param {number} text The line text.
   */
  line(level: number, text: string) {
    this.lines.push({ level, text });
  }

  /**
   * Appends text to the last line.
   *
   * @param {string} text The text.
   */
  append(text: string) {
    this.lines[this.lines.length - 1].text += text;
  }

  /**
   * Appends the trailing comments of a node to the last line.
   *
   * @param {Object} node The node.
   */
  trailing(node: any) {
    if (!this.opts.comments || !node.trailingComments || !node.trailingComments.length) {
      return;
    }
    
    for (const c of node.trailingComments) {
      this.append(" " + c.text);
    }
  }

  /**
   * Adds the leading comments of a node, keeping their inner lines verbatim.
   *
   * @param {Object} node The node.
   * @param {number} level Indentation level of the first line.
   */
  comments(node: any, level: number) {
    if (!this.opts.comments || !node.leadingComments) {
      return;
    }
    
    for (const c of node.leadingComments) {
      const parts = c.text.split(/\r\n|\r|\n/);
      this.line(level, parts[0]);
      
      for (let i = 1; i < parts.length; i++) {
        this.lines.push({ level: 0, text: parts[i], raw: true });
      }
    }
  }

  /**
   * Gives the text.
   */
  toString() {
    return this.lines.map(l => (l.raw || l.text === "" ? l.text : this.opts.indent.repeat(l.level) + l.text)).join("\n");
  }
}
// ----------------------------------------------------------------
