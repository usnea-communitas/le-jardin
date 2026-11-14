// The game's template as code (package J-12). The canonical source keeps the
// game's markup in its <x-dc> block, in the language of the Claude app's design
// canvas, where the game's first version was made:
//
//   {{ path }}                 a value the logic class's renderVals() gives
//   <sc-if value="{{ … }}">    its content only while the value is true
//   <sc-for list as>           its content once for each item of a list
//   sc-camel-on-click="…"      an attribute whose name has capitals (onClick)
//   style-hover="…"            styles for :hover (or another pseudo-class)
//
// The canvas's runtime read that markup in the browser at every start. This module
// reads it once, at build time, and writes game.template.js: one function for each
// part of the page, which makes the React elements lib/runtime.js draws with the
// game's logic class (docs/ARCHITECTURE.md). The elements are the ones the canvas's
// runtime made, called with the same arguments in the same order, so the page is
// the same, and the translations (lib/i18n.js, around React.createElement) find
// the same words.
import { createRequire } from "node:module";
import { parseFragment } from "parse5";

const require = createRequire(import.meta.url);
const { toStyle } = require("../lib/runtime.js");

// Elements whose content the HTML parser rearranges: an <sc-for> inside a <select>
// would be thrown out, one inside a table moved before it. They are read under
// another name, as ordinary elements, and given their own name back.
const REARRANGED = ["select", "table", "tbody", "thead", "tfoot", "tr", "td", "th", "caption"];
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const NAME = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const VALUE = /\{\{([\s\S]+?)\}\}/g;
const WHOLE_VALUE = /^\s*\{\{([\s\S]+?)\}\}\s*$/;
const UNDEFINED = "void 0";

class TemplateError extends Error {}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

// The parts of the canvas's language the game's runtime does not have, and
// attribute names with capitals, which HTML would turn into small letters, stop
// the build with the line to change.
function prepare(markup, offset) {
  const refuse = (pattern, why) => {
    const found = pattern.exec(markup);
    if (found) throw new TemplateError(`Template line ${offset + lineOf(markup, found.index)}: ${why}`);
  };
  refuse(/\s[a-z]+[A-Z][A-Za-z0-9]*\s*=/, "an attribute name with capitals; write it as sc-camel-… (sc-camel-on-click for onClick).");
  refuse(/<(?:x-import|dc-import)\b/i, "<x-import> and <dc-import> are not part of the game's runtime.");
  refuse(/<\/?helmet\b/i, "the template's <helmet> may hold only <style> blocks, which the build moves to game.css.");
  return markup.replace(new RegExp(`(</?)(${REARRANGED.join("|")})(?=[\\s>])`, "gi"), (_, open, tag) => `${open}sc-raw-${tag.toLowerCase()}`);
}

// A scope is the <sc-for> loops around a part of the template: a value's first
// name is the item or the place ($index) of the nearest loop that gives that name,
// or else a value of the logic (v).
class Scope {
  constructor(parent, as) {
    this.parent = parent;
    this.as = as;
    this.depth = parent ? parent.depth + 1 : 0;
  }

  item() {
    return "a" + this.depth;
  }

  index() {
    return "i" + this.depth;
  }

  lookup(name) {
    for (let scope = this; scope.depth > 0; scope = scope.parent) {
      if (name === "$index") return scope.index();
      if (name === scope.as) return scope.item();
    }
    return "v." + name;
  }

  parameters() {
    const names = ["v"];
    for (let depth = 1; depth <= this.depth; depth += 1) names.push("a" + depth, "i" + depth);
    return names.join(", ");
  }
}

// A {{ … }} as JavaScript. The language is small: a name followed by .name, .0 or
// [ … ] steps, where a step from nothing gives undefined instead of an error; ==,
// ===, != or !== between two values (the first one splits the rest); a leading !;
// true, false, null, undefined, numbers and quoted text; and parentheses around the
// whole. Anything else is undefined.
export function compileValue(source, scope = new Scope(null)) {
  const text = String(source).trim();
  if (!text) return UNDEFINED;
  if (text[0] === "(" && text.endsWith(")") && enclosesAll(text)) return compileValue(text.slice(1, -1), scope);
  const comparison = firstComparison(text);
  if (comparison) {
    const left = compileValue(text.slice(0, comparison.at), scope);
    const right = compileValue(text.slice(comparison.at + comparison.operator.length), scope);
    return `(${left} ${comparison.operator} ${right})`;
  }
  if (text[0] === "!") return `!(${compileValue(text.slice(1), scope)})`;
  if (text === "true" || text === "false" || text === "null") return text;
  if (text === "undefined") return UNDEFINED;
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const number = Number(text);
    return Object.is(number, -0) ? "(-0)" : number < 0 ? `(${number})` : String(number);
  }
  if (text.length >= 2 && (text[0] === '"' || text[0] === "'") && text[text.length - 1] === text[0]) {
    return JSON.stringify(text.slice(1, -1));
  }
  return compilePath(text, scope);
}

