import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";
import { Compartment, EditorState, Extension, StateEffect } from "@codemirror/state";
import {
	Command,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
} from "@codemirror/view";
import { SPACES_UNIT, TAB_UNIT } from "../analysis";
import { CompletionProvider, stxtCompletion } from "./completion";
import { DefinitionNavigator, stxtGoToDefinition } from "./definition";
import { highlightField } from "./highlight";
import { developerInfo, NodeInfoProvider, stxtHover } from "./hover";

/** What the Tab key inserts: a tab, or four spaces. STXT allows either, per level. */
export type IndentMode = "tabs" | "spaces";

/** What it takes to create the STXT editor. */
export interface StxtEditorConfig {
	/** Element the editor is mounted into. */
	parent: HTMLElement;
	/** Indentation mode to start with. */
	indent: IndentMode;
	/** Whether to start with the line numbers shown. Defaults to true. */
	lineNumbers?: boolean;
	/** Whether the hover starts with the technical card. Defaults to true. */
	developerInfo?: boolean;
	/** Called after every transaction that changes the document, to re-run the analysis. */
	onDocChanged: (view: EditorView) => void;
	/** Completions for a position of the document in the view (grammar-driven, from the analysis). */
	completions: CompletionProvider;
	/** Description of the node at a line of the document in the view, for the hover. */
	describeNode: NodeInfoProvider;
	/** Goes to the definition of the node at a position of the document in the view. */
	goToDefinition: DefinitionNavigator;
	/** More extensions for every state, after the STXT ones (read-only mode, a theme…). */
	extensions?: Extension;
}

/** The STXT editor: one view, and a factory for the state of every document it shows. */
export interface StxtEditor {
	/** The CodeMirror view. */
	view: EditorView;
	/**
	 * Creates the editor state of a document, with the STXT configuration. An app that shows
	 * several documents in one view keeps one state per document, so switching documents
	 * preserves undo history, selection and highlighting of each. Show it with {@link showState}, which applies the indent mode.
	 *
	 * @param doc initial text of the document.
	 */
	createState(doc: string): EditorState;
	/**
	 * Puts a state in the view, bringing it up to date with the current indentation mode, line
	 * numbers and hover (a parked state may predate a change of any of them).
	 *
	 * @param state a state created by {@link createState}.
	 */
	showState(state: EditorState): void;
	/**
	 * Changes what the Tab key inserts and what the indent commands use, in the view and in every
	 * state created or shown from now on. Re-indenting the existing text is the app's job (it
	 * knows the analysis); this only sets the unit.
	 *
	 * @param mode tabs or spaces.
	 */
	setIndentMode(mode: IndentMode): void;
	/**
	 * Shows or hides the line numbers, in the view and in every state shown from now on. The
	 * marks of the lines with diagnostics stay either way.
	 *
	 * @param show whether to show them.
	 */
	setLineNumbers(show: boolean): void;
	/**
	 * Chooses what the hover shows, in the view and in every state shown from now on: the
	 * technical card, or only what the grammar says about the node.
	 *
	 * @param show whether to show the technical card.
	 */
	setDeveloperInfo(show: boolean): void;
}

/**
 * The indentation string of each mode, shared with the analysis reindenter so the Tab key and
 * the Formatter can never disagree. STXT: one tab, or exactly four spaces, per level.
 */
export const INDENT_UNITS: Record<IndentMode, string> = { tabs: TAB_UNIT, spaces: SPACES_UNIT };

/** Slot of the state configuration that holds the indent unit, so it can be swapped. */
const indentCompartment = new Compartment();

/** Slot of the line numbers: {@link LINE_NUMBERS}, or nothing. */
const lineNumbersCompartment = new Compartment();

/** Slot of the form of the hover. */
const developerInfoCompartment = new Compartment();

/** The line numbers. One value for every state, so a state can be asked whether it has them. */
const LINE_NUMBERS = lineNumbers();

/** What goes in the slot of the line numbers when they are hidden. */
const NO_LINE_NUMBERS: Extension = [];

const lineNumbersExtension = (show: boolean): Extension => (show ? LINE_NUMBERS : NO_LINE_NUMBERS);

