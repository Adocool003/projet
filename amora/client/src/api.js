export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `HTTP ${status}`);
    this.status = status;
    this.code = data?.error;
    this.data = data || {};
  }
}

async function request(method, url, body) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${url}`, opts);
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body ?? {}),
  patch: (url, body) => request('PATCH', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url, body) => request('DELETE', url, body),
};

export function formatPrice(cents, lang = 'fr') {
  return new Intl.NumberFormat(lang === 'en' ? 'en-IE' : 'fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatDate(iso, lang = 'fr', opts = { dateStyle: 'long' }) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', opts).format(new Date(iso));
}
