/**
 * `@stxt-lang/editor/highlight`: static STXT highlighting, without CodeMirror. For pages that
 * show STXT and do not edit it: the text of an element becomes `<span class="stxt-tok-*">` runs,
 * painted by the same stylesheet as the editor.
 *
 * The tokens come from the parser of `@stxt-lang/core`, like in the editor: there is no grammar of
 * the language here either.
 */

import { Analyzer, StxtToken } from "./analysis";
import { TOKEN_CLASSES } from "./tokenClasses";

/** Options of the highlighting functions. */
export interface HighlightOptions {
	/**
	 * Texts of the grammars (`@stxt.schema` or `@stxt.template` documents) of the text. Only needed
	 * to colour as Markdown the blocks a grammar declares `MARKDOWN`; the rest is coloured without
	 * them.
	 */
	grammars?: string[];
}

/** CSS class of a highlighted element; the stylesheet is scoped to it. */
const ROOT_CLASS = "stxt-highlight";

/** Id of the highlighted text within the analyzer. */
const DOCUMENT_ID = "document";

/** Escapes the characters that mean something in HTML. */
function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The tokens of a text, analysed with its grammars. */
function tokensOf(text: string, options: HighlightOptions): StxtToken[] {
	const analyzer = new Analyzer();
	(options.grammars ?? []).forEach((grammar, index) => analyzer.setDocument(`grammar:${index}`, grammar));
	analyzer.setDocument(DOCUMENT_ID, text);
	return analyzer.getAnalysis(DOCUMENT_ID)?.tokens ?? [];
}

/**
 * Highlights a text as HTML: the text, escaped, with every token wrapped in a
 * `<span class="stxt-tok-*">`. No DOM involved, so it also works on a server or in a build.
 * A text that does not parse is highlighted as far as it parsed.
 *
 * @param text the STXT text.
 * @param options the grammars, for Markdown in `MARKDOWN` blocks.
 * @returns the HTML, to put inside a `<pre>` or `<code>` with the `stxt-highlight` class.
 */
export function highlightText(text: string, options: HighlightOptions = {}): string {
	const lines = text.split("\n");
	const tokensByLine = new Map<number, StxtToken[]>();
	for (const token of tokensOf(text, options)) {
		const list = tokensByLine.get(token.line) ?? [];
		list.push(token);
		tokensByLine.set(token.line, list);
	}

	return lines
		.map((line, index) => {
			const tokens = (tokensByLine.get(index) ?? []).sort((a, b) => a.startChar - b.startChar);
			let html = "";
			let column = 0;
			for (const token of tokens) {
				const end = Math.min(token.startChar + token.length, line.length);
				// Overlapping or out of range: leave it as plain text
				if (token.startChar < column || token.startChar >= end) {
					continue;
				}
				html += escapeHtml(line.slice(column, token.startChar));
				html += `<span class="${TOKEN_CLASSES[token.type]}">${escapeHtml(line.slice(token.startChar, end))}</span>`;
				column = end;
			}
			return html + escapeHtml(line.slice(column));
		})
		.join("\n");
}

/**
 * Highlights the text of an element in place, and gives it the `stxt-highlight` class.
 *
 * @param element the element, usually a `<code>` or a `<pre>`; its text is the STXT.
 * @param options the grammars, for Markdown in `MARKDOWN` blocks.
 */
export function highlight(element: Element, options: HighlightOptions = {}): void {
	element.innerHTML = highlightText(element.textContent ?? "", options);
	element.classList.add(ROOT_CLASS);
}

/**
 * Highlights every element of the page that matches a selector.
 *
 * @param selector the CSS selector, `pre code.language-stxt` by default.
 * @param options the grammars, for Markdown in `MARKDOWN` blocks.
 */
export function highlightAll(selector = "pre code.language-stxt", options: HighlightOptions = {}): void {
	document.querySelectorAll(selector).forEach((element) => highlight(element, options));
}
