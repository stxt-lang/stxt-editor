import { setDiagnostics } from "@codemirror/lint";
import { Compartment, EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Analyzer, Diagnostic } from "./analysis";
import { lineAt, toCmChanges, toCmDiagnostics } from "./editor/diagnostics";
import { setTokensEffect } from "./editor/highlight";
import { createStxtEditor, IndentMode, INDENT_UNITS, StxtEditor } from "./editor/stxtEditor";

/** Options of {@link mount} and {@link fromTextArea}. All of them are optional. */
export interface EditorOptions {
	/** Initial text. Defaults to the value of the textarea, or to an empty document. */
	value?: string;
	/**
	 * Texts of the grammars the document validates against: documents with `@stxt.schema` or
	 * `@stxt.template` roots. A grammar written inside the document itself works too.
	 */
	grammars?: string[];
	/** Whether to validate against the grammars. Syntax errors are always reported. Defaults to true. */
	validation?: boolean;
	/** What the Tab key inserts: `"tabs"` (the default) or `"spaces"` (four per level). */
	indent?: IndentMode;
	/** Whether the text can only be read, not edited. Defaults to false. */
	readOnly?: boolean;
	/** Called once on creation and after every change of the text, with the text and its diagnostics. */
	onChange?: (text: string, diagnostics: Diagnostic[]) => void;
	/**
	 * Called on "go to definition" (Ctrl+Click or Ctrl+B on a node; Cmd on macOS) when the node is
	 * defined in one of `grammars`: the editor has nowhere to show it, the page decides what to do.
	 * A definition inside the document itself needs no callback: the cursor goes to it.
	 */
	onGoToDefinition?: (location: GrammarLocation) => void;
}

/** Where a node of the document is defined, in one of the grammars given to the editor. */
export interface GrammarLocation {
	/** Index of the grammar in `grammars`. */
	grammar: number;
	/** Line of that grammar, 0-based, like the lines of the diagnostics. */
	line: number;
	/** Namespace the grammar defines. */
	namespace: string;
}

/** Id of the edited document within the analyzer. */
const DOCUMENT_ID = "document";

/** Prefix of the id of a grammar within the analyzer. */
const GRAMMAR_ID_PREFIX = "grammar:";

/** Id of the n-th grammar within the analyzer. */
const grammarId = (index: number): string => `${GRAMMAR_ID_PREFIX}${index}`;

/** The n of the id of a grammar within the analyzer, or undefined for any other id. */
const grammarIndex = (id: string): number | undefined =>
	id.startsWith(GRAMMAR_ID_PREFIX) ? Number(id.slice(GRAMMAR_ID_PREFIX.length)) : undefined;

/** CSS class of the element that holds the editor; the stylesheet is scoped to it. */
const ROOT_CLASS = "stxt-editor";

/**
 * An STXT editor on a page: one document, highlighted, with its errors underlined while typing,
 * and the grammars it validates against. Create it with {@link mount} or {@link fromTextArea}.
 *
 * The analysis comes from `@stxt-lang/core`, the reference implementation of the language: there
 * is no grammar of the language here, so what the editor accepts is what the specifications say.
 */
export class Editor {
	/** The CodeMirror view, for whoever needs to go further than this API. */
	readonly view: EditorView;

	private readonly analyzer = new Analyzer();
	private readonly editor: StxtEditor;
	private readonly readOnly = new Compartment();
	private readonly onChange?: EditorOptions["onChange"];
	private readonly onGoToDefinition?: EditorOptions["onGoToDefinition"];
	private grammarCount = 0;
	private indent: IndentMode;

