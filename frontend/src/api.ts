async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('json') ? res.json() : res.text()) as Promise<T>;
}

export const api = {
  get:    <T>(u: string) => request<T>('GET', u),
  post:   <T>(u: string, b?: unknown) => request<T>('POST', u, b),
  put:    <T>(u: string, b?: unknown) => request<T>('PUT', u, b),
  delete: <T>(u: string) => request<T>('DELETE', u),
};

export const fetchSchema    = <T>(name: string) => api.get<T>(`/api/schema/${name}`);
export const fetchLookup    = (table: string, q?: string) =>
  api.get<{ value: string; label: string }[]>(`/api/lookup/${table}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
