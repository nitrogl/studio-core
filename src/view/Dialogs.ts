/**
 * Pop-ups of the studio, as Bootstrap modals: a generic one for the forms,
 * and the small ones (confirmation, question, information, export).
 *
 * One modal element is reused: it is filled for each pop-up and its result
 * comes back as a promise.
 *
 * @author Roberto Metere
 * @license MIT
 */
class Dialogs {
  $modal: JQuery<HTMLElement>;
  modal: bootstrap.Modal;
  resolve: (value: any) => void;
  pending: any;
  onShown: any;
  closing: boolean;
  state: string;

  /**
   * @param {Object} params The parameters.
   * @param {string} params.modal The modal element.
   */
  constructor(params: { modal?: string }) {
    const defaults = {
        modal: "#st-modal"
    };
    params = {...defaults, ...params};
    this.$modal = $(params.modal);
    this.modal = bootstrap.Modal.getOrCreateInstance(this.$modal[0], { backdrop: "static" });
    this.resolve = null;
    this.pending = null;
    this.onShown = null;
    this.closing = false;
    
    /* 
     * Bootstrap ignores show and hide while the modal moves: I keep its
     * state, and a pop-up asked for meanwhile waits for its turn
     */
    this.state = "hidden";
    this.$modal.on("show.bs.modal", () => {
      this.state = "showing";
    });
    this.$modal.on("shown.bs.modal", () => {
      this.state = "shown";
      if (this.closing) {
        this.closing = false;
        this.modal.hide();
        return;
      }
      
      if (this.onShown) {
        this.onShown();
      }
    
      this.advance();
    });
    this.$modal.on("hide.bs.modal", () => {
      this.state = "hiding";
    });
    this.$modal.on("hidden.bs.modal", () => {
      this.state = "hidden";
      
      // Closed with the cross or the Escape key: no result
      const resolve = this.resolve;
      this.resolve = null;
      
      if (resolve) {
        resolve(null);
      }
      
      this.advance();
    });
  }

  /**
   * Opens a pop-up.
   *
   * @param {Object} params The pop-up.
   * @param {string} params.title The title.
   * @param {string} params.icon A Font Awesome icon for the title.
   * @param {jQuery|string} params.body The content.
   * @param {Array<Object>} params.buttons The buttons: label, style
   *   (Bootstrap), value (the result) or action (a function that returns
   *   the result, or undefined to keep the pop-up open).
   * @param {string} params.size "sm", "lg", "xl" or "" for the normal size.
   * @param {function():void} params.onShown Called once the pop-up shows.
   * @return {Promise<*>} The result, or null when the pop-up is closed.
   */
  open(params: { title?: string; icon?: string; body?: JQuery | string; buttons?: any[]; size?: string; onShown?: (() => void) }) {
    const defaults = {
        title: ""
      , icon: ""
      , body: ""
      , buttons: [{ label: I18n.t("Close"), style: "secondary", value: null }]
      , size: ""
      , onShown: null
    };
    params = {...defaults, ...params};
    
    if (this.pending) {
      this.pending.resolve(null);
    }
    
    return new Promise<any>(resolve => {
      this.pending = { params: params, resolve: resolve };
      this.advance();
    });
  }

  /**
   * Shows the pop-up that waits, once the modal is free: the open pop-up
   * is closed first, without a result.
   */
  advance() {
    if (!this.pending) return;
    if (this.state === "hidden") {
      const pending = this.pending;
      this.pending = null;
      this.fill(pending.params);
      this.resolve = pending.resolve;
      this.modal.show();
    } else if (this.state === "shown") {
      this.close(null);
    }
  }

