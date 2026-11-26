/**
 * The theme of the studio: a preset, and the colours, the
 * font of the code and the size of the interface chosen by the user. They
 * are kept in the local storage and applied as CSS variables, over those of
 * the style sheet.
 *
 * TODO: Should I move part of it to external file to @import?
 *
 * @author Roberto Metere
 * @license MIT
 */
class ThemeSettings {
  /**
   * The presets: title (translated where it shows), base theme of Bootstrap
   * (null to follow the light or dark choice) and CSS variables.
   *
   * @type {Object<string, Object>}
   */
  static PRESETS: Record<string, any> = {
      studio: { title: I18n.mark("Studio (default)"), base: null, vars: {} }
    , midnight: {
          title: I18n.mark("Midnight")
        , base: "dark"
        , vars: { "--st-bg": "#0b1020", "--st-panel": "#0e1530", "--st-surface": "#101937", "--st-lane": "#131d40", "--st-raised": "#18244d", "--st-border": "#23305e", "--st-accent": "#7c9cff", "--st-k-out": "#4fd1c5", "--st-k-in": "#7c9cff" }
      }
    , paper: {
          title: I18n.mark("Paper (for printing and slides)")
        , base: "light"
        , vars: { "--st-bg": "#ffffff", "--st-panel": "#ffffff", "--st-surface": "#ffffff", "--st-lane": "#ffffff", "--st-border": "#c8c8c8", "--st-accent": "#222222", "--st-k-new": "#555555", "--st-k-in": "#333333", "--st-k-out": "#333333", "--st-k-let": "#777777", "--st-k-if": "#555555", "--st-k-call": "#444444", "--st-grid": "transparent" }
      }
    , contrast: {
          title: I18n.mark("High contrast")
        , base: "dark"
        , vars: { "--st-bg": "#000000", "--st-panel": "#000000", "--st-surface": "#000000", "--st-lane": "#000000", "--st-raised": "#000000", "--st-text": "#ffffff", "--st-muted": "#e0e0e0", "--st-border": "#ffffff", "--st-border-strong": "#ffffff", "--st-accent": "#ffd400" }
      }
    , solarized: {
          title: I18n.mark("Solarized light")
        , base: "light"
        , vars: { "--st-bg": "#eee8d5", "--st-panel": "#fdf6e3", "--st-surface": "#fdf6e3", "--st-lane": "#f5efdc", "--st-raised": "#fdf6e3", "--st-text": "#586e75", "--st-border": "#d9cfb3", "--st-accent": "#268bd2", "--st-k-new": "#6c71c4", "--st-k-in": "#268bd2", "--st-k-out": "#2aa198", "--st-k-if": "#d33682" }
      }
  };

  /**
   * The colours the user may change: CSS variable and label (translated
   * where it shows, but for the keywords of the languages).
   *
   * @type {Array<Object>}
   */
  static COLOURS = [
      { key: "--st-accent", label: I18n.mark("Accent") }
    , { key: "--st-bg", label: I18n.mark("Background") }
    , { key: "--st-lane", label: I18n.mark("Parties") }
    , { key: "--st-k-new", label: "new" }
    , { key: "--st-k-in", label: "in" }
    , { key: "--st-k-out", label: "out" }
    , { key: "--st-k-let", label: "let" }
    , { key: "--st-k-if", label: "if" }
    , { key: "--st-k-call", label: I18n.mark("Calls") }
  ];

  /**
   * Gives the colours the user may change: those of the studio
   * (StudioCore.app.colours), or COLOURS.
   *
   * @return {Array<Object>} The colours, {key, label}.
   */
  static colours(): { key: string; label: string }[] {
    return StudioCore.app.colours || ThemeSettings.COLOURS;
  }

  /**
   * The fonts of the code.
   *
   * @type {Array<string>}
   */
  static FONTS: string[] = ["", "\"DejaVu Sans Mono\", monospace", "\"Fira Code\", monospace", "\"JetBrains Mono\", monospace", "Consolas, monospace", "\"Courier New\", monospace"];

  /**
   * The CSS variables set by the theme applied last, to remove them.
   *
   * @type {Array<string>}
   */
  static applied: string[] = [];

  preset: any;
  colours: any;
  font: string;
  size: number;

  /**
   * @param {Object} values The theme: preset, colours (by variable), font
   *   and size (percent).
   */
  constructor(values: any = {}) {
    const defaults = {
        preset: "studio"
      , colours: {}
      , font: ""
      , size: 100
    };
    const merged = {...defaults, ...(values && typeof values === "object" ? values : {})};
    this.preset = ThemeSettings.PRESETS[merged.preset] ? merged.preset : "studio";
    this.colours = {...merged.colours};
    this.font = String(merged.font || "");
    this.size = Math.min(150, Math.max(80, Number(merged.size) || 100));
  }

  /**
   * Gives the theme kept in the browser. Up to Studio Core 3.5 it was kept
   * under the key of the light or dark choice of the studios, which wrote
   * over each other: a theme found there moves to its own key, and the
   * choice is left to the studio.
   *
   * @return {ThemeSettings} The theme kept in the browser.
   */
  static load(): ThemeSettings {
    try {
      const kept = localStorage.getItem(StudioCore.storageKey("appearance"));
      if (kept !== null) {
        return new ThemeSettings(JSON.parse(kept));
      }
      const old = JSON.parse(localStorage.getItem(StudioCore.storageKey("theme")) || "null");
      if (old && typeof old === "object") {
        const theme = new ThemeSettings(old);
        localStorage.removeItem(StudioCore.storageKey("theme"));
        theme.save();
        return theme;
      }
      return new ThemeSettings();
    } catch (e) {
      return new ThemeSettings();
    }
  }

  /**
   * Keeps the theme in the browser.
   */
  save() {
    try {
      localStorage.setItem(StudioCore.storageKey("appearance"), JSON.stringify({ preset: this.preset, colours: this.colours, font: this.font, size: this.size }));
    } catch (e) {
      // Without storage the theme lasts for this visit only
    }
  }

  /**
   * Applies the theme to the page, removing what an earlier theme set.
   *
   * @param {string} base The light or dark choice of the user.
   */
  apply(base: string) {
    const style = document.documentElement.style;
    ThemeSettings.applied.forEach(key => style.removeProperty(key));
    const preset = ThemeSettings.PRESETS[this.preset];
    const vars = {...preset.vars, ...this.colours};
    if (this.font) {
      vars["--st-mono"] = this.font;
    }
    Object.keys(vars).forEach(key => style.setProperty(key, vars[key]));
    ThemeSettings.applied = Object.keys(vars);
    document.documentElement.setAttribute("data-bs-theme", preset.base || base);
    document.body.style.zoom = this.size === 100 ? "" : String(this.size/100);
  }
}
// ----------------------------------------------------------------
