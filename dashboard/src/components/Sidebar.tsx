'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import {
  LayoutDashboard, Megaphone, MessageSquare, ScrollText, Wallet,
  Workflow, FileCode, MessageCircle, FolderOpen, Clock,
} from 'lucide-react';
import LogoutButton from './LogoutButton';
import { apiFetch } from '@/lib/api';

const NAV = [
  { href: '/overview',       label: 'Overview',    icon: LayoutDashboard },
  { href: '/chat',           label: 'Chat',         icon: MessageCircle },
  { href: '/conversations',  label: 'Conversas',    icon: MessageSquare },
  { href: '/workflows',      label: 'Workflows',    icon: Workflow },
  { href: '/editor',         label: 'Editor',       icon: FileCode },
  { href: '/files',          label: 'Arquivos',     icon: FolderOpen },
  { href: '/dashboard/cron', label: 'Cron Jobs',    icon: Clock },
  { href: '/financeiro',     label: 'Finanças',     icon: Wallet },
  { href: '/campaign',       label: 'Campanha',     icon: Megaphone },
  { href: '/logs',           label: 'Logs',         icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();

  const { data, error, isLoading } = useSWR(
    'agent-status',
    () => apiFetch<{ traces: any }>('stats'),
    { refreshInterval: 30_000, shouldRetryOnError: false },
  );

  const online = !isLoading && !!data && !error;
  const offline = !isLoading && !!error;

  return (
    <aside className="w-56 flex flex-col border-r border-[rgba(59,130,246,0.12)] bg-[#080c15] shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-[rgba(59,130,246,0.12)]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm text-[#3b82f6] tracking-widest uppercase select-none">
            GueClaw
          </span>
          {/* Agent status dot */}
          <div className="flex items-center gap-1.5" title={online ? 'Agente online' : offline ? 'Agente offline' : 'Verificando...'}>
            <span className={`text-[10px] ${online ? 'text-emerald-400' : offline ? 'text-red-400' : 'text-[#5c7a9e]'}`}>
              {online ? 'online' : offline ? 'offline' : '...'}
            </span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                online  ? 'bg-emerald-400 pulse-green' :
                offline ? 'bg-red-500 pulse-red' :
                          'bg-[#3b5270]'
              }`}
            />
          </div>
        </div>
        <div className="mt-1 text-xs text-[#5c7a9e]">control panel</div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/overview' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-[#3b82f6]/15 text-[#3b82f6] font-medium'
                  : 'text-[#8fa8c8] hover:bg-white/5 hover:text-[#e2eaf7]'
              }`}
            >
              <Icon size={16} className={active ? 'text-[#3b82f6]' : 'text-[#5c7a9e]'} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-3">
        <LogoutButton />
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[rgba(59,130,246,0.12)] text-xs text-[#3b5270]">
        gueclaw · v2.0
      </div>
    </aside>
  );
}
