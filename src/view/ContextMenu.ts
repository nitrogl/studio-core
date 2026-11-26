/**
 * A menu at the pointer (right click) or below a button, drawn as a
 * Bootstrap dropdown menu.
 *
 * @author Roberto Metere
 * @license MIT
 */
class ContextMenu {
  $menu: JQuery<HTMLElement>;

  /**
   * Creates the menu, hidden, at the end of the page.
   */
  constructor() {
    this.$menu = $("<ul class=\"dropdown-menu st-context-menu\"></ul>").appendTo("body");
    
    $(document).on("mousedown", event => {
      if (!$(event.target).closest(".st-context-menu").length) {
        this.hide();
      }
    });
    
    $(document).on("keydown", event => {
      if (event.key === "Escape") {
        this.hide();
      }
    });
    
    $(window).on("blur resize", () => this.hide());
  }

  /**
   * Shows the menu at a point of the screen.
   *
   * @param {Array<Object>} items The entries: label, icon, action and
   *   disabled; or {divider: true}; or {header: text}.
   * @param {number} x The horizontal position, in pixels.
   * @param {number} y The vertical position, in pixels.
   */
  show(items: any[], x: number, y: number) {
    this.$menu.empty();
    
    items.forEach(item => {
      if (item.divider) {
        this.$menu.append("<li><hr class=\"dropdown-divider\"></li>");
        return;
      }
      
      if (item.header) {
        this.$menu.append($("<li></li>").append($("<h6 class=\"dropdown-header\"></h6>").text(item.header)));
        return;
      }
      
      const $link = $("<a class=\"dropdown-item\" href=\"#\"></a>").toggleClass("disabled", !!item.disabled);
      $link.append("<i class=\"fas " + (item.icon || "fa-circle") + " fa-fw me-2\"></i>", $("<span></span>").text(item.label));
      if (item.shortcut) {
        $link.append($("<kbd class=\"st-shortcut\"></kbd>").text(item.shortcut));
      }
      
      $link.on("click", event => {
        event.preventDefault();
        this.hide();
        if (!item.disabled && item.action) {
          item.action();
        }
      });
      this.$menu.append($("<li></li>").append($link));
    });
    
    this.$menu.css({ left: 0, top: 0 }).addClass("show");
    const width = this.$menu.outerWidth();
    const height = this.$menu.outerHeight();
    const zoom = StudioCore.zoom();
    this.$menu.css({
        left: Math.max(4, Math.min(x/zoom, window.innerWidth/zoom - width - 8))
      , top: Math.max(4, Math.min(y/zoom, window.innerHeight/zoom - height - 8))
    });
  }

  /**
   * Shows the menu below an element.
   *
   * @param {Array<Object>} items The entries, as for show.
   * @param {Element} anchor The element.
   */
  showBelow(items: any[], anchor: Element) {
    const box = anchor.getBoundingClientRect();
    this.show(items, box.left, box.bottom + 2);
  }

  /**
   * Hides the menu.
   */
  hide() {
    this.$menu.removeClass("show");
  }
}
// ----------------------------------------------------------------