  /**
   * Fills the modal with a pop-up.
   *
   * @param {Object} params The pop-up, as for open.
   */
  fill(params: any) {
    const $dialog = this.$modal.find(".modal-dialog").removeClass("modal-sm modal-lg modal-xl");
    
    if (params.size) {
      $dialog.addClass("modal-" + params.size);
    }
    const $title = this.$modal.find(".modal-title").empty();
    
    if (params.icon) {
      $title.append("<i class=\"fas " + params.icon + " me-2\"></i>");
    }
    $title.append($("<span></span>").text(params.title));
    this.$modal.find(".modal-body").empty().append(params.body);
    const $footer = this.$modal.find(".modal-footer").empty();
    
    params.buttons.forEach(button => {
      const $button = $("<button type=\"button\" class=\"btn btn-sm\"></button>").addClass("btn-" + (button.style || "secondary")).text(button.label);
      $button.on("click", () => {
        if (button.action) {
          const value = button.action();
          if (value !== undefined) {
            this.close(value);
          }
        } else {
          this.close(button.value === undefined ? null : button.value);
        }
      });
      $footer.append($button);
    });
    this.onShown = params.onShown;
  }

  /**
   * Closes the pop-up with a result.
   *
   * @param {*} value The result.
   */
  close(value: any) {
    const resolve = this.resolve;
    this.resolve = null;
    if (resolve) {
      resolve(value);
    }
    
    // While it shows, the modal would not hide: it hides once shown
    if (this.state === "showing") {
      this.closing = true;
    } else {
      this.modal.hide();
    }
  }

  /**
   * @return {jQuery} The content of the open pop-up.
   */
  body(): JQuery {
    return this.$modal.find(".modal-body");
  }

  /**
   * Asks a yes or no question.
   *
   * @param {string} title The title.
   * @param {string} message The question.
   * @param {string} yes The label of the button that agrees; OK when
   *   there is none.
   * @return {Promise<boolean>} True when the user agrees.
   */
  confirm(title: string, message: string, yes: string = null): Promise<boolean> {
    return this.open({
        title: title
      , icon: "fa-circle-question"
      , body: $("<p class=\"mb-0\"></p>").text(message)
      , buttons: [
            { label: I18n.t("Cancel"), style: "secondary", value: false }
          , { label: yes || I18n.t("OK"), style: "primary", value: true }
        ]
    }).then(value => value === true);
  }

  /**
   * Asks for a line of text.
   *
   * @param {Object} params The question.
   * @param {string} params.title The title.
   * @param {string} params.label The label of the input.
   * @param {string} params.value The initial value.
   * @param {function(string):string|null} params.validate Gives an error
   *   for a wrong value, or null.
   * @return {Promise<string|null>} The value, or null when cancelled.
   */
  prompt(params: { title?: string; label?: string; value?: string; validate?: ((arg0: string) => string | null) }): Promise<string | null> {
    const defaults = {
        title: ""
      , label: ""
      , value: ""
      , validate: () => null
    };
    
    params = {...defaults, ...params};
    const $body = $("<div></div>");
    const $input = $("<input type=\"text\" class=\"form-control form-control-sm st-mono\" spellcheck=\"false\">").val(params.value);
    const $error = $("<div class=\"invalid-feedback\"></div>");
    $body.append($("<label class=\"form-label small\"></label>").text(params.label), $input, $error);
    
    const accept = () => {
      const value = String($input.val()).trim();
      const error = params.validate(value);
      $input.toggleClass("is-invalid", !!error);
      $error.text(error || "");
      return error ? undefined : value;
    };
    
    $input.on("keydown", event => {
      if (event.key === "Enter") {
        const value = accept();
        if (value !== undefined) {
          this.close(value);
        }
      }
    });
    
    return this.open({
        title: params.title
      , icon: "fa-pen"
      , body: $body
      , buttons: [
            { label: I18n.t("Cancel"), style: "secondary", value: null }
          , { label: I18n.t("OK"), style: "primary", action: accept }
        ]
      , onShown: () => $input.trigger("focus").trigger("select")
    });
  }

  /**
   * Shows a message.
   *
   * @param {string} title The title.
   * @param {jQuery|string} body The content.
   * @param {string} icon A Font Awesome icon.
   * @return {Promise} Resolves when the pop-up closes.
   */
  inform(title: string, body: JQuery | string, icon: string = "fa-circle-info"): Promise<any> {
    return this.open({ title: title, icon: icon, body: body, size: "lg" });
  }
}
// ----------------------------------------------------------------
