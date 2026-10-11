import { h } from "../utils/dom.js";

let timer;

/** Small status message at the bottom of the screen, with an optional action button (e.g. Undo). */
export function showToast(
  el,
  message,
  { actionLabel, onAction, duration = 4000 } = {},
) {
  clearTimeout(timer);
  el.replaceChildren(
    h("span", {}, message),
    actionLabel
      ? h(
          "button",
          {
            type: "button",
            onclick: () => {
              onAction?.();
              hideToast(el);
            },
          },
          actionLabel,
        )
      : null,
  );
  el.classList.add("is-visible");
  timer = setTimeout(() => hideToast(el), duration);
}

export function hideToast(el) {
  el.classList.remove("is-visible");
}
