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

// The engine of the journeys: Chromium by default; BROWSER=webkit (the engine of
// Safari) or BROWSER=firefox runs the same journeys there (S-17, the Browsers
// workflow). The journeys import it as `chromium`, the name they were written
// with. Chromium's own launch switches are left out elsewhere, and Firefox,
// which has no mobile emulation, gets its pages without isMobile.
export const ENGINE = process.env.BROWSER || "chromium";
const engine = playwright[ENGINE];
if (!engine || !["chromium", "webkit", "firefox"].includes(ENGINE)) {
  throw new Error(`BROWSER=${ENGINE}: use chromium, webkit or firefox`);
}
if (ENGINE !== "chromium") {
  const launch = engine.launch.bind(engine);
  engine.launch = async ({ args, executablePath, ...options } = {}) => {
    // Chromium's switch that lets sound play without a click, said Firefox's way
    if (ENGINE === "firefox" && (args || []).includes("--autoplay-policy=no-user-gesture-required")) {
      options.firefoxUserPrefs = { ...options.firefoxUserPrefs, "media.autoplay.default": 0, "media.autoplay.blocking_policy": 0 };
    }
    const browser = await launch(options);
    if (ENGINE === "firefox") {
      // Firefox reports the fonts a navigation interrupts as console errors
      // (status 2152398850, NS_BINDING_ABORTED); the journeys never hear of them
      const quiet = page => {
        const on = page.on.bind(page);
        page.on = (event, handler) => on(event, event === "console"
          ? message => { if (!/status=2152398850/.test(message.text())) handler(message); }
          : handler);
        return page;
      };
      const newContext = browser.newContext.bind(browser);
      const newPage = browser.newPage.bind(browser);
      browser.newContext = async ({ isMobile, ...rest } = {}) => {
        const context = await newContext(rest);
        const contextPage = context.newPage.bind(context);
        context.newPage = async () => quiet(await contextPage());
        return context;
      };
      browser.newPage = async ({ isMobile, ...rest } = {}) => quiet(await newPage(rest));
    }
    return browser;
  };
}
export const chromium = engine;
export default playwright;
