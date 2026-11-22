/**
 * The pane of the settings that chooses the language of the interface, and
 * that helps to translate the studio into another one: it gives the file to
 * translate, and loads a translation from a PO file, which shows at once.
 * For the translations loaded, it gives the script of the languages,
 * lang/languages.js, that the build of the translations would write with
 * them: put next to the page, it gives them to everyone, with no tool.
 *
 * The studio keeps the choice and the translations that the user loaded;
 * the pane edits them, and the studio applies them by loading the page
 * again (see StudioCore.reload), with its model and the history of its
 * changes.
 *
 * @author Roberto Metere
 * @license MIT
 */
class LanguagePane {
  preference: string;
  loaded: { [x: string]: string; };
  initial: { [x: string]: string; };
  project: string;
  file: string;
  $pane: JQuery<HTMLElement>;
  $select: JQuery<HTMLElement>;
  $status: JQuery<HTMLElement>;
  $message: JQuery<HTMLElement>;
  $loaded: JQuery<HTMLElement>;
  $improve: JQuery<HTMLElement>;
  $script: JQuery<HTMLElement>;

  /**
   * @param {Object} params The pane parameters.
   * @param {string} params.preference The language chosen: a code, or
   *   "auto" for the language of the browser.
   * @param {Object<string, string>} params.loaded The translations that the
   *   user loaded, by code: their PO files.
   * @param {string} params.project The name and the version of the studio,
   *   for the files.
   * @param {string} params.file The base name of the files to translate
   *   ("crystudio").
   */
  constructor(params: { preference?: string; loaded?: Record<string, string>; project?: string; file?: string }) {
    const defaults = {
        preference: "auto"
      , loaded: {}
      , project: StudioCore.app.name
      , file: StudioCore.app.id
    };
    params = {...defaults, ...params};
    this.preference = params.preference;
    this.loaded = {...params.loaded};
    this.initial = {...params.loaded};
    this.project = params.project;
    this.file = params.file;
    this.$pane = null;
  }

  /**
   * Builds the pane.
   *
   * @return {jQuery} The pane.
   */
  render(): JQuery {
    const app = StudioCore.app.name;
    // The files take the project of the build of the languages, as the files of lang/ do
    const project = () => I18n.notice.project || this.project;
    this.$pane = $("<div class=\"st-language\"></div>");
    this.$select = $("<select class=\"form-select form-select-sm\" data-key=\"language\"></select>").on("change", () => this.status());
    this.$status = $("<div class=\"form-text\"></div>");
    this.$message = $("<div class=\"st-language-message\"></div>");
    this.$loaded = $("<div class=\"st-language-loaded\"></div>");
    
    const $input = $("<input type=\"file\" accept=\".po,.pot,text/plain\" hidden>").on("change", event => {
      const file = (event.target as HTMLInputElement).files[0];
      if (file) {
        file.text().then(text => this.load(text, file.name));
      }
      $input.val("");
    });
    
    const $load = $("<button type=\"button\" class=\"btn btn-sm btn-outline-primary\"></button>")
      .append("<i class=\"fas fa-folder-open me-1\"></i>", $("<span></span>").text(I18n.t("Load a translation (.po)...")))
      .on("click", () => $input.trigger("click"));
    
    const $template = $("<button type=\"button\" class=\"btn btn-sm btn-outline-secondary\"></button>")
      .append("<i class=\"fas fa-file-arrow-down me-1\"></i>", $("<span></span>").text(I18n.t("Download the file to translate (.pot)")))
      .on("click", () => LanguagePane.download(this.file + "-template.pot", I18n.toPo(null, project())));
    
    this.$improve = $("<button type=\"button\" class=\"btn btn-sm btn-outline-secondary\"></button>")
      .append("<i class=\"fas fa-file-pen me-1\"></i>", $("<span></span>"))
      .on("click", () => {
        const code = this.chosen();
        // A translation loaded keeps all that its file has, brought up to date as in lang/
        const text = this.loaded[code] !== undefined ? I18n.updatePo(this.loaded[code], project()).text : I18n.toPo(code, project());
        LanguagePane.download(this.file + "-" + code + ".po", text);
      });
    
    this.$script = $("<button type=\"button\" class=\"btn btn-sm btn-outline-secondary\"></button>")
      .append("<i class=\"fas fa-file-code me-1\"></i>", $("<span></span>").text(I18n.t("Download languages.js")))
      .on("click", () => LanguagePane.download("languages.js", LanguagePane.script(this.loaded, project())));
    
    this.$pane.append(
      $("<div class=\"mb-3\"></div>").append($("<label class=\"form-label st-form-label\"></label>").text(I18n.t("Language of the interface")), this.$select, this.$status
        , $("<div class=\"form-text\"></div>").text(I18n.t("When the settings are saved, the page loads again in the language chosen, with the model and the history of its changes.")))
    , $("<fieldset class=\"st-conventions\"></fieldset>").append(
          $("<legend></legend>").text(I18n.t("Translate {app}", { app: app }))
        , $("<p class=\"st-muted small\"></p>").text(I18n.t("Hand the file to translate to whoever knows another language: they write the translation of each message after msgstr, with a text editor or with Poedit, and load the file here to see it at once."))
        , $("<p class=\"st-muted small\"></p>").text(I18n.t("To give a translation to everyone who opens {app}, load it here, then put the languages.js that this pane gives in the folder lang/, next to the page, in place of the one there. Keep the translation in lang/ too, for later changes.", { app: app }))
        , $("<div class=\"st-language-buttons\"></div>").append($template, this.$improve, $load, this.$script, $input)
        , this.$message
        , this.$loaded
      )
    );
    this.fill();
    return this.$pane;
  }

