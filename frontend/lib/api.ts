export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ApiErrorBody {
  message: string | string[];
  statusCode: number;
}

export class ApiError extends Error {
  statusCode: number;

  constructor(body: ApiErrorBody) {
    super(Array.isArray(body.message) ? body.message.join(' ') : body.message);
    this.statusCode = body.statusCode;
  }
}

/// Wrapper simples para chamar a API do Wave Burger. Usado tanto pelos
/// Route Handlers (`app/api/**`, lado servidor) quanto por componentes
/// cliente que já possuem um token em mãos.
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText, statusCode: res.status }));
    throw new ApiError(body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
