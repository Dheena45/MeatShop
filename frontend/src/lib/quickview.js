/* Tiny pub/sub bus for the shared Quick View modal, so any ProductCard can
   open it without threading props through every page. */

const listeners = new Set();

export function onQuickView(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openQuickView(productId) {
  listeners.forEach(fn => fn(productId));
}
