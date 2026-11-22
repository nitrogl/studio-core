/**
 * The code of the model: a plain textarea over a coloured copy of the
 * visible lines.
 *
 * The textarea holds the text and the caret; behind it, transparent text
 * over coloured spans shows the tokens, the problems (wavy underlines) and
 * the highlights (the selected block, the step of a trace, the occurrences
 * of the symbol under the caret); further behind, the regions of the text,
 * such as the part that an interactive prover checked (ProofScript). Only
 * the lines on screen are coloured, so long models stay fast. Undo and redo go to the history of the studio,
 * which also covers the changes made in the diagram.
 *
 * @author Roberto Metere
 * @license MIT
 */
class CodeView {
  /**
   * Height of a line, in pixels (as in the stylesheet).
   *
   * @type {number}
   */
  static LINE_H = 20;

  /**
   * Padding above the first line, in pixels.
   *
   * @type {number}
   */
  static PAD_TOP = 6;

  /**
   * Padding before the first column, in pixels.
   *
   * @type {number}
   */
  static PAD_LEFT = 12;

  /**
   * Lines rendered above and below the visible ones.
   *
   * @type {number}
   */
  static OVERSCAN = 25;

  /**
   * The indentation unit.
   *
   * @type {string}
   */
  static INDENT = "  ";

  handlers: any;
  text: string;
  lineStarts: number[];
  marks: any[];
  analysis: any;
  problems: any[];
  highlight: number[];
  extraMarks: any[];
  regions: any[];
  traceRange: number[];
  frame: number;
  lastSelection: { start: number; end: number; };
  charWidth: number;
  $editor: JQuery<HTMLElement>;
  textarea: HTMLTextAreaElement;
  $layer: JQuery<HTMLPreElement>;
  $regions: JQuery<HTMLElement>;
  $gutter: JQuery<HTMLElement>;
  $currentLine: JQuery<HTMLElement>;
  $tip: JQuery<HTMLElement>;
  caret: { line: number; column: number; };
  hoverTimer: number;
  explainer: Explainer;

  /**
   * @param {Object} params The view parameters.
   * @param {string} params.container The element that receives the editor.
   * @param {Object} params.handlers The callbacks: change(text, selection,
   *   difference) (difference being the TextDiff of the edit), cursor(selection),
   *   undo(), redo(), rename(offset), goTo(offset), click(offset), and
   *   keydown(event, offset), which the keys of the studio go to first (true
   *   when it handled the key).
   */
  constructor(params: { container?: string; handlers?: any }) {
    const defaults = {
        container: "#code"
      , handlers: {}
    };
    params = {...defaults, ...params};
    this.handlers = {
        change: () => {}
      , cursor: () => {}
      , undo: () => {}
      , redo: () => {}
      , rename: () => {}
      , goTo: () => {}
      , click: () => {}
      , keydown: () => false
      , ...params.handlers
    };
    this.text = "";
    this.lineStarts = [0];
    this.marks = [];
    this.analysis = null;
    this.problems = [];
    this.highlight = null;
    this.extraMarks = [];
    this.regions = [];
    this.traceRange = null;
    this.frame = 0;
    this.lastSelection = { start: 0, end: 0 };
    this.charWidth = 7.8;
    this.build($(params.container));
    this.bind();
  }

  /**
   * Creates the elements of the editor.
   *
   * @param {jQuery} $host The container.
   */
  build($host: JQuery) {
    this.$editor = $("<div class=\"st-code-editor\">"
      + "<div class=\"st-gutter\" aria-hidden=\"true\"><div class=\"st-gutter-inner\"></div></div>"
      + "<div class=\"st-code-main\">"
      + "<div class=\"st-code-regions\" aria-hidden=\"true\"></div>"
      + "<div class=\"st-current-line\" aria-hidden=\"true\"></div>"
      + "<pre class=\"st-code-layer\" aria-hidden=\"true\"></pre>"
      + "<textarea class=\"st-code-input\" spellcheck=\"false\" autocapitalize=\"off\" autocomplete=\"off\""
      + " autocorrect=\"off\" wrap=\"off\" aria-label=\"" + MathRenderer.escape(I18n.t("{language} code of the model", { language: StudioCore.app.language })) + "\"></textarea>"
      + "<div class=\"st-code-tip\" role=\"tooltip\"></div>"
      + "</div></div>").appendTo($host);
    this.textarea = this.$editor.find("textarea")[0];
    this.$layer = this.$editor.find("pre");
    this.$regions = this.$editor.find(".st-code-regions");
    this.$gutter = this.$editor.find(".st-gutter-inner");
    this.$currentLine = this.$editor.find(".st-current-line");
    this.$tip = this.$editor.find(".st-code-tip").hide();
  }

