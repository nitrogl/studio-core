/**
 * Scrolls an element, across and down, while the middle button of the mouse
 * drags it.
 *
 * @author Roberto Metere
 * @license MIT
 */
class Panning {
  /**
   * Lets the middle button drag the content of an element.
   *
   * @param {HTMLElement} element The element that scrolls.
   */
  static attach(element: HTMLElement) {
    element.addEventListener("mousedown", event => {
      if (event.button !== 1) {
        return;
      }
      event.preventDefault();
      const from = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop, zoom: StudioCore.zoom() };
      const move = (moved: MouseEvent) => {
        element.scrollLeft = from.left - (moved.clientX - from.x)/from.zoom;
        element.scrollTop = from.top - (moved.clientY - from.y)/from.zoom;
      };
      const stop = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", stop);
        window.removeEventListener("blur", stop);
        element.classList.remove("st-panning");
      };
      element.classList.add("st-panning");
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", stop);
      window.addEventListener("blur", stop);
    });
    element.addEventListener("auxclick", event => {
      if (event.button === 1) {
        event.preventDefault();
      }
    });
  }
}
// ----------------------------------------------------------------
