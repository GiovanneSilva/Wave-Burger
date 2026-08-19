export const SESSION_COOKIE_NAME = 'wb_session';

/// 8h, mesmo valor default de JWT_EXPIRES_IN no backend (Etapa 6). Se o
/// backend mudar esse valor, atualizar aqui também — não há como
/// descobrir a expiração real sem decodificar o JWT no servidor.
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};
