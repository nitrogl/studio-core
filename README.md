# Studio Core

A toolkit for browser IDEs of formal languages: protocol verifiers, model checkers, interactive provers. It is agnostic of the language and of the backend: a studio plugs in its lexer, parser, LaTeX writer and engine, and the core does the rest. Everything runs in the page, offline and from disk, with no server and no bundler.

PieStudio (ProVerif), CryStudio (CryptoVerif) and MetaStudio (protocols as message sequence charts) are built on it.

## Building blocks

- advanced highlighting of source code
- unlimited undo as minimal diffs, the layout lies in a comment of the model
- (optional) diagram view with drag and drop, message arrows, zoom, etc.
- mathematical notation with customisable conventions, hints in comments (`@notation`, `@infix`...)
- modular on backends, including sentence-by-sentence interactive interface
- user-friendly environment with (user-customisable) translations and documentation

## Use

A studio keeps the build of the core (`npm run dist`) in its folder `studio-core/`: the page loads `studio-core.min.js` and `studio-core.min.css`, the studio compiles against `studio-core.d.ts`, and its translations take the messages of the core from `studio-core.pot`. Its `scripts/update-core.sh path/to/studio-core` copies them, from `dist/` or from a release zip. Then it calls `StudioCore.configure({...})`. See [Building a studio](docs/using.md) and [Translating a studio](docs/translating.md).

## Build and check

The last version has been tested with Node 22.18 and TypeScript 7.0 (5.9 used to work, but untested now).

```sh
npm install
npm run build
npm test
npm run dist
npm run docs
```

The views are checked in a browser by the studios (`tests/check-ui.ts`). `js/` and `dist/` are built, not committed.

## Files

| Resource | Description |
|---|---|
| src/StudioCore.ts   | the configuration of the studio |
| src/text/           | text, history, layout comment, translations, zip |
| src/notation/       | conventions, hints, LaTeX writer, TikZ |
| src/view/           | code, formulas, diagram, dialogs, menus, notices, themes, languages |
| src/engine/         | verifier settings, interactive prover |
| css/                | the styles (classes and ids start with st-) |
| types/              | the globals of the libraries the page serves |
| tools/              | build-i18n.ts, build-docs.sh |
| dist.sh             | builds dist/, what the studios copy into their studio-core/ |
| docs/               | the documentation |
| tests/              | the checks under Node |

## License

MIT licence (`LICENSE`), by Roberto Metere, so that studios under any free licence can use it.
