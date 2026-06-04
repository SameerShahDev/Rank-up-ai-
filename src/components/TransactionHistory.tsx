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
      <div className="sticky top-0 z-20 bg-[#0b0c10]/80 backdrop-blur-xl border-b border-white/5 pt-4 pb-3 px-4 space-y-3 sm:pt-8 sm:pb-5 sm:px-6 sm:space-y-6">
         <div className="flex items-center justify-between">
            <h1 className="text-xl font-black tracking-tighter text-white sm:text-3xl">LEDGER <span className="text-blue-500 font-bold text-[10px] sm:text-sm ml-1.5 sm:ml-2 tracking-widest uppercase">Protocol 1.0</span></h1>
            <button className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/10 transition-all active:scale-95 shadow-lg sm:gap-2 sm:px-4 sm:py-2">
               <Download className="w-3.5 h-3.5 text-blue-400 sm:w-4 sm:h-4" />
               <span className="text-[9px] font-black text-white uppercase tracking-widest sm:text-[10px]">Export</span>
            </button>
         </div>

         {/* Search & Filter Controls */}
         <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
            <div className="relative flex-1 group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors sm:left-4" />
               <input 
                 type="text" 
                 placeholder="Search asset or tx id..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full bg-[#161821] border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all shadow-inner sm:py-3.5 sm:pl-12"
               />
            </div>
            <div className="flex bg-[#161821] border border-white/5 p-1.5 rounded-2xl shadow-inner self-start sm:self-stretch">
               {(['all', 'buy', 'sell'] as const).map(f => (
                 <button 
                   key={f} 
                   onClick={() => setFilter(f)}
                   className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all sm:flex-none sm:px-5 ${
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
      <div className="px-4 pt-4 space-y-3 sm:px-6 sm:pt-6 sm:space-y-6">
         {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30 sm:py-24">
               <div className="w-16 h-16 rounded-[2rem] bg-white/5 flex items-center justify-center mb-4 sm:w-20 sm:h-20 sm:mb-6">
                  <FileText className="w-8 h-8 text-gray-500 sm:w-10 sm:h-10" />
               </div>
               <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] sm:text-sm">Zero Activity Found</p>
            </div>
         ) : (
            <div className="space-y-3 sm:space-y-5">
               {filtered.map(tx => {
                 const isBuy = tx.type === 'buy';
                 const Status = STATUS_MAP[tx.status as keyof typeof STATUS_MAP];
                 
                 return (
                   <div key={tx.id} className="group bg-[#161821] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all cursor-pointer active:scale-[0.99] shadow-xl hover:shadow-2xl sm:rounded-[2rem] sm:p-6">
                      
                      <div className="flex items-center justify-between mb-3 sm:mb-5">
                         <div className="flex items-center gap-3 sm:gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 sm:w-12 sm:h-12 sm:rounded-2xl ${isBuy ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                               {isBuy ? <ArrowDownLeft className="w-5 h-5 text-emerald-400 stroke-[2.5] sm:w-6 sm:h-6" /> : <ArrowUpRight className="w-5 h-5 text-rose-400 stroke-[2.5] sm:w-6 sm:h-6" />}
                            </div>
                            <div>
                               <p className="text-sm font-black text-white tracking-tighter leading-none sm:text-lg">{isBuy ? 'PURCHASE' : 'SETTLEMENT'} · {tx.coin}</p>
                               <div className="flex items-center gap-1.5 mt-1.5 sm:gap-2 sm:mt-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${isBuy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  <span className={`text-[9px] font-black uppercase tracking-[0.15em] sm:text-[10px] ${Status.color}`}>{tx.status}</span>
                               </div>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className={`text-base font-black tabular-nums font-mono sm:text-xl ${isBuy ? 'text-emerald-400' : 'text-white'}`}>{tx.amount} <span className="text-[10px] sm:text-xs">{tx.coin}</span></p>
                            <p className="text-[10px] font-bold text-gray-500 tabular-nums font-mono mt-0.5 opacity-70 sm:text-xs sm:mt-1">{tx.usd}</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5 sm:gap-4 sm:pt-5">
                         <div>
                            <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1 sm:text-[9px] sm:mb-1.5">Quote Price</p>
                            <p className="text-[11px] font-black text-white font-mono sm:text-[12px]">{tx.price}</p>
                         </div>
                         <div>
                            <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1 sm:text-[9px] sm:mb-1.5">Fee</p>
                            <p className="text-[11px] font-black text-white font-mono sm:text-[12px]">{tx.fee}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1 sm:text-[9px] sm:mb-1.5">Time</p>
                            <p className="text-[11px] font-black text-white font-mono opacity-80 sm:text-[12px]">{tx.date} · {tx.time}</p>
                         </div>
                      </div>
                      
                      <div className="mt-3 flex justify-between items-center bg-[#0b0c10] rounded-lg px-3 py-1.5 border border-white/5 sm:mt-5 sm:rounded-xl sm:px-4 sm:py-2">
                         <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest sm:text-[9px]">Hash / ID</span>
                         <span className="text-[10px] font-mono font-black text-blue-500 tracking-tighter sm:text-[11px]">{tx.id}</span>
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