/**
 * Edits a file that the model needs, a library for instance, in a pop-up:
 * the code editor of the studio, with the colours of the language, the
 * problems of the file, an undo history of its own, and a button that
 * saves the file. The model stays as it is until the edit is applied.
 *
 * @author Roberto Metere
 * @license MIT
 */
class FileEditor {
  dialogs: Dialogs;
  code: CodeView;
  history: EditHistory;
  timer: number;

  /**
   * @param {Object} params The editor parameters.
   * @param {Dialogs} params.dialogs The pop-ups of the studio.
   */
  constructor(params: { dialogs?: Dialogs }) {
    const defaults = {
        dialogs: null
    };
    params = {...defaults, ...params};
    this.dialogs = params.dialogs;
    this.code = null;
    this.history = null;
    this.timer = null;
  }

  /**
   * Opens a file.
   *
   * @param {Object} params The file.
   * @param {string} params.name Its name.
   * @param {string} params.text Its text.
   * @param {function(string):Object} params.check Analyses a text: {analysis,
   *   problems}, the analysis giving the colours of the symbols (or null),
   *   the problems [{start, end, severity, message}].
   * @return {Promise<string|null>} The text, when the user applies the
   *   edit; null otherwise.
   */
  open(params: { name?: string; text?: string; check?: ((text: string) => any) }): Promise<string | null> {
    const defaults = {
        name: "library"
      , text: ""
      , check: () => ({ analysis: null, problems: [] })
    };
    params = {...defaults, ...params};
    const id = "st-file-editor-" + Date.now();
    const $host = $("<div class=\"st-file-editor\"></div>").attr("id", id);
    const $status = $("<div class=\"st-file-editor-status st-muted small\"></div>");
    this.history = new EditHistory(params.text);

    const update = () => {
      const text = this.code.getText();
      const result = params.check(text);
      const errors = (result.problems || []).filter(problem => problem.severity === "error");
      this.code.setAnalysis(result.analysis, result.problems || []);
      $status.text(errors.length ? I18n.n("{count} error: {message}", "{count} errors, the first: {message}", errors.length, { message: errors[0].message })
        : I18n.t("No problems in {name}.", { name: params.name }));
    };
    const restore = step => {
      if (step) {
        this.code.setText(step.text, step.selection);
        update();
      }
    };

    return this.dialogs.open({
        title: params.name
      , icon: "fa-book"
      , size: "xl"
      , body: $("<div></div>").append($host, $status)
      , buttons: [
            { label: I18n.t("Save the file"), style: "outline-secondary", action: () => {
                FileEditor.download(params.name, this.code.getText());
                return undefined;
              } }
          , { label: I18n.t("Cancel"), style: "secondary", value: null }
          , { label: I18n.t("Apply"), style: "primary", action: () => this.code.getText() }
        ]
      , onShown: () => {
          this.code = new CodeView({
              container: "#" + id
            , handlers: {
                  change: (text, selection) => {
                    this.history.commit(text, { label: I18n.t("Edit the code"), coalesce: "typing", selectionAfter: selection });
                    clearTimeout(this.timer);
                    this.timer = setTimeout(update, 250);
                  }
                , undo: () => restore(this.history.undo())
                , redo: () => restore(this.history.redo())
              }
          });
          this.code.setText(params.text);
          update();
          this.code.reveal(0, 0, true);
        }
    }).then(value => {
      clearTimeout(this.timer);
      return typeof value === "string" && value !== params.text ? value : null;
    });
  }

  /**
   * Gives a text to the user as a file.
   *
   * @param {string} name The name of the file.
   * @param {string} text Its text.
   */
  static download(name: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const $link = $("<a></a>").attr({ href: url, download: name }).appendTo("body");
    $link[0].click();
    $link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
// ----------------------------------------------------------------
