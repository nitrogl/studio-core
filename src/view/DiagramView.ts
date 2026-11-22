/**
 * The diagram: one lane per party (process macro) and per main process,
 * one block per construct of the language, and arrows for the messages.
 *
 * This should allow students to engage better with the content of what
 * they model, as well as familiarise with the code in one go.
 * The diagram is drawn from the DiagramModel of the analysed model. A lane
 * shows its chains of blocks from top to bottom, in the order of the code,
 * on a lifeline; conditionals and parallel compositions fork into one
 * column per branch, under a bar, and a replication frames its body. The
 * branches stay in their lane, where they are edited as any chain. Blocks
 * are moved with jQuery UI sortables: moving a block above another one
 * moves the action in the code. Actions are added by dragging them from
 * the palette onto a chain, or with the + that ends every chain. Outputs
 * and inputs paired by an honest run are joined by arrows, and each input
 * goes down below the output it receives, as in a message sequence chart;
 * messages on private channels are dotted.
 *
 * In the Design mode a block shows its action as a formula (KaTeX); in the
 * Expert mode, as code. The eye of a block shows it the other way.
 *
 * @author Roberto Metere
 * @license MIT
 */
class DiagramView {
  handlers: any;
  $container: JQuery<HTMLElement>;
  $palette: JQuery<HTMLElement>;
  actions: any[];
  icons: any;
  movable: Set<string>;
  model: any;
  writer: any;
  mode: string;
  flipped: Set<any>;
  selected: string;
  traced: string;
  zoom: number;
  dragging: boolean;
  moved: boolean;
  received: boolean;
  explainer: Explainer;

  /**
   * @param {Object} params The view parameters.
   * @param {string} params.container The element of the diagram.
   * @param {string} params.palette The element of the palette.
   * @param {Array<Object>} params.actions The actions of the palette, {kind,
   *   label, icon, title}: the kind of node they create, their label, their
   *   icon (Font Awesome) and what they do.
   * @param {Object} params.icons The icon of each kind of block.
   * @param {Set<string>} params.movable The kinds of blocks that can be
   *   moved: the sequential actions.
   * @param {Object} params.handlers The callbacks: select(id), edit(id),
   *   menu(id, x, y), insert(kind, path, anchor), move(from, to, anchor),
   *   editLane(laneId), eye(id), symmetric(laneId); anchor is the element
   *   of the block, or of the button, where the action goes.
   */
  constructor(params: { container?: string; palette?: string; actions?: any[]; icons?: any; movable?: Set<string>; handlers?: any }) {
    const defaults = {
        container: "#diagram"
      , palette: "#palette"
      , actions: []
      , icons: {}
      , movable: new Set<string>()
      , handlers: {}
    };
    params = {...defaults, ...params};
    this.handlers = {
        select: () => {}
      , edit: () => {}
      , menu: () => {}
      , insert: () => {}
      , move: () => {}
      , editLane: () => {}
      , eye: () => {}
      , symmetric: () => {}
      , ...params.handlers
    };
    this.$container = $(params.container);
    this.$palette = $(params.palette);
    this.actions = params.actions;
    this.icons = params.icons;
    this.movable = params.movable;
    this.model = null;
    this.writer = null;
    this.mode = "design";
    this.flipped = new Set();
    this.selected = null;
    this.traced = null;
    this.zoom = 1;
    this.dragging = false;
    this.buildPalette();
    this.bind();
    Panning.attach(this.$container[0]);
  }

  /**
   * Fills the palette with the actions that can be dragged onto a chain.
   */
  buildPalette() {
    this.actions.forEach(item => {
      $("<span class=\"st-palette-item st-k-" + item.kind.toLowerCase() + "\"></span>")
        .attr({ "data-kind": item.kind, title: I18n.t(item.title) })
        .append("<i class=\"fas " + item.icon + "\"></i>", $("<span></span>").text(item.label))
        .appendTo(this.$palette);
    });
    
    this.$palette.find(".st-palette-item").draggable({
        helper: "clone"
      , appendTo: "body"
      , zIndex: 2000
      , revert: "invalid"
      , cursorAt: { left: 18, top: 12 }
      , start: () => {
          this.dragging = true;
          this.$container.addClass("st-dropping");
        }
      , stop: () => {
          this.dragging = false;
          this.$container.removeClass("st-dropping");
        }
    });
  }

