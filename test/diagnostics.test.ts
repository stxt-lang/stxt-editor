import * as assert from "assert";
import { Text } from "@codemirror/state";
import { lineAt, toCmChanges, toCmDiagnostics } from "../src/editor/diagnostics";

describe("toCmDiagnostics", () => {
	it("maps each diagnostic to the whole range of its line, code first", () => {
		const doc = Text.of(["first", "second"]);
		const mapped = toCmDiagnostics(doc, [
			{ line: 1, code: "SCHEMA_NOT_FOUND", message: "No schema", severity: "warning", source: "validation" },
			{ line: 0, code: "INVALID_LINE", message: "Bad", severity: "error", source: "syntax" },
		]);
		assert.deepStrictEqual(mapped, [
			{ from: 6, to: 12, severity: "warning", message: "[SCHEMA_NOT_FOUND] No schema", source: "validation" },
			{ from: 0, to: 5, severity: "error", message: "[INVALID_LINE] Bad", source: "syntax" },
		]);
	});

	it("lands a diagnostic past the end on the last line", () => {
		const doc = Text.of(["only"]);
		const [mapped] = toCmDiagnostics(doc, [{ line: 7, code: "X", message: "m", severity: "error", source: "syntax" }]);
		assert.strictEqual(mapped.from, 0);
		assert.strictEqual(mapped.to, 4);
	});
});

describe("lineAt", () => {
	it("maps a 0-based analysis line to the document line, clamping past the end to the last line", () => {
		const doc = Text.of(["first", "second"]);
		assert.strictEqual(lineAt(doc, 0).number, 1);
		assert.strictEqual(lineAt(doc, 1).number, 2);
		assert.strictEqual(lineAt(doc, 9).number, 2);
	});
});

describe("toCmChanges", () => {
	it("maps each change to the offsets of its line in the document", () => {
		const doc = Text.of(["Doc:", "    Name: value", "    Other: x"]);
		const mapped = toCmChanges(doc, [
			{ line: 1, from: 0, to: 4, insert: "\t" },
			{ line: 2, from: 0, to: 4, insert: "\t" },
		]);
		assert.deepStrictEqual(mapped, [
			{ from: 5, to: 9, insert: "\t" },
			{ from: 21, to: 25, insert: "\t" },
		]);
	});
});
