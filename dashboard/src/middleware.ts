import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 🔒 Middleware de Segurança - Autenticação por Senha
 * 
 * Bloqueia acesso ao dashboard para usuários não autenticados.
 * Requer login com senha para acessar qualquer página.
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/login', '/api/auth/login', '/api/auth/logout'];
  
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }
  
  // Verifica se tem cookie de autenticação
  const authToken = request.cookies.get('dashboard_auth');
  
  if (!authToken) {
    // Redireciona para login se não estiver autenticado
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Valida o token (senha em base64)
  const expectedToken = process.env.DASHBOARD_PASSWORD_HASH;
  
  if (!expectedToken || authToken.value !== expectedToken) {
    // Token inválido - redireciona para login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('error', 'invalid_session');
    
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('dashboard_auth');
    return response;
  }
  
  // Autenticado - permite acesso
  return NextResponse.next();
}

// Configura em quais rotas o middleware deve rodar
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/health (healthcheck público)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
};
