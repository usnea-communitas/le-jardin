// The game's template as code (package J-12): the compiler that turns the canonical
// source's template into game.template.js (scripts/template-compiler.mjs) and the
// runtime that draws it (lib/runtime.js). The browser journeys play the game; this
// test pins the language: what a {{ value }}, an attribute, a text, <sc-if> and
// <sc-for> make, element by element, with a React stand-in that records them.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compileTemplate, compileValue, propsFromDataProps, TemplateError } from "./template-compiler.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const runtime = require(path.join(root, "lib", "runtime.js"));

// --- values ---------------------------------------------------------------
const read = (source, v = {}) => new Function("v", `"use strict"; return ${compileValue(source)};`)(v);
const values = { a: { b: { c: 3 }, list: ["x", "y"], key: "b", zero: 0 }, n: null, s: "abc", yes: true, k: "b", t: "x" };
const cases = [
  ["a.b.c", 3],
  ["  a.b.c  ", 3],
  ["a.missing.c", undefined],
  ["n.anything", undefined],
  ["a.list.1", "y"],
  ["a.list.length", 2],
  ["s.length", 3],
  ["a[k].c", 3],
  ["a['b'].c", 3],
  ['a["b"].c', 3],
  ["a[a.key].c", 3],
  ["a[ k ]", values.a.b],
  ["true", true],
  ["false", false],
  ["null", null],
  ["undefined", undefined],
  ["0", 0],
  ["-1.5", -1.5],
  ["'it's'", "it's"],
  ['"quoted"', "quoted"],
  ["t === 'x'", true],
  ["t !== 'x'", false],
  ["a.zero == false", true],
  ["n != null", false],
  ["k === 'b' === true", false], // the first comparison splits the rest: k === ('b' === true)
  ["!yes", false],
  ["!!s", true],
  ["!yes === false", true], // (!yes) === false
  ["(a.b.c)", 3],
  ["(t) === (t)", true],
  ["((t))", "x"],
  // anything else reads as undefined
  ["a + b", undefined],
  ["a.b-c", undefined],
  ["a.b.c()", undefined],
  ["a .b", undefined],
  ["'unclosed", undefined],
  ["a[k", undefined],
  ["", undefined],
  ["1x", undefined],
];
for (const [source, expected] of cases) {
  assert.deepEqual(read(source, values), expected, `{{ ${source} }}`);
}
assert.equal(read("constructor", {}), Object, "a name reads from the values object as it is");

// --- a stand-in for React that records what the template makes ---------------
const Fragment = Symbol("Fragment");
const element = (type, props, ...children) => ({ type, props: { ...(props || {}) }, children });
const React = {
  Fragment,
  createElement: element,
  isValidElement: (value) => !!value && typeof value === "object" && "type" in value && "children" in value,
};

// Compiles markup and draws it with the given values, the way lib/runtime.js does.
function draw(markup, vals, props) {
  const { code, css } = compileTemplate(markup, { props });
  const page = {};
  new Function("window", code)(page);
  const template = page.__permagardenTemplate(runtime.helpers(React));
  return { tree: template.render(vals), props: template.props, css };
}
// The tree without fragments' and elements' keys, for comparisons that are about content.
const plain = (node) => Array.isArray(node) ? node.map(plain)
  : node && typeof node === "object" ? { type: node.type === Fragment ? "#" : node.type, props: Object.fromEntries(Object.entries(node.props).filter(([k]) => k !== "key")), children: plain(node.children) }
    : node;

