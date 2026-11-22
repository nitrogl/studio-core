/**
 * The bar of a refactoring, above the code: which name, the
 * new name, how many occurrences are chosen, the problems of the new name
 * and the lines that change. The code cannot be edited meanwhile; a click
 * on an occurrence includes it or leaves it out.
 *
 * @author Roberto Metere
 * @license MIT
 */
class RefactorBar {
  handlers: any;
  $bar: JQuery<HTMLElement>;
  session: any;
  $name: JQuery<HTMLElement>;
  $count: JQuery<HTMLElement>;
  $problems: JQuery<HTMLElement>;
  $lines: JQuery<HTMLElement>;
  timer: number;

  /**
   * @param {Object} params The bar parameters.
   * @param {string} params.container The element before which the bar goes.
   * @param {Object} params.handlers The callbacks: choose(symbolId),
   *   all(included), apply(name), cancel().
   */
  constructor(params: { container?: string; handlers?: any }) {
    const defaults = {
        container: "#code"
      , handlers: {}
    };
    
    params = {...defaults, ...params};
    this.handlers = {
        choose: () => {}
      , all: () => {}
      , apply: () => {}
      , cancel: () => {}
      , ...params.handlers
    };
    
    this.$bar = $("<div class=\"st-refactor\"></div>").hide().insertBefore(params.container);
    this.session = null;
  }

  /**
   * Shows the bar for a session.
   *
   * @param {RefactorSession} session The session.
   * @param {Array<Object>} candidates The names of the part, {symbol, count}.
   */
  open(session: any, candidates: any[]) {
    this.session = session;
    const $choice = $("<select class=\"form-select form-select-sm st-mono\"></select>");
    
    candidates.forEach(candidate => {
      $choice.append($("<option></option>").attr("value", candidate.symbol.id).text(candidate.symbol.name + " (" + candidate.count + ")")
        .prop("selected", candidate.symbol.id === session.symbol.id));
    });
    
    this.$name = $("<input type=\"text\" class=\"form-control form-control-sm st-mono\" spellcheck=\"false\">").val(session.symbol.name);
    this.$count = $("<span class=\"st-refactor-count\"></span>");
    this.$problems = $("<div class=\"st-refactor-problems\"></div>");
    this.$lines = $("<div class=\"st-refactor-lines\"></div>");
    
    const $row = $("<div class=\"st-refactor-row\"></div>").append(
        "<i class=\"fas fa-wand-magic-sparkles\"></i>", $("<span></span>").text(I18n.t("Rename")), $choice, $("<span></span>").text(I18n.t("to")), this.$name, this.$count
      , $("<button type=\"button\" class=\"btn btn-sm btn-link\"></button>").text(I18n.t("all")).on("click", () => this.handlers.all(true))
      , $("<button type=\"button\" class=\"btn btn-sm btn-link\"></button>").text(I18n.t("none")).on("click", () => this.handlers.all(false))
      , $("<button type=\"button\" class=\"btn btn-sm btn-primary\"></button>").text(I18n.t("Apply")).on("click", () => this.handlers.apply(String(this.$name.val()).trim()))
      , $("<button type=\"button\" class=\"btn btn-sm btn-secondary\"></button>").text(I18n.t("Cancel")).on("click", () => this.handlers.cancel()));
    this.$bar.empty().append($row, this.$problems, this.$lines).show();
    $choice.on("change", () => this.handlers.choose(String($choice.val())));
    this.$name.on("input", () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.update(), 250);
    });
    this.$name.on("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.handlers.apply(String(this.$name.val()).trim());
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.handlers.cancel();
      }
    });
    
    this.update();
    this.$name.trigger("focus").trigger("select");
  }

  /**
   * Shows the count, the problems and the changed lines of the name typed.
   */
  update() {
    const session = this.session;
    if (!session) {
      return;
    }
    const name = String(this.$name.val()).trim();
    const range = session.range ? I18n.t("lines {from} to {to}", { from: session.analysis.lineIndex.pos(session.range.start).line, to: session.analysis.lineIndex.pos(session.range.end).line })
      : I18n.t("the whole model");
    this.$count.text(I18n.t("{included} of {total} in {range}", { included: session.included().length, total: session.occurrences.length, range: range }));
    this.$problems.empty();
    this.$lines.empty();
    if (name === "" || name === session.symbol.name) {
      this.$problems.append($("<span class=\"st-muted\"></span>").text(I18n.t("Type the new name: nothing changes until you apply it. Click an occurrence in the code to leave it out.")));
      return;
    }
    const result = session.check(name);
    result.problems.forEach(problem => {
      this.$problems.append($("<div class=\"st-warning\"></div>").append("<i class=\"fas fa-triangle-exclamation\"></i> ", document.createTextNode(problem)));
    });
    result.lines.slice(0, 8).forEach(line => {
      this.$lines.append($("<div></div>").append($("<span class=\"st-problem-line\"></span>").text(I18n.t("line {number}", { number: line.line })),
        $("<code></code>").text(line.after.trim())));
    });
    if (result.lines.length > 8) {
      this.$lines.append($("<div class=\"st-muted\"></div>").text(I18n.n("and {count} more line", "and {count} more lines", result.lines.length - 8)));
    }
  }

  /**
   * @return {string} The name typed.
   */
  name(): string {
    return this.$name ? String(this.$name.val()).trim() : "";
  }

  /**
   * Hides the bar.
   */
  close() {
    this.session = null;
    this.$bar.hide().empty();
  }
}
// ----------------------------------------------------------------