  /**
   * Listens to the clicks on the diagram.
   */
  bind() {
    const view = this; // avoid annoying "this" issues later
    
    this.$container.on("click", ".st-block-head", function(event) {
      event.stopPropagation();
      view.handlers.select($(this).closest(".st-block").attr("data-id"));
    });
    this.$container.on("dblclick", ".st-block-head", function(event) {
      event.stopPropagation();
      view.handlers.edit($(this).closest(".st-block").attr("data-id"));
    });
    this.$container.on("contextmenu", ".st-block-head", function(event) {
      event.preventDefault();
      event.stopPropagation();
      const id = $(this).closest(".st-block").attr("data-id");
      view.handlers.select(id);
      view.handlers.menu(id, event.clientX, event.clientY);
    });
    this.$container.on("click", ".st-eye", function(event) {
      event.stopPropagation();
      view.handlers.eye($(this).closest("[data-id]").attr("data-id"));
    });
    this.$container.on("click", ".st-add", function(event) {
      event.stopPropagation();
      view.handlers.insert(null, DiagramView.parsePath($(this).attr("data-path")), this);
    });
    this.$container.on("dblclick", ".st-lane-header", function() {
      view.handlers.editLane($(this).closest(".st-lane").attr("data-lane"));
    });
    this.$container.on("click", ".st-symmetric", function(event) {
      event.stopPropagation();
      view.handlers.symmetric($(this).closest(".st-lane").attr("data-lane"));
    });
    this.$container.on("click", function(event) {
      if (event.target === this || $(event.target).is(".st-canvas, .st-lane-body")) {
        view.handlers.select(null);
      }
    });
    this.explainer = new Explainer();
    this.$container.on("mouseenter", ".st-block-head", function(event) {
      view.explainer.schedule({ kind: $(this).closest(".st-block").attr("data-kind") }, event.clientX, event.clientY);
    });
    this.$container.on("mousemove", ".st-block-head", event => this.explainer.follow(event.clientX, event.clientY));
    this.$container.on("mouseleave mousedown", ".st-block-head", () => this.explainer.cancel());
    this.$container.on("scroll", () => {
      this.explainer.cancel();
      this.drawArrows();
    });
    $(window).on("resize", () => this.drawArrows());
  }

  /**
   * Draws the diagram of a model.
   *
   * @param {Object} model The DiagramModel.
   * @param {Object} options How to draw it.
   * @param {string} options.mode "design" or "expert".
   * @param {LatexWriter} options.writer The writer of formulas.
   * @param {Set<string>} options.flipped The blocks and lanes shown in the
   *   other mode.
   */
  render(model: any, options: { mode?: string; writer?: NotationWriter; flipped?: Set<string> }) {
    this.model = model;
    this.mode = options.mode;
    this.writer = options.writer;
    this.flipped = options.flipped || new Set();
    const scroll = { top: this.$container.scrollTop(), left: this.$container.scrollLeft() };

    const $canvas = $("<div class=\"st-canvas\"></div>").css("font-size", (13*this.zoom) + "px");
    $canvas.append("<svg class=\"st-lines\" xmlns=\"http://www.w3.org/2000/svg\"><path></path></svg>");
    for (const lane of model.lanes) {
      if (lane.hidden) {
        continue;
      }
      $canvas.append(this.laneElement(lane));
    }
    $canvas.append("<svg class=\"st-arrows\" xmlns=\"http://www.w3.org/2000/svg\"><defs>"
      + "<marker id=\"st-arrow-head\" viewBox=\"0 0 10 10\" refX=\"9\" refY=\"5\" markerWidth=\"7\" markerHeight=\"7\" orient=\"auto-start-reverse\">"
      + "<path d=\"M0,0 L10,5 L0,10 z\"></path></marker></defs></svg>");
    this.$container.empty().append($canvas);
    this.$container.scrollTop(scroll.top).scrollLeft(scroll.left);
    this.makeSortable($canvas);
    this.setSelected(this.selected);
    this.setTraced(this.traced);
    requestAnimationFrame(() => {
      this.align();
      this.drawArrows();
    });
  }

