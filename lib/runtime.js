(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  // The game's own runtime (package J-12). The canonical source keeps the game in
  // the language of the Claude app's design canvas, where its first version was
  // made: a template of {{ values }}, <sc-if> and <sc-for>, and a logic class whose
  // renderVals() gives the values. The build turns the template into code once
  // (game.template.js, scripts/template-compiler.mjs); this file is the rest: the
  // base of the logic class, the few helpers that code calls, and the start, which
  // renders the two together with React (docs/ARCHITECTURE.md).
  const VERSION = "1.0.0";

  // Each message once per page; the template is drawn again at every change.
  const warned = new Set();
  function warn(message) {
    if (warned.has(message)) return;
    warned.add(message);
    if (root.console) root.console.warn("[template] " + message);
  }

  // A style attribute's text as React's style object: "font-size:12px" becomes
  // { fontSize: "12px" }, a custom property keeps its name. The build reads the
  // template's fixed styles with it, the helpers the styles a value fills in.
  function toStyle(text) {
    const style = {};
    for (const declaration of String(text).split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const name = declaration.slice(0, colon).trim();
      const key = name.startsWith("--") ? name : name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      style[key] = declaration.slice(colon + 1).trim();
    }
    return style;
  }

  // The base of the game's logic class, under the name the canvas gave it: props
  // and state as in a React class, and renderVals() for what the template shows.
  // setState changes this.state at once, so the next line already reads the new
  // state, and asks React to draw the game again (then calls done, if given).
  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
      this.__host = undefined;
    }

    setState(update, done) {
      if (this.__host) this.__host.updateLogic(update, done);
    }

    forceUpdate() {
      if (this.__host) this.__host.forceUpdate();
    }

    componentDidMount() {}

    componentDidUpdate() {}

    componentWillUnmount() {}

    renderVals() {
      return {};
    }
  }

  // What the template's code calls, around React.createElement. createElement is
  // taken when the game starts, after lib/i18n.js has wrapped it with the
  // translations, and the code calls it with the same arguments in the same order
  // as the canvas's runtime did, so a translation finds the same words.
  function helpers(React) {
    const h = React.createElement;
    const F = React.Fragment;
    return {
      h,
      F,
      // A {{ value }} in a text: nothing for null, true or false, an element or a
      // list as it is, anything else as text in a span. Undefined is a value the
      // logic never gave: nothing, and a warning the language checks look for.
      hole(key, value, source) {
        if (value === undefined) {
          warn("{{ " + source + " }} never resolved — rendered as empty");
          return null;
        }
        if (React.isValidElement(value) || Array.isArray(value)) return h(F, { key }, value);
        if (value === null || typeof value === "boolean") return null;
        return h("span", { key, className: "sc-interp" }, String(value));
      },
      // <sc-for>: a fragment for each item, keyed by its place in the list.
      each(key, list, source, item) {
        if (!Array.isArray(list)) {
          if (list !== undefined && list !== null) warn('sc-for list="' + source + '" is not a list (' + typeof list + ")");
          list = [];
        }
        return h(F, { key }, list.map(item));
      },
      // style, value and checked filled in by a value
      css(value) {
        return typeof value === "string" ? toStyle(value) : value;
      },
      val(value) {
        return value === undefined ? "" : value;
      },
      chk(value) {
        return value === undefined ? false : value;
      },
      // a class from a value together with the classes of the element's style-hover
      cls() {
        return Array.prototype.filter.call(arguments, Boolean).join(" ");
      }
    };
  }

  // An error's message in the console's first words, which every browser prints as written.
  function describe(error) {
    return error instanceof Error && error.message ? error.message : String(error);
  }

  // The words of the boot screen's error, for an error after the boot screen has gone.
  function say(key, fallback) {
    const i18n = root.PermacultureI18n;
    return i18n && typeof i18n.t === "function" ? i18n.t(key, null, fallback) : fallback;
  }

  // Starts the game: the logic class from game.logic.js and the template from
  // game.template.js, drawn by React into a new element at the end of the page.
  // React draws in a task of its own, after this one, as with any first render.
  // The shell calls it once React, the rules, the styles and both files are in;
  // onError (the shell's retry screen) hears of an error that stops the drawing.
  function start(options) {
    const settings = options || {};
    const React = root.React;
    const ReactDOM = root.ReactDOM;
    if (!React || !ReactDOM || typeof ReactDOM.createRoot !== "function") throw new Error("React is not in the page");
    if (typeof root.__permagardenLogic !== "function") throw new Error("The game's logic (game.logic.js) is not in the page");
    if (typeof root.__permagardenTemplate !== "function") throw new Error("The game's template (game.template.js) is not in the page");
    const Logic = root.__permagardenLogic(DCLogic, DCLogic, React);
    if (typeof Logic !== "function") throw new Error("game.logic.js did not give the game's class");
    const template = root.__permagardenTemplate(helpers(React));
    const h = React.createElement;
    const F = React.Fragment;

    class Game extends React.Component {
      constructor(props) {
        super(props);
        this.state = { drawn: 0 };
        this.logic = new Logic({ ...props });
        this.logic.__host = this;
      }

      updateLogic(update, done) {
        const before = this.logic.state;
        const change = typeof update === "function" ? update(before) : update;
        this.logic.state = { ...before, ...change };
        this.setState((state) => ({ drawn: state.drawn + 1 }), done);
      }

      componentDidMount() {
        try {
          this.logic.componentDidMount();
        } catch (error) {
          console.error(error);
        }
      }

      componentDidUpdate(previousProps) {
        this.logic.props = { ...this.props };
        try {
          this.logic.componentDidUpdate(previousProps);
        } catch (error) {
          console.error(error);
        }
      }

      componentWillUnmount() {
        try {
          this.logic.componentWillUnmount();
        } catch (error) {
          console.error(error);
        }
      }

      // A value the logic cannot give (renderVals() or the template throws) draws the
      // retry card instead of the game, as long as it lasts: the game stays, and the next
      // change that draws again draws the game, as with the canvas's runtime.
      render() {
        const props = { ...this.props };
        this.logic.props = props;
        try {
          const values = { ...props, ...(this.logic.renderVals() || {}) };
          return h("div", { className: "pg-host" }, h(F, null, template.render(values)));
        } catch (error) {
          console.error("Le Jardin could not draw the game: " + describe(error), error);
          return failure();
        }
      }
    }

    // An error that stops the game itself (its logic cannot be made) ends in the
    // shell's retry screen while the boot screen is still there, and in the same
    // words here for one later.
    class Stopped extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error };
      }

      componentDidCatch(error, info) {
        console.error("Le Jardin stopped: " + describe(error), error, (info && info.componentStack) || "");
        if (typeof settings.onError === "function") settings.onError(error);
      }

      render() {
        return this.state.error ? failure() : this.props.children;
      }
    }

    // The words of the boot screen's error, with its Try again (a new start).
    function failure() {
      return h("div", { className: "pg-host" },
        h("div", { role: "alert", style: { maxWidth: "420px", margin: "18vh auto 0", padding: "26px 30px", borderRadius: "24px", background: "#fbf8f1", color: "#2c3525", textAlign: "center", font: "14px/1.45 'Hanken Grotesk',sans-serif", boxShadow: "0 30px 80px -36px rgba(0,0,0,.6)" } },
          h("strong", { style: { display: "block", fontSize: "20px" } }, say("boot.error.title", "Le Jardin needs another moment")),
          h("p", null, say("boot.error.detail", "The game could not finish loading. Check your connection, then try again.")),
          h("button", { type: "button", "data-testid": "runtime-retry", onClick: () => root.location.reload() }, say("boot.error.retry", "Try again"))));
    }

    const container = root.document.createElement("div");
    container.id = "pg-root";
    root.document.body.appendChild(container);
    ReactDOM.createRoot(container).render(h(Stopped, null, h(Game, template.props)));
    return container;
  }

  return { VERSION, DCLogic, toStyle, helpers, start };
});
