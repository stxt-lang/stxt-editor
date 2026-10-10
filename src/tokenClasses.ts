import { StxtTokenType } from "./analysis";

/**
 * The CSS class of each token type, shared by the editor and the static highlighter so both
 * paint with the same stylesheet.
 */
export const TOKEN_CLASSES: Record<StxtTokenType, string> = {
	comment: "stxt-tok-comment",
	namespace: "stxt-tok-namespace",
	property: "stxt-tok-property",
	macro: "stxt-tok-macro",
	string: "stxt-tok-string",
	// Content of MARKDOWN blocks
	markdownHeading: "stxt-tok-md-heading",
	markdownBold: "stxt-tok-md-bold",
	markdownItalic: "stxt-tok-md-italic",
	markdownCode: "stxt-tok-md-code",
	markdownList: "stxt-tok-md-list",
	markdownQuote: "stxt-tok-md-quote",
	markdownLink: "stxt-tok-md-link",
};