  /**
   * Builds the element of a lane.
   *
   * @param {Object} lane The lane of the model.
   * @return {jQuery} The element.
   */
  laneElement(lane: any): JQuery {
    const flipped = this.flipped.has(lane.id);
    const $lane = $("<div class=\"st-lane\"></div>").attr("data-lane", lane.id).attr("data-id", lane.id)
      .addClass("st-lane-" + lane.kind).toggleClass("st-flipped", flipped);
    if (lane.mirror || lane.kind === "mirror") {
      $lane.addClass("st-mirror");
    }
    if (lane.color) {
      $lane.css("--st-lane-color", lane.color);
    }
    const $header = $("<div class=\"st-lane-header\"></div>").attr("title", lane.kind === "macro" ? I18n.t("Double click to edit the party") : "");
    const icon = lane.kind === "main" ? "fa-diagram-project" : lane.kind === "branch" ? "fa-code-fork" : lane.kind === "mirror" ? "fa-clone" : "fa-user";
    $header.append("<i class=\"fas " + icon + "\"></i>", $("<span class=\"st-lane-title\"></span>").text(lane.title));

    if (lane.subtitle) {
      $header.append($("<span class=\"st-lane-subtitle\"></span>").text(lane.subtitle));
    }

    if (lane.unused) {
      $header.append($("<span class=\"badge text-bg-secondary\"></span>").attr("title", I18n.t("No process runs this party")).text(I18n.t("unused")));
    }
    
    if (lane.kind === "macro") {
      $header.append($("<button type=\"button\" class=\"st-symmetric\"></button>").toggleClass("st-on", !!lane.symmetric)
        .attr("title", lane.symmetric ? I18n.t("Symmetric role: shown with its mirrored copy. Click to show it once.") : I18n.t("Symmetric role? Show it with a mirrored copy"))
        .append("<i class=\"far fa-clone\"></i>"));
    }
    
    $header.append($("<button type=\"button\" class=\"st-eye\"></button>")
      .attr("title", this.modeOf(lane.id) === "design" ? I18n.t("Show this party as code") : I18n.t("Show this party as formulas"))
      .append("<i class=\"far " + (flipped ? "fa-eye-slash" : "fa-eye") + "\"></i>"));
    const $body = $("<div class=\"st-lane-body\"></div>");
    
    if (lane.root) {
      $body.append(this.chainElement(lane.root, lane));
    }
    
    return $lane.append($header, $body);
  }

  /**
   * Builds the element of a chain: its blocks, in order, and the + that
   * adds an action at its end.
   *
   * @param {Object} first The first block of the chain.
   * @param {Object} lane The lane.
   * @return {jQuery} The element.
   */
  chainElement(first: any, lane: any): JQuery {
    const $chain = $("<div class=\"st-seq\"></div>").attr("data-lane", lane.id);
    let block = first;
    let last = null;
    
    while (block) {
      $chain.append(this.blockElement(block, lane));
      last = block;
      block = block.next;
    }
    
    // The + inserts before the end of the chain: its 0, or the call that ends it
    if (last && !last.branches && !last.body && !lane.mirror && lane.kind !== "mirror") {
      $chain.append($("<button type=\"button\" class=\"st-add\"><i class=\"fas fa-plus\"></i></button>")
        .attr({ "data-path": last.path.join("."), title: I18n.t("Add an action here") }));
    }
    return $chain;
  }

  /**
   * Builds the element of a block, with its branches or body.
   *
   * @param {Object} block The block of the model.
   * @param {Object} lane The lane.
   * @return {jQuery} The element.
   */
  blockElement(block: any, lane: any): JQuery {
    const kind = block.kind;
    const kinds = StudioCore.app.diagram;
    const $block = $("<div class=\"st-block\"></div>")
      .attr({ "data-id": block.id, "data-path": block.path.join("."), "data-kind": kind })
      .addClass("st-k-" + kind.toLowerCase());
    const movable = this.movable.has(kind) && !block.branches && !block.mirror && lane.kind !== "mirror";
    $block.toggleClass("st-movable", movable).toggleClass("st-mirrored", !!block.mirror);

    if (kind === kinds.end) {
      const label = kinds.endLabel(block.node);
      $block.addClass("st-end").attr("title", block.implicit ? I18n.t("End of the process") : label);
      return $block.append($("<div class=\"st-block-head\"></div>").text(label));
    }

    if (block.diagnostics && block.diagnostics.some(d => d.severity === "error")) {
      $block.addClass("st-has-error");
    } else if (block.diagnostics && block.diagnostics.some(d => d.severity === "warning")) {
      $block.addClass("st-has-warning");
    }

    if (block.private) {
      $block.addClass("st-private");
    }

    const $head = $("<div class=\"st-block-head\"></div>");
    $head.append("<span class=\"st-block-icon\"><i class=\"fas " + (this.icons[kind] || "fa-square") + "\"></i></span>");
    $head.append(this.labelElement(block));

    if (kind !== kinds.branch && kind !== kinds.parallel) {
      $head.append($("<button type=\"button\" class=\"st-eye\"></button>").attr("title", I18n.t("Show the other way"))
        .append("<i class=\"far " + (this.flipped.has(block.id) ? "fa-eye-slash" : "fa-eye") + "\"></i>"));
    }

    $block.append($head);
    
    if (block.branches) {
      const parallel = kind === kinds.parallel;
      const $branches = $("<div class=\"st-branches\"></div>").toggleClass("st-par-branches", parallel);
      block.branches.forEach(branch => {
        const $branch = $("<div class=\"st-branch\"></div>").attr("data-key", branch.key);
        // The processes in parallel need no name, unless the model gives one
        if (branch.label) {
          $branch.append($("<div class=\"st-branch-label\"></div>").text(branch.label));
        }
        if (branch.block) {
          $branch.append(this.chainElement(branch.block, lane));
        }
        $branches.append($branch);
      });
      $block.append($branches);
    }
    
    if (block.body) {
      $block.append($("<div class=\"st-repl-body\"></div>").append(this.chainElement(block.body, lane)));
    }
    
    return $block;
  }

