/**
 * Lets touches drive jQuery UI, which listens to the mouse only.
 *
 * A one finger touch that starts on one of the given elements is passed on
 * as mouse events (down, move, up) to the element under the finger, so that
 * blocks, palette actions, declarations and panel borders can be dragged on
 * a tablet. Touches with more fingers are left to the browser (zoom).
 * 
 * Part is borrowed from MetaCP.
 *
 * @author Roberto Metere
 * @license MIT
 */
class TouchMouse {
  /**
   * Whether a touch is being passed on as mouse events.
   *
   * @type {boolean}
   */
  static active = false;

  /**
   * Starts passing touches on.
   *
   * @param {string} selector The elements where a touch starts a drag.
   */
  static install(selector: string) {
    document.addEventListener("touchstart", event => {
      TouchMouse.active = event.touches.length === 1 && $(event.target).closest(selector).exists();
      if (TouchMouse.active) {
        TouchMouse.forward(event, "mousedown");
      }
    }, { passive: true });
    document.addEventListener("touchmove", event => {
      if (TouchMouse.active && event.touches.length === 1) {
        event.preventDefault();
        TouchMouse.forward(event, "mousemove");
      }
    }, { passive: false });
    document.addEventListener("touchend", event => {
      if (TouchMouse.active) {
        TouchMouse.forward(event, "mouseup");
        TouchMouse.active = false;
      }
    }, { passive: true });
  }

  /**
   * Sends the mouse event that matches a touch event.
   *
   * @param {TouchEvent} event The touch event.
   * @param {string} type The mouse event: mousedown, mousemove or mouseup.
   */
  static forward(event: TouchEvent, type: string) {
    const touch = event.changedTouches[0];
    const target = type === "mousedown" ? touch.target : document.elementFromPoint(touch.clientX, touch.clientY) || touch.target;
    target.dispatchEvent(new MouseEvent(type, {
        bubbles: true
      , cancelable: true
      , view: window
      , screenX: touch.screenX
      , screenY: touch.screenY
      , clientX: touch.clientX
      , clientY: touch.clientY
      , button: 0
      , buttons: type === "mouseup" ? 0 : 1
    }));
  }
}
// ----------------------------------------------------------------
