import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/session';
import type { LoginResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body?.email || !body?.password) {
    return NextResponse.json({ message: 'Informe e-mail e senha.' }, { status: 400 });
  }

  try {
    const result = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: body.email, password: body.password }),
    });

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(SESSION_COOKIE_NAME, result.accessToken, sessionCookieOptions);
    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Não foi possível conectar ao servidor.' }, { status: 502 });
  }
}
