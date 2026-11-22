/**
 * Short descriptions of the constructs of a model, shown when the pointer
 * rests on them: a block of the diagram, a keyword of the code.
 *
 * The descriptions are the studio's (StudioCore.app.explain). They show
 * after DELAY_MS without moving away, so that they do not get in the way of
 * the work, and the user can turn them off in the settings: the choice is
 * remembered in the browser.
 * 
 * This is also borrowed from MetaCP, but heavily refactored.
 *
 * @author Roberto Metere
 * @license MIT
 */
class Explainer {
  /**
   * How long the pointer rests on a construct before its description shows,
   * in milliseconds.
   *
   * @type {number}
   */
  static DELAY_MS = 1500;

  $tip: JQuery<HTMLElement>;
  timer: number;
  x: number;
  y: number;

  /**
   * Finds the tip of the descriptions in the page, or creates it, hidden:
   * every view shows its descriptions in the same one.
   */
  constructor() {
    const $existing = $("body > .st-explain");
    this.$tip = $existing.length ? $existing.first() : $("<div class=\"st-explain\" role=\"tooltip\"></div>").hide().appendTo("body");
    this.timer = 0;
    this.x = 0;
    this.y = 0;
  }

  /**
   * Says whether the descriptions show.
   *
   * @return {boolean} False when the user turned them off.
   */
  static enabled(): boolean {
    try {
      return localStorage.getItem(StudioCore.storageKey("explain")) !== "off";
    } catch (e) {
      return true;
    }
  }

  /**
   * Turns the descriptions on or off, for the next visits too.
   *
   * @param {boolean} on True to show them.
   */
  static setEnabled(on: boolean) {
    try {
      localStorage.setItem(StudioCore.storageKey("explain"), on ? "on" : "off");
    } catch (e) {
      // Without the storage of the browser, the choice lasts for the page only
    }
  }

  /**
   * Gives the HTML of the description of a construct.
   *
   * @param {Object} what {kind} for a block of the diagram, {keyword} for a
   *   keyword of the code.
   * @return {string|null} The HTML, or null when the studio has none.
   */
  static html(what: { kind?: string; keyword?: string }): string | null {
    const found = StudioCore.app.explain(what);
    if (!found) {
      return null;
    }

    return "<div class=\"st-explain-title\">" + MathRenderer.escape(found.title) + "</div>"
      + "<div class=\"st-explain-text\">" + MathRenderer.escape(found.text) + "</div>";
  }

  /**
   * Shows the description of a construct after the delay, unless the
   * pointer leaves it first (cancel) or the descriptions are off.
   *
   * @param {Object} what The construct, as html takes it.
   * @param {number} x Where the pointer is, in the window.
   * @param {number} y Where the pointer is, in the window.
   */
  schedule(what: { kind?: string; keyword?: string }, x: number, y: number) {
    this.cancel();
    if (!Explainer.enabled()) {
      return;
    }
    this.follow(x, y);

    this.timer = window.setTimeout(() => {
      const html = Explainer.html(what);
      if (html) {
        this.show(html);
      }
    }, Explainer.DELAY_MS);
  }

  /**
   * Remembers where the pointer is, for the description to show next to it.
   *
   * @param {number} x Where the pointer is, in the window.
   * @param {number} y Where the pointer is, in the window.
   */
  follow(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Shows a description next to the pointer, inside the window.
   *
   * @param {string} html The description.
   */
  show(html: string) {
    this.$tip.html(html).css({ left: 0, top: 0 }).show();
    const width = this.$tip.outerWidth();
    const height = this.$tip.outerHeight();
    const left = Math.max(8, Math.min(this.x + 14, window.innerWidth - width - 8));
    const top = this.y + 20 + height > window.innerHeight ? Math.max(8, this.y - height - 12) : this.y + 20;

    this.$tip.css({ left: left, top: top });
  }

  /**
   * Hides the description, and forgets the one that was waiting.
   */
  cancel() {
    clearTimeout(this.timer);
    this.$tip.hide();
  }
}
// ----------------------------------------------------------------
