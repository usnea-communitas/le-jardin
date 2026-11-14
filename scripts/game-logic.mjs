// The game's logic class as the build ships it (scripts/build.mjs): game.logic.js
// defines window.__permagardenLogic(DCLogic, StreamableLogic, React), which returns
// the class written in the canonical source's <script type="text/x-dc" data-dc-script>,
// and game.fragment.html keeps a one-line stub there that the runtime compiles
// instead (docs/START-PERFORMANCE.md). Tests evaluate the shipped file.
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

export const LOGIC_FILE = "game.logic.js";
export const LOGIC_GLOBAL = "__permagardenLogic";
export const LOGIC_STUB = `var Component = window.${LOGIC_GLOBAL}(DCLogic, StreamableLogic, React);`;

// Runs game.logic.js in a vm context whose window is the context itself, and
// returns the game's class, made with the context's DCLogic and React.
export async function loadGameClass(root, sandbox) {
  const text = await readFile(path.join(root, LOGIC_FILE), "utf8");
  vm.runInContext(text, sandbox, { filename: LOGIC_FILE });
  const make = sandbox[LOGIC_GLOBAL];
  if (typeof make !== "function") throw new Error(`${LOGIC_FILE} did not define window.${LOGIC_GLOBAL}.`);
  const Game = make(sandbox.DCLogic, sandbox.DCLogic, sandbox.React);
  if (typeof Game !== "function") throw new Error(`${LOGIC_FILE} did not return the game's class.`);
  return Game;
}
