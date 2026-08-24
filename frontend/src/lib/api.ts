const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
const apiBase = rawApiBase.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${normalizedPath}`;
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.headers || {})
    }
  });
}
