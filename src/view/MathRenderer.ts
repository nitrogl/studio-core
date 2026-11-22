/**
 * Renders LaTeX with KaTeX, for the Design mode.
 *
 * KaTeX renders synchronously into HTML, so a block is drawn complete at
 * once, without the reflow of an asynchronous renderer. Renderings are kept
 * in a cache, since the diagram redraws the same formulas often. Types are
 * marked by the LaTeX writer with \htmlClass{st-type}{...}, and the pieces
 * of a formula with their place in the code with \htmlData{st-range=a-b}
 * (NotationWriter.located): the only commands that KaTeX may trust here.
 *
 * This is my first time with KaTeX, I used to use MathJax.
 *
 * @author Roberto Metere
 * @license MIT
 */
class MathRenderer {
  /**
   * The rendered formulas, by LaTeX source.
   *
   * @type {Map<string, string>}
   */
  static cache: Map<string, string> = new Map();

  /**
   * The largest number of formulas kept in the cache.
   *
   * @type {number}
   */
  static CACHE_SIZE = 4000;

  /**
   * The longest formula worth drawing: past it (a tuple of thousands of
   * names, written by a program) the code is shown instead.
   *
   * @type {number}
   */
  static MAX_LENGTH = 3000;

  /**
   * Says which commands KaTeX may trust: classes, and the data of the place
   * of a piece in the code.
   *
   * @param {Object} context The command, as KaTeX describes it.
   * @return {boolean} True for those commands.
   */
  static trust(context: any): boolean {
    if (context.command === "\\htmlData") {
      return Object.keys(context.attributes || {}).every(key => key === "data-" + NotationWriter.RANGE);
    }
    
    return context.command === "\\htmlClass";
  }

  /**
   * Tells whether a formula is short enough to be drawn.
   *
   * @param {string|null} tex The LaTeX source.
   * @return {boolean} True when it can be drawn.
   */
  static fits(tex: string | null): boolean {
    return !!tex && tex.length <= MathRenderer.MAX_LENGTH;
  }

  /**
   * @return {boolean} True when KaTeX is loaded.
   */
  static isAvailable(): boolean {
    return typeof katex !== "undefined";
  }

  /**
   * Renders a formula into HTML.
   *
   * @param {string} tex The LaTeX source.
   * @param {boolean} display True for a display formula.
   * @return {string} The HTML, or the escaped source when KaTeX cannot
   *   render it.
   */
  static html(tex: string, display: boolean = false): string {
    const key = (display ? "D:" : "I:") + tex;
    const cached = MathRenderer.cache.get(key);
    
    if (cached !== undefined) {
      return cached;
    }
    
    let html;
    if (!MathRenderer.isAvailable()) {
      html = "<code>" + MathRenderer.escape(tex) + "</code>";
    } else {
      try {
        html = katex.renderToString(tex, {
            displayMode: display
          , throwOnError: true
          , strict: "ignore"
          , output: "html"
          , trust: MathRenderer.trust
        });
      } catch (e) {
        html = "<span class=\"st-tex-error\" title=\"" + MathRenderer.escape((e as Error).message) + "\">"
          + MathRenderer.escape(tex) + "</span>";
      }
    }
    
    if (MathRenderer.cache.size >= MathRenderer.CACHE_SIZE) {
      MathRenderer.cache.clear();
    }
    MathRenderer.cache.set(key, html);
    
    return html;
  }

  /**
   * Checks a formula.
   *
   * @param {string} tex The LaTeX source.
   * @return {string|null} The error of KaTeX, or null when it renders.
   */
  static error(tex: string): string | null {
    if (!MathRenderer.isAvailable()) {
      return null;
    }
    
    try {
      katex.renderToString(tex, { throwOnError: true, strict: "ignore", trust: MathRenderer.trust });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  /**
   * @param {string} text Any text.
   * @return {string} The text, safe to put in HTML.
   */
  static escape(text: string): string {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}
// ----------------------------------------------------------------
