/**
 * Buttons under the code extracts of a documentation: "Open in PieStudio",
 * "Quick run in demo"...
 *
 * The page gives the buttons in window.codeActions, from the actions of
 * docs/site.conf (see build-docs.sh): {lang, label, href, run}, href being
 * relative to docs/. Each code block of that language gets a link to href,
 * with the code in the fragment of the address:
 *
 *   href#model=<base64url of the UTF-8 code>&file=<name>[&run=1]
 *
 * The fragment never reaches a server, and it works from disk too.
 *
 * SPDX-License-Identifier: MIT
 */
(function () {
  "use strict";

  // docs/, from this script in docs/assets/
  const docs = new URL("../", document.currentScript.src);

  /**
   * Encodes a text as base64url, from its UTF-8 bytes.
   *
   * @param {string} text The text.
   * @return {string} The base64url, without padding.
   */
  function base64url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    }

    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /**
   * The name of the file of an extract, which chooses the front end: .pv for
   * ProVerif; for CryptoVerif, .ocv when it reads like the oracles front end,
   * .cv otherwise.
   *
   * @param {string} lang The language of the block.
   * @param {string} code The code.
   * @return {string} The file name.
   */
  function fileName(lang, code) {
    if (lang === "cryptoverif") {
      return /:=|\bforeach\b|\breturn\s*\(/.test(code) ? "extract.ocv" : "extract.cv";
    }

    return "extract.pv";
  }

  /**
   * Adds the buttons under every code block of a language that has actions.
   */
  function addButtons() {
    const actions = window.codeActions || [];
    if (!actions.length) {
      return;
    }

    document.querySelectorAll("pre").forEach(pre => {
      const lang = actions.map(action => action.lang).find(name => pre.classList.contains(name));
      if (!lang) {
        return;
      }

      const code = pre.textContent.replace(/\n$/, "");
      const fragment = "#model=" + base64url(code) + "&file=" + fileName(lang, code);
      const bar = document.createElement("div");
      bar.className = "code-actions";
      actions.filter(action => action.lang === lang).forEach(action => {
        const link = document.createElement("a");
        link.href = new URL(action.href, docs).href + fragment + (action.run ? "&run=1" : "");
        link.textContent = action.label;
        link.target = "_blank";
        link.rel = "noopener";
        bar.appendChild(link);
      });

      const block = pre.parentElement && pre.parentElement.classList.contains("sourceCode") ? pre.parentElement : pre;
      block.insertAdjacentElement("afterend", bar);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addButtons);
  } else {
    addButtons();
  }
})();