	/**
	 * @param root element the editor goes into; it gets the `stxt-editor` class.
	 * @param options the options of the editor.
	 * @param onText called with the text after every change, before `onChange`.
	 * @param onDestroy called when the editor is destroyed, after removing the view.
	 */
	private constructor(
		private readonly root: HTMLElement,
		options: EditorOptions,
		private readonly onText: (text: string) => void,
		private readonly onDestroy: () => void,
	) {
		this.onChange = options.onChange;
		this.onGoToDefinition = options.onGoToDefinition;
		this.indent = options.indent ?? "tabs";
		this.analyzer.setValidation(options.validation ?? true);
		this.loadGrammars(options.grammars ?? []);

		root.classList.add(ROOT_CLASS);
		this.editor = createStxtEditor({
			parent: root,
			indent: this.indent,
			onDocChanged: (view) => this.analyze(view.state.doc.toString()),
			completions: (line, linePrefix) => this.analyzer.getCompletions(DOCUMENT_ID, line, linePrefix),
			describeNode: (line) => this.analyzer.describeNode(DOCUMENT_ID, line),
			goToDefinition: (line, character) => this.goToDefinition(line, character),
			extensions: this.readOnly.of(Editor.readOnlyExtension(options.readOnly ?? false)),
		});
		this.view = this.editor.view;
		this.editor.showState(this.editor.createState(options.value ?? ""));
		this.analyze(this.getValue());
	}

	/**
	 * Creates an editor inside an element.
	 *
	 * @param parent the element; the editor is appended to it and the element gets the
	 * `stxt-editor` class, which the stylesheet uses.
	 * @param options the options of the editor.
	 */
	static mount(parent: HTMLElement, options: EditorOptions = {}): Editor {
		const root = parent.ownerDocument.createElement("div");
		parent.appendChild(root);
		return new Editor(root, options, () => undefined, () => root.remove());
	}

	/**
	 * Replaces a textarea with an editor. The textarea stays in the page, hidden, and its value
	 * follows the editor, so a form that contains it still submits the text. {@link destroy}
	 * brings it back.
	 *
	 * @param textarea the textarea; its value is the initial text unless `options.value` says
	 * otherwise.
	 * @param options the options of the editor.
	 */
	static fromTextArea(textarea: HTMLTextAreaElement, options: EditorOptions = {}): Editor {
		const root = textarea.ownerDocument.createElement("div");
		textarea.insertAdjacentElement("afterend", root);
		const display = textarea.style.display;
		textarea.style.display = "none";
		const editor = new Editor(
			root,
			{ ...options, value: options.value ?? textarea.value },
			(text) => {
				textarea.value = text;
			},
			() => {
				root.remove();
				textarea.style.display = display;
			},
		);
		textarea.value = editor.getValue();
		return editor;
	}

	/** The text of the document. */
	getValue(): string {
		return this.view.state.doc.toString();
	}

