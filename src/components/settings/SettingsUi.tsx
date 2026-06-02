import React from 'react';

const D = 'div' as unknown as React.FC<React.HTMLAttributes<HTMLDivElement>>;

export const Toggle = ({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onToggle}
    className={`relative w-10 h-6 rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-40 ${on ? 'bg-amber-500' : 'bg-gray-700'}`}
  >
    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${on ? 'translate-x-5' : 'translate-x-1'}`} />
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
    className={`flex items-center justify-between px-4 py-3.5 bg-[#14161f] border-b border-white/5 last:border-0 ${
      onClick ? 'cursor-pointer hover:bg-white/5 active:bg-white/10' : ''
    } transition-colors`}
  >
    <D className="flex items-center gap-4">
      <D className={`w-10 h-10 ${iconBg} rounded-[0.85rem] flex items-center justify-center border border-white/5`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </D>
      <D>
        <p className={`text-sm font-bold ${isDestructive ? 'text-red-400' : 'text-white'}`}>{label}</p>
        {sub && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{sub}</p>}
      </D>
    </D>
    <D className="flex items-center gap-2">{right}</D>
  </D>
);

export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">{title}</h3>
    <D className="bg-[#14161f] border-y border-white/5 sm:border sm:rounded-3xl overflow-hidden">
      {children}
    </D>
  </section>
);

export const StatCard = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <D className="bg-[#14161f] border border-white/5 rounded-2xl p-3 text-center">
    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
    <p className={`text-sm font-black mt-1 ${accent ?? 'text-white'}`}>{value}</p>
  </D>
);
