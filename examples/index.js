// The script of index.html and index-dark.html

const template = document.getElementById("template").textContent.replace(/^\n/, "");
const problems = document.getElementById("problems");

function showProblems(diagnostics) {
	problems.replaceChildren();
	if (diagnostics.length === 0) {
		const item = document.createElement("li");
		item.className = "none";
		item.textContent = "No problems.";
		problems.appendChild(item);
	}
	for (const diagnostic of diagnostics) {
		const item = document.createElement("li");
		item.className = diagnostic.severity;
		item.textContent = `Line ${diagnostic.line + 1} · ${diagnostic.code} · ${diagnostic.message}`;
		problems.appendChild(item);
	}
}

// The whole integration: the textarea and the grammars
const editor = StxtEditor.fromTextArea(document.getElementById("document"), {
	grammars: [template],
	onChange: (text, diagnostics) => showProblems(diagnostics),
});

// The rest of the page: the switches, and what the form submits
document.getElementById("template-text").textContent = template;

const press = (id, pressed) => document.getElementById(id).setAttribute("aria-pressed", String(pressed));
const pressed = (id) => document.getElementById(id).getAttribute("aria-pressed") === "true";

for (const mode of ["tabs", "spaces"]) {
	document.getElementById(mode).addEventListener("click", () => {
		editor.setIndent(mode);
		press("tabs", mode === "tabs");
		press("spaces", mode === "spaces");
	});
}
document.getElementById("validation").addEventListener("click", () => {
	const enabled = !pressed("validation");
	editor.setValidation(enabled);
	press("validation", enabled);
	showProblems(editor.getDiagnostics());
});
document.getElementById("read-only").addEventListener("click", () => {
	const readOnly = !pressed("read-only");
	editor.setReadOnly(readOnly);
	press("read-only", readOnly);
});
document.getElementById("form").addEventListener("submit", (event) => {
	event.preventDefault();
	const text = new FormData(event.target).get("document");
	document.getElementById("submitted").textContent = `The form sent ${text.split("\n").length} lines.`;
});
