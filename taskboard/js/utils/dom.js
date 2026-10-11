const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Tiny hyperscript helper: h("li", { class: "x", onclick }, child, child)
 * Builds real DOM nodes (never innerHTML), so user text can never inject markup.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class")
      el.className = [].concat(value).filter(Boolean).join(" ");
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on") && typeof value === "function")
      el.addEventListener(key.slice(2), value);
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  children.flat(Infinity).forEach((child) => {
    if (child == null || child === false) return;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return el;
}

/** 16x16 stroke icon from one or more path strings. */
export function icon(...paths) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  paths.forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  });
  return svg;
}

export const ICONS = {
  edit: ["M2.5 13.5l.8-3.2 7.6-7.6 2.4 2.4-7.6 7.6-3.2.8z", "M9.4 4.2l2.4 2.4"],
  remove: ["M3.5 3.5l9 9", "M12.5 3.5l-9 9"],
};