  /**
   * Fills the list of the languages and of the translations loaded.
   */
  fill() {
    const browser = I18n.choose("auto", typeof navigator !== "undefined" ? navigator.languages || [] : []);
    const selected = this.$select.val() || this.preference;
    this.$select.empty().append($("<option value=\"auto\"></option>").text(I18n.t("Automatic: the language of the browser ({name})", { name: I18n.nameOf(browser) })));
    
    I18n.list().forEach(language => {
      const label = language.origin === "loaded" ? I18n.t("{name} (loaded)", { name: language.name }) : language.name;
      this.$select.append($("<option></option>").attr("value", language.code).text(label));
    });
    
    this.$select.val(this.$select.find("option[value=\"" + selected + "\"]").length ? selected : "auto");
    this.$loaded.empty();
    
    Object.keys(this.loaded).forEach(code => {
      const language = I18n.languages.get(I18n.key(code));
      this.$loaded.append($("<div class=\"st-language-item\"></div>").append(
          $("<span></span>").text(I18n.t("Loaded by you: {name} ({code})", { name: language ? language.name : code, code: code }))
        , $("<button type=\"button\" class=\"btn btn-sm btn-link\"></button>").text(I18n.t("Remove")).on("click", () => {
            delete this.loaded[code];
            I18n.unregister(code);
            this.fill();
          })
      ));
    });
    
    this.$script.toggle(Object.keys(this.loaded).length > 0);
    this.status();
  }

  /**
   * @return {string} The code of the language that the select gives, the
   *   language of the browser for "auto".
   */
  chosen(): string {
    const value = String(this.$select.val() || "auto");
    
    return value === "auto" ? I18n.choose("auto", typeof navigator !== "undefined" ? navigator.languages || [] : []) : value;
  }

  /**
   * Shows how much of the chosen language is translated.
   */
  status() {
    const code = this.chosen();
    const language = I18n.languages.get(I18n.key(code));
    
    if (!language) {
      this.$status.text(I18n.t("The messages of {app} are written in English.", { app: StudioCore.app.name }));
      this.$improve.hide();
      return;
    }
    
    const translated = I18n.translated(language);
    const total = I18n.entries.length;
    this.$status.text(translated === total
      ? I18n.t("All {total} messages are translated.", { total: total })
      : I18n.t("{translated} of {total} messages are translated; the others show in English.", { translated: translated, total: total }));
    this.$improve.show().find("span").text(I18n.t("Download {name} to improve it (.po)", { name: language.name }));
  }

