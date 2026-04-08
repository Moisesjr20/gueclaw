import { NextRequest, NextResponse } from 'next/server';

/**
 * 🔐 API de Login - Autenticação por Senha
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return NextResponse.json(
        { error: 'Senha é obrigatória' },
        { status: 400 }
      );
    }
    
    // Pega a senha hash do .env (base64)
    const expectedHash = process.env.DASHBOARD_PASSWORD_HASH;
    
    if (!expectedHash) {
      console.error('⚠️ DASHBOARD_PASSWORD_HASH não configurado no .env');
      console.error('Environment:', process.env.NODE_ENV, process.env.VERCEL_ENV);
      return NextResponse.json(
        { error: 'Configuração de autenticação inválida. DASHBOARD_PASSWORD_HASH não encontrado.' },
        { status: 500 }
      );
    }
    
    // Converte a senha fornecida para base64
    const passwordHash = Buffer.from(password).toString('base64');
    
    // Debug logs (remover em produção final)
    console.log('🔐 Login attempt:', {
      env: process.env.NODE_ENV,
      vercel_env: process.env.VERCEL_ENV,
      hasExpectedHash: !!expectedHash,
      expectedHashLength: expectedHash?.length,
      providedHashLength: passwordHash.length,
      match: passwordHash === expectedHash
    });
    
    // Valida senha
    if (passwordHash !== expectedHash) {
      // Log de tentativa falhada (segurança)
      console.warn('🚫 Tentativa de login com senha incorreta');
      
      return NextResponse.json(
        { error: 'Senha incorreta' },
        { status: 401 }
      );
    }
    
    // Senha correta - cria cookie de sessão
    const response = NextResponse.json(
      { 
        success: true, 
        message: 'Login realizado com sucesso' 
      },
      { status: 200 }
    );
    
    // Define cookie com hash (válido por 7 dias)
    response.cookies.set('dashboard_auth', passwordHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    });
    
    console.log('✅ Login bem-sucedido');
    
    return response;
    
  } catch (error) {
    console.error('❌ Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
