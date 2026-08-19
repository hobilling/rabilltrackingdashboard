import React, { useState, useMemo, useContext } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppContext } from "../../../App";
import UnifiedJourney from "../../UnifiedJourney";
import { isCompletedVal, getStatusDateVal, getStatusStyles, getPaymentStatusStyles } from "../../../utils/recordUtils";

// Highly polished, modern compact popover timeline drawer displaying detail cards
export function DetailTimelineModal({
  records,
  title,
  onClose
}: {
  records: any[];
  title: string;
  onClose: () => void;
}) {
  const context = useContext(AppContext);
  const [activeTab, setActiveTab] = useState(0);

  // Polish: Sort records alphabetically by Contractor Name, then Work Head, then numeric Amount
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      // 1. Contractor Name (Alphabetical)
      const nameA = String(a["Contractor Name"] || "").toLowerCase();
      const nameB = String(b["Contractor Name"] || "").toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;

      // 2. Work Head (Alphabetical)
      const workA = String(a["Work Head"] || "").toLowerCase();
      const workB = String(b["Work Head"] || "").toLowerCase();
      if (workA < workB) return -1;
      if (workA > workB) return 1;

      // 3. Amount (Numeric Ascending)
      const amtA = Number(a["Bill Amount (Net Payble)"] || 0);
      const amtB = Number(b["Bill Amount (Net Payble)"] || 0);
      return amtA - amtB;
    });
  }, [records]);

  // Movable and resizable window state
  const [width, setWidth] = useState(850);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = position.x;
    const initialY = position.y;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setPosition({
        x: initialX + dx,
        y: initialY + dy
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const startResize = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const newWidth = Math.max(350, Math.min(window.innerWidth - 32, startW - dx));
      setWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const currentRecord = sortedRecords[activeTab] || sortedRecords[0];

  if (!currentRecord) {
    return createPortal(
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[999] flex items-center justify-end animate-in fade-in duration-200">
        <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
        <motion.div 
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 240 }}
          className="bg-slate-50 h-full shadow-2xl flex flex-col pointer-events-auto border-l border-slate-200"
          style={{ width: 400 }}
        >
          <div className="flex-1 p-6 flex items-center justify-center text-slate-400 font-semibold text-sm">
            No records found.
          </div>
        </motion.div>
      </div>,
      document.body
    );
  }

  const formatCurrency = (val: any) => {
    const rawNum = Number(val);
    if (isNaN(rawNum)) return "-";
    return rawNum.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[999] flex items-center justify-end animate-in fade-in duration-200">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
      
      <motion.div 
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        style={{
          width: `${width}px`,
          left: `${position.x}px`,
          top: `${position.y}px`,
          position: 'relative'
        }}
        className="relative bg-white h-[calc(100%-32px)] my-4 mr-4 shadow-2xl flex flex-col border border-slate-200 rounded-2xl overflow-hidden"
      >
        {/* Resize Handler - Left Edge */}
        <div 
          onMouseDown={startResize}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize group hover:bg-blue-500/10 transition-colors z-[130] flex items-center justify-center select-none"
          title="Drag left/right to resize window"
        >
          <div className="w-[1.5px] h-10 bg-slate-350 group-hover:bg-blue-400 group-active:bg-blue-500 rounded transition-colors" />
        </div>

        {/* Header - Vertically Compact */}
        <div 
          className="py-2.5 px-3 border-b border-slate-150 flex items-center justify-between bg-slate-50 shrink-0 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={startDrag}
        >
          <div className="min-w-0 pr-4 flex-1">
            <h3 className="text-xs font-bold text-slate-800 truncate leading-tight" title={title}>
              {title}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 px-2.5 bg-slate-200/60 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-md transition-all text-[11px] flex items-center gap-1 font-bold cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>

        {/* Scrollable details and timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/40">
          {currentRecord ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              
              {/* Left Column: Core Meta and Financial details */}
              <div className="space-y-3">
                {/* 1) Multiple Records Selector (Moved above Bill details & compact) */}
                {sortedRecords.length > 1 && (
                  <div className="border border-slate-150 rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="bg-slate-50 px-2.5 py-1 border-b border-slate-150 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Select Record ({sortedRecords.length})</span>
                      <span className="text-[9px] font-mono text-slate-400 font-semibold">Record {activeTab + 1} of {sortedRecords.length}</span>
                    </div>
                    {/* Reduced height max-h-[105px] to make list compact in vertical viewport and prevent scroll */}
                    <div className="p-1 px-1.5 max-h-[105px] overflow-y-auto custom-scrollbar space-y-1 bg-slate-50/50">
                      {sortedRecords.map((rec, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveTab(idx)}
                          className={cn(
                            "w-full px-2 py-1 rounded text-left text-[11px] transition-all cursor-pointer border flex items-center justify-between gap-2.5",
                            activeTab === idx
                              ? "bg-blue-50 border-blue-400 text-blue-700 shadow-sm font-semibold"
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                          )}
                        >
                          <span className="truncate flex-1 pr-1" title={`${rec["Contractor Name"] || rec["Project"] || ""}${rec["Work Head"] ? " - " + rec["Work Head"] : ""}`}>
                            <span className="font-semibold">{rec["Contractor Name"] || rec["Project"] || `Record #${idx + 1}`}</span>
                            {rec["Work Head"] && (
                              <span className={cn(
                                "ml-1.5 font-normal text-[10px]",
                                activeTab === idx ? "text-blue-500" : "text-slate-400"
                              )}>
                                - {rec["Work Head"]}
                              </span>
                            )}
                          </span>
                          <span className={cn(
                            "font-mono text-[10.5px] font-semibold shrink-0",
                            activeTab === idx ? "text-blue-600" : "text-slate-500"
                          )}>
                             {formatCurrency(rec["Bill Amount (Net Payble)"])}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2) Bill details - Source moved before Sr no */}
                <div className="border border-slate-150 rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="bg-slate-50 px-2.5 py-1.5 border-b border-slate-150 flex justify-between items-center text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <span>Bill details</span>
                    <div className="flex items-center gap-2 font-mono text-slate-400">
                      <span>Source: <span className="text-slate-700 font-semibold uppercase">{currentRecord["Source"] || "-"}</span></span>
                      <span className="opacity-40">|</span>
                      <span>Sr no: <span className="text-slate-700 font-semibold">{currentRecord["Sr no"] ?? "-"}</span></span>
                    </div>
                  </div>
                  <div className="p-2.5 grid grid-cols-3 gap-x-2.5 gap-y-1.5 text-[11px]">
                    <div className="col-span-1">
                      <span className="text-slate-400 font-medium text-[10px] block">Project</span>
                      <span className="font-semibold text-slate-800 block break-words leading-tight">{currentRecord["Project"] || "-"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 font-medium text-[10px] block">Contractor Name</span>
                      <span className="font-semibold text-slate-800 block break-words leading-tight">{currentRecord["Contractor Name"] || "-"}</span>
                    </div>

                    {/* LOCATION/Bldg., Bill Type, and Billing Eng Name aligned horizontally */}
                    <div className="col-span-1 pt-0.5 border-t border-slate-100/60">
                      <span className="text-slate-400 font-medium text-[10px] block">LOCATION/Bldg.</span>
                      <span className="font-semibold text-slate-800 block break-words leading-tight">{currentRecord["LOCATION/Bldg."] || "-"}</span>
                    </div>
                    <div className="col-span-1 pt-0.5 border-t border-slate-100/60">
                      <span className="text-slate-400 font-medium text-[10px] block">Bill Type</span>
                      <span className="font-semibold text-slate-800 block break-words leading-tight">{currentRecord["Bill Type"] || "-"}</span>
                    </div>
                    <div className="col-span-1 pt-0.5 border-t border-slate-100/60">
                      <span className="text-slate-400 font-medium text-[10px] block">Billing Eng Name</span>
                      <span className="font-semibold text-slate-800 block break-words leading-tight">{currentRecord["Billing Eng Name"] || "-"}</span>
                    </div>

                    <div className="col-span-3 border-t border-slate-100/60 pt-1.5">
                      <div className="flex justify-between items-center w-full">
                        <span className="text-slate-400 font-medium text-[10px]">Work Head</span>
                        {isCompletedVal(currentRecord["Site"]) && (
                          <span className="text-[10px] font-bold">
                            <span className="text-slate-400 font-medium">site: </span>
                            <span className="text-slate-850 font-semibold">{currentRecord["Site"]}</span>
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-slate-800 block break-words leading-tight whitespace-normal mt-0.5">{currentRecord["Work Head"] || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* 3) Amount and Status */}
                <div className="border border-slate-150 rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="bg-slate-50 px-2.5 py-1.5 border-b border-slate-150 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Amount and Status
                  </div>
                  <div className="p-3 space-y-3.5 text-[11px]">
                    {/* Amounts block (no borders and no fills, Balance Payment in red) */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-slate-400 font-medium text-[10px] block leading-tight text-slate-400 font-semibold text-slate-400">Bill Amount</span>
                        <span className="font-bold text-slate-850 font-mono block mt-0.5 text-xs">{formatCurrency(currentRecord["Bill Amount (Net Payble)"])}</span>
                      </div>
                      <div>
                        <span className="text-emerald-500 font-semibold text-[10px] block leading-tight">Paid Amount</span>
                        <span className="font-extrabold text-green-600 font-mono block mt-0.5 text-xs">{formatCurrency(currentRecord["Paid Amount"])}</span>
                      </div>
                      <div>
                        <span className="text-red-500 font-semibold text-[10px] block leading-tight text-red-650">Balance Payment</span>
                        <span className="font-bold text-red-650 font-mono block mt-0.5 text-xs text-red-600">{formatCurrency(currentRecord["Balance Payment"])}</span>
                      </div>
                    </div>

                    {/* Paid Date written as Payment Date and Cheque No/RTGS here */}
                    <div className="pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-slate-400 font-medium text-[10px] block leading-tight text-slate-400">Cheque No / RTGS</span>
                        <span className="font-mono font-bold text-slate-505 text-xs block mt-1">
                          {currentRecord["Cheque No"] || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium text-[10px] block leading-tight text-slate-400">Payment Date</span>
                        <span className="font-mono font-bold text-slate-505 text-xs block mt-1">
                          {currentRecord["Cheque Recd. At Site Date"] || "-"}
                        </span>
                      </div>
                    </div>

                    {/* Status badges with custom sub-labels (Status Date below Status, Remark below Payment Status) */}
                    <div className="grid grid-cols-2 gap-3.5 pt-2.5 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 font-medium text-[10px] block text-slate-400">Status</span>
                        <span className={cn(
                          "inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border",
                          getStatusStyles(currentRecord["Status"], currentRecord)
                        )}>
                          {currentRecord["Status"] || "-"}
                        </span>
                        <div className="mt-2 pl-0.5">
                           <span className="text-slate-400 text-[9px] block">Status Date</span>
                           <span className="font-mono font-bold text-slate-600 text-[10.5px]">
                             {getStatusDateVal(currentRecord) || "-"}
                           </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium text-[10px] block text-slate-400 font-semibold text-slate-400">Payment Status</span>
                        <span className={cn(
                          "inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border",
                          getPaymentStatusStyles(currentRecord["Payment Status"])
                        )}>
                          {currentRecord["Payment Status"] || "-"}
                        </span>
                        <div className="mt-2 pl-0.5">
                          <span className="text-slate-400 text-[9px] block">Remark</span>
                          {currentRecord["Remark"] ? (
                            <span className="text-slate-650 text-[10.5px] italic leading-tight block break-words" title={currentRecord["Remark"]}>
                              &ldquo;{currentRecord["Remark"]}&rdquo;
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px] italic block">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Unified Journey of Record from Start (NO separate boxes inside, matching stage colorfills) */}
              <div className="h-full col-span-1">
                <UnifiedJourney record={currentRecord} className="h-full border-slate-200" />
              </div>

            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              Select an item to display.
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