// Whether the first "(" closes only at the very end.
function enclosesAll(text) {
  let depth = 0;
  for (let at = 0; at < text.length - 1; at += 1) {
    if (text[at] === "(") depth += 1;
    else if (text[at] === ")") {
      depth -= 1;
      if (depth === 0) return false;
    }
  }
  return true;
}

// The first ==, ===, != or !== outside brackets and parentheses, with something before it.
function firstComparison(text) {
  let depth = 0;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth -= 1;
    else if (depth === 0 && (char === "=" || char === "!") && text[at + 1] === "=") {
      if (at > 0 && (text[at - 1] === "=" || text[at - 1] === "!")) continue;
      if (!text.slice(0, at).trim()) continue;
      return { at, operator: char + (text[at + 2] === "=" ? "==" : "=") };
    }
  }
  return null;
}

function compilePath(text, scope) {
  const head = NAME.exec(text);
  if (!head) return UNDEFINED;
  let code = scope.lookup(head[0]);
  let at = head[0].length;
  while (at < text.length) {
    if (text[at] === ".") {
      const rest = text.slice(at + 1);
      const step = NAME.exec(rest) || /^\d+/.exec(rest);
      if (!step) return UNDEFINED;
      code += IDENTIFIER.test(step[0]) ? `?.${step[0]}` : `?.[${JSON.stringify(step[0])}]`;
      at += 1 + step[0].length;
    } else if (text[at] === "[") {
      let depth = 1;
      let end = at + 1;
      for (; end < text.length; end += 1) {
        if (text[end] === "[") depth += 1;
        else if (text[end] === "]") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) return UNDEFINED;
      code += `?.[${compileValue(text.slice(at + 1, end), scope)}]`;
      at = end + 1;
    } else {
      return UNDEFINED;
    }
  }
  return code;
}

// An attribute: one whole {{ value }} keeps the value as it is (an object, a
// function, true), text around values joins them as text, and the rest is text.
// As in the canvas, an attribute that begins with {{ and ends with }} is one value
// even when it holds several, so "{{ a }} {{ b }}" gives nothing: such a label is
// joined in renderVals(), where its words can be translated as a whole.
function compileAttribute(raw, scope) {
  const whole = WHOLE_VALUE.exec(raw);
  if (whole) return { code: compileValue(whole[1], scope) };
  if (raw.includes("{{")) {
    const parts = raw.split(VALUE).map((part, index) => index % 2 ? `(${compileValue(part, scope)}) ?? ""` : JSON.stringify(part));
    return { code: `[${parts.join(", ")}].join("")`, text: true };
  }
  return { fixed: raw };
}

const literal = (value) => JSON.stringify(value);
const key = (name) => IDENTIFIER.test(name) ? name : JSON.stringify(name);

function styleLiteral(text) {
  const style = toStyle(text);
  return "{" + Object.keys(style).map((name) => `${key(name)}: ${literal(style[name])}`).join(", ") + "}";
}

// An attribute's name as React's prop: sc-camel-on-click is onClick, class is
// className, for is htmlFor; the rest keep their names (aria-label, tabindex).
function propName(name, line) {
  let prop = name.startsWith("sc-camel-") ? name.slice(9).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) : name;
  if (prop === "class") return "className";
  if (prop === "for") return "htmlFor";
  if (prop.startsWith("on") && prop.length > 2) {
    if (prop === prop.toLowerCase()) throw new TemplateError(`Template line ${line}: write the event attribute ${name} as sc-camel-on-… (sc-camel-on-click for onclick).`);
    prop = "on" + prop[2].toUpperCase() + prop.slice(3);
  }
  return prop;
}