  /**
   * Measures the width of a character of the font.
   */
  measure() {
    const $probe = $("<span class=\"st-code-probe\"></span>").text("x".repeat(100));
    this.$editor.find(".st-code-main").append($probe);
    const width = $probe[0].getBoundingClientRect().width/100;
    $probe.remove();
    
    if (width > 0) {
      this.charWidth = width;
    }
  }

  /**
   * Listens to the user.
   */
  bind() {
    const textarea = this.textarea;
    $(textarea).on("input", () => this.onInput());
    $(textarea).on("scroll", () => this.schedule());
    $(textarea).on("keydown", event => this.keydown(event));
    $(textarea).on("mousemove", event => this.hover(event));
    this.explainer = new Explainer();
    
    $(textarea).on("mouseleave keydown scroll", () => {
      clearTimeout(this.hoverTimer);
      this.$tip.hide();
      this.explainer.cancel();
    });
    
    $(textarea).on("click", event => {
      if (event.ctrlKey || event.metaKey) {
        this.handlers.goTo(textarea.selectionStart);
      } else {
        this.handlers.click(textarea.selectionStart);
      }
    });
    
    $(textarea).on("focus", () => this.$editor.addClass("st-focused"));
    $(textarea).on("blur", () => this.$editor.removeClass("st-focused"));
    document.addEventListener("selectionchange", () => {
      if (document.activeElement === textarea) {
        this.onSelect();
      }
    });
    
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this.schedule()).observe(this.$editor[0]);
    }
    
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        this.measure();
        this.schedule();
      });
    }
  }

  /**
   * Puts a new text in the editor, keeping the scroll and, if possible, the
   * selection.
   *
   * @param {string} text The text.
   * @param {Object|null} selection The selection to restore, {start, end},
   *   or null to keep the current one.
   */
  setText(text: string, selection: any = null) {
    const textarea = this.textarea;
    if (textarea.value !== text) {
      const top = textarea.scrollTop;
      const left = textarea.scrollLeft;
      const start = Math.min(textarea.selectionStart, text.length);
      const end = Math.min(textarea.selectionEnd, text.length);
      textarea.value = text;
      
      if (selection && typeof selection.start === "number") {
        textarea.setSelectionRange(Math.min(selection.start, text.length), Math.min(selection.end, text.length));
      } else {
        textarea.setSelectionRange(start, end);
      }
      
      textarea.scrollTop = top;
      textarea.scrollLeft = left;
    }
    this.recolour();
  }

  /**
   * Gives the editor the analysis of its text and the problems to show.
   *
   * @param {Analysis} analysis The analysis of the text (or of the last
   *   text that parsed).
   * @param {Array<Object>} problems The problems, with their offsets.
   */
  setAnalysis(analysis: any, problems: any[]) {
    this.analysis = analysis;
    this.problems = problems || [];
    this.recolour();
  }

  /**
   * Highlights the code of the selected element.
   *
   * @param {Array<number>|null} range The offsets [start, end], or null.
   * @param {boolean} reveal True to scroll to it.
   */
  setHighlight(range: number[] | null, reveal: boolean = true) {
    this.highlight = range;
    if (range && reveal) {
      this.scrollToOffset(range[0]);
    }
    this.schedule();
  }

  /**
   * Highlights the code of the selected step of a trace.
   *
   * @param {Array<number>|null} range The offsets [start, end], or null.
   */
  setTraceRange(range: number[] | null) {
    this.traceRange = range;
    if (range) {
      this.scrollToOffset(range[0]);
    }
    this.schedule();
  }

  /**
   * Marks parts of the code, such as the occurrences of a refactoring.
   *
   * @param {Array<Object>} marks The marks, {start, end, cls}.
   */
  setMarks(marks: any[]) {
    this.extraMarks = marks;
    this.schedule();
  }

  /**
   * Colours regions of the text behind it, whole lines between their first
   * and their last, such as the part that an interactive prover checked.
   *
   * @param {Array<Object>} regions The regions, {start, end, cls}.
   */
  setRegions(regions: any[]) {
    this.regions = regions || [];
    this.schedule();
  }

  /**
   * Lets the code be edited, or not.
   *
   * @param {boolean} readOnly True to forbid editing.
   */
  setReadOnly(readOnly: boolean) {
    this.textarea.readOnly = readOnly;
    this.$editor.toggleClass("st-read-only", readOnly);
  }

  /**
   * @return {string} The text in the editor.
   */
  getText(): string {
    return this.textarea.value;
  }

  /**
   * @return {Object} The selection, {start, end}.
   */
  getSelection() {
    return { start: this.textarea.selectionStart, end: this.textarea.selectionEnd };
  }

  /**
   * Recomputes the lines and the colours of the text, then draws.
   */
  recolour() {
    const text = this.textarea.value;
    this.text = text;
    const starts = [0];
    
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) {
        starts.push(i + 1);
      }
    }
    
    this.lineStarts = starts;
    const analysis = this.analysis && this.analysis.text === text ? this.analysis : null;
    this.marks = CodeHighlighter.marks(text, analysis || (this.analysis ? { global: name => this.analysis.global(name), text: null } : null));
    this.schedule();
  }

  /**
   * Passes on what the user typed.
   */
  onInput() {
    const textarea = this.textarea;
    const selection = { start: textarea.selectionStart, end: textarea.selectionEnd };
    const difference = TextDiff.between(this.text, textarea.value);
    this.lastSelection = selection;
    this.recolour();
    this.handlers.change(textarea.value, selection, difference);
  }

  /**
   * Follows the caret.
   */
  onSelect() {
    const selection = this.getSelection();
    if (selection.start === this.lastSelection.start && selection.end === this.lastSelection.end) {
      return;
    }
    
    this.lastSelection = selection;
    this.handlers.cursor(selection);
    this.schedule();
  }

  /**
   * Gives the line of an offset.
   *
   * @param {number} offset The offset.
   * @return {number} The line, from 0.
   */
  lineOf(offset: number): number {
    const starts = this.lineStarts;
    
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    
    return low;
  }

  /**
   * Draws at the next frame.
   */
  schedule() {
    if (!this.frame) {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.draw();
      });
    }
  }

  /**
   * Draws the visible lines, the gutter and the current line.
   * 
   * TODO long function, good code practices discourage >15 lines
   */
  draw() {
    const textarea = this.textarea;
    const lineHeight = CodeView.LINE_H;
    const count = this.lineStarts.length;
    const top = textarea.scrollTop;
    const height = textarea.clientHeight || 400;
    const first = Math.max(0, Math.floor((top - CodeView.PAD_TOP)/lineHeight) - CodeView.OVERSCAN);
    const last = Math.min(count - 1, Math.ceil((top + height)/lineHeight) + CodeView.OVERSCAN);
    const from = this.lineStarts[first];
    const to = last + 1 < count ? this.lineStarts[last + 1] : this.text.length;

    const problems = [];
    const lineProblem = new Map();
    for (const problem of this.problems) {
      if (problem.severity === "info") continue;
      
      const end = problem.end > problem.start ? problem.end : problem.start + 1;
      problems.push({ start: problem.start, end: end, cls: problem.severity === "error" ? "st-d-error" : "st-d-warning" });
      const line = this.lineOf(problem.start);
      if (lineProblem.get(line) !== "error") {
        lineProblem.set(line, problem.severity === "error" ? "error" : "warning");
      }
    }
    
    const highlights = [];
    if (this.highlight) {
      highlights.push({ start: this.highlight[0], end: this.highlight[1], cls: "st-hl" });
    }
    
    if (this.traceRange) {
      highlights.push({ start: this.traceRange[0], end: this.traceRange[1], cls: "st-hl-trace" });
    }
    
    for (const occurrence of this.extraMarks.length ? [] : this.occurrences()) {
      highlights.push({ start: occurrence.start, end: occurrence.end, cls: "st-occurrence" });
    }
    
    this.extraMarks.forEach(mark => highlights.push(mark));
    this.$layer[0].innerHTML = CodeHighlighter.spans(this.text, from, to, [this.windowMarks(from, to), problems, highlights]) + "\n";
    const dy = first*lineHeight - top;
    this.$layer[0].style.transform = "translate(" + (-textarea.scrollLeft) + "px, " + dy + "px)";

    const caretLine = this.lineOf(textarea.selectionStart);
    const gutter = [];
    
    for (let i = first; i <= last; i++) {
      const mark = lineProblem.get(i);
      gutter.push("<div class=\"st-ln" + (mark ? " st-ln-" + mark : "") + (i === caretLine ? " st-ln-current" : "") + "\">" + (i + 1) + "</div>");
    }
    
    this.$gutter[0].innerHTML = gutter.join("");
    this.$regions[0].innerHTML = this.regionsHtml(first, last);
    this.$gutter[0].style.transform = "translateY(" + (dy + CodeView.PAD_TOP) + "px)";
    this.$currentLine[0].style.transform = "translateY(" + (CodeView.PAD_TOP + caretLine*lineHeight - top) + "px)";
    this.caret = { line: caretLine + 1, column: textarea.selectionStart - this.lineStarts[caretLine] + 1 };
  }

  /**
   * Gives the column of an offset on screen, tabs counted to their stop.
   *
   * @param {number} offset The offset.
   * @return {number} The column, from 0.
   */
  column(offset: number): number {
    let column = 0;
    for (let i = this.lineStarts[this.lineOf(offset)]; i < offset; i++) {
      column += this.text[i] === "\t" ? 4 - column % 4 : 1;
    }
    
    return column;
  }

  /**
   * Draws the regions that touch the lines on screen: from the start of a
   * region to the end of its line, the lines in between, and the start of
   * its last line up to its end.
   *
   * @param {number} first The first line drawn.
   * @param {number} last The last line drawn.
   * @return {string} The HTML of the regions.
   */
  regionsHtml(first: number, last: number): string {
    const textarea = this.textarea;
    const lineHeight = CodeView.LINE_H;
    const x = offset => (offset === this.lineStarts[this.lineOf(offset)] ? 0 : CodeView.PAD_LEFT + this.column(offset)*this.charWidth - textarea.scrollLeft);
    const box = (cls, from, to, left, right) => "<div class=\"st-region " + MathRenderer.escape(cls) + "\" style=\"top: "
      + (CodeView.PAD_TOP + from*lineHeight - textarea.scrollTop) + "px; height: " + ((to - from + 1)*lineHeight) + "px; left: " + left + "px; "
      + (right === null ? "right: 0" : "width: " + Math.max(0, right - left) + "px") + "\"></div>";
    const html = [];
    
    for (const region of this.regions) {
      if (!(region.end > region.start)) {
        continue;
      }
      
      const a = this.lineOf(region.start);
      const b = this.lineOf(region.end);
      if (b < first || a > last) continue;
      if (a === b) {
        html.push(box(region.cls, a, a, x(region.start), x(region.end)));
        continue;
      }
      
      html.push(box(region.cls, a, a, x(region.start), null));
      const from = Math.max(a + 1, first);
      const to = Math.min(b - 1, last);
      
      if (from <= to) {
        html.push(box(region.cls, from, to, 0, null));
      }
      
      if (region.end > this.lineStarts[b]) {
        html.push(box(region.cls, b, b, 0, x(region.end)));
      }
    }
    
    return html.join("");
  }

  /**
   * Gives the coloured ranges that touch a range of the text.
   *
   * @param {number} from The first offset.
   * @param {number} to The offset after the last.
   * @return {Array<Object>} The marks.
   */
  windowMarks(from: number, to: number) {
    const marks = this.marks;
    
    let low = 0;
    let high = marks.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (marks[middle].start < from) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    
    // BUG: A comment may start before the window and end inside it
    for (let i = low - 1; i >= 0 && low - i < 64; i--) {
      if (marks[i].end > from) {
        low = i;
      }
    }
    
    const result = [];
    
    for (let k = low; k < marks.length && marks[k].start < to; k++) {
      if (marks[k].end > from) {
        result.push(marks[k]);
      }
    }
    return result;
  }

  /**
   * Lists the occurrences of the symbol under the caret.
   *
   * @return {Array<Object>} The occurrences, with their offsets.
   */
  occurrences() {
    const analysis = this.analysis;
    const start = this.textarea.selectionStart;
    if (!analysis || analysis.text !== this.text || this.textarea.selectionEnd !== start) {
      return [];
    }
    
    const hit = analysis.symbolAt(start) || (start > 0 ? analysis.symbolAt(start - 1) : null);
    if (!hit || !hit.symbol || hit.symbol.builtin) {
      return [];
    }
    
    return analysis.occurrencesOf(hit.symbol.id);
  }

  /**
   * Handles the keys that a textarea does not handle as an editor would.
   *
   * @param {Object} event The key event.
   */
  keydown(event: any) {
    const textarea = this.textarea;
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    
    if (this.handlers.keydown(event, textarea.selectionStart)) {
      event.preventDefault();
    } else if (modifier && key === "z" && !event.shiftKey) {
      event.preventDefault();
      this.handlers.undo();
    } else if (modifier && ((key === "z" && event.shiftKey) || key === "y")) {
      event.preventDefault();
      this.handlers.redo();
    } else if (event.key === "Tab") {
      event.preventDefault();
      this.indent(event.shiftKey);
    } else if (event.key === "Enter" && !modifier && !event.altKey) {
      event.preventDefault();
      const start = textarea.selectionStart;
      const line = this.text.slice(this.lineStarts[this.lineOf(start)], start);
      let indentation = (line.match(/^[ \t]*/) || [""])[0];
    
      // After the ends of lines that open a level of the language (StudioCore.app.indentAfter)
      if (StudioCore.app.indentAfter.test(line)) {
        indentation += CodeView.INDENT;
      }
      
      this.insert("\n" + indentation);
    } else if (event.key === "F2") {
      event.preventDefault();
      this.handlers.rename(textarea.selectionStart);
    } else if (event.key === "F12") {
      event.preventDefault();
      this.handlers.goTo(textarea.selectionStart);
    }
  }

  /**
   * Inserts text at the caret, as typing would.
   *
   * @param {string} text The text.
   */
  insert(text: string) {
    const textarea = this.textarea;
    textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, "end");
    this.onInput();
  }

  /**
   * Indents or outdents the selected lines, or inserts an indentation.
   *
   * @param {boolean} outdent True to outdent.
   */
  indent(outdent: boolean) {
    const textarea = this.textarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const firstLine = this.lineOf(start);
    const lastLine = this.lineOf(Math.max(start, end - (end > start && this.text[end - 1] === "\n" ? 1 : 0)));
    
    if (!outdent && firstLine === lastLine && start === end) {
      this.insert(CodeView.INDENT);
      return;
    }
    
    const from = this.lineStarts[firstLine];
    const to = lastLine + 1 < this.lineStarts.length ? this.lineStarts[lastLine + 1] - 1 : this.text.length;
    const lines = this.text.slice(from, to).split("\n");
    const changed = lines.map(line => (outdent ? line.replace(/^( {1,2}|\t)/, "") : CodeView.INDENT + line));
    textarea.setRangeText(changed.join("\n"), from, to, "select");
    this.onInput();
  }

  /**
   * Gives the offset under the pointer.
   *
   * @param {Object} event The mouse event.
   * @return {number} The offset, or -1 outside the text.
   */
  offsetAt(event: any): number {
    const textarea = this.textarea;
    const box = textarea.getBoundingClientRect();
    const y = event.clientY - box.top + textarea.scrollTop - CodeView.PAD_TOP;
    const line = Math.floor(y/CodeView.LINE_H);
    
    if (line < 0 || line >= this.lineStarts.length) {
      return -1;
    }
    
    const x = event.clientX - box.left + textarea.scrollLeft - CodeView.PAD_LEFT;
    const start = this.lineStarts[line];
    const end = line + 1 < this.lineStarts.length ? this.lineStarts[line + 1] - 1 : this.text.length;
    let column = 0;
    
    for (let i = start; i < end; i++) {
      const width = this.text[i] === "\t" ? 4 - column % 4 : 1;
      if ((column + width/2)*this.charWidth > x) {
        return i;
      }
      column += width;
    }
    
    return x > (column + 1)*this.charWidth ? -1 : end;
  }

  /**
   * Gives the keyword of the language at an offset of the text, as the
   * lexer of the studio reads it (not in a comment or a string).
   *
   * @param {number} offset The offset.
   * @return {string|null} The keyword, or null.
   */
  keywordAt(offset: number): string | null {
    const lexed = StudioCore.app.tokenize(this.text);
    const token = lexed.tokens.find(tok => tok.start <= offset && offset < tok.end);
    if (!token) {
      return null;
    }
    const cls = StudioCore.app.tokenClass(token, this.text);
    
    return cls === "kw" || cls === "kw2" ? this.text.slice(token.start, token.end) : null;
  }

  /**
   * Shows what is under the pointer: the problems and what a symbol is.
   *
   * @param {Object} event The mouse event.
   */
  hover(event: any) {
    clearTimeout(this.hoverTimer);
    this.explainer.cancel();
    this.hoverTimer = setTimeout(() => {
      const offset = this.offsetAt(event);
      if (offset < 0) {
        this.$tip.hide();
        return;
      }
      
      const lines = [];
      for (const problem of this.problems) {
        const end = problem.end > problem.start ? problem.end : problem.start + 1;
        if (problem.start <= offset && offset < end && problem.severity !== "info") {
          const icon = problem.severity === "error" ? "fa-circle-xmark" : "fa-triangle-exclamation";
          const source = problem.source === StudioCore.app.engineSource ? " <span class=\"st-muted\">(" + StudioCore.app.language + ")</span>" : "";
          lines.push("<div class=\"st-tip-" + problem.severity + "\"><i class=\"fas " + icon + "\"></i> "
            + MathRenderer.escape(problem.message) + source + "</div>");
        }
      }
      
      const analysis = this.analysis;
      if (analysis && analysis.text === this.text) {
        const hit = analysis.symbolAt(offset);
        if (hit && hit.symbol && !hit.symbol.builtin) {
          lines.push("<div class=\"st-tip-symbol\"><b>" + MathRenderer.escape(hit.symbol.name) + "</b>: "
            + MathRenderer.escape(hit.symbol.kind) + "<span class=\"st-muted\"> - " + MathRenderer.escape(I18n.t("F2 renames, F12 goes to the declaration")) + "</span></div>");
        }
      }
      
      if (lines.length === 0) {
        this.$tip.hide();
        const keyword = this.keywordAt(offset);
        if (keyword) {
          this.explainer.schedule({ keyword: keyword }, event.clientX, event.clientY);
        }
        
        return;
      }
      const box = this.$editor.find(".st-code-main")[0].getBoundingClientRect();
      this.$tip.html(lines.join("")).css({ left: Math.max(8, event.clientX - box.left + 12), top: event.clientY - box.top + 18 }).show();
    }, 350);
  }

  /**
   * Scrolls so that an offset is visible.
   *
   * @param {number} offset The offset.
   */
  scrollToOffset(offset: number) {
    const textarea = this.textarea;
    const y = CodeView.PAD_TOP + this.lineOf(offset)*CodeView.LINE_H;
    
    if (y < textarea.scrollTop + CodeView.LINE_H || y > textarea.scrollTop + textarea.clientHeight - 2*CodeView.LINE_H) {
      textarea.scrollTop = Math.max(0, y - textarea.clientHeight/3);
    }
    this.schedule();
  }

  /**
   * Selects a range of the text and shows it.
   *
   * @param {number} start The first offset.
   * @param {number} end The offset after the last.
   * @param {boolean} focus True to give the editor the focus.
   */
  reveal(start: number, end: number, focus: boolean = false) {
    this.textarea.setSelectionRange(start, end);
    this.lastSelection = { start: start, end: end };
    
    if (focus) {
      this.textarea.focus({ preventScroll: true });
    }
    this.scrollToOffset(start);
  }
}
// ----------------------------------------------------------------
