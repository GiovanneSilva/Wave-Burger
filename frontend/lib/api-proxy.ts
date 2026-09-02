import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from './api';
import { SESSION_COOKIE_NAME } from './session';

/// Proxy genérico para GET autenticado: lê o cookie httpOnly no
/// servidor, repassa a query string tal como veio, e chama o backend com
/// `Authorization: Bearer`. Toda tela nova que só precisa LER dado real
/// deve criar um Route Handler de uma linha usando isto — ver
/// app/api/analytics/executive/route.ts como referência.
export async function proxyBackendGet(request: NextRequest, backendPath: string) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const data = await apiFetch(`${backendPath}${request.nextUrl.search}`, { token });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Não foi possível conectar ao servidor.' }, { status: 502 });
  }
}

/// Mesma ideia, para escritas (POST/PATCH/DELETE). Repassa o corpo da
/// requisição tal como veio do cliente — a validação de verdade acontece
/// no NestJS (DTOs + class-validator), este proxy não duplica validação.
export async function proxyBackendMutation(
  request: NextRequest,
  backendPath: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  const body = method === 'DELETE' ? undefined : await request.json().catch(() => undefined);

  try {
    const data = await apiFetch(backendPath, {
      method,
      token,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Não foi possível conectar ao servidor.' }, { status: 502 });
  }
}
