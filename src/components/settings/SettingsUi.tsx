import React from 'react';

const D = 'div' as unknown as React.FC<React.HTMLAttributes<HTMLDivElement>>;

export const Toggle = ({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onToggle}
    className={`relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none disabled:opacity-40 ${
      on ? 'bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'bg-gray-700/60'
    }`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
      on ? 'translate-x-5' : 'translate-x-0'
    }`} />
  </button>
);

type RowProps = {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  isDestructive?: boolean;
};

export const Row = ({ icon: Icon, iconBg, iconColor, label, sub, right, onClick, isDestructive }: RowProps) => (
  <D
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    className={`flex items-center justify-between px-4 py-3.5 bg-[#14161f] border-b border-white/[0.03] last:border-0 ${
      onClick ? 'cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.06]' : ''
    } transition-colors`}
  >
    <D className="flex items-center gap-3.5 min-w-0">
      <D className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center shrink-0 border border-white/5`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </D>
      <D className="min-w-0">
        <p className={`text-sm font-bold truncate ${isDestructive ? 'text-red-400' : 'text-white'}`}>{label}</p>
        {sub && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5 truncate">{sub}</p>}
      </D>
    </D>
    <D className="flex items-center gap-2 shrink-0 ml-2">{right}</D>
  </D>
);

export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-1.5">
    <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em] px-4">{title}</h3>
    <D className="bg-[#14161f] border-y border-white/[0.04] sm:border sm:border-white/[0.04] sm:rounded-2xl overflow-hidden mx-0">
      {children}
    </D>
  </section>
);

export const StatCard = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <D className="bg-[#14161f] border border-white/[0.04] rounded-xl p-3 text-center transition-colors hover:border-white/[0.08]">
    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
    <p className={`text-sm font-black mt-1.5 leading-none ${accent ?? 'text-white'}`}>{value}</p>
  </D>
);