  /**
   * Loads a translation from a PO file: it joins the languages, and the
   * select chooses it.
   *
   * @param {string} text The file.
   * @param {string} name Its name.
   */
  load(text: string, name: string) {
    this.$message.empty();
    let language = null;
    try {
      language = I18n.fromPo(text, "loaded");
    } catch (e) {
      this.$message.append($("<div class=\"alert alert-danger py-1 px-2 mb-0 small\"></div>").text(name + ": " + (e as Error).message));
    
      return;
    }
    
    const registered = I18n.register(language);
    this.loaded[registered.code] = text;
    this.fill();
    this.$select.val(registered.code);
    this.status();
    
    const $note = $("<div class=\"alert alert-success py-1 px-2 mb-0 small\"></div>")
      .text(I18n.t("Loaded {file}: {name} ({code}), {translated} of {total} messages. Save the settings to see it.", {
          file: name
        , name: registered.name
        , code: registered.code
        , translated: I18n.translated(registered)
        , total: I18n.entries.length
      }));
    
    if (language.problems.length) {
      $note.removeClass("alert-success").addClass("alert-warning")
        .append($("<div></div>").text(I18n.n("{count} line could not be read: {lines}", "{count} lines could not be read: {lines}", language.problems.length,
          { lines: language.problems.slice(0, 5).map(problem => problem.line).join(", ") })));
    }
    
    if (/INTEGER|EXPRESSION/.test(language.plural)) {
      $note.removeClass("alert-success").addClass("alert-warning")
        .append($("<div></div>").text(I18n.t("The file does not give the plural forms of the language: write them after Plural-Forms, in its header (see the comments at its top). Until then, plurals show as in English.")));
    }
    
    if (language.refused.length) {
      $note.removeClass("alert-success").addClass("alert-warning");
      language.refused.slice(0, 5).forEach(refused => $note.append($("<div></div>")
        .text(I18n.t("Line {line}: {reason}; the message shows in English.", { line: refused.line, reason: refused.reason }))));
      
      if (language.refused.length > 5) {
        $note.append($("<div></div>").text(I18n.n("And {count} more.", "And {count} more.", language.refused.length - 5)));
      }
    }
    this.$message.append($note);
  }

  /**
   * Gives back the translations that the studio had before the pane changed
   * them, when the settings are cancelled.
   */
  restore() {
    const code = I18n.language();
    Object.keys({...this.initial, ...this.loaded}).forEach(key => {
      if (this.initial[key] === this.loaded[key]) {
        return;
      }
      
      I18n.unregister(key);
      if (this.initial[key] !== undefined) {
        try {
          I18n.register(I18n.fromPo(this.initial[key], "loaded"));
        } catch (e) {
          // The studio left out this translation when it started, for the same reason
        }
      }
    });
    I18n.use(code);
    this.loaded = {...this.initial};
  }

  /**
   * @return {Object} {preference, loaded}: the language chosen ("auto" or a
   *   code), and the translations loaded by the user, by code.
   */
  collect() {
    return { preference: String(this.$select.val() || "auto"), loaded: {...this.loaded} };
  }

  /**
   * Writes the script of the languages, lang/languages.js, with the
   * translations that the user loaded: the script that the build of the
   * translations writes once their files are in lang/, each brought up to
   * date with the template, in place of the language of the same code that
   * the studio ships, if any.
   *
   * @param {Object<string, string>} loaded The translations loaded, by
   *   code: their PO files.
   * @param {string} project The name and the version of the studio.
   * @return {string} The script.
   */
  static script(loaded: Record<string, string>, project: string): string {
    const languages = new Map();
    I18n.builtIn.forEach((language, key) => languages.set(key, language));
    
    Object.keys(loaded).forEach(code => {
      try {
        const language = I18n.fromPo(I18n.updatePo(loaded[code], project).text, "built-in");
        languages.set(I18n.key(language.code), language);
      } catch (e) {
        // A file that names no language was never loaded
      }
    });
    
    return I18n.toScript(Array.from(languages.values()));
  }

  /**
   * Gives a file to the user.
   *
   * @param {string} name The name of the file.
   * @param {string} text Its content.
   */
  static download(name: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
// ----------------------------------------------------------------
