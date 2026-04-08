import { NextResponse } from 'next/server';

/**
 * 🚪 API de Logout
 * POST /api/auth/logout
 */
export async function POST() {
  const response = NextResponse.json(
    { success: true, message: 'Logout realizado com sucesso' },
    { status: 200 }
  );
  
  // Remove cookie de autenticação
  response.cookies.delete('dashboard_auth');
  
  return response;
}
