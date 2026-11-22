/**
 * The model in LaTeX, next to its code, one to one: a row for each part
 * that the writer of the studio writes (a line, a sentence, a declaration),
 * and in a row the pieces that it marked with their place in the code
 * (NotationWriter.located). Pointing at a piece shows its code, a click
 * picks it, and the caret in the code shows its piece (follow).
 *
 * Rows are drawn when they scroll into view, and kept while their LaTeX
 * stays the same, so that long models stay fast; the places of the pieces
 * count from the start of their row, so an edit above a row leaves its
 * LaTeX as it was. Rows without a place in the code (the goals of a proof,
 * with the names of the hypotheses as labels) only show.
 *
 * @author Roberto Metere
 * @license MIT
 */
class FormulaView {
  handlers: any;
  display: boolean;
  $root: JQuery<HTMLElement>;
  items: any[];
  rows: HTMLElement[];
  observer: IntersectionObserver;
  $pointed: JQuery<HTMLElement>;

  /**
   * @param {Object} params The view parameters.
   * @param {string} params.container The element that receives the rows.
   * @param {boolean} params.display True for formulas in display style.
   * @param {Object} params.handlers The callbacks: point(range) when the
   *   pointer moves onto a piece, or off the formulas (null), and
   *   pick(range) when a piece is clicked; range is [start, end] in the
   *   code.
   */
  constructor(params: { container?: string; display?: boolean; handlers?: any }) {
    const defaults = {
        container: "#formulas"
      , display: false
      , handlers: {}
    };
    params = {...defaults, ...params};
    this.handlers = {
        point: () => {}
      , pick: () => {}
      , ...params.handlers
    };
    this.display = params.display;
    this.$root = $("<div class=\"st-formulas\"></div>").appendTo($(params.container));
    this.items = [];
    this.rows = [];
    this.$pointed = $();
    this.observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const row = entry.target as HTMLElement;
        row.dataset.visible = entry.isIntersecting ? "1" : "";
        if (entry.isIntersecting && !row.dataset.drawn) {
          this.draw(row);
        }
      });
    }, { root: this.$root[0], rootMargin: "200px 0px" });
    this.bind();
  }

  /**
   * Listens to the user.
   */
  bind() {
    this.$root.on("mouseover", event => {
      const piece = this.pieceOf(event.target);
      this.$pointed.removeClass("st-formula-point");
      this.$pointed = piece ? $(piece).addClass("st-formula-point") : $();
      this.handlers.point(piece ? this.rangeOf(piece) : null);
    });
    this.$root.on("mouseleave", () => {
      this.$pointed.removeClass("st-formula-point");
      this.$pointed = $();
      this.handlers.point(null);
    });
    this.$root.on("click", event => {
      const piece = this.pieceOf(event.target);
      if (piece) {
        this.handlers.pick(this.rangeOf(piece));
      }
    });
  }

  /**
   * Shows the formulas of a text.
   *
   * @param {Array<Object>} items The parts, in the order of the code:
   *   {start, end, tex, label}; start and end place the part in the code
   *   (none for a row that only shows), and the label, the line of start by
   *   default, goes before the formula.
   * @param {string} text The code, for the lines of the labels.
   */
  setItems(items: any[], text: string = null) {
    const lines = text === null ? null : new LineIndex(text);
    this.items = items;
    items.forEach((item, index) => {
      let row = this.rows[index];
      if (!row) {
        row = $("<div class=\"st-formula-row\"><span class=\"st-formula-label\"></span><span class=\"st-formula-body\"></span></div>").appendTo(this.$root)[0];
        this.rows.push(row);
        if (this.observer) {
          this.observer.observe(row);
        }
      }
      row.dataset.index = String(index);
      const label = item.label !== undefined ? item.label : (lines && item.start >= 0 ? lines.pos(item.start).line : "");
      (row.firstChild as HTMLElement).textContent = String(label);
      if (row.dataset.tex !== item.tex) {
        row.dataset.tex = item.tex;
        row.dataset.drawn = "";
        (row.lastChild as HTMLElement).textContent = "";
        if (row.dataset.visible || !this.observer) {
          this.draw(row);
        }
      }
    });
    this.rows.splice(items.length).forEach(row => {
      if (this.observer) {
        this.observer.unobserve(row);
      }
      row.remove();
    });
  }

  /**
   * Draws the formula of a row.
   *
   * @param {HTMLElement} row The row.
   */
  draw(row: HTMLElement) {
    const item = this.items[Number(row.dataset.index)];
    if (item) {
      (row.lastChild as HTMLElement).innerHTML = MathRenderer.html(item.tex, this.display);
      row.dataset.drawn = "1";
    }
  }

  /**
   * Finds the piece of a formula that an element is in: the innermost one
   * marked with its place, or else its row.
   *
   * @param {Element} element The element.
   * @return {HTMLElement|null} The piece, or null outside the rows or in a
   *   row without a place in the code.
   */
  pieceOf(element: any): HTMLElement | null {
    const row = element && element.closest ? element.closest(".st-formula-row") : null;
    const item = row ? this.items[Number(row.dataset.index)] : null;
    if (!item || !(item.start >= 0)) {
      return null;
    }
    const piece = element.closest("[data-" + NotationWriter.RANGE + "]");
    return piece && row.contains(piece) ? piece : row;
  }

  /**
   * Gives the place in the code of a piece.
   *
   * @param {HTMLElement} piece The piece, or its row.
   * @return {Array<number>} The offsets [start, end].
   */
  rangeOf(piece: HTMLElement): number[] {
    const row = piece.closest(".st-formula-row") as HTMLElement;
    const item = this.items[Number(row.dataset.index)];
    const range = piece === row ? null : piece.getAttribute("data-" + NotationWriter.RANGE);
    if (!range) {
      return [item.start, item.end];
    }
    const [from, to] = range.split("-").map(Number);
    return [item.start + from, item.start + to];
  }

  /**
   * Shows the piece of the code between two offsets, usually the caret: the
   * smallest piece that holds them, in its row, scrolled into view.
   *
   * @param {number} start The first offset.
   * @param {number} end The offset after the last, start by default.
   */
  follow(start: number, end: number = start) {
    this.$root.find(".st-formula-current").removeClass("st-formula-current");
    this.$root.find(".st-formula-hl").removeClass("st-formula-hl");
    const index = this.items.findIndex(item => item.start <= start && end <= item.end);
    if (index < 0) {
      return;
    }
    const row = this.rows[index];
    if (!row.dataset.drawn) {
      this.draw(row);
    }
    row.classList.add("st-formula-current");
    let best = null;
    let size = Infinity;
    row.querySelectorAll("[data-" + NotationWriter.RANGE + "]").forEach(piece => {
      const [from, to] = this.rangeOf(piece as HTMLElement);
      if (from <= start && end <= to && to - from < size) {
        best = piece;
        size = to - from;
      }
    });
    if (best) {
      best.classList.add("st-formula-hl");
    }
    const root = this.$root[0];
    const top = row.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    if (top < root.scrollTop || top + row.offsetHeight > root.scrollTop + root.clientHeight) {
      root.scrollTop = Math.max(0, top - root.clientHeight/3);
    }
  }
}
// ----------------------------------------------------------------
