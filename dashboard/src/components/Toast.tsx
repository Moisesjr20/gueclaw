'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const styles: Record<ToastType, string> = {
    success: 'border-emerald-500/30 text-emerald-300',
    error:   'border-red-500/30 text-red-300',
    info:    'border-blue-500/30 text-blue-300',
  };

  const Icon = ({ type }: { type: ToastType }) => {
    if (type === 'success') return <CheckCircle2 className="w-4 h-4 shrink-0" />;
    if (type === 'error')   return <AlertCircle  className="w-4 h-4 shrink-0" />;
    return <Info className="w-4 h-4 shrink-0" />;
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm max-w-sm bg-[#0e1522] animate-fade-in ${styles[t.type]}`}
          >
            <Icon type={t.type} />
            <span className="flex-1 text-[#e2eaf7]">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="text-[#5c7a9e] hover:text-[#e2eaf7] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