class Compiler {
  constructor(firstLine) {
    this.firstLine = firstLine;
    this.functions = [];
    this.pseudo = new Map();
    this.css = [];
    this.stats = { elements: 0, conditions: 0, loops: 0, values: 0 };
  }

  line(node) {
    const at = node.sourceCodeLocation;
    return this.firstLine - 1 + (at ? at.startLine : 1);
  }

  // Every {{ … }} in a text or an attribute must be something the language can
  // read: anything else would always be undefined, so it stops the build.
  readable(text, node, attribute) {
    for (const found of String(text).matchAll(VALUE)) {
      const source = found[1];
      if (compileValue(source) !== UNDEFINED || source.trim() === "undefined") continue;
      const at = node.sourceCodeLocation;
      const start = (attribute && at && at.attrs && at.attrs[attribute]) || at;
      const line = this.firstLine - 1 + (start ? start.startLine : 1) + text.slice(0, found.index).split("\n").length - 1;
      throw new TemplateError(`Template line ${line}: {{${source}}} can never be read; a value is a name with .name, .0 or [ … ] steps, a comparison, a ! or a literal.`);
    }
  }

  // A class for each different style-hover (or style-focus, style-before…), in the
  // order the template first uses them, and its rule for game.css.
  pseudoClass(pseudo, css, node) {
    if (/[{}]|\/\*/.test(css) || css.includes("{{")) {
      throw new TemplateError(`Template line ${this.line(node)}: style-${pseudo} holds styles only, without {{ values }}, braces or comments.`);
    }
    const id = pseudo + "|" + css;
    if (!this.pseudo.has(id)) {
      const name = `pg-${pseudo}-${this.pseudo.size}`;
      this.pseudo.set(id, name);
      const separator = pseudo === "before" || pseudo === "after" ? "::" : ":";
      this.css.push(`.${name}${separator}${pseudo}{${css}}`);
    }
    return this.pseudo.get(id);
  }

  // A node's children as code, each with its place among those that draw something.
  children(node, scope, depth) {
    const out = [];
    for (const child of node.childNodes || []) {
      const code = this.node(child, scope, depth, out.length);
      if (code !== null) out.push(code);
    }
    return out;
  }

  node(node, scope, depth, place) {
    if (node.nodeName === "#text") {
      this.readable(node.value, node);
      return this.text(node.value, scope, place);
    }
    if (!node.tagName) return null; // a comment
    for (const attr of node.attrs || []) this.readable(attr.value, node, attr.name);
    const name = node.tagName.toLowerCase();
    if (name === "sc-for") return this.loop(node, scope, depth, place);
    if (name === "sc-if") return this.condition(node, scope, depth, place);
    return this.element(node, scope, depth, place);
  }

  // Text: words as they are (a run of line breaks and tabs without a space between
  // two elements draws nothing), with each {{ value }} in its place.
  text(value, scope, place) {
    if (!value.includes("{{")) {
      if (!value.trim() && !value.includes(" ")) return null;
      return literal(value);
    }
    const parts = value.split(VALUE).map((part, index) => {
      if (!(index % 2)) return literal(part);
      this.stats.values += 1;
      return `hole(${index}, ${compileValue(part, scope)}, ${literal(part.trim())})`;
    });
    return `h(F, {key: ${place}}, ${parts.join(", ")})`;
  }

  // The content of <sc-if> and <sc-for> is a function of its own, which the
  // browser compiles only when that part of the page is first drawn.
  body(node, scope, depth) {
    const name = "f" + (this.functions.length + 1);
    this.functions.push(null);
    const kids = this.children(node, scope, 1);
    this.functions[Number(name.slice(1)) - 1] = `function ${name}(${scope.parameters()}) {\n  return [${kids.length ? "\n" + kids.map((kid) => "  " + kid).join(",\n") + "\n  " : ""}];\n}`;
    return `${name}(${scope.parameters()})`;
  }

  condition(node, scope, depth, place) {
    this.stats.conditions += 1;
    const attribute = (node.attrs || []).find((attr) => attr.name === "value");
    const test = compileAttribute(attribute ? attribute.value : "", scope);
    const call = this.body(node, scope, depth);
    if ("fixed" in test) return test.fixed ? `h(F, {key: ${place}}, ${call})` : "null";
    return `(${test.code} ? h(F, {key: ${place}}, ${call}) : null)`;
  }

