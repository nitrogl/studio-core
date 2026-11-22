/**
 * Short messages in a corner of the page, inspired by Bootstrap toasts.
 *
 * @author Roberto Metere
 * @license MIT
 */
class Toast {
  /**
   * The container of the toasts.
   *
   * @type {string}
   */
  static CONTAINER = "#st-toasts";

  /**
   * Shows a message.
   *
   * @param {string} message The message.
   * @param {string} kind "info", "success", "warning" or "error".
   * @param {number} delay Milliseconds before it hides.
   */
  static show(message: string, kind: string = "info", delay: number = 4000) {
    const icons = {
        info: "fa-circle-info"
      , success: "fa-circle-check"
      , warning: "fa-triangle-exclamation"
      , error: "fa-circle-xmark"
    };
    
    const $toast = $("<div class=\"toast st-toast align-items-center\" role=\"status\" aria-live=\"polite\"></div>").addClass("st-toast-" + kind);
    const $body = $("<div class=\"d-flex\"></div>");
    $body.append($("<div class=\"toast-body\"></div>").append("<i class=\"fas " + (icons[kind] || icons.info) + " me-2\"></i>", $("<span></span>").text(message)));
    $body.append($("<button type=\"button\" class=\"btn-close me-2 m-auto\" data-bs-dismiss=\"toast\"></button>").attr("aria-label", I18n.t("Close")));
    $toast.append($body).appendTo(Toast.CONTAINER);
    const toast = new bootstrap.Toast($toast[0], { delay: delay });
    $toast.on("hidden.bs.toast", () => $toast.remove());
    toast.show();
  }
}
// ----------------------------------------------------------------
