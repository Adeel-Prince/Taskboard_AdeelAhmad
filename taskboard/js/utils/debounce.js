/**
 * Returns a function that waits `wait` ms after the LAST call before running.
 * Used for search so the list is not re-filtered on every keystroke.
 */
export function debounce(fn, wait = 250) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