  loop(node, scope, depth, place) {
    this.stats.loops += 1;
    const attrs = node.attrs || [];
    const listAttr = attrs.find((attr) => attr.name === "list");
    const asAttr = attrs.find((attr) => attr.name === "as");
    const source = listAttr ? listAttr.value : "";
    const list = compileAttribute(source, scope);
    const inner = new Scope(scope, (asAttr && asAttr.value) || "item");
    const call = this.body(node, inner, depth + 1);
    const listCode = "fixed" in list ? literal(list.fixed) : list.code;
    return `each(${place}, ${listCode}, ${literal(source)}, (${inner.item()}, ${inner.index()}) => h(F, {key: ${inner.index()}}, ${call}))`;
  }

  element(node, scope, depth, place) {
    this.stats.elements += 1;
    const tag = node.tagName.startsWith("sc-raw-") ? node.tagName.slice(7) : node.tagName;
    const props = [`key: ${place}`];
    const pseudo = [];
    let classAt = -1;
    let classCode = null;
    for (const attr of node.attrs || []) {
      const name = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
      if (name === "sc-name" || name === "data-dc-tpl" || name === "hint-size") continue;
      if (name.startsWith("style-")) {
        pseudo.push(this.pseudoClass(name.slice(6), attr.value, node));
        continue;
      }
      const prop = propName(name, this.line(node));
      const value = compileAttribute(attr.value, scope);
      let code;
      if (prop === "style") code = "fixed" in value ? styleLiteral(value.fixed) : `css(${value.code})`;
      else if ("fixed" in value) code = literal(value.fixed);
      else if (!value.text && prop === "value") code = `val(${value.code})`;
      else if (!value.text && prop === "checked") code = `chk(${value.code})`;
      else code = value.code;
      if (prop === "className") {
        classAt = props.length;
        classCode = "fixed" in value ? { fixed: value.fixed } : { code };
      }
      props.push(`${key(prop)}: ${code}`);
    }
    if (pseudo.length) {
      const fixedClass = (text) => literal([text, ...pseudo].filter(Boolean).join(" "));
      if (classAt < 0) props.push(`className: ${fixedClass("")}`);
      else props[classAt] = "className: " + ("fixed" in classCode ? fixedClass(classCode.fixed) : `cls(${classCode.code}, ${pseudo.map(literal).join(", ")})`);
    }
    const kids = this.children(node, scope, depth + 1);
    const head = `h(${literal(tag)}, {${props.join(", ")}}`;
    if (!kids.length) return head + ")";
    const indent = "  ".repeat(Math.min(depth + 1, 12));
    return head + ",\n" + kids.map((kid) => indent + "  " + kid).join(",\n") + ")";
  }
}

// Compiles the markup inside <x-dc> (with the <helmet> already taken out) into the
// text of game.template.js. props are the defaults of the source's data-props, which
// the logic class gets as this.props; firstLine is the markup's first line in the
// canonical source, for the build's messages.
export function compileTemplate(markup, { props = {}, firstLine = 1, header = "" } = {}) {
  const prepared = prepare(markup, firstLine - 1);
  const tree = parseFragment(prepared, { sourceCodeLocationInfo: true });
  const compiler = new Compiler(firstLine);
  const top = compiler.children(tree, new Scope(null), 0);
  const render = `function render(v) {\n  return [\n${top.map((kid) => "  " + kid).join(",\n")}\n  ];\n}`;
  const code = [
    header,
    "(function () {",
    '"use strict";',
    "let h, F, hole, each, css, val, chk, cls;",
    render,
    ...compiler.functions,
    "window.__permagardenTemplate = function (helpers) {",
    "  ({ h, F, hole, each, css, val, chk, cls } = helpers);",
    `  return { props: ${JSON.stringify(props)}, render };`,
    "};",
    "})();",
    ""
  ].join("\n");
  return { code, css: compiler.css, stats: { ...compiler.stats, functions: compiler.functions.length + 1 } };
}

// The defaults of the source's data-props (season, gridGuides…), which the canvas
// gave the logic class as this.props; keys starting with $ describe the canvas's
// preview and are left out.
export function propsFromDataProps(raw) {
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const props = {};
  for (const name of Object.keys(parsed)) {
    if (name[0] === "$") continue;
    const meta = parsed[name];
    if (meta && meta.default !== undefined) props[name] = meta.default;
  }
  return props;
}

export { TemplateError };
