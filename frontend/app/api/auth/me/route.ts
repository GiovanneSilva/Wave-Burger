import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api';
import { SESSION_COOKIE_NAME } from '@/lib/session';
import type { AuthUser } from '@/lib/types';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const user = await apiFetch<AuthUser>('/auth/me', { token });
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ message: 'Não foi possível conectar ao servidor.' }, { status: 502 });
  }
}
