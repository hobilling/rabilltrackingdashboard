import React, { useState, useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip as ReTooltip } from 'recharts';
import { X, Plus, RotateCcw, CreditCard, Info, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InvoiceRecord } from '../../types';
import { AppContext } from '../../App';

interface ScorecardDef {
  id: string;
  title: string;
  fields: string[];
}

const ALL_AVAILABLE_FIELDS: string[] = [
  'Project',
  'Source',
  'Billing Eng Name',
  'Contractor Name',
  'Bill Type',
  'Inward Date',
  'Work Head',
  'LOCATION/Bldg.',
  'Bill Amount (Net Payble)',
  'Paid Amount',
  'Balance Payment',
  'Status',
  'Hold at Site',
  'Reason For Hold at Site',
  'Remark Site',
  'Excel RA Bill NO',
  'EXCEL Date',
  'Billing Period',
  'Highrise WO No',
  'Highrise RA No',
  'Highrise RA Date',
  'HO Submission Date',
  'Received at HO',
  'Certified at HO & Sent to Accounts on',
  'Hold at HO',
  'Reason For Hold at HO',
  'Remark HO',
  'Cheque Recd. At HO Date',
  'Cheque Recd. At Site Date',
  'Cheque No',
  'Paid Amount',
  'Remark',
  'Site Days',
  'HO Days',
  'Account Days',
  'Bill Process Days',
  'Inward to Payment Cycle Days',
  'Payment Status'
];

function getFieldCategory(field: string): 'amount' | 'days' | 'date' | 'categorical' {
  const f = field.toLowerCase();
  if (f.includes('days') || f.includes('cycle')) {
    return 'days';
  }
  if (f.includes('amount') || f.includes('payble') || (f.includes('payment') && !f.includes('status'))) {
    return 'amount';
  }
  if (f.includes('date')) {
    return 'date';
  }
  return 'categorical';
}