  /**
   * Builds the label of a block: a formula in the Design mode, the code in
   * the Expert mode.
   *
   * @param {Object} block The block.
   * @return {jQuery} The label.
   */
  labelElement(block: any): JQuery {
    const $label = $("<span class=\"st-block-label\"></span>");
    
    const kinds = StudioCore.app.diagram;
    if (block.kind === kinds.branch) {
      const target = String(block.target || "");
      return $label.text(target.includes("#") ? I18n.t("runs process {number}", { number: target.replace(/^.*#/, "") }) : I18n.t("runs {name}", { name: target }));
    }
    
    if (this.modeOf(block.id, block.lane) === "design" && this.writer && block.node) {
      let tex = null;
      try {
        tex = this.writer.action(block.node);
      } catch (e) {
        tex = null;
      }
    
      if (MathRenderer.fits(tex)) {
        $label.addClass("st-math").html(MathRenderer.html(tex));
        // A bare ! or | means little to whom does not know the pi calculus
        if (block.kind === kinds.replication && !block.node.index) {
          $label.append($("<span class=\"st-caption\"></span>").text(I18n.t("any number of copies")));
        } else if (block.kind === kinds.parallel && block.branches) {
          $label.append($("<span class=\"st-caption\"></span>").text(I18n.n("{count} process in parallel", "{count} processes in parallel", block.branches.length)));
        }
        
        return $label;
      }
    }
    
    const label = block.label || "";
    
    return $label.addClass("st-code").text(label.length > 300 ? label.slice(0, 300) + "..." : label);
  }

  /**
   * Tells how an element is shown: the mode, unless its eye flips it.
   *
   * @param {string} id The element (block or lane).
   * @param {string} laneId Its lane, whose eye flips it too.
   * @return {string} "design" or "expert".
   */
  modeOf(id: string, laneId: string = null): string {
    let flips = this.flipped.has(id) ? 1 : 0;
    if (laneId && this.flipped.has(laneId)) {
      flips++;
    }
    const other = this.mode === "design" ? "expert" : "design";
    
    return flips % 2 === 1 ? other : this.mode;
  }

  /**
   * Turns the chains into sortables, connected within each lane. Every block
   * of a chain is an item, so that a block or an action of the palette lands
   * next to the block under the pointer, whether that block moves or not;
   * only the head of a movable block starts a drag.
   *
   * @param {jQuery} $canvas The canvas.
   */
  makeSortable($canvas: JQuery) {
    const view = this;
    $canvas.find(".st-lane").each(function() {
      const $lane = $(this);
      if ($lane.hasClass("st-mirror")) {
        return;
      }
      const $chains = $lane.find(".st-seq");
      $chains.sortable({
          items: "> .st-block"
        , connectWith: $chains
        , handle: "> .st-block-head"
        , cancel: "input, textarea, button, select, option, .st-block:not(.st-movable) > .st-block-head"
        , distance: 6
        , tolerance: "pointer"
        , placeholder: "st-placeholder"
        , cursor: "grabbing"
        , start: () => {
            view.dragging = true;
            view.moved = false;
          }
        , update: () => {
            view.moved = true;
          }
        , sort: function(this: HTMLElement, event, ui) {
            if (DiagramView.follow(ui.placeholder, event.clientY)) {
              $(this).sortable("refreshPositions");
            }
          }
        , stop: function(this: HTMLElement, event, ui) {
            view.dragging = false;
            // A block put back where it was is not a move
            if (view.moved || ui.item.hasClass("st-palette-item")) {
              view.dropped(ui.item, $(this));
            } else {
              $(this).sortable("cancel");
            }
          }
        , receive: function(this: HTMLElement, event, ui) {
            // A new action from the palette: the clone is in the chain now
            if (ui.item.hasClass("st-palette-item")) {
              view.received = true;
            }
          }
      });
    });
  }

  /**
   * Puts the placeholder of a drag where the pointer is, in its chain:
   * before the first block whose head is lower than the pointer, or at the
   * end of the chain. The blocks are where they would be without the
   * placeholder, and the gap where an input waits for its message belongs
   * to the input, so a drop there lands before it.
   *
   * @param {jQuery} $placeholder The placeholder.
   * @param {number} y The pointer, from the top of the window.
   * @return {boolean} True when the placeholder moved.
   */
  static follow($placeholder: JQuery, y: number): boolean {
    const $chain = $placeholder.parent();
    const blocks = $chain.children(".st-block").not(".ui-sortable-helper").get();
    // The room that the placeholder takes, which the blocks after it give back
    const room = $placeholder.outerHeight(true) + (parseFloat($chain.css("row-gap")) || 0);
    const after = (block: Element) => ($placeholder[0].compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const below = blocks.find(block => {
      const head = $(block).children(".st-block-head")[0].getBoundingClientRect();
      return head.top + head.height/2 - (after(block) ? room : 0) > y;
    });
    const next = below || $chain.children(".st-add")[0] || null;
    let current = $placeholder[0].nextElementSibling;

    while (current && $(current).hasClass("ui-sortable-helper")) {
      current = current.nextElementSibling;
    }

    if (current === next) {
      return false;
    }

    $chain[0].insertBefore($placeholder[0], next);
    return true;
  }

  /**
   * Interprets a drop: a block moved, or an action of the palette added.
   *
   * @param {jQuery} $item The element dropped.
   * @param {jQuery} $origin The chain it was dragged from.
   */
  dropped($item: JQuery, $origin: JQuery) {
    /*
     * The action goes before the next block; at the end of a chain, before
     *  its last block (the end of the process, a call or a test)
     */
    let $next = $item.nextAll(".st-block").first();
    
    if (!$next.exists()) {
      $next = $item.prevAll(".st-block").first();
    }
    
    const target = $next.exists() ? DiagramView.parsePath($next.attr("data-path")) : null;
    if ($item.hasClass("st-palette-item")) {
      const kind = $item.attr("data-kind");
      $item.remove();
      if (target) {
        this.handlers.insert(kind, target, $next[0]);
      }
      return;
    }
    
    const from = DiagramView.parsePath($item.attr("data-path"));
    $origin.sortable("cancel");
    
    if (target && from.join(".") !== target.join(".")) {
      this.handlers.move(from, target, $next[0]);
    }
  }

  /**
   * Connects the palette to the chains: a palette action dropped on a chain
   * lands where the placeholder is.
   */
  connectPalette() {
    this.$palette.find(".st-palette-item").draggable("option", "connectToSortable", this.$container.find(".st-lane:not(.st-mirror) .st-seq"));
  }

  /**
   * Reads a path written in a data attribute.
   *
   * @param {string} text The path, its keys joined by dots.
   * @return {Array<string|number>} The path.
   */
  static parsePath(text: string): (string | number)[] {
    return String(text || "").split(".").filter(key => key !== "").map(key => (/^\d+$/.test(key) ? Number(key) : key));
  }

  /**
   * Moves each input down below the output that it receives, so that time
   * flows downwards as in a message sequence chart. Only the first message
   * of each block counts: the others come from more copies of a replicated
   * process, and could make the moves circular. An input is not moved when
   * moving it would move its output too.
   */
  align() {
    const $canvas = this.$container.find(".st-canvas");
    
    if (!$canvas.exists() || !this.model) {
      return;
    }
    
    $canvas.find(".st-block[data-push]").each(function() {
      this.style.removeProperty("--st-push");
      this.removeAttribute("data-push");
    });
    
    const head = id => this.$container.find(".st-block[data-id=\"" + DiagramView.escapeId(id) + "\"] > .st-block-head")[0];
    const fromSeen = new Set();
    const toSeen = new Set();
    const links = (this.model.links || []).filter(link => {
      const first = !fromSeen.has(link.from) && !toSeen.has(link.to);
      fromSeen.add(link.from);
      toSeen.add(link.to);
      return first;
    });
    const delay = parseFloat($canvas.css("font-size"))*0.9;
    
    for (let round = 0; round < 12; round++) {
      let changed = false;
      for (const link of links) {
        const from = head(link.from);
        const to = head(link.to);
        
        if (!from || !to || $(to).closest(".st-seq")[0].contains(from)) {
          continue;
        }
        
        const block = to.parentElement;
        const push = Number(block.getAttribute("data-push") || 0);
        const missing = from.getBoundingClientRect().top + delay - to.getBoundingClientRect().top;
        
        if (missing > 0.5 && push < 800) {
          block.setAttribute("data-push", String(push + missing));
          block.style.setProperty("--st-push", (push + missing) + "px");
          changed = true;
        }
      }
      
      if (!changed) {
        break;
      }
    }
  }

  /**
   * Draws the lifelines: the line that runs through the blocks of each
   * chain, and the fork of each block with branches, whose bar joins the
   * lines of its branches.
   */
  drawLines() {
    const $canvas = this.$container.find(".st-canvas");
    const svg = $canvas.find("svg.st-lines")[0];
    
    if (!svg) {
      return;
    }
    
    const origin = $canvas[0].getBoundingClientRect();
    const box = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2 - origin.left) + 0.5, top: r.top - origin.top, bottom: r.bottom - origin.top };
    };
    // The block of an item of a chain, or the + that ends it
    const headOf = (item: Element) => ($(item).hasClass("st-block") ? $(item).children(".st-block-head")[0] : item);
    const firstOf = (chain: Element) => $(chain).children(".st-block, .st-add")[0];
    const lines = [];
    const line = (x1, y1, x2, y2) => {
      if (y2 > y1 + 0.5 || Math.abs(x2 - x1) > 0.5) {
        lines.push("M" + x1 + "," + y1 + " L" + x2 + "," + y2);
      }
    };
    
    svg.setAttribute("width", String($canvas[0].scrollWidth));
    svg.setAttribute("height", String($canvas[0].scrollHeight));
    $canvas.find(".st-seq").each(function() {
      let previous = null;
      $(this).children(".st-block, .st-add").each(function() {
        const head = headOf(this);
        if (!head) {
          return;
        }
        
        const b = box(head);
        if (previous) {
          line(previous.x, previous.bottom, b.x, b.top);
        }
        previous = b;
        // A block that the chain goes on after: its branches join, its body ends, above the next
        const after = $(this).nextAll(".st-block, .st-add").exists();
        
        const $branches = $(this).children(".st-branches");
        if ($branches.exists()) {
          const drops = $branches.children(".st-branch").map(function() {
            const first = firstOf($(this).children(".st-seq")[0]);
            return first ? box(headOf(first)) : null;
          }).get().filter(Boolean);
          const bar = $branches[0].getBoundingClientRect().top - origin.top + parseFloat($canvas.css("font-size"))*0.35;
          
          if (drops.length) {
            line(b.x, b.bottom, b.x, bar);
            line(drops[0].x, bar, drops[drops.length - 1].x, bar);
            drops.forEach(drop => line(drop.x, bar, drop.x, drop.top));
          }
          
          if (after) {
            const join = $branches[0].getBoundingClientRect().bottom - origin.top - parseFloat($canvas.css("font-size"))*0.35;
            const ends = $branches.children(".st-branch").map(function() {
              const $chain = $(this).children(".st-seq");
              const last = $chain.children(".st-block, .st-add").last()[0];
              return last && !$chain.children(".st-block").last().hasClass("st-k-stop") ? box(last) : null;
            }).get().filter(Boolean);
            
            if (ends.length) {
              ends.forEach(end => line(end.x, end.bottom, end.x, join));
              line(Math.min(b.x, ends[0].x), join, Math.max(b.x, ends[ends.length - 1].x), join);
              previous = { x: b.x, top: join, bottom: join };
            }
          }
        }
        
        const body = $(this).children(".st-repl-body").children(".st-seq")[0];
        const first = body ? firstOf(body) : null;
        if (first) {
          const f = box(headOf(first));
          line(b.x, b.bottom, f.x, f.top);
          
          if (after) {
            previous = { x: b.x, top: b.top, bottom: $(this).children(".st-repl-body")[0].getBoundingClientRect().bottom - origin.top };
          }
        }
      });
    });
    svg.firstElementChild.setAttribute("d", lines.join(" "));
  }

  /**
   * Draws the arrows of the messages.
   */
  drawArrows() {
    const $canvas = this.$container.find(".st-canvas");
    const svg = $canvas.find("svg.st-arrows")[0];
    if (!svg || !this.model) {
      return;
    }
    this.connectPalette();
    this.drawLines();
    const origin = $canvas[0].getBoundingClientRect();
    svg.setAttribute("width", String($canvas[0].scrollWidth));
    svg.setAttribute("height", String($canvas[0].scrollHeight));
    $(svg).find("g").remove();
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    
    for (const link of this.model.links || []) {
      const from = this.$container.find(".st-block[data-id=\"" + DiagramView.escapeId(link.from) + "\"] > .st-block-head")[0];
      const to = this.$container.find(".st-block[data-id=\"" + DiagramView.escapeId(link.to) + "\"] > .st-block-head")[0];
      
      if (!from || !to) continue;
      
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const rightwards = b.left >= a.right;
      const x1 = (rightwards ? a.right : a.left) - origin.left;
      const y1 = a.top + a.height/2 - origin.top;
      const x2 = (rightwards ? b.left : b.right) - origin.left;
      const y2 = b.top + b.height/2 - origin.top;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M" + x1 + "," + y1 + " L" + x2 + "," + y2);
      path.setAttribute("class", "st-message" + (link.private ? " st-message-private" : ""));
      path.setAttribute("marker-end", "url(#st-arrow-head)");
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = DiagramView.messageTitle(link);
      path.appendChild(title);
      group.appendChild(path);
    }
    svg.appendChild(group);
  }

  /**
   * Writes the title of the arrow of a message.
   *
   * @param {Object} link The message: its channel (or none), whether the
   *   channel is private, and the name that @inout gives it (or none).
   * @return {string} The title.
   */
  static messageTitle(link: any): string {
    const values = { channel: link.channel, name: link.name };
    if (link.name && link.channel) {
      return link.private ? I18n.t("Message {name} on {channel} (private channel)", values) : I18n.t("Message {name} on {channel}", values);
    }
    if (link.name) {
      return I18n.t("Message {name}", values);
    }
    if (link.channel) {
      return link.private ? I18n.t("Message on {channel} (private channel)", values) : I18n.t("Message on {channel}", values);
    }
    return I18n.t("Message");
  }

  /**
   * @param {string} id The identifier of a block.
   * @return {string} The identifier, safe in a CSS attribute selector.
   */
  static escapeId(id: string): string {
    return String(id).replace(/["\\]/g, "\\$&");
  }

  /**
   * Marks the selected block.
   *
   * @param {string|null} id The block, or null.
   */
  setSelected(id: string | null) {
    this.selected = id;
    this.$container.find(".st-selected").removeClass("st-selected");
    
    if (id) {
      const $block = this.$container.find("[data-id=\"" + DiagramView.escapeId(id) + "\"]");
      $block.addClass("st-selected");
      const element = $block.children(".st-block-head")[0] || $block[0];
    
      if (element && !this.dragging) {
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  }

  /**
   * Marks the block of the selected step of a trace.
   *
   * @param {string|null} path The path of the block, or null.
   */
  setTraced(path: string | null) {
    this.traced = path;
    this.$container.find(".st-traced").removeClass("st-traced");
    if (path) {
      const $block = this.$container.find(".st-block[data-path=\"" + DiagramView.escapeId(path) + "\"]").first();
      $block.addClass("st-traced");
      
      if ($block.length) {
        $block.children(".st-block-head")[0].scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  }

  /**
   * Changes the zoom.
   *
   * @param {number} zoom The scale, 1 for the normal size.
   */
  setZoom(zoom: number) {
    this.zoom = Math.max(0.5, Math.min(2, Math.round(zoom*10)/10));
    this.$container.find(".st-canvas").css("font-size", (13*this.zoom) + "px");
    this.align();
    this.drawArrows();
  }
}
// ----------------------------------------------------------------
