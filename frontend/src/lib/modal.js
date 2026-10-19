/* Thin helpers around Bootstrap's modal plugin so pages can open/close modals
   programmatically the same way the original app did (new bootstrap.Modal). */

import { Modal } from 'bootstrap';

const instances = new Map();

function instanceFor(id) {
  if (instances.has(id)) return instances.get(id);
  const el = document.getElementById(id);
  if (!el) return null;
  const modal = new Modal(el);
  instances.set(id, modal);
  return modal;
}

export function showModal(id) {
  const modal = instanceFor(id);
  if (modal) modal.show();
}

export function hideModal(id) {
  const modal = instances.get(id);
  if (modal) modal.hide();
  else {
    const el = document.getElementById(id);
    if (el) new Modal(el).hide();
  }
}

/* Hides every currently open Bootstrap modal (used after an action succeeds
   while a modal is open). */
export function hideAllModals() {
  document.querySelectorAll('.modal.show').forEach(el => {
    const modal = instanceFor(el.id);
    if (modal) modal.hide();
    else new Modal(el).hide();
  });
}
