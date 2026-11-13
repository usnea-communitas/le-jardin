(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureGardenFile = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // A garden saved to a file and loaded back ("Garden file" in the header and the
  // menu). The file is the save the browser keeps, wrapped with what it is and
  // which game made it. Loading checks the file before anything changes; the
  // game's own start-up then cleans the garden exactly as it cleans a stored one.
  // In workshop mode the same file holds the group's garden, never anyone's own
  // game. Nothing here touches the network.
  const APP = "le-jardin";
  const FORMAT = 1;
  const MAX_BYTES = 2 * 1024 * 1024;
  const MAX_PLACED = 500;

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  // The file for a stored save (the string the browser keeps), or null when
  // there is no garden in it.
  function pack(stored, options) {
    const o = options || {};
    let garden = null;
    try { garden = typeof stored === "string" ? JSON.parse(stored) : stored; } catch (_) { garden = null; }
    if (!isObject(garden) || !Array.isArray(garden.placed)) return null;
    const saved = new Date(o.now == null ? Date.now() : o.now).toISOString();
    return JSON.stringify({ app: APP, format: FORMAT, game: String(o.version || ""), saved, workshop: !!o.workshop, garden }, null, 2) + "\n";
  }

  // What a chosen file holds: { ok: true, garden } with the save to store, or
  // { ok: false, error } where error is "format" (not a saved garden),
  // "app" (made by something else), "newer" (by a newer version of the game)
  // or "garden" (the garden inside is damaged).
  function unpack(text) {
    if (typeof text !== "string" || !text.trim() || text.length > MAX_BYTES) return { ok: false, error: "format" };
    let file;
    try { file = JSON.parse(text); } catch (_) { return { ok: false, error: "format" }; }
    if (!isObject(file) || file.app !== APP) return { ok: false, error: "app" };
    if (!Number.isInteger(file.format) || file.format < 1) return { ok: false, error: "format" };
    if (file.format > FORMAT) return { ok: false, error: "newer" };
    const garden = file.garden;
    if (!isObject(garden) || !Array.isArray(garden.placed) || garden.placed.length > MAX_PLACED) return { ok: false, error: "garden" };
    return {
      ok: true,
      garden: JSON.stringify(garden),
      workshop: !!file.workshop,
      saved: typeof file.saved === "string" ? file.saved : null,
      game: typeof file.game === "string" ? file.game : ""
    };
  }

  function fileName(date, workshop) {
    const d = date instanceof Date && !isNaN(date) ? date : new Date();
    const day = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    return (workshop ? "le-jardin-workshop-garden-" : "le-jardin-garden-") + day + ".json";
  }

  // Asking the browser to keep the garden for good shows a prompt only in Firefox;
  // Safari and Chromium browsers decide by themselves how the site is used.
  // Firefox on iOS is WebKit and says FxiOS, not Firefox/.
  function persistPrompts(userAgent) {
    return /\bFirefox\//.test(String(userAgent || ""));
  }

  return { APP, FORMAT, MAX_BYTES, MAX_PLACED, pack, unpack, fileName, persistPrompts };
});
