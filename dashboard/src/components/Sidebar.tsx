'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Megaphone, MessageSquare, ScrollText } from 'lucide-react';

const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/campaign', label: 'Campanha', icon: Megaphone },
  { href: '/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/logs', label: 'Logs', icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 flex flex-col border-r border-[rgba(59,130,246,0.12)] bg-[#080c15] shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-[rgba(59,130,246,0.12)]">
        <span className="font-mono text-sm text-[#3b82f6] tracking-widest uppercase select-none">
          GueClaw
        </span>
        <div className="mt-1 text-xs text-[#5c7a9e]">control panel</div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
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

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[rgba(59,130,246,0.12)] text-xs text-[#3b5270]">
        fluxohub.kyrius.com.br
      </div>
    </aside>
  );
}
