# STXT Editor

The [STXT](https://stxt.dev) editor for any web page: a `<textarea>` becomes an editor with
highlighting, errors while typing, and completion and hover driven by the grammar.

```html
<link rel="stylesheet" href="stxt-editor.css">
<script src="stxt-editor.js"></script>

<textarea id="doc" name="doc"></textarea>

<script>
	const editor = StxtEditor.fromTextArea(document.getElementById("doc"), {
		grammars: [templateText],
		onChange: (text, diagnostics) => console.log(diagnostics),
	});
</script>
```

> **Status: 0.1.0, in development.** The API may still change. Not published on npm yet.

## What it does

- **Highlighting** from the parser of [`@stxt-lang/core`](https://www.npmjs.com/package/@stxt-lang/core).
  There is no grammar of the language here. Blocks that a grammar declares as `MARKDOWN` are
  highlighted as Markdown.
- **Errors while typing**: syntax errors, and validation errors against the grammars.
- **Completion** (typing, or Ctrl+Space): the nodes the grammar allows at that point, and the
  `ENUM` values.
- **Hover** over a node shows what the parser and its grammar know about it.
- **Tab inserts indentation**: a tab, or four spaces. Switching re-indents the document.
- **The textarea stays in sync**: a form that contains it still submits the text.

## Install

```bash
npm install @stxt-lang/editor
```

```js
import { fromTextArea } from "@stxt-lang/editor";
import "@stxt-lang/editor/stxt-editor.css";
```

The package is ESM. CodeMirror and `@stxt-lang/core` are dependencies, not bundled, so a page that
already uses CodeMirror loads a single copy.

Without a bundler, `dist/stxt-editor.js` has everything inside and defines a global
`StxtEditor`.

## API

| Call | What it does |
|---|---|
| `fromTextArea(textarea, options)` | Replaces a textarea with an editor. The textarea is hidden and keeps the text |
| `mount(element, options)` | Creates an editor inside an element |

| Option | Default | |
|---|---|---|
| `value` | the textarea's value, or `""` | Initial text |
| `grammars` | `[]` | Texts of `@stxt.schema` or `@stxt.template` documents |
| `validation` | `true` | Validate against the grammars. Syntax errors are always reported |
| `indent` | `"tabs"` | What Tab inserts: `"tabs"` or `"spaces"` |
| `readOnly` | `false` | The text can be read, not edited |
| `onChange` | — | `(text, diagnostics) => void`, on creation and after every change |

| Method | |
|---|---|
| `getValue()` / `setValue(text)` | The text. `setValue` is an edit: it can be undone |
| `setGrammars(texts)` | Replaces the grammars and validates again |
| `setValidation(enabled)` | Turns validation on or off |
| `setIndent(mode)` | Changes what Tab inserts and re-indents the document |
| `setReadOnly(readOnly)` | Read-only or editable |
| `getDiagnostics()` | The problems of the document. Lines are 0-based |
| `getGrammarDiagnostics()` | The problems of each grammar, in order |
| `focus()` / `destroy()` | `destroy` removes the editor and shows the textarea again |
| `view` | The CodeMirror `EditorView` |

A diagnostic is `{ line, code, message, severity, source }`. `code` is the stable error code of the
ecosystem (`INDENTATION_MIXED`, `INVALID_VALUE`…), `severity` is `"error"` or `"warning"`, and
`source` is `"syntax"`, `"grammar"` or `"validation"`.

### The pieces underneath

For more than one document per view, or another layout, the package also exports what the
editor is made of:

- `Analyzer`: parses and validates a set of documents. No DOM, no CodeMirror.
- `createStxtEditor`, `createStxtExtensions`: the CodeMirror extensions.
- `setTokensEffect`, `toCmDiagnostics`: to push an analysis into a view.

## Static highlighting

For pages that show STXT and do not edit it, there is a highlighter without CodeMirror, much
lighter than the editor (about 21 kB gzipped, against 133 kB):

```html
<link rel="stylesheet" href="stxt-editor.css">
<script src="stxt-highlight.js"></script>

<pre><code class="language-stxt">Recipe (com.example.cooking): Pancakes
	Serves: 4</code></pre>

<script>
	StxtHighlight.highlightAll();
</script>
```

| Call | What it does |
|---|---|
| `highlightAll(selector, options)` | Highlights every element that matches. `selector` defaults to `pre code.language-stxt` |
| `highlight(element, options)` | Highlights one element in place |
| `highlightText(text, options)` | Returns the HTML, without touching the DOM: it also works on a server |

The only option is `grammars`: with them, blocks that a grammar declares as `MARKDOWN` are
highlighted as Markdown. With a bundler: `import { highlightAll } from "@stxt-lang/editor/highlight"`.

## Themes

The colours are CSS custom properties on `.stxt-editor` (the editor) and `.stxt-highlight` (static
highlighting). Override them to theme both:

```css
.stxt-editor {
	--stxt-node: #0d5cb6;
	--stxt-value: #d05a80;
	--stxt-comment: #008000;
	--stxt-background: #fff;
	height: 22rem;
}
```

The full list is at the top of `stxt-editor.css`. Without a height, the editor grows with the text.

## Development

```bash
npm install
npm test        # lint + mocha
npm run build   # typecheck + lint, then dist/
npm start       # build and open examples/ at http://localhost:8080 (PORT changes it)
                # examples/index.html is the editor, examples/highlight.html the highlighter
```

## License

MIT © stxt-lang
