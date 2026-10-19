/* ============================================================
   FRESHMEAT — Central API service
   ------------------------------------------------------------
   Every network request in the app goes through this module so the backend
   URL is configured in exactly one place (VITE_API_BASE_URL) and is never
   hardcoded inside components. It also attaches the JWT of the active
   role's session and normalises error responses to { message, status, data }.
   ============================================================ */

import { getToken } from './auth';

const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

/** Backend base URL, e.g. http://localhost:8082 (no trailing slash). */
export const API_BASE_URL = String(rawBase).replace(/\/+$/, '');

/** Absolute URL for an API path. Absolute/data/blob URLs pass through. */
export function apiUrl(path = '') {
  if (!path) return API_BASE_URL;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return API_BASE_URL + (path.startsWith('/') ? path : '/' + path);
}

/** Absolute URL for an image path stored by the backend (/images, /uploads). */
export function resolveImage(path) {
  if (!path) return apiUrl('/images/default-meat.jpg');
  return apiUrl(path);
}

function messageFrom(data, fallback) {
  if (data && (data.message || data.error)) return data.message || data.error;
  return fallback;
}

/**
 * Core JSON request helper.
 * @param {string} path   API path (e.g. '/api/cart')
 * @param {object} options { method, body (JSON), formData, headers }
 * @returns parsed JSON body (the ApiResponse envelope)
 */
export async function apiCall(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };

  // Try to get token with role awareness
  let token = getToken();
  if (!token && typeof window !== 'undefined') {
    const p = window.location.pathname || '';
    if (p.startsWith('/admin')) {
      token = localStorage.getItem('freshmeat_admin_token');
    } else if (p.startsWith('/delivery')) {
      token = localStorage.getItem('freshmeat_delivery_token');
    } else {
      token = localStorage.getItem('fm_token');
    }
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;

  let body;
  if (options.formData) {
    body = options.formData; // let the browser set the multipart boundary
  } else if (options.body !== undefined && options.body !== null) {
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(apiUrl(path), { method, headers, body });
  } catch (e) {
    throw { message: 'Network error. Is the server running?', status: 0 };
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { data = await response.json(); } catch (e) { /* ignore */ }
  } else {
    try { data = await response.text(); } catch (e) { /* ignore */ }
  }

  if (!response.ok) {
    throw { message: messageFrom(data, 'Request failed'), status: response.status, data };
  }
  return data;
}

/** Downloads a protected file (e.g. invoice PDF) with the bearer token. */
export async function downloadFile(path, filename) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const response = await fetch(apiUrl(path), { headers });
  if (!response.ok) {
    let message = 'Download failed';
    try {
      const d = await response.json();
      message = d.message || d.error || message;
    } catch (e) { /* ignore */ }
    throw { message, status: response.status };
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || 'download.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** Uploads a single image to /api/files/upload and returns its public path. */
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiCall('/api/files/upload', { method: 'POST', formData });
  return res && res.data ? res.data.url : null;
}
