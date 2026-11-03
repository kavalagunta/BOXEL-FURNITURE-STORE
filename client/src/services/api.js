/**
 * Thin fetch wrapper for the Express API.
 * - Same-origin requests with the HTTP-only session cookie (no tokens in localStorage).
 * - Sends the CSRF token on every state-changing request; refreshes it once if the session rotated.
 */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || (status === 0 ? 'Could not reach the server. Check your connection and try again.' : 'Something went wrong. Please try again.'));
    this.status = status;
    this.fields = body?.fields || {};
    this.code = body?.code;
    this.details = body?.details;
  }
}

let csrfToken = null;
let csrfPromise = null;

async function fetchCsrf() {
  if (!csrfPromise) {
    csrfPromise = fetch(`${BASE}/api/csrf`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        csrfToken = d.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

export async function api(path, { method = 'GET', body, signal, isForm = false, retry = true } = {}) {
  const headers = {};
  const unsafe = method !== 'GET' && method !== 'HEAD';
  if (unsafe) headers['X-CSRF-Token'] = csrfToken || (await fetchCsrf());
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      credentials: 'include',
      signal,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, null);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (res.status === 403 && data?.code === 'CSRF' && retry) {
    await fetchCsrf();
    return api(path, { method, body, signal, isForm, retry: false });
  }
  if (res.status === 401 && path.startsWith('/admin/') && !path.startsWith('/admin/auth/')) {
    window.dispatchEvent(new Event('boxel:admin-signed-out'));
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

/** Called after sign-in/out because the server rotates the session. */
export function refreshCsrf() {
  csrfToken = null;
  return fetchCsrf();
}

export const get = (path, opts) => api(path, { ...opts, method: 'GET' });
export const post = (path, body, opts) => api(path, { ...opts, method: 'POST', body });
export const put = (path, body, opts) => api(path, { ...opts, method: 'PUT', body });
export const patch = (path, body, opts) => api(path, { ...opts, method: 'PATCH', body });
export const del = (path, body, opts) => api(path, { ...opts, method: 'DELETE', body });

export function uploadImages(files, folder) {
  const form = new FormData();
  for (const f of files) form.append('images', f);
  return api(`/admin/uploads?folder=${encodeURIComponent(folder)}`, { method: 'POST', body: form, isForm: true });
}

export function uploadMedia(file, folder = 'products', onProgress) {
  const form = new FormData();
  form.append('file', file);
  form.append('folder', folder);
  // XMLHttpRequest reports upload progress while preserving the session and CSRF protections.
  return (async () => {
    const csrf = csrfToken || await fetchCsrf();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/api/admin/upload`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-CSRF-Token', csrf);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)); };
      xhr.onload = () => {
        let data;
        try { data = JSON.parse(xhr.responseText); } catch { data = null; }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(xhr.status, data));
      };
      xhr.onerror = () => reject(new ApiError(0, null));
      xhr.send(form);
    });
  })();
}

export const qs = (params) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
};
