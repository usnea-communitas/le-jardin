// Loads Playwright for the browser journeys (scripts/e2e-*.mjs).
//
// Playwright is a devDependency, so `npm ci` installs it with the project
// (browsers: `npx playwright install chromium`). To use a copy installed
// elsewhere, point CODEX_NODE_MODULES at that node_modules folder; both the
// plain npm layout (playwright/) and a pnpm store (.pnpm/playwright@…) work.
import path from "node:path";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

async function fromModuleRoot(moduleRoot) {
  const direct = path.join(moduleRoot, "playwright", "index.mjs");
  if (existsSync(direct)) return import(pathToFileURL(direct).href);
  const pnpmRoot = path.join(moduleRoot, ".pnpm");
  const packageDir = existsSync(pnpmRoot)
    ? (await readdir(pnpmRoot)).find(name => /^playwright@[^-]/.test(name))
    : undefined;
  if (packageDir) {
    return import(pathToFileURL(path.join(pnpmRoot, packageDir, "node_modules", "playwright", "index.mjs")).href);
  }
  return null;
}

async function loadPlaywright() {
  const moduleRoot = process.env.CODEX_NODE_MODULES;
  const external = moduleRoot ? await fromModuleRoot(moduleRoot) : null;
  if (external) return external;
  try {
    return await import("playwright");
  } catch (error) {
    const where = moduleRoot ? ` It was not found in CODEX_NODE_MODULES (${moduleRoot}) either.` : "";
    throw new Error(
      `Playwright is not installed. Run \`npm ci\` and \`npx playwright install chromium\`.${where}`,
      { cause: error }
    );
  }
}

const playwright = await loadPlaywright();
export const { chromium } = playwright;
export default playwright;
