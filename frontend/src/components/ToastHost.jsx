import { useEffect, useState } from 'react';
import { onToast } from '../lib/toast';

/* Renders the toast stack exactly like the original app.js showToast():
   .fm-toast inside #toast-container, auto-dismissed after a timeout. */

const ICONS = {
  success: 'fa-circle-check',
  error: 'fa-circle-xmark',
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info'
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const off = onToast((toast) => {
      setToasts(list => [...list, toast]);
      const opts = toast.options || {};
      const timeout = opts.title ? (opts.duration || 6000) : (opts.duration || 3200);
      setTimeout(() => {
        setToasts(list => list.filter(t => t.id !== toast.id));
      }, timeout);
    });
    return off;
  }, []);

  return (
    <div id="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={'fm-toast ' + t.type + (t.options && t.options.title ? ' fm-toast-titled' : '')}
        >
          <i className={'fa-solid ' + (ICONS[t.type] || ICONS.info)}></i>
          {t.options && t.options.title ? (
            <div className="fm-toast-body">
              <strong className="fm-toast-title">{t.options.title}</strong>
              <span>{t.message}</span>
            </div>
          ) : (
            <span>{t.message}</span>
          )}
        </div>
      ))}
    </div>
  );
}
