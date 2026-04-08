import { NextResponse } from 'next/server';

/**
 * 🔍 Debug de Variáveis de Ambiente
 * GET /api/debug/env
 * 
 * ⚠️ REMOVER EM PRODUÇÃO APÓS DEBUG
 */
export async function GET() {
  const hasPasswordHash = !!process.env.DASHBOARD_PASSWORD_HASH;
  const hashLength = process.env.DASHBOARD_PASSWORD_HASH?.length || 0;
  const hashPreview = process.env.DASHBOARD_PASSWORD_HASH?.substring(0, 5) || 'undefined';
  
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV || 'local',
    dashboard_password_configured: hasPasswordHash,
    hash_length: hashLength,
    hash_preview: hashPreview + '...',
    timestamp: new Date().toISOString(),
  });
}
