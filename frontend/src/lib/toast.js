/* Tiny pub/sub toast bus, so any component can call showToast(...) without
   threading a context through every call site. */

const listeners = new Set();
let counter = 0;

export function onToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function showToast(message, type = 'success', options = {}) {
  const toast = {
    id: ++counter,
    message: String(message == null ? '' : message),
    type,
    options: options || {}
  };
  listeners.forEach(fn => fn(toast));
  return toast.id;
}