{
  // elements: attribute names as React's props, keys by place among what draws something
  const { tree } = draw('\n<div class="a" for="x" data-x="1" sc-camel-on-click="{{ go }}" sc-camel-view-box="0 0 1 1" tabindex="-1"><!-- note --><b>Hi</b></div>\n', { go: "fn" });
  assert.equal(tree.length, 1);
  const [div] = tree;
  assert.equal(div.type, "div");
  assert.deepEqual(div.props, { key: 0, className: "a", htmlFor: "x", "data-x": "1", onClick: "fn", viewBox: "0 0 1 1", tabindex: "-1" });
  assert.deepEqual(div.children.map((child) => child.props.key), [0], "a comment takes no place");
  assert.deepEqual(div.children[0].children, ["Hi"]);
}
{
  // text: a run of line breaks without a space draws nothing, spaces stay; values in spans
  const { tree } = draw("<p>\n\t</p><p> \n </p><p>Hello {{ name }}, {{ count }} {{ none }}{{ no }}{{ yes }}{{ el }}{{ list }}!</p>", { name: "Ana", count: 0, none: null, no: false, yes: true, el: element("i", null), list: ["a"] });
  assert.deepEqual(tree[0].children, []);
  assert.deepEqual(tree[1].children, [" \n "]);
  const text = tree[2].children[0];
  assert.equal(text.type, Fragment);
  assert.equal(text.props.key, 0);
  assert.deepEqual(plain(text.children), [
    "Hello ", { type: "span", props: { className: "sc-interp" }, children: ["Ana"] },
    ", ", { type: "span", props: { className: "sc-interp" }, children: ["0"] },
    " ", null, "", null, "", null, "",
    { type: "#", props: {}, children: [{ type: "i", props: {}, children: [] }] }, "",
    { type: "#", props: {}, children: [["a"]] }, "!",
  ]);
  assert.deepEqual(text.children.filter((child) => child && typeof child === "object").map((child) => child.props.key), [1, 3, 11, 13], "a value's key is its place among the text's parts");
}
{
  // a text value the logic never gave is drawn as nothing, with one warning
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    draw("<p>{{ ghost }}</p><p>{{ ghost }}</p>", {});
  } finally {
    console.warn = original;
  }
  assert.deepEqual(warnings, ["[template] {{ ghost }} never resolved — rendered as empty"]);
}
{
  // attributes: one whole value keeps its kind, text around values joins them
  const { tree } = draw('<input value="{{ missing }}" checked="{{ missing }}"><input value="{{ v }}" checked="{{ c }}"><a title="Go to {{ place }}{{ none }}!" aria-label="{{ a }} {{ b }}" style="{{ s }}" data-n="{{ n }}"></a><a style="color: red; --gap: 2px;-webkit-line-clamp:2;bad"></a><a style="width:{{ w }}px"></a>', { v: 0, c: true, place: "Menet", a: "x", b: "y", s: { color: "blue" }, n: 7, w: 12 });
  assert.deepEqual(plain(tree[0]).props, { value: "", checked: false }, "a value and checked never left undefined");
  assert.deepEqual(plain(tree[1]).props, { value: 0, checked: true });
  assert.deepEqual(plain(tree[2]).props, { title: "Go to Menet!", "aria-label": undefined, style: { color: "blue" }, "data-n": 7 }, "an attribute that begins with {{ and ends with }} is one value, as in the canvas");
  assert.deepEqual(plain(tree[3]).props.style, { color: "red", "--gap": "2px", WebkitLineClamp: "2" });
  assert.deepEqual(plain(tree[4]).props.style, { width: "12px" });
}
{
  // style-hover: one class per different style, in the order of first use, after the element's own
  const { tree, css } = draw('<b class="x" style-hover="color:red"></b><b style-hover="color:blue"></b><b class="{{ c }}" style-hover="color:red"></b><b class="" style-hover="color:blue"></b>', { c: "dyn" });
  assert.deepEqual(tree.map((node) => node.props.className), ["x pg-hover-0", "pg-hover-1", "dyn pg-hover-0", "pg-hover-1"]);
  assert.deepEqual(css, [".pg-hover-0:hover{color:red}", ".pg-hover-1:hover{color:blue}"]);
}
{
  // sc-if: while the value is true, a fragment whose one child is the list of its content
  const markup = '<sc-if value="{{ show }}"><b>{{ word }}</b> </sc-if><sc-if value=""><i></i></sc-if><sc-if value="x"><u></u></sc-if><sc-if><s></s></sc-if>';
  const shown = draw(markup, { show: 1, word: "yes" }).tree;
  assert.deepEqual(plain(shown), [
    { type: "#", props: {}, children: [[{ type: "b", props: {}, children: [{ type: "#", props: {}, children: ["", { type: "span", props: { className: "sc-interp" }, children: ["yes"] }, ""] }] }, " "]] },
    null,
    { type: "#", props: {}, children: [[{ type: "u", props: {}, children: [] }]] },
    null,
  ]);
  assert.deepEqual(shown.map((node) => node && node.props.key), [0, null, 2, null]);
  assert.deepEqual(draw(markup, { show: 0 }).tree.slice(0, 2), [null, null]);
}
{
  // sc-for: a fragment per item keyed by its place; the item's name and $index shadow the values
  const markup = '<ul><sc-for list="{{ rows }}" as="row"><li title="{{ $index }}">{{ row.name }}<sc-for list="{{ row.tags }}"><i>{{ item }}{{ $index }}{{ row.name }}{{ outer }}</i></sc-for></li></sc-for></ul><sc-for list="{{ nothing }}"></sc-for><sc-for list="{{ word }}"></sc-for>';
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(message);
  let tree;
  try {
    tree = draw(markup, { rows: [{ name: "A", tags: ["t"] }, { name: "B", tags: [] }], row: "shadowed", outer: "o", word: "text" }).tree;
  } finally {
    console.warn = original;
  }
  // a fragment for the list, whose one child is the list of the items' fragments, each keyed by
  // its place, whose one child is the list of the item's content
  const list = tree[0].children[0];
  assert.equal(list.type, Fragment);
  assert.equal(list.children.length, 1);
  const items = list.children[0];
  assert.deepEqual(items.map((item) => [item.type, item.props.key]), [[Fragment, 0], [Fragment, 1]]);
  const first = items[0].children[0][0];
  assert.equal(first.type, "li");
  assert.equal(first.props.title, 0);
  const tag = first.children[1].children[0][0].children[0][0];
  assert.equal(tag.type, "i");
  assert.deepEqual(tag.children[0].children.filter(Boolean).map((part) => typeof part === "string" ? part : part.children[0]), ["t", "0", "A", "o"]);
  assert.deepEqual(plain(tree[1]), { type: "#", props: {}, children: [[]] }, "a missing list draws an empty fragment");
  assert.deepEqual(warnings, ['[template] sc-for list="{{ word }}" is not a list (string)'], "a list that is not a list says so");
}
{
  // <select> and table parts keep the loops written inside them
  const { tree } = draw('<select value="{{ v }}"><sc-for list="{{ o }}" as="x"><option value="{{ x }}">{{ x }}</option></sc-for></select><table><tbody><sc-for list="{{ o }}"><tr><td>{{ item }}</td></tr></sc-for></tbody></table>', { v: "b", o: ["a", "b"] });
  assert.equal(tree[0].type, "select");
  assert.deepEqual(tree[0].children[0].children[0].map((item) => item.children[0][0].props.value), ["a", "b"]);
  assert.equal(tree[1].type, "table");
  const row = tree[1].children[0].children[0].children[0][0].children[0][0];
  assert.deepEqual([row.type, row.children[0].type], ["tr", "td"]);
}
{
  // svg keeps its names
  const { tree } = draw('<svg sc-camel-view-box="0 0 2 2" stroke-width="2"><path d="M0 0"></path><lineargradient></lineargradient></svg>', {});
  assert.deepEqual(tree[0].props, { key: 0, viewBox: "0 0 2 2", "stroke-width": "2" });
  assert.deepEqual(tree[0].children.map((child) => child.type), ["path", "linearGradient"]);
}

