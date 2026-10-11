# STXT Editor

The [STXT](https://stxt.dev) editor for any web page: a `<textarea>` becomes an editor with
highlighting, errors while typing, and completion and hover driven by the grammar.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@stxt-lang/editor@0.2.0/dist/stxt-editor.css">
<script src="https://cdn.jsdelivr.net/npm/@stxt-lang/editor@0.2.0/dist/stxt-editor.js"></script>

<textarea id="doc" name="doc">
Recipe (com.example.cooking): Pancakes
	Serves: four
	Difficulty: Easy
</textarea>

<script>
	const template = `
Template (@stxt.template): com.example.cooking
	Structure >>
		Recipe (com.example.cooking):
			Serves: (1) NATURAL
			Difficulty: (?) ENUM [Easy, Medium, Hard]
`;

	const editor = StxtEditor.fromTextArea(document.getElementById("doc"), {
		grammars: [template],
		onChange: (text, diagnostics) => console.log(diagnostics),
	});
</script>
```

`Serves: four` is underlined: the template says `NATURAL`.

> **Status: 0.2.0.** The API may still change before 1.0.

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

### With a `<script>`

The package carries its files ready for a page, minified. Any CDN that serves npm packages
serves them, under `https://cdn.jsdelivr.net/npm/@stxt-lang/editor@0.2.0/`:

| File | Global | Size (gzip) | What it has |
|---|---|---|---|
| `dist/stxt-editor.js` | `StxtEditor` | 421 kB (133 kB) | The editor and the static highlighting, with CodeMirror and `@stxt-lang/core` inside |
| `dist/stxt-highlight.js` | `StxtHighlight` | 76 kB (21 kB) | Only the static highlighting, without CodeMirror |
| `dist/stxt-editor.css` | — | 6 kB (2 kB) | The styles of both |
| `dist/stxt-editor-dark.css` | — | 7 kB (2 kB) | The same styles with the [dark theme](#dark-theme), instead of `stxt-editor.css` |

### With a bundler

```bash
npm install @stxt-lang/editor
```

```js
import { fromTextArea } from "@stxt-lang/editor";
import "@stxt-lang/editor/stxt-editor.css";
```

The package is ESM, with type declarations. CodeMirror and `@stxt-lang/core` are dependencies,
not bundled, so a page that already uses CodeMirror loads a single copy.

## API

| Call | What it does |
|---|---|
| `fromTextArea(textarea, options)` | Replaces a textarea with an editor. The textarea is hidden and keeps the text |
| `mount(element, options)` | Creates an editor inside an element |

Both return an `Editor`. Every option is optional:

| Option | Default | |
|---|---|---|
| `value` | the textarea's value, or `""` | Initial text |
| `grammars` | `[]` | Texts of `@stxt.schema` or `@stxt.template` documents |
| `validation` | `true` | Validate against the grammars. Syntax errors are always reported |
| `indent` | `"tabs"` | What Tab inserts: `"tabs"` or `"spaces"` |
| `readOnly` | `false` | The text can be read, not edited |
| `onChange` | — | `(text, diagnostics) => void`, on creation and after every change |

A grammar written inside the document itself works too. A grammar that lives at a URL is
fetched by the page:

```js
const template = await (await fetch("/grammars/cooking.stxt")).text();
editor.setGrammars([template]);
```

| Method | |
|---|---|
| `getValue()` / `setValue(text)` | The text. `setValue` is an edit: it can be undone |
| `setGrammars(texts)` | Replaces the grammars and validates again |
| `setValidation(enabled)` | Turns validation on or off |
| `setIndent(mode)` | Changes what Tab inserts and re-indents the document |
| `setReadOnly(readOnly)` | Read-only or editable |
| `getDiagnostics()` | The problems of the document |
| `getGrammarDiagnostics()` | The problems of each grammar, in order |
| `focus()` / `destroy()` | `destroy` removes the editor and shows the textarea again |
| `view` | The CodeMirror `EditorView` |

A diagnostic is `{ line, code, message, severity, source }`:

| Field | |
|---|---|
| `line` | 0-based |
| `code` | The stable error code of the ecosystem: `INDENTATION_MIXED`, `INVALID_VALUE`… |
| `severity` | `"error"` or `"warning"` |
| `source` | `"syntax"`, `"grammar"` or `"validation"` |

### The pieces underneath

For more than one document per view, or another layout, the package also exports what the
editor is made of:

- `Analyzer`: parses and validates a set of documents. No DOM, no CodeMirror.
- `createStxtEditor`, `createStxtExtensions`: the CodeMirror extensions.
- `setTokensEffect`, `toCmDiagnostics`: to push an analysis into a view.

## Static highlighting

For pages that show STXT and do not edit it, there is a highlighter without CodeMirror:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@stxt-lang/editor@0.2.0/dist/stxt-editor.css">
<script src="https://cdn.jsdelivr.net/npm/@stxt-lang/editor@0.2.0/dist/stxt-highlight.js"></script>

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
| `highlightText(text, options)` | Returns the HTML, without touching the DOM: it also works in Node, on a server or in a build |

The only option is `grammars`: with them, blocks that a grammar declares as `MARKDOWN` are
highlighted as Markdown.

With a bundler: `import { highlightAll } from "@stxt-lang/editor/highlight"`.

## Themes

The colours are CSS custom properties on `.stxt-editor` (the editor) and `.stxt-highlight`
(static highlighting). A page themes both by overriding them:

```css
.stxt-editor,
.stxt-highlight {
	--stxt-node: #0d5cb6;
	--stxt-value: #d05a80;
	--stxt-comment: #008000;
	--stxt-background: #fff;
}

.stxt-editor {
	height: 22rem;
}
```

Without a height, the editor grows with the text. With one, it scrolls.

| Property | Colours |
|---|---|
| `--stxt-node` | Names of the nodes |
| `--stxt-block` | The `>>` of a text block |
| `--stxt-namespace` | Namespaces |
| `--stxt-value` | Values |
| `--stxt-comment` | Comments |
| `--stxt-muted` | Punctuation, line numbers, secondary text |
| `--stxt-background`, `--stxt-text`, `--stxt-border` | The box of the editor |
| `--stxt-gutter-background`, `--stxt-active-line`, `--stxt-active-gutter` | The line numbers and the current line |
| `--stxt-selected`, `--stxt-code-background`, `--stxt-separator` | The selected completion, inline Markdown code, the rule of the hover |
| `--stxt-font-mono`, `--stxt-font-body`, `--stxt-font-size` | Fonts |

The defaults are the palette of <https://stxt.dev>.

### Dark theme

`stxt-editor-dark.css` is the same stylesheet with a dark palette. A page loads it instead of
`stxt-editor.css`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@stxt-lang/editor@0.2.0/dist/stxt-editor-dark.css">
```

With a bundler: `import "@stxt-lang/editor/stxt-editor-dark.css"`.

To follow the colour scheme of the system, a page loads both, each with its `media`:

```html
<link rel="stylesheet" media="(prefers-color-scheme: light)" href="https://cdn.jsdelivr.net/npm/@stxt-lang/editor@0.2.0/dist/stxt-editor.css">
<link rel="stylesheet" media="(prefers-color-scheme: dark)" href="https://cdn.jsdelivr.net/npm/@stxt-lang/editor@0.2.0/dist/stxt-editor-dark.css">
```

The dark palette is the same set of properties, so it is overridden the same way. Static
highlighting only sets the colours of the text: the dark background of a `<pre>` is the page's.

## Development

```bash
npm install
npm test        # lint + mocha
npm run build   # typecheck + lint, then dist/
npm start       # build and open examples/ at http://localhost:8080 (PORT changes it)
                # examples/index.html is the editor, examples/highlight.html the highlighter;
                # index-dark.html and highlight-dark.html are the same pages with the dark theme
```

## License

MIT © stxt-lang
