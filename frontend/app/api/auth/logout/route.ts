import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    // Best-effort: o backend hoje é stateless (Etapa 6), então isso não
    // revoga nada de verdade — existe só para consistência de contrato,
    // caso um mecanismo de revogação seja adicionado no futuro.
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ message: 'Sessão encerrada.' });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