const formatRupees = (val: number) => {
  if (Math.abs(val) >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(val) >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)}`;
};

export default function InteractiveScorecards({ data }: { data: InvoiceRecord[] }) {
  const context = useContext(AppContext);
  // Scorecards State
  const [scorecards, setScorecards] = useState<ScorecardDef[]>([
    {
      id: 'amounts',
      title: 'Total Amounts',
      fields: ['Bill Amount (Net Payble)', 'Paid Amount', 'Balance Payment']
    },
    {
      id: 'tat',
      title: 'TAT Days',
      fields: ['Site Days', 'HO Days', 'Bill Process Days', 'Account Days', 'Inward to Payment Cycle Days']
    },
    {
      id: 'payments',
      title: 'Total Payments',
      fields: ['Payment Status']
    }
  ]);

  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  // Dialog State
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'add_fields'>('create');
  const [targetCardId, setTargetCardId] = useState<string>('');

  const removeCard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setScorecards(prev => prev.filter(c => c.id !== id));
  };

  const removeFieldFromCard = (cardId: string, fieldName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setScorecards(prev => prev.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          fields: c.fields.filter(f => f !== fieldName)
        };
      }
      return c;
    }));
  };

  const handleReset = () => {
    setScorecards([
      {
        id: 'amounts',
        title: 'Total Amounts',
        fields: ['Bill Amount (Net Payble)', 'Paid Amount', 'Balance Payment']
      },
      {
        id: 'tat',
        title: 'TAT Days',
        fields: ['Site Days', 'HO Days', 'Bill Process Days', 'Account Days', 'Inward to Payment Cycle Days']
      },
      {
        id: 'payments',
        title: 'Total Payments',
        fields: ['Payment Status']
      }
    ]);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim() || selectedFields.length === 0) return;

    const newId = `custom-${Date.now()}`;
    const newCard: ScorecardDef = {
      id: newId,
      title: newCardTitle,
      fields: [...selectedFields]
    };

    setScorecards(prev => [...prev, newCard]);
    setNewCardTitle('');
    setSelectedFields([]);
    setIsAddMenuOpen(false);
  };

  const handleAddFields = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCardId || selectedFields.length === 0) return;

    setScorecards(prev => prev.map(c => {
      if (c.id === targetCardId) {
        const updatedFields = Array.from(new Set([...c.fields, ...selectedFields]));
        return { ...c, fields: updatedFields };
      }
      return c;
    }));

    setSelectedFields([]);
    setIsAddMenuOpen(false);
  };

  const toggleFieldSelect = (field: string) => {
    setSelectedFields(prev => 
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const filteredFieldList = ALL_AVAILABLE_FIELDS.filter(f => 
    f.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  return (
    <div className="w-full select-none font-sans mb-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2" style={{ backgroundColor: '#f8fafc', height: '94px', marginTop: '3px' }}>
        <AnimatePresence mode="popLayout">
          {scorecards.map((card, idx) => {
            const isTATCard = card.id === 'tat' || card.title.toLowerCase().includes('tat');
            const isAmountsCard = card.id === 'amounts' || card.title.toLowerCase().includes('amounts');
            const isPaymentsCard = card.id === 'payments' || card.title.toLowerCase().includes('payments');

            // TAT Calc values
            let t_site = '0.0';
            let t_ho = '0.0';
            let t_proc = '0.0';
            let t_acc = '0.0';
            let t_cycle = '0.0';

            if (isTATCard) {
              const vSite = data.map(item => item['Site Days']).filter(v => v !== null && v !== undefined && !isNaN(Number(v))) as number[];
              const vHO = data.map(item => item['HO Days']).filter(v => v !== null && v !== undefined && !isNaN(Number(v))) as number[];
              const vProc = data.map(item => item['Bill Process Days']).filter(v => v !== null && v !== undefined && !isNaN(Number(v))) as number[];
              const vAcc = data.map(item => item['Account Days']).filter(v => v !== null && v !== undefined && !isNaN(Number(v))) as number[];
              const vCycle = data.map(item => item['Inward to Payment Cycle Days']).filter(v => v !== null && v !== undefined && !isNaN(Number(v))) as number[];

              t_site = vSite.length ? (vSite.reduce((a, b) => a + Number(b), 0) / vSite.length).toFixed(1) : '0.0';
              t_ho = vHO.length ? (vHO.reduce((a, b) => a + Number(b), 0) / vHO.length).toFixed(1) : '0.0';
              t_proc = vProc.length ? (vProc.reduce((a, b) => a + Number(b), 0) / vProc.length).toFixed(1) : '0.0';
              t_acc = vAcc.length ? (vAcc.reduce((a, b) => a + Number(b), 0) / vAcc.length).toFixed(1) : '0.0';
              t_cycle = vCycle.length ? (vCycle.reduce((a, b) => a + Number(b), 0) / vCycle.length).toFixed(1) : '0.0';
            }

            // Calculate targets and variances
            const targets = context?.targets || { site: 5, ho: 1.5, accounts: 6 };
            const targetSite = targets.site;
            const targetHo = targets.ho;
            const targetProc = targets.site + targets.ho;
            const targetAcc = targets.accounts;
            const targetCycle = targets.site + targets.ho + targets.accounts;

            const diffSite = Number(t_site) - targetSite;
            const dStrSite = diffSite > 0 ? `+${diffSite.toFixed(1)} days` : `${diffSite.toFixed(1)} days`;
            const colSite = diffSite > 0 ? 'text-red-500' : 'text-blue-500';

            const diffHo = Number(t_ho) - targetHo;
            const dStrHo = diffHo > 0 ? `+${diffHo.toFixed(1)} days` : `${diffHo.toFixed(1)} days`;
            const colHo = diffHo > 0 ? 'text-red-500' : 'text-blue-500';

            const diffProc = Number(t_proc) - targetProc;
            const dStrProc = diffProc > 0 ? `+${diffProc.toFixed(1)} days` : `${diffProc.toFixed(1)} days`;
            const colProc = diffProc > 0 ? 'text-red-500' : 'text-blue-500';

            const diffAcc = Number(t_acc) - targetAcc;
            const dStrAcc = diffAcc > 0 ? `+${diffAcc.toFixed(1)} days` : `${diffAcc.toFixed(1)} days`;
            const colAcc = diffAcc > 0 ? 'text-red-500' : 'text-blue-500';

            const diffCycle = Number(t_cycle) - targetCycle;
            const dStrCycle = diffCycle > 0 ? `+${diffCycle.toFixed(1)} days` : `${diffCycle.toFixed(1)} days`;
            const colCycle = diffCycle > 0 ? 'text-red-500' : 'text-blue-500';

            // Amounts Calc values
            let amt_net = 0;
            let amt_paid = 0;
            let amt_bal = 0;
            let pct_paid = 0;
            let pct_bal = 0;
            let amt_net_count = 0;
            let amt_paid_count = 0;
            let amt_bal_count = 0;

            if (isAmountsCard) {
              amt_net = data.reduce((acc, i) => acc + Number(i['Bill Amount (Net Payble)'] || 0), 0);
              amt_paid = data.reduce((acc, i) => acc + Number(i['Paid Amount'] || 0), 0);
              amt_bal = data.reduce((acc, i) => acc + Number(i['Balance Payment'] || 0), 0);
              
              amt_net_count = data.length;
              amt_paid_count = data.filter(i => Number(i['Paid Amount'] || 0) > 0).length;
              amt_bal_count = data.filter(i => Number(i['Balance Payment'] || 0) > 0).length;

              pct_paid = amt_net > 0 ? (amt_paid / amt_net) * 100 : 0;
              pct_bal = amt_net > 0 ? (amt_bal / amt_net) * 100 : 0;
            }

            // Payments exact user calculations
            const pay_cleared_sum = data.filter(i => i['Payment Status'] === 'Payment Cleared').reduce((sum, i) => sum + Number(i['Paid Amount'] || 0), 0);
            
            const partial_done_sum = data.filter(i => i['Payment Status'] === 'Partial Payment Balance').reduce((sum, i) => sum + Number(i['Paid Amount'] || 0), 0);
            const partial_bal_sum = data.filter(i => i['Payment Status'] === 'Partial Payment Balance').reduce((sum, i) => sum + Number(i['Balance Payment'] || 0), 0);
            
            const pay_bal_sum = data.filter(i => i['Payment Status'] === 'Payment Balance').reduce((sum, i) => sum + Number(i['Balance Payment'] || 0), 0);

            // Counts of bills
            const pay_total = data.length;
            const pay_cleared_count = data.filter(i => i['Payment Status'] === 'Payment Cleared').length;
            const pay_balance_count = data.filter(i => i['Payment Status'] === 'Payment Balance').length;
            const pay_partial_count = data.filter(i => i['Payment Status'] === 'Partial Payment Balance').length;

            return (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                style={undefined}
                className="relative h-[98px] cursor-pointer perspective-1000"
                onPointerEnter={(e) => {
                  if (e.pointerType === 'touch') return;
                  setFlippedCards(p => ({ ...p, [card.id]: true }));
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'touch') return;
                  setFlippedCards(p => ({ ...p, [card.id]: false }));
                }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  setFlippedCards(p => ({ ...p, [card.id]: !p[card.id] }));
                }}
              >
                {/* 3D Flippable card body */}
                <div className={`relative w-full h-full duration-500 transform-style-3d ${flippedCards[card.id] ? 'rotate-y-180' : ''}`}>
                  
                  {/* FRONT SIDE (No header borders) */}
                  <div className={`absolute inset-0 backface-hidden bg-slate-50 border rounded-xl py-1.5 px-[15px] shadow-xs flex flex-col justify-between transition-colors duration-300 ${flippedCards[card.id] ? 'border-blue-400' : 'border-slate-200'}`}>
                    <div className="flex-1 flex flex-col min-h-0">

                      {/* FRONT CARD CONTENTS */}
                      <div className="flex-1 min-h-0 flex flex-col justify-center">
                        {isAmountsCard ? (
                          /* REFINE AMOUNT CARD VISUALS: Shows "Bill Amount is Paid + Balance" visually with Stacked volume bar */
                          <div className="space-y-1 pt-0">
                            <div>
                              <div className="flex justify-between items-end leading-none mb-1">
                                <span className="text-[10px] text-blue-900 uppercase font-medium tracking-wide">Bill Amount</span>
                                <div className="flex items-baseline gap-0.5">
                                  <span className="text-[15.5px] font-semibold tracking-tight text-blue-950">
                                    {formatRupees(amt_net)}
                                  </span>
                                  <span className="text-[9px] text-blue-800 font-normal">({amt_net_count} Bills)</span>
                                </div>
                              </div>

                              {/* Proportional dynamic fill stacked bar */}
                              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden flex my-1.5">
                                <div 
                                  className="bg-emerald-500 h-full transition-all duration-500" 
                                  style={{ width: `${pct_paid}%` }} 
                                />
                                <div 
                                  className="bg-amber-500 h-full transition-all duration-500" 
                                  style={{ width: `${pct_bal}%` }} 
                                />
                              </div>

                              {/* Paid & Balance with percentage & bill count below */}
                              <div className="grid grid-cols-2 gap-1 pt-1">
                                <div>
                                  <span className="text-[10.5px] text-emerald-950 uppercase font-medium tracking-tight leading-none mb-0.5 block">Paid Amount</span>
                                  <div className="text-[14.5px] font-semibold text-emerald-700 leading-none">{formatRupees(amt_paid)}</div>
                                  <span className="text-[9px] text-emerald-800 font-normal leading-none mt-0.5 block">
                                    ({pct_paid.toFixed(1)}%) ({amt_paid_count} Bills)
                                  </span>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="text-[10.5px] text-amber-950 uppercase font-medium tracking-tight leading-none mb-0.5 block">Balance Amount</span>
                                  <div className="text-[14.5px] font-semibold text-amber-700 leading-none">{formatRupees(amt_bal)}</div>
                                  <span className="text-[9px] text-amber-800 font-normal leading-none mt-0.5 block">
                                    ({pct_bal.toFixed(1)}%) ({amt_bal_count} Bills)
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : isTATCard ? (
                          /* TAT VISUAL CHANNELS ON FRONT: Vertically centered visual timeline */
                          <div className="flex flex-col w-full h-full select-none justify-center animate-in fade-in duration-300 py-0.5 px-0.5">
                            {/* Horizontal timeline chart tightly boxed and centered */}
                            <div className="relative h-[68px] w-full flex flex-col justify-center mt-2">
                              {/* Horizontal Connecting Track at center exactly. track thickness is 2px, centered around 34px (center of 68px) */}
                              <div className="absolute top-[34px] left-[12.5%] right-[12.5%] h-0.5 bg-blue-105 rounded-full" />
                              
                              {/* Progress Track up to Accounts */}
                              <div className="absolute top-[34px] left-[12.5%] right-[12.5%] h-0.5 bg-blue-500 rounded-full" />

                              {/* Connection Line Labels placed directly above the line. Bottom of labels touches the track at 34px */}
                              <div className="absolute top-[0px] left-[12.5%] w-[25%] text-center flex flex-col justify-end h-[32px] pb-[1px]">
                                <span className="text-[9.5px] font-semibold text-black uppercase tracking-tight leading-none">site process</span>
                                <span className="text-[11px] font-medium text-slate-800 leading-none mt-[2px]">{t_site} days</span>
                                <span className="text-[8px] text-slate-400 leading-none mt-[2px]">target {targetSite} days</span>
                                <span className={`text-[8.5px] font-semibold ${colSite} leading-none mt-1`}>
                                  {diffSite > 0 ? `+${diffSite.toFixed(1)} days` : `${diffSite.toFixed(1)} days`}
                                </span>
                              </div>

                              <div className="absolute top-[0px] left-[37.5%] w-[25%] text-center flex flex-col justify-end h-[32px] pb-[1px]">
                                <span className="text-[9.5px] font-semibold text-black uppercase tracking-tight leading-none">HO process</span>
                                <span className="text-[11px] font-medium text-slate-800 leading-none mt-[2px]">{t_ho} days</span>
                                <span className="text-[8px] text-slate-400 leading-none mt-[2px]">target {targetHo} days</span>
                                <span className={`text-[8.5px] font-semibold ${colHo} leading-none mt-1`}>
                                  {diffHo > 0 ? `+${diffHo.toFixed(1)} days` : `${diffHo.toFixed(1)} days`}
                                </span>
                              </div>

                              <div className="absolute top-[0px] left-[62.5%] w-[25%] text-center flex flex-col justify-end h-[32px] pb-[1px]">
                                <span className="text-[9.5px] font-semibold text-black uppercase tracking-tight leading-none">Account Process</span>
                                <span className="text-[11px] font-medium text-slate-800 leading-none mt-[2px]">{t_acc} days</span>
                                <span className="text-[8px] text-slate-400 leading-none mt-[2px]">target {targetAcc} days</span>
                                <span className={`text-[8.5px] font-semibold ${colAcc} leading-none mt-1`}>
                                  {diffAcc > 0 ? `+${diffAcc.toFixed(1)} days` : `${diffAcc.toFixed(1)} days`}
                                </span>
                              </div>

                              <div className="grid grid-cols-4 relative z-10 text-center w-full">
                                {/* Step 1: Inward at Site */}
                                <div className="flex flex-col items-center justify-start h-full pt-[26px]">
                                  <div className="w-[18px] h-[18px] rounded-full bg-blue-600 border border-white flex items-center justify-center text-white text-[9px] font-semibold shadow-xs">
                                    S
                                  </div>
                                  <span className="text-[7.5px] font-semibold text-slate-650 uppercase mt-[3px] leading-none block">Inward</span>
                                  <span style={{ color: '#b3bac8' }} className="text-[7px] font-normal mt-[2px] leading-none block">at 0 days</span>
                                </div>

                                {/* Step 2: HO Recd */}
                                <div className="flex flex-col items-center justify-start h-full pt-[26px]">
                                  <div className="w-[18px] h-[18px] rounded-full bg-slate-600 border border-white flex items-center justify-center text-white text-[9px] font-semibold shadow-xs">
                                    H
                                  </div>
                                  <span className="text-[7.5px] font-semibold text-slate-650 uppercase mt-[3px] leading-none block">HO Recd</span>
                                  <span style={{ color: '#b3bac8' }} className="text-[7px] font-normal mt-[2px] leading-none block">at {t_site} days</span>
                                </div>

                                {/* Step 3: Sent to Accounts */}
                                <div className="flex flex-col items-center justify-start h-full pt-[26px]">
                                  <div className="w-[18px] h-[18px] rounded-full bg-indigo-600 border border-white flex items-center justify-center text-white text-[9px] font-semibold shadow-xs">
                                    A
                                  </div>
                                  <span className="text-[7.5px] font-semibold text-slate-650 uppercase mt-[3px] leading-none block">Account Recd</span>
                                  <span style={{ color: '#b3bac8' }} className="text-[7px] font-normal mt-[2px] leading-none block">at {t_proc} days</span>
                                </div>

                                {/* Step 4: Disbursed / Cleared */}
                                <div className="flex flex-col items-center justify-start h-full pt-[26px]">
                                  <div className="w-[18px] h-[18px] rounded-full bg-blue-100 border border-blue-600 flex items-center justify-center text-blue-800 text-[10px] font-bold shadow-xs">
                                    ✓
                                  </div>
                                  <span className="text-[7.5px] font-semibold text-slate-650 uppercase mt-[3px] leading-none block">Payment</span>
                                  <span style={{ color: '#b3bac8' }} className="text-[7px] font-normal mt-[2px] leading-none block">at {t_cycle} days</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : isPaymentsCard ? (
                          /* PAYMENTS FRONT REVISED VENN CIRCLES: 3 circles side-by-side touching edges */
                          <div className="flex flex-col h-full justify-between py-1 select-none">
                            {/* 3 Circles Visual depiction */}
                            <div className="w-full flex-1 flex items-center justify-center my-0 relative">
                              {/* Open Space Totals Left / Right */}
                              <div className="absolute -top-[2px] left-[2px] text-left text-[9px] text-slate-700 leading-tight bg-white/60 px-1 py-0.5 rounded border border-slate-100 backdrop-blur-sm z-30 font-medium shadow-xs">
                                <div className="text-emerald-700 font-semibold">Total Paid</div>
                                <div className="font-bold text-[10.5px] text-emerald-950 font-sans tracking-tight">{formatRupees(pay_cleared_sum + partial_done_sum)}</div>
                              </div>
                              <div className="absolute -top-[2px] right-[2px] text-right text-[9px] text-slate-700 leading-tight bg-white/60 px-1 py-0.5 rounded border border-slate-100 backdrop-blur-sm z-30 font-medium shadow-xs">
                                <div className="text-amber-700 font-semibold font-sans">Total Bal</div>
                                <div className="font-bold text-[10.5px] text-amber-950 font-sans tracking-tight">{formatRupees(pay_bal_sum + partial_bal_sum)}</div>
                              </div>

                              {/* Left Circle - Payment Cleared */}
                              <motion.div 
                                className="relative w-[82px] h-[82px] rounded-full bg-emerald-500/10 border border-emerald-500/50 flex flex-col justify-center items-center text-center shrink-0 -mr-[1px] z-10 overflow-hidden cursor-pointer shadow-xs select-none"
                                whileHover={{ scale: 1.12, rotate: -4, zIndex: 30 }}
                                whileTap={{ scale: 0.95 }}
                                animate={{
                                  scale: [1, 1.04, 1],
                                }}
                                transition={{
                                  scale: {
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }
                                }}
                              >
                                {/* Spinning decorative outer dashed ring */}
                                <motion.div 
                                  className="absolute inset-0 rounded-full border border-dashed border-emerald-500/30"
                                  animate={{ rotate: -360 }}
                                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                />
                                <span className="relative z-10 text-[10px] font-bold uppercase text-emerald-800 leading-none mt-2">Paid</span>
                                <span className="relative z-10 text-[13px] font-bold text-emerald-950 mt-[3px] leading-none tracking-tight">{formatRupees(pay_cleared_sum)}</span>
                                <span className="relative z-10 text-[8px] text-emerald-700/80 mt-[3px] leading-none">({pay_cleared_count} bills)</span>
                              </motion.div>

                              {/* Center Circle - Partial */}
                              <motion.div 
                                className="relative w-[86px] h-[86px] rounded-full border border-blue-300 shadow-sm overflow-hidden flex flex-col justify-center items-center shrink-0 z-20 cursor-pointer select-none"
                                whileHover={{ scale: 1.14, rotate: 6, zIndex: 35 }}
                                whileTap={{ scale: 0.95 }}
                                animate={{
                                  scale: [1, 1.05, 1],
                                }}
                                transition={{
                                  scale: {
                                    duration: 2.6,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }
                                }}
                              >
                                {/* Spinning decorative outer dashed ring */}
                                <motion.div 
                                  className="absolute inset-0 rounded-full border-2 border-dashed border-blue-500/10 z-0"
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                                />
                                {/* Vertically split halves within the circle */}
                                <div className="absolute inset-0 flex z-0">
                                  <div className="w-1/2 h-full bg-emerald-500/10" />
                                  <div className="w-1/2 h-full bg-amber-500/10" />
                                </div>
                                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full pt-[2px]">
                                  <span className="text-[8.5px] font-bold uppercase text-slate-800 leading-none bg-white/80 px-[6px] py-[3px] rounded-full shadow-xs backdrop-blur-md mb-[5px]">Partial</span>
                                  
                                  <div className="flex w-full px-[3px] justify-between items-center leading-[1.2] font-medium text-slate-900 mt-[2px]">
                                    <div className="w-1/2 flex flex-col items-center">
                                      <span className="text-[8.5px] text-emerald-900 font-bold leading-none">Paid</span>
                                      <span className="text-[9.5px] text-emerald-950 font-bold tracking-tighter mt-[2px]">{formatRupees(partial_done_sum)}</span>
                                    </div>
                                    <div className="w-1/2 flex flex-col items-center">
                                      <span className="text-[8.5px] text-amber-900 font-bold leading-none">Bal</span>
                                      <span className="text-[9.5px] text-amber-950 font-bold tracking-tighter mt-[2px]">{formatRupees(partial_bal_sum)}</span>
                                    </div>
                                  </div>
                                  
                                  <span className="text-[7.5px] text-slate-700 font-semibold leading-none mt-[5px] bg-white/80 px-[6px] py-[3px] rounded-full shadow-xs backdrop-blur-md">({pay_partial_count} bills)</span>
                                </div>
                              </motion.div>

                              {/* Right Circle - Payment Balance */}
                              <motion.div 
                                className="relative w-[82px] h-[82px] rounded-full bg-amber-500/10 border border-amber-500/50 flex flex-col justify-center items-center text-center shrink-0 -ml-[1px] z-10 overflow-hidden cursor-pointer shadow-xs select-none"
                                whileHover={{ scale: 1.12, rotate: 4, zIndex: 30 }}
                                whileTap={{ scale: 0.95 }}
                                animate={{
                                  scale: [1, 1.04, 1],
                                }}
                                transition={{
                                  scale: {
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }
                                }}
                              >
                                {/* Spinning decorative outer dashed ring */}
                                <motion.div 
                                  className="absolute inset-0 rounded-full border border-dashed border-amber-500/30"
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                />
                                <span className="relative z-10 text-[10px] font-bold uppercase text-amber-800 leading-none font-sans mt-2">Balance</span>
                                <span className="relative z-10 text-[13px] font-bold text-amber-950 mt-[3px] leading-none tracking-tight">{formatRupees(pay_bal_sum)}</span>
                                <span className="relative z-10 text-[8px] text-amber-700/80 mt-[3px] leading-none font-sans">({pay_balance_count} bills)</span>
                              </motion.div>
                            </div>
                          </div>
                        ) : (
                          /* CUSTOM CARDS VIEW */
                          <div className="space-y-2 mt-0.5">
                            {card.fields.length === 0 ? (
                              <div className="text-center py-10 text-slate-400 text-[10px] italic font-medium">No fields configured. Drag/Drop or Add fields.</div>
                            ) : (
                              card.fields.map(field => {
                                const category = getFieldCategory(field);

                                if (field === 'Payment Status') {
                                  const statusVals: Record<string, { count: number; sum: number }> = {};
                                  data.forEach(item => {
                                    const s = String(item['Payment Status'] || 'Unspecified');
                                    if (!statusVals[s]) statusVals[s] = { count: 0, sum: 0 };
                                    statusVals[s].count++;
                                    statusVals[s].sum += Number(item['Bill Amount (Net Payble)'] || 0);
                                  });

                                  return (
                                    <div key={field} className="space-y-1">
                                      <div className="text-[8.5px] font-medium uppercase text-blue-800 tracking-wider flex justify-between">
                                        <span>Payment Status</span>
                                        <button 
                                          onClick={(e) => removeFieldFromCard(card.id, field, e)}
                                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 rounded cursor-pointer font-medium uppercase transition-opacity"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                      <div className="space-y-1">
                                        {Object.entries(statusVals).map(([v, info]) => (
                                          <div key={v} className="flex justify-between items-center text-[10.5px] font-medium text-slate-700 leading-tight">
                                            <span className="text-slate-650 truncate max-w-[130px]">{v}</span>
                                            <div className="text-slate-900 flex items-center gap-1 font-medium">
                                              <span>{formatRupees(info.sum)}</span>
                                              <span className="text-slate-400 text-[9px] font-normal">({info.count} Bills)</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }

                                if (category === 'categorical') {
                                  const uniqueVals = new Set(data.map(item => String(item[field as keyof InvoiceRecord] || '')).filter(Boolean));
                                  const totalCount = data.filter(item => !!item[field as keyof InvoiceRecord]).length;
                                  const breakMap: Record<string, number> = {};
                                  data.forEach(item => {
                                    const v = String(item[field as keyof InvoiceRecord] || 'N/A');
                                    breakMap[v] = (breakMap[v] || 0) + 1;
                                  });
                                  const sorted = Object.entries(breakMap).sort((a,b) => b[1] - a[1]);
                                  
                                  // Show all unique values instead of restricting to top 3
                                  const topList = sorted;

                                  return (
                                    <div key={field} className="py-1 group/field flex flex-col border-b border-slate-100/55 last:border-0 pb-1.5 mb-1 bg-white p-1.5 rounded-md border border-slate-150">
                                      <div className="flex justify-between items-center text-[10px] font-medium text-slate-800 leading-none">
                                        <span className="truncate max-w-[120px] tracking-tight" title={field}>{field}</span>
                                        <div className="flex items-center gap-1 shrink-0 text-slate-400">
                                          <span className="text-blue-700 font-medium text-[9.5px]">{uniqueVals.size} Unique</span>
                                          <span className="text-[8.5px] font-normal">({totalCount} Bills)</span>
                                          <button 
                                            onClick={(e) => removeFieldFromCard(card.id, field, e)}
                                            className="opacity-0 group-hover/field:opacity-100 text-slate-400 hover:text-red-500 rounded cursor-pointer font-medium"
                                            title={`Remove ${field}`}
                                          >
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* String field list representation - all items scrollable */}
                                      <div className="space-y-0.5 mt-1 max-h-[140px] overflow-y-auto custom-scrollbar pr-0.5">
                                        {topList.map(([val, count]) => {
                                          const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                                          return (
                                            <div key={val} className="flex justify-between items-center text-[9px] font-normal text-slate-600 leading-tight border-b border-slate-50/50 last:border-0 py-0.5">
                                              <span className="truncate max-w-[145px] hover:text-slate-950" title={val}>"{val}"</span>
                                              <span className="text-slate-900 shrink-0 font-medium">{count} <span className="text-[8px] text-slate-400">({pct.toFixed(0)}%)</span></span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }

                                if (category === 'amount') {
                                  const vals = data.map(item => Number(item[field as keyof InvoiceRecord] || 0));
                                  const sum = vals.reduce((a, b) => a + b, 0);
                                  const counts = data.length;

                                  return (
                                    <div key={field} className="py-1.5 group/field flex justify-between items-center text-[10.5px] font-medium text-slate-700 leading-tight border-b border-slate-100/50 last:border-0">
                                      <span className="text-slate-500 truncate max-w-[140px] font-medium" title={field}>{field}</span>
                                      <div className="flex items-center gap-1 text-slate-900 shrink-0">
                                        <span>{formatRupees(sum)}</span>
                                        <span className="text-slate-450 text-[9px] font-normal">({counts} Bills)</span>
                                        <button 
                                          onClick={(e) => removeFieldFromCard(card.id, field, e)}
                                          className="opacity-0 group-hover/field:opacity-100 p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                                          title={`Remove ${field}`}
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }

                                if (category === 'days') {
                                  const validVals = data
                                    .map(item => item[field as keyof InvoiceRecord])
                                    .filter(v => v !== null && v !== undefined && !isNaN(Number(v))) as number[];
                                  const avg = validVals.length ? validVals.reduce((a, b) => a + Number(b), 0) / validVals.length : 0;

                                  return (
                                    <div key={field} className="py-1.5 group/field flex justify-between items-center text-[10.5px] font-medium text-slate-700 leading-tight border-b border-slate-100/50 last:border-0">
                                      <span className="text-slate-500 truncate max-w-[140px] font-medium" title={field}>{field}</span>
                                      <div className="flex items-center gap-1 text-slate-900 shrink-0">
                                        <span>{avg.toFixed(1)} Days</span>
                                        <span className="text-slate-450 text-[9px] font-normal">({validVals.length} Bills)</span>
                                        <button 
                                          onClick={(e) => removeFieldFromCard(card.id, field, e)}
                                          className="opacity-0 group-hover/field:opacity-100 p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                                          title={`Remove ${field}`}
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }

                                const cVal = data.filter(item => !!item[field as keyof InvoiceRecord]).length;
                                return (
                                  <div key={field} className="py-1.5 group/field flex justify-between items-center text-[10.5px] font-medium text-slate-700 leading-tight border-b border-slate-100/50 last:border-0">
                                    <span className="text-slate-500 truncate max-w-[140px] font-medium" title={field}>{field}</span>
                                    <div className="flex items-center gap-1 text-slate-900 shrink-0">
                                      <span>{cVal} entries</span>
                                      <button 
                                        onClick={(e) => removeFieldFromCard(card.id, field, e)}
                                        className="opacity-0 group-hover/field:opacity-100 p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                                        title={`Remove ${field}`}
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BACK SIDE (Drawn on mouseover) */}
                  <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex flex-col justify-between transition-colors duration-300">
                    <div className="flex-1 flex flex-col min-h-0">
                      
                      {/* Custom Visualizations based on card type on hover */}
                      <div className="flex-1 w-full min-h-0 overflow-hidden">
                        {isTATCard ? (
                          /* TAT BACK TABULAR/FORMULAS: Clean list format without separate styled boxes */
                          <div className="flex flex-col select-none text-slate-900 py-0 px-1 font-normal h-full justify-evenly pt-[1px]">
                            {/* Site Process and HO Process in Top Line */}
                            <div className="grid grid-cols-2 gap-1 m-[1px]">
                              <div className="flex flex-col leading-none">
                                <span className="text-[9.5px] font-medium text-slate-705 mb-[1px]">Site Process</span>
                                <span className="text-[10px] font-medium text-indigo-950 flex flex-col gap-0">
                                  <span>{t_site} days <span className={`text-[8.5px] font-semibold ${colSite}`}>({dStrSite})</span></span>
                                  <span className="text-[7.5px] font-normal text-slate-400">target {targetSite} days</span>
                                </span>
                              </div>
                              <div className="flex flex-col leading-none items-end text-right">
                                <span className="text-[9.5px] font-medium text-slate-705 mb-[1px]">HO Process</span>
                                <span className="text-[10px] font-medium text-indigo-950 flex flex-col items-end gap-0">
                                  <span>{t_ho} days <span className={`text-[8.5px] font-semibold ${colHo}`}>({dStrHo})</span></span>
                                  <span className="text-[7.5px] font-normal text-slate-400">target {targetHo} days</span>
                                </span>
                              </div>
                            </div>

                            <div className="border-t border-slate-200/40 my-[1px]" />

                            {/* Bill Process Days */}
                            <div className="flex justify-between items-center leading-none">
                              <span className="text-[10px] font-normal text-slate-705">
                                Bill Process <span className="text-[8px] font-normal text-slate-400 font-mono tracking-tighter">(Site+HO)</span>
                              </span>
                              <span className="text-[10.5px] font-normal text-blue-900 flex items-center gap-0.5">
                                {t_proc} days <span className={`text-[9px] font-semibold ${colProc}`}>({dStrProc})</span> <span className="text-[8px] font-normal text-slate-400 ml-1">target {targetProc} days</span>
                              </span>
                            </div>

                            <div className="border-t border-slate-200/40 my-[1px]" />

                            {/* Account Days */}
                            <div className="flex justify-between items-center leading-none">
                              <span className="text-[10px] font-normal text-slate-705">Account Process</span>
                              <span className="text-[10.5px] font-normal text-indigo-900 flex items-center gap-0.5">
                                {t_acc} days <span className={`text-[9px] font-semibold ${colAcc}`}>({dStrAcc})</span> <span className="text-[8px] font-normal text-slate-400 ml-1">target {targetAcc} days</span>
                              </span>
                            </div>

                            <div className="border-t border-slate-200/40 my-[1px]" />

                            {/* Inward to Payment cycle */}
                            <div className="flex justify-between items-center leading-none mt-0">
                              <span className="text-[10px] font-normal text-slate-705 flex flex-col gap-[1px]">
                                <span>Inward to payment cycle</span>
                                <span className="text-[7.5px] font-normal text-slate-400 font-mono tracking-tighter">(Bill Process + Account Process)</span>
                              </span>
                              <span className="text-[11px] font-normal text-indigo-950 flex flex-col items-end gap-[1px]">
                                <span>{t_cycle} days <span className={`text-[9px] font-semibold ${colCycle}`}>({dStrCycle})</span></span>
                                <span className="text-[8px] font-normal text-slate-400">target {targetCycle} days</span>
                              </span>
                            </div>
                          </div>
                        ) : isAmountsCard ? (() => {
                          const chartData = [
                            { name: 'Bill Amount', value: amt_net, fill: '#3b82f6' },
                            { name: 'Paid Amount', value: amt_paid, fill: '#10b981' },
                            { name: 'Balance Amount', value: amt_bal, fill: '#f59e0b' }
                          ];
                          return (
                            <div className="flex flex-col h-full justify-between select-none animate-in fade-in duration-300 py-0.5">
                              {/* Short Responsive Column Chart */}
                              <div className="flex-1 w-full mt-0.5 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                                    <XAxis dataKey="name" fontSize={7.5} axisLine={false} tickLine={false} tick={{ fill: '#0f172a', fontWeight: 'normal' }} />
                                    <YAxis hide />
                                    <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={26}>
                                      {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          );
                        })() : isPaymentsCard ? (
                          /* PAYMENTS EFFICIENCY BACK DETAILS */
                          <div className="flex flex-col select-none text-slate-900 py-[2px] px-1 font-normal h-full justify-between">
                            {/* Detailed breakdown per User requirements */}
                            <div className="flex flex-col justify-evenly h-full mt-0 text-[10px] text-slate-700">
                              <div className="flex justify-between items-center leading-none">
                                <span className="font-semibold text-emerald-800">1. Payment Cleared</span>
                                <span className="text-emerald-700 font-bold text-[11px]">{formatRupees(pay_cleared_sum)} <span className="text-slate-400 font-normal text-[8.5px]">({pay_cleared_count} bills)</span></span>
                              </div>
                              
                              <div className="border-t border-slate-200/40 my-[1px]" />

                              <div className="flex justify-between items-center leading-none">
                                <span className="font-semibold text-blue-800">2. Partial Payment</span>
                                <span className="text-slate-900 font-normal flex flex-col items-end gap-[1px]">
                                  <span><span className="text-slate-500 font-normal text-[8.5px]">Paid:</span> <span className="text-emerald-700 font-bold text-[11px]">{formatRupees(partial_done_sum)}</span></span>
                                  <span><span className="text-slate-500 font-normal text-[8.5px]">Bal:</span> <span className="text-amber-700 font-bold text-[11px]">{formatRupees(partial_bal_sum)}</span></span>
                                </span>
                              </div>

                              <div className="border-t border-slate-200/40 my-[1px]" />

                              <div className="flex justify-between items-center leading-none">
                                <span className="font-semibold text-red-800">3. Payment Balance</span>
                                <span className="text-red-700 font-bold text-[11px]">{formatRupees(pay_bal_sum)} <span className="text-slate-400 font-normal text-[8.5px]">({pay_balance_count} bills)</span></span>
                              </div>
                            </div>

                            <div className="bg-slate-50/85 p-[4px] px-2 rounded border border-blue-100 text-[9px] text-center font-normal text-slate-700 uppercase flex justify-between mt-0.5 leading-none shrink-0 mb-[1px]">
                              <span>Sum Paid: <span className="text-emerald-700 font-bold text-[10px]">{formatRupees(pay_cleared_sum + partial_done_sum)}</span></span>
                              <span>Sum Bal: <span className="text-amber-700 font-bold text-[10px]">{formatRupees(pay_bal_sum + partial_bal_sum)}</span></span>
                            </div>
                          </div>
                        ) : (
                          /* CUSTOM BACK PANEL */
                          <div className="pt-0.5 text-[7.5px] space-y-0.5 select-none text-slate-700 font-normal">
                            <div className="text-blue-800 uppercase tracking-widest text-[6.5px] font-normal pb-0.5">Aggregation Summary</div>
                            {card.fields.map(f => {
                                const unique = new Set(data.map(item => String(item[f as keyof InvoiceRecord] || '')).filter(Boolean));
                                return (
                                  <div key={f} className="flex justify-between items-center py-0.5 border-b border-blue-100 last:border-0 font-normal text-[7.5px]">
                                    <span className="truncate max-w-[130px] font-normal">{f}</span>
                                    <span className="text-blue-900 font-normal">{unique.size} Unique</span>
                                  </div>
                                );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* DYNAMIC BACKDROP / CONFIG MENU */}
      <AnimatePresence>
        {isAddMenuOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-200">
            <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.95, opacity: 0 }}
               className="bg-white border border-gray-150 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col h-[520px]"
            >
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#1F2937]">Configure Scorecard</h4>
                </div>
                <button 
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setSelectedFields([]);
                    setNewCardTitle('');
                  }}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-2 border-b border-gray-100 shrink-0 bg-white">
                <button
                  className={`py-2 text-[10px] font-black uppercase tracking-widest text-center border-b-2 transition-all cursor-pointer ${activeTab === 'create' ? 'border-blue-600 text-blue-700 bg-blue-50/10' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  onClick={() => {
                    setActiveTab('create');
                    setSelectedFields([]);
                  }}
                >
                  Create New Card
                </button>
                <button
                  className={`py-2 text-[10px] font-black uppercase tracking-widest text-center border-b-2 transition-all cursor-pointer ${activeTab === 'add_fields' ? 'border-blue-600 text-blue-700 bg-blue-50/10' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  onClick={() => {
                    setActiveTab('add_fields');
                    setSelectedFields([]);
                    if (scorecards.length > 0) {
                      setTargetCardId(scorecards[0].id);
                    }
                  }}
                >
                  Add Fields to Existing
                </button>
              </div>

              {/* Config Form Content */}
              <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
                {activeTab === 'create' ? (
                  <div className="space-y-4">
                    <div className="space-y-1 bg-white">
                      <Label htmlFor="card-title" className="text-[10px] font-black uppercase tracking-wider text-gray-400">Card Title</Label>
                      <Input 
                        id="card-title"
                        placeholder="e.g. Inward Process, Site Holds"
                        className="text-[11px] font-bold h-9 border-gray-200 focus-visible:ring-blue-500 focus-visible:border-blue-500 rounded-lg"
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1 bg-white">
                      <Label htmlFor="target-card" className="text-[10px] font-black uppercase tracking-wider text-gray-400 font-bold">Select Scorecard</Label>
                      {scorecards.length === 0 ? (
                        <div className="text-[10px] italic text-red-500">No scorecards available. Create one first!</div>
                      ) : (
                        <select
                          id="target-card"
                          className="w-full border border-gray-200 rounded-lg p-2 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer bg-white"
                          value={targetCardId}
                          onChange={(e) => setTargetCardId(e.target.value)}
                        >
                          {scorecards.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {/* Field Selector */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 font-bold">
                      Select Fields ({selectedFields.length} Chosen)
                    </span>
                    <button 
                      type="button"
                      className="text-[9px] font-medium uppercase tracking-wider text-blue-600 hover:underline cursor-pointer"
                      onClick={() => {
                        if (selectedFields.length === ALL_AVAILABLE_FIELDS.length) {
                          setSelectedFields([]);
                        } else {
                          setSelectedFields([...ALL_AVAILABLE_FIELDS]);
                        }
                      }}
                    >
                      {selectedFields.length === ALL_AVAILABLE_FIELDS.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <Input 
                    placeholder="Search source fields..."
                    className="text-[11px] font-bold h-8 border-gray-200 focus-visible:ring-blue-500 rounded-lg"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                  />

                  {/* Fields list in adding new card */}
                  <div className="border border-gray-100 rounded-lg max-h-48 overflow-y-auto custom-scrollbar p-1.5 bg-gray-50 flex flex-col gap-1">
                    {filteredFieldList.map(field => {
                      const isSelected = selectedFields.includes(field);
                      const cat = getFieldCategory(field);
                      
                      let badge = '';
                      let badgeColor = '';
                      if (cat === 'amount') { badge = 'Amount'; badgeColor = 'bg-emerald-100 text-emerald-800'; }
                      else if (cat === 'days') { badge = 'Days'; badgeColor = 'bg-amber-100 text-amber-800'; }
                      else if (cat === 'date') { badge = 'Date'; badgeColor = 'bg-indigo-100 text-indigo-800'; }
                      else { badge = 'String'; badgeColor = 'bg-slate-200 text-slate-700'; }

                      return (
                        <div 
                          key={field}
                          onClick={() => toggleFieldSelect(field)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                        >
                          <span className={`text-[10.5px] font-bold ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>{field}</span>
                          <span className={`text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${badgeColor}`}>
                            {badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 shrink-0">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-9 font-bold text-[11px] uppercase tracking-wider rounded-lg text-gray-500"
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setSelectedFields([]);
                    setNewCardTitle('');
                  }}
                >
                  Cancel
                </Button>
                {activeTab === 'create' ? (
                  <Button 
                    variant="default" 
                    size="sm"
                    disabled={!newCardTitle.trim() || selectedFields.length === 0}
                    className="h-9 font-bold text-[11px] uppercase tracking-wider rounded-lg bg-blue-600 hover:bg-blue-700"
                    onClick={handleCreateCard}
                  >
                    Create Card
                  </Button>
                ) : (
                  <Button 
                    variant="default" 
                    size="sm"
                    disabled={!targetCardId || selectedFields.length === 0}
                    className="h-9 font-bold text-[11px] uppercase tracking-wider rounded-lg bg-blue-600 hover:bg-blue-700"
                    onClick={handleAddFields}
                  >
                    Add Fields
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
