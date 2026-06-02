"use client";

import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Search, CheckCircle2, Clock, XCircle, FileText, Download } from 'lucide-react';

const STATUS_MAP = {
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  pending:   { icon: Clock,        color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  failed:    { icon: XCircle,      color: 'text-rose-400',    bg: 'bg-rose-500/10' },
};

const TransactionHistory: React.FC<{ transactions: Record<string, string>[] }> = ({ transactions }) => {
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [search, setSearch] = useState('');

  const filtered = transactions.filter(tx => {
    const matchType = filter === 'all' || tx.type === filter;
    const matchSearch = tx.coin.toLowerCase().includes(search.toLowerCase()) || tx.id.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="min-h-full bg-[#0b0c10] text-white flex flex-col pb-24 font-space">
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[#0b0c10]/80 backdrop-blur-xl border-b border-white/5 pt-8 pb-5 px-6 space-y-6">
         <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black tracking-tighter text-white italic">LEDGER <span className="text-blue-500 font-bold not-italic text-sm ml-2 tracking-widest uppercase">Protocol 1.0</span></h1>
            <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/10 transition-all active:scale-95 shadow-lg">
               <Download className="w-4 h-4 text-blue-400" />
               <span className="text-[10px] font-black text-white uppercase tracking-widest">Export CSV</span>
            </button>
         </div>

         {/* Search & Filter Controls */}
         <div className="flex gap-3">
            <div className="relative flex-1 group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
               <input 
                 type="text" 
                 placeholder="Search by Asset or TxID..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full bg-[#161821] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all shadow-inner"
               />
            </div>
            <div className="flex bg-[#161821] border border-white/5 p-1.5 rounded-2xl shadow-inner">
               {(['all', 'buy', 'sell'] as const).map(f => (
                 <button 
                   key={f} 
                   onClick={() => setFilter(f)}
                   className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                     filter === f
                       ? f === 'buy' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                       : f === 'sell' ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                       : 'bg-white text-black'
                       : 'text-gray-500 hover:text-gray-300'
                   }`}
                 >
                   {f}
                 </button>
               ))}
            </div>
         </div>
      </div>

      {/* Ledger List */}
      <div className="px-6 pt-6 space-y-6">
         {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 opacity-30">
               <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center mb-6">
                  <FileText className="w-10 h-10 text-gray-500" />
               </div>
               <p className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Zero Activity Found</p>
            </div>
         ) : (
            <div className="space-y-5">
               {filtered.map(tx => {
                 const isBuy = tx.type === 'buy';
                 const Status = STATUS_MAP[tx.status as keyof typeof STATUS_MAP];
                 
                 return (
                   <div key={tx.id} className="group bg-[#161821] border border-white/5 rounded-[2rem] p-6 hover:border-white/10 transition-all cursor-pointer active:scale-[0.99] shadow-xl hover:shadow-2xl">
                      
                      <div className="flex items-center justify-between mb-5">
                         <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${isBuy ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                               {isBuy ? <ArrowDownLeft className="w-6 h-6 text-emerald-400 stroke-[2.5]" /> : <ArrowUpRight className="w-6 h-6 text-rose-400 stroke-[2.5]" />}
                            </div>
                            <div>
                               <p className="text-lg font-black text-white italic tracking-tighter leading-none">{isBuy ? 'PURCHASE' : 'SETTLEMENT'} · {tx.coin}</p>
                               <div className="flex items-center gap-2 mt-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${isBuy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${Status.color}`}>{tx.status}</span>
                               </div>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className={`text-xl font-black tabular-nums font-mono ${isBuy ? 'text-emerald-400' : 'text-white'}`}>{tx.amount} <span className="text-xs">{tx.coin}</span></p>
                            <p className="text-xs font-bold text-gray-500 tabular-nums font-mono mt-1 opacity-70">{tx.usd}</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-5 border-t border-white/5">
                         <div>
                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1.5">Quote Price</p>
                            <p className="text-[12px] font-black text-white font-mono">{tx.price}</p>
                         </div>
                         <div>
                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1.5">Network Fee</p>
                            <p className="text-[12px] font-black text-white font-mono">{tx.fee}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1.5">Timestamp</p>
                            <p className="text-[12px] font-black text-white font-mono opacity-80">{tx.date} · {tx.time}</p>
                         </div>
                      </div>
                      
                      <div className="mt-5 flex justify-between items-center bg-[#0b0c10] rounded-xl px-4 py-2 border border-white/5">
                         <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Hash / ID</span>
                         <span className="text-[11px] font-mono font-black text-blue-500 tracking-tighter">{tx.id}</span>
                      </div>
                   </div>
                 );
               })}
            </div>
         )}
      </div>
    </div>
  );
};

export default TransactionHistory;