/**
 * Tab inserts one indent unit at every cursor, a real tab or four spaces, per the indent mode,
 * or indents the selected lines when there is a selection. Shift-Tab is `indentLess`, which is
 * unit-aware on its own.
 */
const insertIndentUnit: Command = (view) => {
	const { state } = view;
	if (state.selection.ranges.some((range) => !range.empty)) {
		return indentMore(view);
	}
	view.dispatch(state.update(state.replaceSelection(state.facet(indentUnit)), {
		scrollIntoView: true,
		userEvent: "input",
	}));
	return true;
};

/**
 * The extensions that make a CodeMirror state an STXT editor:
 *
 * - Indentation is structure. Tab inserts one indent unit (or indents the selection), Shift-Tab
 *   dedents; the unit is a tab by default and four spaces in spaces mode.
 * - Highlighting comes from {@link highlightField}, fed by the analysis, never from a grammar.
 * - The lint gutter marks the lines with diagnostics; the app pushes them with `setDiagnostics`.
 *   It stays when the line numbers are hidden.
 * - Autocompletion, hover and "go to definition" ask the analysis through the providers of the
 *   config.
 *
 * @param config the editor configuration (the parent element is not used here).
 */
export function createStxtExtensions(config: Omit<StxtEditorConfig, "parent">): Extension {
	const { onDocChanged, indent } = config;
	return [
		lineNumbersCompartment.of(lineNumbersExtension(config.lineNumbers ?? true)),
		highlightActiveLineGutter(),
		highlightActiveLine(),
		history(),
		indentCompartment.of(indentUnit.of(INDENT_UNITS[indent])),
		EditorState.tabSize.of(4),
		keymap.of([
			{ key: "Tab", run: insertIndentUnit, shift: indentLess },
			...defaultKeymap,
			...historyKeymap,
		]),
		lintGutter(),
		highlightField,
		stxtCompletion(config.completions),
		developerInfoCompartment.of(developerInfo.of(config.developerInfo ?? true)),
		stxtHover(config.describeNode),
		stxtGoToDefinition(config.goToDefinition),
		EditorView.updateListener.of((update) => {
			if (update.docChanged) {
				onDocChanged(update.view);
			}
		}),
		config.extensions ?? [],
	];
}

/**
 * Creates the CodeMirror view, empty, plus the state factory an app uses to give every document
 * it shows its own state.
 */
export function createStxtEditor(config: StxtEditorConfig): StxtEditor {
	let indent = config.indent;
	let showLineNumbers = config.lineNumbers ?? true;
	let showDeveloperInfo = config.developerInfo ?? true;
	const extensions = createStxtExtensions(config);
	const view = new EditorView({ parent: config.parent, state: EditorState.create({ doc: "", extensions }) });

	/** Brings the state in the view up to date with the settings, in one transaction. */
	const applySettings = (): void => {
		const { state } = view;
		const effects: StateEffect<unknown>[] = [];
		if (state.facet(indentUnit) !== INDENT_UNITS[indent]) {
			effects.push(indentCompartment.reconfigure(indentUnit.of(INDENT_UNITS[indent])));
		}
		if (lineNumbersCompartment.get(state) !== lineNumbersExtension(showLineNumbers)) {
			effects.push(lineNumbersCompartment.reconfigure(lineNumbersExtension(showLineNumbers)));
		}
		if (state.facet(developerInfo) !== showDeveloperInfo) {
			effects.push(developerInfoCompartment.reconfigure(developerInfo.of(showDeveloperInfo)));
		}
		if (effects.length > 0) {
			view.dispatch({ effects });
		}
	};

	return {
		view,
		// States are born with the initial settings; showState brings them to the current ones
		createState: (doc) => EditorState.create({ doc, extensions }),
		showState: (state) => {
			view.setState(state);
			applySettings();
		},
		setIndentMode: (mode) => {
			indent = mode;
			applySettings();
		},
		setLineNumbers: (show) => {
			showLineNumbers = show;
			applySettings();
		},
		setDeveloperInfo: (show) => {
			showDeveloperInfo = show;
			applySettings();
		},
	};
}
