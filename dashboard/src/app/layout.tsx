import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'GueClaw Dashboard',
  description: 'Control panel — gueclaw-agent',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex h-screen overflow-hidden bg-[#080c15]">
        <Sidebar />
        <main className="flex-1 overflow-y-auto dot-grid">
          <div className="p-6 min-h-full">{children}</div>
        </main>
      </body>
    </html>
  );
}
