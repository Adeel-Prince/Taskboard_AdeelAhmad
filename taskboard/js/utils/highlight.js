const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits text into segments, flagging the ones that match the query.
 * Pure function (no DOM) so it is easy to unit test.
 *   splitByQuery("Write report", "rep") -> [{text:"Write ",match:false},{text:"rep",match:true},{text:"ort",match:false}]
 */
export function splitByQuery(text, query) {
  const needle = query.trim();
  if (!needle) return [{ text, match: false }];
  // A capture group makes split() keep the matches, always at odd indexes.
  const pattern = new RegExp(`(${escapeRegExp(needle)})`, "gi");
  return text
    .split(pattern)
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((segment) => segment.text !== "");
}

/** DocumentFragment with <mark> around each match. Text nodes only, so it is XSS-safe. */
export function highlight(text, query) {
  const fragment = document.createDocumentFragment();
  splitByQuery(text, query).forEach(({ text: part, match }) => {
    if (match) {
      const mark = document.createElement("mark");
      mark.textContent = part;
      fragment.append(mark);
    } else {
      fragment.append(document.createTextNode(part));
    }
  });
  return fragment;
}
