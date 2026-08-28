const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
const apiBase = rawApiBase.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${normalizedPath}`;
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const signal = init.signal || controller.signal;

  return fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    signal,
    headers: {
      ...(init.headers || {})
    }
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}
