interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'blue' | 'green' | 'amber' | 'red';
}

const accentMap = {
  blue: 'text-[#3b82f6]',
  green: 'text-[#10b981]',
  amber: 'text-[#f59e0b]',
  red: 'text-[#ef4444]',
};

export default function StatCard({ label, value, sub, accent = 'blue' }: StatCardProps) {
  return (
    <div className="glass p-5 flex flex-col gap-2">
      <span className="text-xs text-[#5c7a9e] uppercase tracking-wider">{label}</span>
      <span className={`text-3xl font-bold font-mono ${accentMap[accent]}`}>{value}</span>
      {sub && <span className="text-xs text-[#5c7a9e]">{sub}</span>}
    </div>
  );
}
