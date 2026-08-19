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
