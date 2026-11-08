(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const SUPPORTED_LOCALES = ["en", "cs", "de", "fr", "es", "pt-BR", "pl", "ru", "zh-CN"];
  const STORAGE_KEY = "permagarden_locale_v1";
  const CATALOG_ROOT = "assets/i18n/";
  const ATTRIBUTE_NAMES = ["aria-label", "title", "placeholder", "alt"];
  const PLURAL_KEYS = new Set(["zero", "one", "two", "few", "many", "other"]);
  const NUMERIC_PLACEHOLDERS = new Set([
    "count", "total", "current", "done", "number", "value", "amount", "cost", "price",
    "delta", "target", "baseline", "gap", "score", "given", "next", "wildlife", "guilds", "guildTotal"
  ]);
  const LANGUAGE_OPTIONS = [
    { code: "en", label: "English" },
    { code: "cs", label: "Čeština" },
    { code: "de", label: "Deutsch" },
    { code: "fr", label: "Français" },
    { code: "es", label: "Español" },
    { code: "pt-BR", label: "Português (Brasil)" },
    { code: "pl", label: "Polski" },
    { code: "ru", label: "Русский" },
    { code: "zh-CN", label: "简体中文" }
  ];
  const LANGUAGE_NAMES = {
    en: "English",
    cs: "čeština",
    de: "Deutsch",
    fr: "français",
    es: "español",
    "pt-BR": "português do Brasil",
    pl: "polski",
    ru: "русский",
    "zh-CN": "简体中文"
  };
  const BUILTIN = {
    messages: {
      "boot.preparing": "Preparing Le Jardin…",
      "boot.error.title": "Le Jardin needs another moment",
      "boot.error.detail": "The game could not finish loading. Check your connection, then try again.",
      "boot.error.retry": "Try again",
      "language.label": "Language",
      "language.aria": "Game language",
      "audio.englishStatus": "Audio: English",
      "language.changeAnnouncement": "Language changed. Reloading the garden."
    },
    templates: {}
  };

  let currentLocale = "en";
  let englishCatalog = BUILTIN;
  let currentCatalog = BUILTIN;
  let readyPromise = null;
  let observer = null;
  let reactInstalled = false;
  let translatingDom = false;
  const exactReverse = new Map();
  // the same English texts by their lower-case form, for values the game builds
  // with a lower-cased name ("Camille will add cherries to…")
  const lowerReverse = new Map();
  const templateReverse = [];
  const structuralReverse = [];
  let quietLookups = 0;
  const localizedExact = new Set();
  const localizedTemplates = [];
  const collisionKeys = new Map();
  const missingValues = new Map();
  // what this runtime has produced is already in the player's language; the DOM
  // observer meets it again once it is on the page
  const producedText = new Set();
  const localizedLower = new Set();
  const localizedStructural = [];

  function produced(text) {
    if (currentLocale !== "en" && typeof text === "string" && text.trim()) {
      if (producedText.size > 5000) producedText.clear();
      producedText.add(text.trim());
    }
    return text;
  }

  function normalizeLocale(value) {
    const raw = String(value || "").trim().replace(/_/g, "-");
    if (!raw) return null;
    const exact = SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === raw.toLowerCase());
    if (exact) return exact;
    const lower = raw.toLowerCase();
    const base = lower.split("-")[0];
    if (base === "pt") return "pt-BR";
    if (base === "zh") return "zh-CN";
    return SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === base) || null;
  }

  function localeFromQuery() {
    if (!root.location || typeof URLSearchParams === "undefined") return null;
    try { return normalizeLocale(new URLSearchParams(root.location.search).get("lang")); }
    catch (_) { return null; }
  }

  function localeFromStorage() {
    if (!root.localStorage) return null;
    try { return normalizeLocale(root.localStorage.getItem(STORAGE_KEY)); }
    catch (_) { return null; }
  }

  function localeFromBrowser() {
    const values = root.navigator && Array.isArray(root.navigator.languages)
      ? root.navigator.languages
      : [root.navigator && root.navigator.language];
    for (const value of values) {
      const locale = normalizeLocale(value);
      if (locale) return locale;
    }
    return null;
  }

  function requestedLocale() {
    return localeFromQuery() || localeFromStorage() || localeFromBrowser() || "en";
  }

  function setDocumentLocale(locale) {
    if (!root.document || !root.document.documentElement) return;
    const html = root.document.documentElement;
    html.lang = locale;
    html.dir = "ltr";
    html.dataset.pgLocale = locale;
  }

  function flatten(input, prefix, output) {
    const out = output || {};
    if (!input || typeof input !== "object" || Array.isArray(input)) return out;
    Object.keys(input).forEach(key => {
      const value = input[key];
      const path = prefix ? prefix + "." + key : key;
      if (typeof value === "string" || isMessageLeaf(value)) out[path] = value;
      else if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, path, out);
    });
    return out;
  }

  function isMessageLeaf(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.some(key => PLURAL_KEYS.has(key) || /^=\d+$/.test(key) || ["value", "text", "template", "source", "translation"].includes(key));
  }

  function normalizeSection(section) {
    if (!section || typeof section !== "object") return {};
    const out = {};
    Object.keys(section).forEach(key => {
      const value = section[key];
      if (typeof value === "string" || isMessageLeaf(value)) out[key] = value;
      else if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, key, out);
    });
    return out;
  }

  function normalizeCatalog(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const messages = normalizeSection(source.messages || source.strings || {});
    const templates = normalizeSection(source.templates || {});
    if (!Object.keys(messages).length && !Object.keys(templates).length) {
      const copy = Object.assign({}, source);
      delete copy.locale;
      delete copy.meta;
      Object.assign(messages, normalizeSection(copy));
    }
    return {
      locale: normalizeLocale(source.locale) || null,
      messages,
      templates
    };
  }

  function catalogUrl(locale) {
    const file = "catalog." + locale + ".json";
    try { return new URL(CATALOG_ROOT + file, root.document ? root.document.baseURI : root.location.href).href; }
    catch (_) { return CATALOG_ROOT + file; }
  }

  async function fetchCatalog(locale, required) {
    if (typeof root.fetch !== "function") return required ? {
      locale: "en",
      messages: Object.assign({}, BUILTIN.messages),
      templates: {}
    } : { messages: {}, templates: {} };
    try {
      const response = await root.fetch(catalogUrl(locale), { cache: "no-cache", credentials: "same-origin" });
      if (!response.ok) throw new Error("locale_http_" + response.status);
      const catalog = normalizeCatalog(await response.json());
      if (required) catalog.messages = Object.assign({}, BUILTIN.messages, catalog.messages);
      return catalog;
    } catch (error) {
      if (required && root.console && console.warn) console.warn("English locale catalog could not be loaded; using the safe built-in copy.", error);
      else if (root.console && console.info) console.info("Locale pack unavailable; English remains available.", locale);
      return required ? BUILTIN : { locale, messages: {}, templates: {} };
    }
  }

  function messageForms(value) {
    if (typeof value === "string") return [value];
    if (!value || typeof value !== "object") return [];
    const preferred = ["source", "template", "value", "text", "translation", "=0", "zero", "one", "two", "few", "many", "other"];
    const forms = [];
    preferred.forEach(key => {
      if (typeof value[key] === "string" && !forms.includes(value[key])) forms.push(value[key]);
    });
    Object.keys(value).forEach(key => {
      if (typeof value[key] === "string" && !forms.includes(value[key])) forms.push(value[key]);
    });
    return forms;
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function compileTemplate(source, key) {
    const names = [];
    const token = /%\{([a-zA-Z0-9_]+)\}|\{([a-zA-Z0-9_]+)\}/g;
    let cursor = 0;
    let pattern = "^";
    let literal = "";
    let match;
    while ((match = token.exec(source))) {
      literal += source.slice(cursor, match.index);
      pattern += escapeRegex(source.slice(cursor, match.index)).replace(/\s+/g, "\\s+");
      const name = match[1] || match[2];
      // a count or a score is a number: "Chapter {current} of {total}" must not
      // take "Chapter 1: At the edge of Menet"
      pattern += NUMERIC_PLACEHOLDERS.has(name) ? "([+\\-−]?\\d[\\d\\s\\u00a0\\u202f.,]*?)" : "(.+?)";
      names.push(name);
      cursor = match.index + match[0].length;
    }
    if (!names.length) return null;
    literal += source.slice(cursor);
    pattern += escapeRegex(source.slice(cursor)).replace(/\s+/g, "\\s+") + "$";
    try {
      return {
        key,
        source,
        names,
        regex: new RegExp(pattern, "u"),
        // how much fixed text a value must contain to match: more is more specific
        specificity: literal.replace(/\s+/g, "").length,
        // "{title}" or "{label} {name}" have no fixed text at all. They are fine for
        // t(), but in reverse they would take almost any text, split it at random
        // and keep untranslated text out of the missing list.
        catchAll: !/\S/u.test(literal),
        // "{giveText}." or "{name}. {reason}" only have punctuation: a last resort
        // that counts only when every part with letters translates
        structural: !/[\p{L}\p{N}]/u.test(literal)
      };
    }
    catch (_) { return null; }
  }

  // specific templates first; among equals, the one with fewer placeholders
  function bySpecificity(a, b) {
    return b.specificity - a.specificity || a.names.length - b.names.length || b.source.length - a.source.length;
  }

  function registerExact(value, key) {
    if (!value || typeof value !== "string") return;
    const lower = value.toLocaleLowerCase("en");
    if (!lowerReverse.has(lower)) lowerReverse.set(lower, key);
    if (!exactReverse.has(value)) exactReverse.set(value, key);
    else if (exactReverse.get(value) !== key) {
      const list = collisionKeys.get(value) || [exactReverse.get(value)];
      if (!list.includes(key)) list.push(key);
      collisionKeys.set(value, list);
    }
  }

  function buildReverseIndex() {
    exactReverse.clear();
    lowerReverse.clear();
    templateReverse.length = 0;
    structuralReverse.length = 0;
    collisionKeys.clear();
    // a message with a placeholder ("{count} shares") is matched like a template
    ["messages", "templates"].forEach(section => {
      Object.keys(englishCatalog[section] || {}).forEach(key => {
        messageForms(englishCatalog[section][key]).forEach(source => {
          const compiled = compileTemplate(source, key);
          if (!compiled) registerExact(source, key);
          else if (compiled.structural) { if (!compiled.catchAll) structuralReverse.push(compiled); }
          else templateReverse.push(compiled);
        });
      });
    });
    templateReverse.sort(bySpecificity);
    structuralReverse.sort(bySpecificity);
  }

  function buildLocalizedIndex() {
    localizedExact.clear();
    localizedLower.clear();
    localizedTemplates.length = 0;
    localizedStructural.length = 0;
    ["messages", "templates"].forEach(section => {
      Object.keys(currentCatalog[section] || {}).forEach(key => {
        messageForms(currentCatalog[section][key]).forEach(value => {
          const compiled = compileTemplate(value, key);
          // a punctuation-only template ("{title}", "{name}. {reason}") would call any
          // text "already translated"; it only counts when each of its parts does
          if (compiled) (compiled.structural ? localizedStructural : localizedTemplates).push(compiled);
          else if (value) localizedExact.add(value);
        });
      });
    });
    // language names are written in their own language everywhere
    LANGUAGE_OPTIONS.forEach(option => localizedExact.add(option.label));
    localizedExact.forEach(value => localizedLower.add(value.toLocaleLowerCase(currentLocale)));
    localizedTemplates.sort(bySpecificity);
    localizedStructural.sort(bySpecificity);
  }

  // Is this text already in the player's language? A composed value counts when
  // each of its parts does ("Jaro — současný stav"); case does not matter.
  function isLocalized(text, depth) {
    const value = String(text).trim();
    if (!value || !/\p{L}/u.test(value)) return true;
    if (producedText.has(value) || localizedExact.has(value) || localizedLower.has(value.toLocaleLowerCase(currentLocale))) return true;
    if (localizedTemplates.some(entry => entry.regex.test(value))) return true;
    const level = depth || 0;
    if (level >= 2) return false;
    return localizedStructural.some(entry => {
      const match = entry.regex.exec(value);
      return !!match && match.slice(1).every(part => isLocalized(part, level + 1));
    });
  }

  function quietly(run) {
    quietLookups += 1;
    try { return run(); }
    finally { quietLookups -= 1; }
  }

  // Decoration around a known text ("🔥 Hot-bed idea", "Skill practised ·", "Compost.")
  // and punctuation-only templates ("{name}. {reason}") are used only when every part
  // with letters translates: half-translated text is worse than honest English.
  function translatePieces(value, level) {
    const peeled = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su.exec(value);
    if (peeled && (peeled[1] || peeled[3]) && /\p{L}/u.test(peeled[2])) {
      const inner = quietly(() => translateValue(peeled[2], level + 1));
      if (inner !== peeled[2]) return peeled[1] + inner + peeled[3];
    }
    for (const entry of structuralReverse) {
      const match = entry.regex.exec(value);
      if (!match) continue;
      const vars = {};
      let changed = false;
      const complete = quietly(() => entry.names.every((name, index) => {
        const part = match[index + 1];
        vars[name] = translateValue(part, level + 1);
        if (vars[name] !== part) { changed = true; return true; }
        // "Winter" is German too: known to the catalogue, just spelt the same
        if (exactReverse.has(part) && isLocalized(part)) { changed = true; return true; }
        return !/\p{L}/u.test(part);
      }));
      if (complete && changed) return t(entry.key, vars, value);
    }
    return null;
  }

  // A text found by its lower-case form keeps the case it was written in: a name
  // in the middle of a sentence stays lower case (German nouns keep their capital),
  // and a heading in capitals stays in capitals.
  function matchCase(original, translated) {
    if (!translated || translated === original) return translated;
    const capitals = (text, locale) => text === text.toLocaleUpperCase(locale) && text !== text.toLocaleLowerCase(locale);
    if (original.length > 1 && capitals(original, "en")) return translated.toLocaleUpperCase(currentLocale);
    // German writes nouns with a capital wherever they stand: keep the catalogue's spelling
    if (currentLocale === "de") return translated;
    // the catalogue writes it in capitals ("GROWN WITH CARE BY"), the game does not
    const text = translated.length > 1 && capitals(translated, currentLocale) ? translated.toLocaleLowerCase(currentLocale) : translated;
    const first = original.charAt(0);
    const head = text.charAt(0);
    if (first !== first.toLocaleUpperCase("en")) return head.toLocaleLowerCase(currentLocale) + text.slice(1);
    return head.toLocaleUpperCase(currentLocale) + text.slice(1);
  }

  function selectForm(value, vars, locale) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const count = Number(vars && vars.count);
    if (Number.isFinite(count) && typeof value["=" + count] === "string") return value["=" + count];
    if (Number.isFinite(count)) {
      let category = "other";
      try { category = new Intl.PluralRules(locale).select(count); } catch (_) {}
      if (typeof value[category] === "string") return value[category];
    }
    return value.translation || value.value || value.text || value.template || value.other || value.one || value.source || "";
  }

  function interpolate(template, vars) {
    const input = String(template || "");
    const values = vars || {};
    return input.replace(/%\{([a-zA-Z0-9_]+)\}|\{([a-zA-Z0-9_]+)\}/g, (full, a, b) => {
      const key = a || b;
      return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : full;
    });
  }

  function findValue(catalog, section, key) {
    const data = catalog && catalog[section];
    return data && Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined;
  }

  function t(key, vars, fallback) {
    const templateValue = findValue(currentCatalog, "messages", key);
    const currentTemplate = templateValue !== undefined ? templateValue : findValue(currentCatalog, "templates", key);
    const englishValue = findValue(englishCatalog, "messages", key) !== undefined
      ? findValue(englishCatalog, "messages", key)
      : findValue(englishCatalog, "templates", key);
    const chosen = currentTemplate !== undefined ? currentTemplate : (englishValue !== undefined ? englishValue : fallback);
    const selected = selectForm(chosen, vars, currentLocale) || fallback || key;
    const text = interpolate(selected, vars);
    // only a text from the catalogue counts as translated, never the English fallback
    return currentTemplate !== undefined ? produced(text) : text;
  }

  function noteMissing(text) {
    if (quietLookups) return;
    const candidate = String(text).trim();
    if (
      candidate.length >= 3 &&
      candidate.length <= 700 &&
      /[A-Za-zÀ-ž\u0400-\u04ff\u4e00-\u9fff]/u.test(candidate) &&
      !/^(?:https?:|assets\/|api\/|lib\/|vendor\/|[\w./-]+\.(?:mp3|mp4|webp|png|svg|js|json|html|woff2?))/.test(candidate) &&
      !isLocalized(candidate)
    ) {
      const previous = missingValues.get(candidate) || 0;
      missingValues.set(candidate, previous + 1);
    }
  }

  function translateValue(value, depth) {
    if (typeof value !== "string" || currentLocale === "en" || !value) return value;
    // The declarative component compiler owns {{ ... }} expressions. Translating
    // a source template before that compiler runs can reorder or split the braces
    // and turn a valid binding into an unresolved expression. Runtime values are
    // translated after the compiler has resolved them instead.
    if (value.includes("{{") || value.includes("}}")) return value;
    const level = Number(depth) || 0;
    if (level > 2) return value;
    const exactKey = exactReverse.get(value);
    if (exactKey) return t(exactKey, null, value);
    const compact = value.trim();
    if (compact !== value && compact) {
      const translated = translateValue(compact, level + 1);
      if (translated !== compact) return value.slice(0, value.indexOf(compact)) + translated + value.slice(value.indexOf(compact) + compact.length);
    }
    const lowerKey = lowerReverse.get(value.toLocaleLowerCase("en"));
    if (lowerKey) {
      const translated = t(lowerKey, null, value);
      if (translated !== value) return produced(matchCase(value, translated));
    }
    for (const entry of templateReverse) {
      const match = entry.regex.exec(value);
      if (!match) continue;
      const parts = match.slice(1);
      const vars = {};
      quietly(() => entry.names.forEach((name, index) => { vars[name] = translateValue(parts[index], level + 1); }));
      // A whole untranslated sentence in a short slot ("Choose {name}" around
      // "Choose an element, then place it…") means the template caught text it was
      // not written for: try the next one rather than mixing two languages.
      const untranslated = parts.filter((part, index) => vars[entry.names[index]] === part && /\p{L}/u.test(part) && !isLocalized(part));
      if (untranslated.some(part => part.trim().split(/\s+/).length >= 5)) continue;
      untranslated.forEach(part => noteMissing(part));
      return t(entry.key, vars, value);
    }
    if (isLocalized(value)) return value;
    const pieces = translatePieces(value, level);
    if (pieces !== null) return pieces;
    // a list the game joins with " · " or " + " (learned practices, design pairs):
    // each item on its own
    const separator = level < 2 ? [" · ", " + "].find(mark => value.includes(mark)) : null;
    if (separator) return value.split(separator).map(part => translateValue(part, level + 1)).join(separator);
    noteMissing(value);
    return value;
  }

  function number(value, options) {
    try { return produced(new Intl.NumberFormat(currentLocale, options || {}).format(value)); }
    catch (_) { return String(value); }
  }

  function date(value, options) {
    try { return produced(new Intl.DateTimeFormat(currentLocale, options || {}).format(value instanceof Date ? value : new Date(value))); }
    catch (_) { return String(value); }
  }

  function list(values, options) {
    const clean = Array.isArray(values) ? values.map(String) : [];
    try { return produced(new Intl.ListFormat(currentLocale, options || { style: "long", type: "conjunction" }).format(clean)); }
    catch (_) { return clean.join(", "); }
  }

  function shouldSkipElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.closest && element.closest("[data-pg-no-i18n],script,style,textarea,code,pre,[contenteditable='true']")) return true;
    return false;
  }

  function translateElement(element) {
    if (!element || element.nodeType !== 1 || shouldSkipElement(element)) return;
    ATTRIBUTE_NAMES.forEach(name => {
      if (!element.hasAttribute(name)) return;
      const before = element.getAttribute(name);
      const after = translateValue(before);
      if (after !== before) element.setAttribute(name, after);
    });
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== 3 || !node.parentElement || shouldSkipElement(node.parentElement)) return;
    const before = node.nodeValue;
    const after = translateValue(before);
    if (after !== before) node.nodeValue = after;
  }

  function translateTree(rootNode) {
    if (!root.document || currentLocale === "en" || !rootNode || translatingDom) return;
    translatingDom = true;
    try {
      if (rootNode.nodeType === 3) translateTextNode(rootNode);
      else if (rootNode.nodeType === 1 || rootNode.nodeType === 9 || rootNode.nodeType === 11) {
        if (rootNode.nodeType === 1) translateElement(rootNode);
        const nodeFilter = root.NodeFilter;
        const whatToShow = nodeFilter ? (nodeFilter.SHOW_ELEMENT | nodeFilter.SHOW_TEXT) : 5;
        const walker = root.document.createTreeWalker(rootNode, whatToShow);
        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeType === 1) translateElement(node);
          else translateTextNode(node);
        }
      }
    } finally {
      translatingDom = false;
    }
  }

  function installObserver() {
    if (currentLocale === "en" || !root.document || observer || typeof root.MutationObserver !== "function") return;
    observer = new root.MutationObserver(records => {
      if (translatingDom) return;
      records.forEach(record => {
        if (record.type === "attributes") translateElement(record.target);
        record.addedNodes && record.addedNodes.forEach(translateTree);
      });
    });
    observer.observe(root.document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ATTRIBUTE_NAMES
    });
  }

  function translateReactChild(child, skip) {
    if (skip) return child;
    if (typeof child === "string") return translateValue(child);
    if (Array.isArray(child)) return child.map(item => translateReactChild(item, false));
    return child;
  }

  function installReact(react) {
    if (currentLocale === "en" || !react || typeof react.createElement !== "function" || reactInstalled) return false;
    const original = react.createElement;
    const wrapped = function (type, props) {
      const args = Array.prototype.slice.call(arguments, 2);
      const tag = typeof type === "string" ? type.toLowerCase() : "";
      const skip = !!(props && props["data-pg-no-i18n"]) || ["script", "style", "textarea", "code", "pre"].includes(tag);
      let nextProps = props;
      if (props && !skip) {
        let changed = false;
        nextProps = Object.assign({}, props);
        ATTRIBUTE_NAMES.forEach(name => {
          if (typeof props[name] !== "string") return;
          const translated = translateValue(props[name]);
          if (translated !== props[name]) { nextProps[name] = translated; changed = true; }
        });
        if (!changed) nextProps = props;
      }
      // E('span', null, count, ' shares') reaches React as several text children.
      // Translate the text they make together first, so a catalogue template can
      // match it; only when that fails, child by child (the joined text is reported).
      let children = null;
      if (!skip && args.length > 1) {
        const parts = args.filter(child => child !== null && child !== undefined && typeof child !== "boolean");
        if (parts.length > 1 && parts.every(child => typeof child === "string" || typeof child === "number")) {
          const joined = parts.join("");
          const translated = translateValue(joined);
          if (translated !== joined) children = [translated];
          else children = quietly(() => args.map(child => translateReactChild(child, false)));
        }
      }
      if (!children) children = args.map(child => translateReactChild(child, skip));
      return original.apply(this, [type, nextProps].concat(children));
    };
    try {
      react.createElement = wrapped;
      reactInstalled = react.createElement === wrapped;
    } catch (_) {
      reactInstalled = false;
    }
    return reactInstalled;
  }

  async function bootstrap() {
    if (readyPromise) return readyPromise;
    currentLocale = requestedLocale();
    setDocumentLocale(currentLocale);
    readyPromise = (async () => {
      englishCatalog = await fetchCatalog("en", true);
      buildReverseIndex();
      currentCatalog = currentLocale === "en"
        ? englishCatalog
        : mergeCatalog(englishCatalog, await fetchCatalog(currentLocale, false));
      buildLocalizedIndex();
      setDocumentLocale(currentLocale);
      translateTree(root.document);
      installObserver();
      if (root.document) {
        const status = root.document.querySelector("#pg-boot span");
        if (status) status.textContent = t("boot.preparing", null, "Preparing Le Jardin…");
      }
      return api;
    })();
    return readyPromise;
  }

  function mergeCatalog(base, overlay) {
    return {
      locale: currentLocale,
      messages: Object.assign({}, base.messages || {}, overlay.messages || {}),
      templates: Object.assign({}, base.templates || {}, overlay.templates || {})
    };
  }

  function setLocaleAndReload(value) {
    const locale = normalizeLocale(value);
    if (!locale) return false;
    try { if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, locale); } catch (_) {}
    setDocumentLocale(locale);
    if (!root.location) return true;
    try {
      const url = new URL(root.location.href);
      if (url.searchParams.has("lang")) url.searchParams.set("lang", locale);
      root.location.replace(url.href);
    } catch (_) {
      root.location.reload();
    }
    return true;
  }

  const api = {
    SUPPORTED_LOCALES: SUPPORTED_LOCALES.slice(),
    STORAGE_KEY,
    LANGUAGE_OPTIONS: LANGUAGE_OPTIONS.map(option => Object.assign({}, option)),
    LANGUAGE_NAMES: Object.assign({}, LANGUAGE_NAMES),
    normalizeLocale,
    bootstrap,
    installReact,
    translateTree,
    translateValue,
    t,
    number,
    date,
    list,
    setLocaleAndReload,
    clearMissing() { missingValues.clear(); },
    get locale() { return currentLocale; },
    get ready() { return readyPromise || Promise.resolve(api); },
    get collisions() { return new Map(collisionKeys); },
    get missing() {
      return [...missingValues.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    }
  };

  setDocumentLocale(requestedLocale());
  return api;
});
