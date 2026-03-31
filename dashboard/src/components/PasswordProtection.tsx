'use client';
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordProtectionProps {
  children: React.ReactNode;
  correctPassword: string;
}

export default function PasswordProtection({ children, correctPassword }: PasswordProtectionProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if already authenticated in this session
    const sessionAuth = sessionStorage.getItem('financial_auth');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === correctPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem('financial_auth', 'true');
      setError('');
    } else {
      setError('Senha incorreta');
      setPassword('');
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#040911]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3b82f6]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#040911]">
        <div className="w-full max-w-md p-8">
          {/* Card */}
          <div className="bg-gradient-to-br from-[#0a0f1a] to-[#060911] border border-[rgba(59,130,246,0.15)] rounded-xl shadow-2xl p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] p-4 rounded-full">
                <Lock size={32} className="text-white" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-[#e2eaf7] text-center mb-2">
              Área Protegida
            </h2>
            <p className="text-sm text-[#5c7a9e] text-center mb-8">
              Insira a senha para acessar o Controle Financeiro
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Digite a senha"
                  className="w-full bg-[#0a0f1a] border border-[rgba(59,130,246,0.12)] rounded-lg px-4 py-3 pr-12 text-[#c5d5e8] placeholder-[#3b5270] focus:border-[#3b82f6] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c7a9e] hover:text-[#3b82f6] transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!password}
                className="w-full bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] disabled:from-[#1e3a5f] disabled:to-[#1e3a5f] disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#3b82f6]/20"
              >
                Acessar
              </button>
            </form>

            <p className="text-xs text-[#3b5270] text-center mt-6">
              A sessão expira ao fechar o navegador
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