// --- what the build refuses ------------------------------------------------
for (const [markup, why] of [
  ['<div\n onClick="{{ go }}"></div>', /line 2: an attribute name with capitals/],
  ['<button onclick="{{ go }}"></button>', /sc-camel-on-/],
  ['<x-import component="A" from="a.js"></x-import>', /x-import/],
  ["<helmet><meta></helmet>", /helmet/],
  ['<b style-hover="a{b}"></b>', /style-hover holds styles only/],
]) {
  assert.throws(() => compileTemplate(markup), (error) => error instanceof TemplateError && why.test(error.message), markup);
}

// --- the props the canvas gave the logic class ------------------------------
assert.deepEqual(propsFromDataProps('{"$preview":{"width":"100%"},"season":{"default":"Summer"},"grid":{"default":false},"none":{},"bad":null}'), { season: "Summer", grid: false });
assert.deepEqual(propsFromDataProps("not json"), {});

// --- the runtime's own parts -------------------------------------------------
assert.deepEqual(runtime.toStyle("margin:0 auto;--x: 1px ; background:url(a.webp) ;:x;y"), { margin: "0 auto", "--x": "1px", background: "url(a.webp)", "": "x" });
{
  // setState changes this.state at once and asks the host to draw; without a host it does nothing
  const logic = new runtime.DCLogic({ season: "Spring" });
  assert.deepEqual([logic.props, logic.state, logic.renderVals()], [{ season: "Spring" }, {}, {}]);
  logic.setState({ a: 1 });
  assert.deepEqual(logic.state, {}, "before the game starts, setState waits for a host");
  const calls = [];
  logic.__host = { updateLogic: (update, done) => calls.push([update, done]), forceUpdate: () => calls.push("force") };
  logic.setState({ a: 1 }, "done");
  logic.forceUpdate();
  assert.deepEqual(calls, [[{ a: 1 }, "done"], "force"]);
}

// --- the game's own template ------------------------------------------------
const built = await readFile(path.join(root, "game.template.js"), "utf8");
const page = {};
new Function("window", built)(page);
const game = page.__permagardenTemplate(runtime.helpers(React));
assert.deepEqual(game.props, { season: "Summer", gridGuides: true }, "the logic gets the source's data-props defaults");
{
  const original = console.warn;
  console.warn = () => {};
  try {
    assert.ok(Array.isArray(game.render({})), "the game's template draws from any values");
  } finally {
    console.warn = original;
  }
}
assert.ok(!/\bnew Function\b|\beval\(/.test(built), "the template needs no code made from text");

console.log("Template compiler and runtime tests passed.");
