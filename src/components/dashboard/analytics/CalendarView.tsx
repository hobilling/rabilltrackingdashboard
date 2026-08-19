import React, { useMemo, useState } from "react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  addDays, 
  subWeeks, 
  addWeeks 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseRecordDate, getStatusStyles } from "../../../utils/recordUtils";
import { motion, AnimatePresence } from 'motion/react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export function CalendarViewInternal({ 
  data, 
  ageingBasis, 
  currentDate, 
  setCurrentDate, 
  viewType, 
  setViewType,
  onOpenDetails
}: {
  data: any[];
  ageingBasis: string;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  viewType: 'month' | 'week' | 'day';
  setViewType: (v: 'month' | 'week' | 'day') => void;
  onOpenDetails: (records: any[], title: string) => void;
}) {

  const getDynamicDetailTitle = (d: Date) => {
    return `Date: ${format(d, 'dd MMMM yyyy')}`;
  };

  const getCardSide = (d: Date) => {
    const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    // Mon(1), Tue(2), Wed(3), Thu(4) -> open on 'right'
    // Fri(5), Sat(6), Sun(0) -> open on 'left'
    return (day === 5 || day === 6 || day === 0) ? 'left' : 'right';
  };

  // Group data by date based on the selected basis
  const groupedData = useMemo(() => {
    const groups: Record<string, any[]> = {};
    data.forEach(record => {
      const dateVal = record[ageingBasis];
      const parsedDate = parseRecordDate(dateVal);
      if (parsedDate) {
        const key = format(parsedDate, 'yyyy-MM-dd');
        if (!groups[key]) groups[key] = [];
        groups[key].push(record);
      }
    });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const projA = (a['Project'] || '').toLowerCase();
        const projB = (b['Project'] || '').toLowerCase();
        if (projA < projB) return -1;
        if (projA > projB) return 1;

        const nameA = (a['Contractor Name'] || '').toLowerCase();
        const nameB = (b['Contractor Name'] || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        const amtA = Number(a['Bill Amount (Net Payble)'] || 0);
        const amtB = Number(b['Bill Amount (Net Payble)'] || 0);
        return amtA - amtB;
      });
    });

    return groups;
  }, [data, ageingBasis]);

  const nextPeriod = () => {
    if (viewType === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewType === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prevPeriod = () => {
    if (viewType === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewType === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const calendarInterval = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-white relative">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/100 sticky top-0 z-20 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-400 border-r last:border-r-0 border-gray-200">
              {d}
            </div>
          ))}
        </div>
        
        <div className="flex-1 overflow-hidden h-full min-h-0">
          <div 
            className="grid grid-cols-7 border-b border-gray-200 h-full"
            style={{ 
              gridTemplateRows: `repeat(${Math.ceil(calendarInterval.length / 7)}, 1fr)`
            }}
          >
            {calendarInterval.map((d, i) => {
              const dateKey = format(d, 'yyyy-MM-dd');
              const dayRecords = groupedData[dateKey] || [];
              const totalAmount = dayRecords.reduce((sum, r) => sum + (r['Bill Amount (Net Payble)'] || 0), 0);
              const totalPaid = dayRecords.reduce((sum, r) => sum + (r['Paid Amount'] || 0), 0);
              const isInMonth = isSameMonth(d, monthStart);

              return (
                <div 
                  key={dateKey} 
                  className={cn(
                    "min-h-0 p-0 border-r border-b border-gray-100 flex flex-col group transition-colors overflow-hidden",
                    !isInMonth ? "bg-gray-100/50 grayscale-[0.5] opacity-50 shadow-inner" : "bg-white",
                    isToday(d) ? "bg-blue-50/10" : ""
                  )}
                >
                  <div 
                    role="button"
                    tabIndex={0}
                    onClick={() => dayRecords.length > 0 && isInMonth && onOpenDetails(dayRecords, getDynamicDetailTitle(d))}
                    onKeyDown={(e) => e.key === 'Enter' && dayRecords.length > 0 && isInMonth && onOpenDetails(dayRecords, getDynamicDetailTitle(d))}
                    className={cn(
                      "flex items-center justify-between px-1.5 py-1 border-b border-gray-50/50 transition-all text-left outline-none bg-transparent w-full shrink-0",
                      dayRecords.length > 0 && isInMonth ? "cursor-pointer hover:bg-black/5" : "cursor-default"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "w-4.5 h-4.5 flex items-center justify-center text-[10px] font-bold rounded-full leading-none",
                        isToday(d) ? "bg-blue-600 text-white shadow-sm" : "text-gray-900 font-black",
                        !isInMonth && !isToday(d) ? "text-gray-400" : ""
                      )}>
                        {format(d, 'd')}
                      </span>
                      {dayRecords.length > 0 && isInMonth && (
                        <span className="text-[10.5px] font-medium text-blue-600 uppercase tracking-tighter animate-in fade-in slide-in-from-left-1">
                          {dayRecords.length} Bills
                        </span>
                      )}
                    </div>
                    {dayRecords.length > 0 && isInMonth && (
                      <div className="text-right leading-none space-y-0.5">
                        <div className="text-[10px] font-medium text-gray-800">
                          ₹{(totalAmount / 100000).toFixed(1)}L
                        </div>
                        <div className="text-[9.5px] font-medium text-emerald-600">
                          ₹{(totalPaid / 100000).toFixed(1)}L
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar p-1">
                    {isInMonth && (() => {
                      const byProject: Record<string, any[]> = {};
                      dayRecords.forEach(r => {
                        const p = r['Project'] || 'Other';
                        if (!byProject[p]) byProject[p] = [];
                        byProject[p].push(r);
                      });
                      
                      return Object.entries(byProject).map(([proj, records]) => (
                        <div key={proj} className="space-y-0.5 mb-1">
                          <div className="px-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[9px] font-black text-gray-400 uppercase truncate leading-none">{proj}</span>
                              <span className="text-[9px] font-medium text-blue-600 leading-none ml-1">({records.length})</span>
                            </div>
                            <div className="space-y-0.5">
                              {records.map((record, idx) => (
                                <RecordCard key={`${record['Sr no']}-${idx}`} record={record} side={getCardSide(d)} onOpenDetails={onOpenDetails} ageingBasis={ageingBasis} hideAmounts />
                              ))}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-white relative">
        {/* Header Row */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/100 sticky top-0 z-20 shrink-0">
          {weekDays.map(d => {
            const dateKey = format(d, 'yyyy-MM-dd');
            const dayRecords = groupedData[dateKey] || [];
            const totalAmount = dayRecords.reduce((sum, r) => sum + (r['Bill Amount (Net Payble)'] || 0), 0);
            const totalPaid = dayRecords.reduce((sum, r) => sum + (r['Paid Amount'] || 0), 0);

            return (
              <div 
                role="button"
                tabIndex={0}
                key={`head-${dateKey}`} 
                onClick={() => dayRecords.length > 0 && onOpenDetails(dayRecords, getDynamicDetailTitle(d))}
                onKeyDown={(e) => e.key === 'Enter' && dayRecords.length > 0 && onOpenDetails(dayRecords, getDynamicDetailTitle(d))}
                className={cn(
                  "p-1 border-r last:border-r-0 border-gray-200 flex flex-col items-center outline-none transition-colors h-[52px] justify-center",
                  isToday(d) ? "bg-blue-50" : "bg-gray-50",
                  dayRecords.length > 0 ? "cursor-pointer hover:bg-black/5" : "cursor-default"
                )}
              >
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">{format(d, 'EEE')}</span>
                  <span className={cn(
                    "text-[11px] font-bold w-4.5 h-4.5 flex items-center justify-center rounded-full leading-none",
                    isToday(d) ? "bg-blue-600 text-white shadow-sm" : "text-gray-900 font-extrabold"
                  )}>{format(d, 'd')}</span>
                  {dayRecords.length > 0 && (
                    <span className="text-[10.5px] font-normal text-blue-600 uppercase tracking-tighter">
                      {dayRecords.length} Bills
                    </span>
                  )}
                </div>
                {dayRecords.length > 0 && (
                  <div className="mt-1 w-full text-center leading-none">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-normal text-gray-400">Bill:</span>
                      <span className="text-[10px] font-normal text-gray-800">₹{(totalAmount / 100000).toFixed(1)}L</span>
                      <span className="text-[10px] font-normal text-gray-400 opacity-50">|</span>
                      <span className="text-[10px] font-normal text-gray-400">Paid:</span>
                      <span className="text-[10px] font-normal text-emerald-600">₹{(totalPaid / 100000).toFixed(1)}L</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-hidden h-full min-h-0">
          <div className="grid grid-cols-7 h-full">
            {weekDays.map(d => {
              const dateKey = format(d, 'yyyy-MM-dd');
              const dayRecords = groupedData[dateKey] || [];

              return (
                <div key={`content-${dateKey}`} className={cn(
                  "flex flex-col border-r last:border-r-0 border-gray-200 min-h-0 h-full",
                  isToday(d) ? "bg-blue-50/10" : ""
                )}>
                  <div className="flex-1 p-1 space-y-2 bg-gray-50/20 overflow-y-auto custom-scrollbar h-full">
                    {(() => {
                      const byProject: Record<string, any[]> = {};
                      dayRecords.forEach(r => {
                        const p = r['Project'] || 'Other';
                        if (!byProject[p]) byProject[p] = [];
                        byProject[p].push(r);
                      });
                      
                      return Object.entries(byProject).map(([proj, records]) => (
                        <div key={proj} className="space-y-0.5">
                          <div className="px-1 py-0.5 flex items-center justify-between">
                            <span className="text-[9.5px] font-black text-gray-400 uppercase tracking-tighter truncate leading-none">
                              {proj}
                            </span>
                            <span className="text-[9.5px] font-normal text-blue-600 tracking-tighter shrink-0 ml-1">
                              ({records.length})
                            </span>
                          </div>
                          <div className="space-y-1">
                            {records.map((record, idx) => (
                              <RecordCard key={`${record['Sr no']}-${idx}`} record={record} layout="compact" side={getCardSide(d)} onOpenDetails={onOpenDetails} ageingBasis={ageingBasis} />
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const dayRecords = groupedData[dateKey] || [];
    const totalAmount = dayRecords.reduce((sum, r) => sum + (r['Bill Amount (Net Payble)'] || 0), 0);
    const totalPaid = dayRecords.reduce((sum, r) => sum + (r['Paid Amount'] || 0), 0);

    return (
      <div className="flex-1 flex flex-col min-h-0 bg-white relative mx-auto w-full">
        <div 
          role="button"
          tabIndex={0}
          onClick={() => dayRecords.length > 0 && onOpenDetails(dayRecords, getDynamicDetailTitle(currentDate))}
          onKeyDown={(e) => e.key === 'Enter' && dayRecords.length > 0 && onOpenDetails(dayRecords, getDynamicDetailTitle(currentDate))}
          className="p-1 px-3 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 sticky top-0 z-20 shadow-sm hover:bg-gray-50/50 transition-colors w-full text-left"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex flex-col items-center justify-center border border-blue-100 mr-[7px]">
              <span className="text-[7.5px] font-black text-blue-400 uppercase leading-none mb-0.5">{format(currentDate, 'MMM')}</span>
              <span className="text-xs font-black text-blue-700 leading-none">{format(currentDate, 'dd')}</span>
            </div>
            <div>
              <h3 className="text-xs font-black text-gray-900 tracking-tight leading-none">{format(currentDate, 'EEEE')}</h3>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{format(currentDate, 'MMMM yyyy')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pr-1">
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-normal text-gray-400 font-mono leading-none">Bill:</span>
                <span className="text-[12px] font-normal text-gray-800 font-mono leading-none">₹{(totalAmount / 100000).toFixed(1)}L</span>
                <span className="text-[12px] font-normal text-gray-400 font-mono leading-none">Paid:</span>
                <span className="text-[12px] font-normal text-emerald-600 font-mono leading-none">₹{(totalPaid / 100000).toFixed(1)}L</span>
                <span className="text-[11px] font-normal text-blue-600 leading-none">{dayRecords.length} Bills</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 p-2 overflow-y-auto custom-scrollbar bg-gray-50/10">
          <div className="space-y-4">
            {(() => {
              const byProject: Record<string, any[]> = {};
              dayRecords.forEach(r => {
                const p = r['Project'] || 'Other';
                if (!byProject[p]) byProject[p] = [];
                byProject[p].push(r);
              });
              
              return Object.entries(byProject).map(([proj, records]) => {
                const projAmt = records.reduce((sum, r) => sum + (r['Bill Amount (Net Payble)'] || 0), 0);
                const projPaid = records.reduce((sum, r) => sum + (r['Paid Amount'] || 0), 0);
                
                return (
                  <div key={proj} className="space-y-1">
                    <div className="px-3 py-0.5 flex items-center justify-between">
                      <span className="text-[9.5px] font-black text-gray-400 uppercase tracking-wider truncate">{proj}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[9.5px] font-normal text-gray-400">Bill:</span>
                          <span className="text-[9.5px] font-normal text-gray-800">₹{(projAmt / 100000).toFixed(1)}L</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9.5px] font-normal text-gray-400">Paid:</span>
                          <span className="text-[9.5px] font-normal text-emerald-600">₹{(projPaid / 100000).toFixed(1)}L</span>
                        </div>
                        <span className="text-[9px] font-normal text-blue-600 uppercase tracking-widest">{records.length} Bills</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 px-0.5">
                      {records.map((record, idx) => (
                        <RecordCard key={`${record['Sr no']}-${idx}`} record={record} layout="compact" side={idx % 7 < 4 ? "right" : "left"} onOpenDetails={onOpenDetails} ageingBasis={ageingBasis} />
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
            {dayRecords.length === 0 && (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl">
                <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">No records for this date</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-transparent animate-in fade-in duration-500 w-full h-full p-0">
      <div className="flex flex-col gap-1.5 w-full h-full">
        <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${viewType}-${format(currentDate, 'yyyy-MM-dd')}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {viewType === 'month' && renderMonthView()}
              {viewType === 'week' && renderWeekView()}
              {viewType === 'day' && renderDayView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function RecordCard({ record, layout = 'compact', onOpenDetails, ageingBasis = 'Inward Date', hideAmounts = false, side }: any) {
  const status = record['Status'] || '';
  const amt = Number(record['Bill Amount (Net Payble)'] || 0);
  const paidAmt = Number(record['Paid Amount'] || 0);

  const getDynamicRecordDetailTitle = (rec: any) => {
    const dateVal = rec[ageingBasis];
    const parsed = parseRecordDate(dateVal);
    const formattedDate = parsed ? format(parsed, 'dd MMMM yyyy') : (dateVal || 'N/A');
    let label = ageingBasis;
    if (ageingBasis === 'Inward Date') label = 'Site Inward Date';
    else if (ageingBasis === 'Received at HO') label = 'Received at HO Date';
    else if (ageingBasis === 'Certified at HO & Sent to Accounts on') label = 'Send to account date';
    else if (ageingBasis === 'Cheque Recd. At Site Date') label = 'Payment Date';
    return `${label}: ${formattedDate}`;
  };
  
  return (
    <button 
      onClick={() => onOpenDetails?.([record], getDynamicRecordDetailTitle(record))}
      className={cn(
        "px-1 py-0.5 rounded text-[10.5px] transition-all cursor-pointer truncate text-left bg-transparent block w-full outline-none",
        hideAmounts ? "h-auto py-0" : "h-7",
        getStatusStyles(status, record).replace('border', 'border-transparent')
      )}
    >
      <div className="font-normal truncate text-gray-950 leading-tight">{record['Contractor Name']}</div>
      {!hideAmounts && (
        <div className="flex justify-between items-center gap-1 overflow-hidden leading-none font-medium">
          <div className="flex items-center gap-0.5 truncate flex-1">
            <span className="text-gray-400 font-normal shrink-0">Bill:</span>
            <span className="truncate font-normal">₹{(amt/1000).toFixed(0)}k</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-black/5">
            <span className="text-gray-400 font-normal shrink-0">Paid:</span>
            <span className="font-normal text-emerald-600">₹{(paidAmt/1000).toFixed(0)}k</span>
          </div>
        </div>
      )}
    </button>
  );
}