	/**
	 * Replaces the whole text. It is an edit like any other: it can be undone and it calls
	 * `onChange`.
	 *
	 * @param text the new text.
	 */
	setValue(text: string): void {
		if (text !== this.getValue()) {
			this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text } });
		}
	}

	/**
	 * Replaces the grammars the document validates against, and validates it again.
	 *
	 * @param grammars texts of `@stxt.schema` or `@stxt.template` documents.
	 */
	setGrammars(grammars: string[]): void {
		this.loadGrammars(grammars);
		this.paint();
	}

	/**
	 * Turns validation against the grammars on or off. Syntax errors are always reported.
	 *
	 * @param enabled whether to validate.
	 */
	setValidation(enabled: boolean): void {
		this.analyzer.setValidation(enabled);
		this.paint();
	}

	/**
	 * Changes what the Tab key inserts and re-indents the document to match, with the formatter
	 * of the core. The re-indentation is one edit: it can be undone.
	 *
	 * @param mode `"tabs"` or `"spaces"`.
	 */
	setIndent(mode: IndentMode): void {
		if (mode === this.indent) {
			return;
		}
		this.indent = mode;
		this.editor.setIndentMode(mode);
		const changes = this.analyzer.getIndentChanges(DOCUMENT_ID, INDENT_UNITS[mode]);
		if (changes.length > 0) {
			this.view.dispatch({ changes: toCmChanges(this.view.state.doc, changes), userEvent: "reindent" });
		}
	}

	/**
	 * Makes the editor read-only, or editable again.
	 *
	 * @param readOnly whether the text can only be read.
	 */
	setReadOnly(readOnly: boolean): void {
		this.view.dispatch({ effects: this.readOnly.reconfigure(Editor.readOnlyExtension(readOnly)) });
	}

	/** The problems of the document, ordered by line (0-based lines). */
	getDiagnostics(): Diagnostic[] {
		return this.analyzer.getAnalysis(DOCUMENT_ID)?.diagnostics ?? [];
	}

	/**
	 * The problems of each grammar, in the order they were given: a grammar that does not parse
	 * or does not transform cannot validate anything, and this says why.
	 */
	getGrammarDiagnostics(): Diagnostic[][] {
		const result: Diagnostic[][] = [];
		for (let index = 0; index < this.grammarCount; index++) {
			result.push(this.analyzer.getAnalysis(grammarId(index))?.diagnostics ?? []);
		}
		return result;
	}

	/** Gives the focus to the editor. */
	focus(): void {
		this.view.focus();
	}

	/** Removes the editor from the page; a textarea it replaced is shown again. */
	destroy(): void {
		this.view.destroy();
		this.root.classList.remove(ROOT_CLASS);
		this.onDestroy();
	}

	/** Puts the grammars in the analyzer, replacing the previous ones. */
	private loadGrammars(grammars: string[]): void {
		for (let index = grammars.length; index < this.grammarCount; index++) {
			this.analyzer.removeDocument(grammarId(index));
		}
		grammars.forEach((text, index) => this.analyzer.setDocument(grammarId(index), text));
		this.grammarCount = grammars.length;
	}

	/** Analyzes the text, repaints, and tells whoever listens. */
	private analyze(text: string): void {
		this.analyzer.setDocument(DOCUMENT_ID, text);
		this.paint();
		this.onText(text);
		this.onChange?.(text, this.getDiagnostics());
	}

	/** Pushes the analysis into the view: highlighting and underlines, in one transaction. */
	private paint(): void {
		const analysis = this.analyzer.getAnalysis(DOCUMENT_ID);
		if (!analysis) {
			return;
		}
		// It changes no text, so it does not re-trigger the analysis
		this.view.dispatch(setDiagnostics(this.view.state, toCmDiagnostics(this.view.state.doc, analysis.diagnostics)), {
			effects: setTokensEffect.of(analysis.tokens),
		});
	}

	/**
	 * "Go to definition". Within the document itself, when it defines its own grammar, the cursor
	 * goes to the line. The given grammars are not on the page, so there is nowhere to go for
	 * them: the page is told through `onGoToDefinition`, if it listens.
	 */
	private goToDefinition(line: number, character: number): boolean {
		const location = this.analyzer.findDefinition(DOCUMENT_ID, line, character);
		if (!location) {
			return false;
		}
		if (location.documentId === DOCUMENT_ID) {
			this.view.dispatch({ selection: { anchor: lineAt(this.view.state.doc, location.line).from }, scrollIntoView: true });
			return true;
		}
		const grammar = grammarIndex(location.documentId);
		if (grammar === undefined || !this.onGoToDefinition) {
			return false;
		}
		this.onGoToDefinition({ grammar, line: location.line, namespace: location.namespace });
		return true;
	}

	/** The extensions of the read-only mode. */
	private static readOnlyExtension(readOnly: boolean): Extension {
		return readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];
	}
}

/**
 * Creates an editor inside an element. See {@link Editor.mount}.
 *
 * @param parent the element the editor is appended to.
 * @param options the options of the editor.
 */
export function mount(parent: HTMLElement, options?: EditorOptions): Editor {
	return Editor.mount(parent, options);
}

/**
 * Replaces a textarea with an editor, keeping its value in sync. See {@link Editor.fromTextArea}.
 *
 * @param textarea the textarea.
 * @param options the options of the editor.
 */
export function fromTextArea(textarea: HTMLTextAreaElement, options?: EditorOptions): Editor {
	return Editor.fromTextArea(textarea, options);
}
