import * as assert from "assert";
import { highlightText } from "../src/highlight";

/** A template whose Notes are MARKDOWN. */
const TEMPLATE = [
	"Template (@stxt.template): com.example.cooking",
	"\tStructure >>",
	"\t\tRecipe (com.example.cooking):",
	"\t\t\tNotes: (?) MARKDOWN",
	"",
].join("\n");

describe("Static highlighting", () => {
	it("wraps every token of a line in its class and leaves the rest as text", () => {
		assert.strictEqual(
			highlightText("# Hi\nDoc (com.example.x): <b>"),
			'<span class="stxt-tok-comment"># Hi</span>\n' +
				'<span class="stxt-tok-property">Doc </span><span class="stxt-tok-namespace">(com.example.x)</span>' +
				'<span class="stxt-tok-property">:</span><span class="stxt-tok-string"> &lt;b&gt;</span>',
		);
	});

	it("keeps the text: removing the tags and unescaping gives it back", () => {
		const text = "Doc:\n\tBody >>\n\t\t<a href=\"x\"> & # not a comment\n\n\tEnd: 1\n";
		const html = highlightText(text);
		const plain = html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
		assert.strictEqual(plain, text);
	});

	it("colours as far as the text parsed, without failing", () => {
		const html = highlightText("Doc:\n   Bad: indentation\n");
		assert.ok(html.includes('<span class="stxt-tok-property">Doc</span>'));
	});

	it("colours MARKDOWN blocks only with the grammar that declares them", () => {
		const text = "Recipe (com.example.cooking):\n\tNotes >>\n\t\t**bold**\n";
		assert.ok(!highlightText(text).includes("stxt-tok-md-bold"));
		assert.ok(highlightText(text, { grammars: [TEMPLATE] }).includes('<span class="stxt-tok-md-bold">**bold**</span>'));
	});
});
