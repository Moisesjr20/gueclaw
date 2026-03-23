import type { QueueLead } from '@/lib/api';

export default function LeadQueue({ leads }: { leads: QueueLead[] }) {
  if (leads.length === 0) {
    return (
      <div className="glass p-5 text-center text-[#5c7a9e] text-sm py-10">
        Nenhum lead na fila
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden">
      <div className="px-5 py-3 border-b border-[rgba(59,130,246,0.12)] text-xs text-[#5c7a9e] uppercase tracking-wider flex gap-4">
        <span className="w-8">#</span>
        <span className="flex-1">Nome</span>
        <span className="w-28">Cidade</span>
        <span className="w-36 font-mono">WhatsApp</span>
      </div>
      <div className="divide-y divide-[rgba(59,130,246,0.07)]">
        {leads.map((lead, i) => (
          <div key={lead.id} className="px-5 py-2.5 flex gap-4 items-center text-sm hover:bg-white/[0.02]">
            <span className="w-8 text-[#3b5270] font-mono text-xs">{i + 1}</span>
            <span className="flex-1 text-[#c5d5e8] truncate">{lead.title}</span>
            <span className="w-28 text-[#5c7a9e] text-xs truncate">{lead.city}</span>
            <span className="w-36 font-mono text-xs text-[#3b82f6]">{lead.whatsapp_number}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
