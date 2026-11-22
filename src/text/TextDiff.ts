/**
 * Is the difference between two texts: one replaced range.
 *
 * @author Roberto Metere
 * @license MIT
 */
class TextDiff {
  /**
   * Computes the difference between two texts.
   *
   * @param {Object} a The old text.
   * @param {Object} b The new text.
   * @return {Object} {at, removed, inserted}.
   */
  static between(a: any, b: any) {
    let i = 0;
    const n = Math.min(a.length, b.length);
    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) {
      i++;
    }
    
    let j = 0;
    while (j < n - i && a.charCodeAt(a.length - 1 - j) === b.charCodeAt(b.length - 1 - j)) {
      j++;
    }
    
    return { at: i, removed: a.slice(i, a.length - j), inserted: b.slice(i, b.length - j) };
  }

  /**
   * Applies a difference forwards.
   *
   * @param {string} text The old text.
   * @param {Object} d The difference.
   * @return {string} The new text.
   */
  static forward(text: string, d: any): string {
    return text.slice(0, d.at) + d.inserted + text.slice(d.at + d.removed.length);
  }

  /**
   * Applies a difference backwards.
   *
   * @param {string} text The new text.
   * @param {Object} d The difference.
   * @return {Object} The old text.
   */
  static backward(text: string, d: any) {
    return text.slice(0, d.at) + d.removed + text.slice(d.at + d.inserted.length);
  }
}
// ----------------------------------------------------------------
