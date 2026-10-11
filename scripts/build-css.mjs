// The two stylesheets of dist/. stxt-editor.css is the light theme, as written. stxt-editor-dark.css
// is the same file with the dark palette after it, so a page loads one stylesheet or the other.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const base = readFileSync("css/stxt-editor.css", "utf8");
const dark = readFileSync("css/dark.css", "utf8");

mkdirSync("dist", { recursive: true });
writeFileSync("dist/stxt-editor.css", base);
writeFileSync("dist/stxt-editor-dark.css", `${base}\n${dark}`);
