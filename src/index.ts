/**
 * `@stxt-lang/editor`: the STXT editor for any web page.
 *
 * The simple way in is {@link fromTextArea} or {@link mount}, which give an {@link Editor}. The
 * pieces underneath are exported too, for an app that needs more than one document per view, or
 * another layout: the {@link Analyzer} (no DOM, no CodeMirror) and the CodeMirror extensions.
 */

export { Editor, EditorOptions, fromTextArea, mount } from "./Editor";

// The CodeMirror layer
export { createStxtEditor, createStxtExtensions, IndentMode, INDENT_UNITS, StxtEditor, StxtEditorConfig } from "./editor/stxtEditor";
export { setTokensEffect, highlightField } from "./editor/highlight";
export { CompletionProvider } from "./editor/completion";
export { NodeInfoProvider } from "./editor/hover";
export { DefinitionNavigator } from "./editor/definition";
export { lineAt, toCmChanges, toCmDiagnostics } from "./editor/diagnostics";

// The analysis layer
export * from "./analysis";
