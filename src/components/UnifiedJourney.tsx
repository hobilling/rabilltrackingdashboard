import React, { useContext } from 'react';
import { cn } from '@/lib/utils';
import { InvoiceRecord } from '../types';
import { AppContext } from '../App';
import { 
  parseRecordDate, 
  isCompletedVal, 
  getStatusDateVal, 
  formatDaysOrMonths 
} from '../utils/recordUtils';

interface UnifiedJourneyProps {
  record: InvoiceRecord;
  className?: string;
}

export default function UnifiedJourney({ record, className }: UnifiedJourneyProps) {
  const context = useContext(AppContext);
  
  const siteTarget = context?.targets?.site ?? 4;
  const hoTarget = context?.targets?.ho ?? 1.5;
  const accTarget = context?.targets?.accounts ?? 6;
  const totalTarget = siteTarget + hoTarget + accTarget;

  const siteActual = record ? (record["Site Days"] !== null && record["Site Days"] !== undefined ? Number(record["Site Days"]) : null) : null;
  const hoActual = record ? (record["HO Days"] !== null && record["HO Days"] !== undefined ? Number(record["HO Days"]) : null) : null;
  const accActual = record ? (record["Account Days"] !== null && record["Account Days"] !== undefined ? Number(record["Account Days"]) : null) : null;
  const totalActual = record ? (record["Inward to Payment Cycle Days"] !== null && record["Inward to Payment Cycle Days"] !== undefined ? Number(record["Inward to Payment Cycle Days"]) : null) : null;

  if (!record) return null;

  const statusLStr = record ? String(record["Status"] || "").toLowerCase() : "";
  const isDashedPath = record && (
    statusLStr.includes("sent to accounts") || 
    statusLStr.includes("send to accounts") ||
    statusLStr.includes("08")
  ) && !statusLStr.includes("hold") && !statusLStr.includes("received");

  const getLevelDetails = (rec: any) => {
    if (!rec) return { target: siteTarget, level: "at Site", isHold: false, key: "site" };
    const s = String(rec["Status"] || "").toLowerCase();
    if (s.includes("hold at site") || rec["Hold at Site"] === "Yes") {
      return { target: siteTarget, level: "at Site", isHold: true, key: "site" };
    }
    if (s.includes("hold at ho") || rec["Hold at HO"] === "Yes") {
      return { target: hoTarget, level: "at HO", isHold: true, key: "ho" };
    }
    if (s.includes("10 ") || s.includes("09 ") || s.includes("08 ") || s.includes("cheque") || s.includes("payment") || s.includes("cleared")) {
      return { target: accTarget, level: "in Accounts", isHold: false, key: "accounts" };
    }
    if (s.includes("07 ") || s.includes("06 ") || s.includes("certified") || s.includes("ho") || s.includes("received at ho")) {
      return { target: hoTarget, level: "at HO", isHold: false, key: "ho" };
    }
    return { target: siteTarget, level: "at Site", isHold: false, key: "site" };
  };

  const isLineCompleted = (stageKey: string) => {
    if (!record) return false;
    const order = [
      "Inward Date",
      "EXCEL Date",
      "Highrise RA Date",
      "HO Submission Date",
      "Received at HO",
      "Certified at HO & Sent to Accounts on",
      "Cheque Recd. At HO Date",
      "Cheque Recd. At Site Date"
    ];
    const idx = order.indexOf(stageKey);
    if (idx === -1) return false;
    for (let i = idx; i < order.length; i++) {
      if (isCompletedVal(record[order[i] as keyof InvoiceRecord])) return true;
    }
    return false;
  };

  const isSpotCompleted = (stageKey: string) => {
    if (!record) return false;
    if (isCompletedVal(record[stageKey as keyof InvoiceRecord])) return true;
    if (stageKey === "EXCEL Date" || stageKey === "Highrise RA Date") {
      const order = [
        "Inward Date",
        "EXCEL Date",
        "Highrise RA Date",
        "HO Submission Date",
        "Received at HO",
        "Certified at HO & Sent to Accounts on",
        "Cheque Recd. At HO Date",
        "Cheque Recd. At Site Date"
      ];
      const idx = order.indexOf(stageKey);
      if (idx !== -1) {
        for (let i = idx + 1; i < order.length; i++) {
          if (isCompletedVal(record[order[i] as keyof InvoiceRecord])) return true;
        }
      }
    }
    return false;
  };

  const renderDate = (processKey: keyof InvoiceRecord, rawKey: keyof InvoiceRecord, label: string, isSpot?: boolean) => {
    if (!record) return null;
    const val = record[processKey];
    const rawVal = record[rawKey];
    const isTransformed = val && !rawVal;
    
    return (
      <div className="relative text-[11px] flex flex-col gap-0.5">
         {(isSpot ? isSpotCompleted(String(processKey)) : isCompletedVal(val)) && (
           <div className={cn(
             "absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
             "bg-amber-500 ring-4 ring-amber-100"
           )} />
         )}
         <span className={cn("text-[9px] uppercase tracking-wider font-extrabold", val ? "text-slate-400" : "text-slate-300")}>{label}</span>
         <div className="flex items-center gap-1.5 flex-wrap">
           <span className={cn(
             "font-bold font-mono text-[11px] px-1 rounded",
             val ? "text-slate-700" : "text-slate-400 italic",
             isTransformed && "text-orange-600 bg-transparent"
           )}>
             {val || "-"}
           </span>
         </div>
      </div>
    );
  };

  const renderDeviationStr = (actual: number | null, target: number) => {
    if (actual === null || isNaN(actual)) return null;
    const diff = actual - target;
    const isOver = diff > 0;
    const sign = diff > 0 ? "+" : "";
    return (
      <span className={cn(
        "font-normal font-mono shrink-0 ml-1.5 text-[10px]",
        isOver ? "text-red-500" : "text-emerald-600"
      )}>
        {sign}{diff} Days
      </span>
    );
  };

  const renderJourneyHeader = () => {
    const statusStr = record["Status"] || "-";
    const paymentStatusStr = record["Payment Status"] || "";
    const sL = String(statusStr).toLowerCase();
    const lvl = getLevelDetails(record);
    const statusDateObj = parseRecordDate(getStatusDateVal(record));
    let daysDiff = 0;
    if (statusDateObj) {
      const today = new Date();
      const timeDiff = today.getTime() - statusDateObj.getTime();
      daysDiff = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
    }
    const isExceeded = daysDiff > lvl.target;

    const formatTiming = (skipRed: boolean = false) => {
      if (daysDiff === 0) return <span className="font-extrabold text-black">Today</span>;
      return (
        <>
          <span className={(!skipRed && isExceeded) ? "text-red-500 font-extrabold" : ""}>
            {formatDaysOrMonths(daysDiff)}
          </span>
          {" ago"}
        </>
      );
    };

    let labelElement: React.ReactNode = null;
    let statusColorClass = "text-amber-600";

    if (sL.includes("01") || sL.includes("in process")) {
      labelElement = <>Inward at Site {formatTiming()}</>;
    } else if (sL.includes("02") || sL.includes("excel done")) {
      labelElement = <>Excel Done at Site {formatTiming()}</>;
    } else if (sL.includes("03") || sL.includes("high rise done") || sL.includes("highrise")) {
      labelElement = <>High Rise Done at Site {formatTiming()}</>;
    } else if (sL.includes("04") || sL.includes("hold at site") || record["Hold at Site"] === "Yes") {
      statusColorClass = "text-red-500";
      labelElement = <>Hold at Site {formatTiming()}</>;
    } else if (sL.includes("05") || sL.includes("send to ho")) {
      labelElement = <>Send To HO {formatTiming()}</>;
    } else if (sL.includes("06") || sL.includes("received at ho")) {
      statusColorClass = "text-blue-500";
      labelElement = <>Received at HO {formatTiming()}</>;
    } else if (sL.includes("07") || sL.includes("hold at ho") || record["Hold at HO"] === "Yes") {
      statusColorClass = "text-red-500";
      labelElement = <>Hold at HO {formatTiming()}</>;
    } else if (sL.includes("08") || sL.includes("send to accounts")) {
      statusColorClass = "text-emerald-600";
      labelElement = <>Send To Accounts {formatTiming()}</>;
    } else if (sL.includes("10") || sL.includes("09") || sL.includes("cheque") || sL.includes("payment")) {
      statusColorClass = "text-emerald-600";
      const payL = String(paymentStatusStr).toLowerCase();
      if (payL.includes("cleared")) labelElement = <>Payment Cleared {formatTiming(true)}</>;
      else if (payL.includes("partial")) labelElement = <>Partial Payment Paid {formatTiming()}</>;
      else labelElement = <>Cheque Recd. At Site {formatTiming()}</>;
    } else {
      labelElement = <>{statusStr} {formatTiming()}</>;
    }

    return (
      <span className={cn("text-[10px] font-black uppercase tracking-wider", statusColorClass)}>
        {labelElement}
      </span>
    );
  };

  return (
    <div className={cn("border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col w-full", className)}>
      <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center text-[10px] font-black uppercase tracking-wider shrink-0 min-h-[34px]">
        {renderJourneyHeader()}
        <span className="font-mono text-[9px] text-slate-400">Stages</span>
      </div>

      <div className="p-3 bg-[#E6D7A1]/12 border-b border-[#E6D7A1]/20 space-y-3">
        <div className="flex items-center justify-between border-b border-[#E6D7A1]/25 pb-1 pl-5">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Site Process</span>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-slate-500 font-normal">Site Days: <span className="font-normal text-slate-700">{record["Site Days"] ?? "-"}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400 font-normal">Target: {siteTarget}</span>
            {renderDeviationStr(siteActual, siteTarget)}
          </div>
        </div>
        <div className="relative pl-5 space-y-3.5 pt-0.5">
                    {/* Inward Date Container wrapping both the node date and potential hold blocks */}
                    <div className="relative text-[11px] flex flex-col gap-2">
                      <div>
                        <span className={cn("text-[9px] uppercase tracking-wider font-extrabold", isCompletedVal(record["Inward Date"]) ? "text-slate-400" : "text-slate-300")}>Inward Date</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            "font-bold font-mono text-[11px] px-1 rounded", 
                            isCompletedVal(record["Inward Date"]) ? "text-slate-700" : "text-slate-400 italic",
                            (record["Inward Date"] && !record["_rawInwardDate"]) && "text-orange-600 bg-transparent"
                          )}>
                            {record["Inward Date"] || "-"}
                          </span>
                          
                          {/* Billing Period displayed right after date */}
                          {record["Billing Period"] && isCompletedVal(record["Inward Date"]) && (
                            <span className="bg-slate-150/65 px-1.5 py-0.5 rounded border border-slate-205 text-[9.5px] font-semibold text-slate-500">
                              Billing Period: <span className="font-mono font-bold text-slate-650">{record["Billing Period"]}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Holds / Remarks right after Inward Date in RED status style */}
                      {(record["Hold at Site"] === "Yes" || record["Reason For Hold at Site"] || record["Remark Site"]) && (
                        <div className="relative ml-4 text-[10.5px] bg-red-50/75 border border-red-100 p-2 rounded text-red-700 space-y-1 z-10">
                          {record["Hold at Site"] === "Yes" && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-medium uppercase text-red-400">Hold at Site:</span>
                              <span className="font-normal text-red-700">{record["Hold at Site"]}</span>
                            </div>
                          )}
                          {record["Reason For Hold at Site"] && (
                            <div>
                               <span className="text-[9px] font-medium uppercase text-red-400 block pb-0.5">Reason For Hold at Site</span>
                               <span className="font-normal text-red-700 block leading-tight">{record["Reason For Hold at Site"]}</span>
                            </div>
                          )}
                          {record["Remark Site"] && (
                            <div>
                              <span className="text-[9px] font-medium uppercase text-red-400 block pb-0.5">Remark Site</span>
                              <span className="italic font-normal text-red-750 block leading-tight">&ldquo;{record["Remark Site"]}&rdquo;</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dot */}
                      <div className={cn(
                        "absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
                        isCompletedVal(record["Inward Date"]) 
                          ? "bg-amber-500 ring-4 ring-amber-100" 
                          : "bg-slate-300 ring-4 ring-slate-100 text-slate-400"
                      )} />

                      {/* Line connecting to EXCEL Date */}
                      <div className={cn(
                        "absolute left-[-13.25px] top-4.5 w-[2.5px] bottom-[-18px] z-0",
                        isLineCompleted("EXCEL Date") ? "bg-amber-500" : "bg-slate-200"
                      )} />
                    </div>

                    {/* EXCEL Date */}
                    <div className="relative text-[11px] flex flex-col gap-0.5">
                      <div className={cn(
                        "absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
                        isSpotCompleted("EXCEL Date") 
                          ? "bg-amber-500 ring-4 ring-amber-100" 
                          : "bg-slate-300 ring-4 ring-slate-100 text-slate-400"
                      )} />
                      <div className={cn(
                        "absolute left-[-13.25px] top-4.5 w-[2.5px] bottom-[-18px] z-0",
                        isLineCompleted("Highrise RA Date") ? "bg-amber-500" : "bg-slate-200"
                      )} />
                      <span className={cn("text-[9px] uppercase tracking-wider font-extrabold", isSpotCompleted("EXCEL Date") ? "text-slate-400" : "text-slate-300")}>EXCEL Date</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                            "font-bold font-mono text-[11px] px-1 rounded", 
                            isCompletedVal(record["EXCEL Date"]) ? "text-slate-700" : "text-slate-400 italic",
                            (record["EXCEL Date"] && !record["_rawEXCELDate"]) && "text-orange-600 bg-transparent"
                        )}>
                          {record["EXCEL Date"] || "-"}
                        </span>
                        {record["Excel RA Bill NO"] && isCompletedVal(record["EXCEL Date"]) && (
                          <span className="bg-slate-150/60 px-1.5 py-0.5 rounded border border-slate-200/50 text-[9.5px] font-semibold text-slate-500">
                            Excel RA Bill NO: <span className="font-mono font-bold">{record["Excel RA Bill NO"]}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Highrise RA Date */}
                    <div className="relative text-[11px] flex flex-col gap-0.5">
                      <div className={cn(
                        "absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
                        isSpotCompleted("Highrise RA Date") 
                          ? "bg-amber-500 ring-4 ring-amber-100" 
                          : "bg-slate-300 ring-4 ring-slate-100 text-slate-400"
                      )} />
                      <div className={cn(
                        "absolute left-[-13.25px] top-4.5 w-[2.5px] bottom-[-18px] z-0",
                        isLineCompleted("HO Submission Date") ? "bg-amber-500" : "bg-slate-200"
                      )} />
                      <span className={cn("text-[9px] uppercase tracking-wider font-extrabold", isSpotCompleted("Highrise RA Date") ? "text-slate-400" : "text-slate-300")}>Highrise RA Date</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                            "font-bold font-mono text-[11px] px-1 rounded", 
                            isCompletedVal(record["Highrise RA Date"]) ? "text-slate-700" : "text-slate-400 italic",
                            (record["Highrise RA Date"] && !record["_rawHighriseRADate"]) && "text-orange-600 bg-transparent"
                        )}>
                          {record["Highrise RA Date"] || "-"}
                        </span>
                        {isCompletedVal(record["Highrise RA Date"]) && (record["Highrise WO No"] || record["Highrise RA No"]) && (
                          <div className="flex flex-wrap gap-1">
                            {record["Highrise WO No"] && (
                              <span className="bg-slate-150/60 px-1.5 py-0.5 rounded border border-slate-200/50 text-[9.5px] font-mono text-slate-650">
                                WO: {record["Highrise WO No"]}
                              </span>
                            )}
                            {record["Highrise RA No"] && (
                              <span className="bg-slate-150/60 px-1.5 py-0.5 rounded border border-slate-200/50 text-[9.5px] font-mono text-slate-650">
                                RA: {record["Highrise RA No"]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
          <div className="relative text-[11px] flex flex-col gap-0.5">
            <div className={cn(
              "absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
              isCompletedVal(record["HO Submission Date"]) ? "bg-amber-500 ring-4 ring-amber-100" : "bg-slate-300 ring-4 ring-slate-100"
            )} />
            <div className={cn(
              "absolute left-[-13.25px] top-4.5 w-[2.5px] bottom-[-58px] z-0",
              isLineCompleted("Received at HO") ? "bg-blue-400" : "bg-slate-200"
            )} />
            <span className={cn("text-[9px] uppercase tracking-wider font-extrabold", isCompletedVal(record["HO Submission Date"]) ? "text-slate-400" : "text-slate-300")}>HO Submission Date</span>
            <span className={cn(
                "font-bold font-mono text-[11px] px-1 rounded inline-block", 
                isCompletedVal(record["HO Submission Date"]) ? "text-slate-700" : "text-slate-400 italic",
                (record["HO Submission Date"] && !record["_rawHOSubmissionDate"]) && "text-orange-600 bg-transparent"
            )}>
              {record["HO Submission Date"] || "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 bg-blue-500/10 border-b border-blue-50/50 space-y-3">
        <div className="flex items-center justify-between border-b border-blue-150 pb-1 pl-5">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">HO Process</span>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-blue-500 font-normal">HO Days: <span className="font-normal text-blue-700">{record["HO Days"] ?? "-"}</span></span>
            <span className="text-blue-200">|</span>
            <span className="text-slate-400 font-normal">Target: {hoTarget}</span>
            {renderDeviationStr(hoActual, hoTarget)}
          </div>
        </div>
        <div className="relative pl-5 space-y-3.5 pt-0.5">
                    {/* Received at HO Container wrapping both node date and potential hold blocks */}
                    <div className="relative text-[11px] flex flex-col gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className={cn("text-[9px] uppercase tracking-wider font-extrabold", isCompletedVal(record["Received at HO"]) ? "text-slate-400" : "text-slate-300")}>Received at HO</span>
                        <span className={cn(
                            "font-bold font-mono text-[11px] px-1 rounded inline-block w-fit", 
                            isCompletedVal(record["Received at HO"]) ? "text-slate-700" : "text-slate-400 italic",
                            (record["Received at HO"] && !record["_rawReceivedHODate"]) && "text-orange-600 bg-transparent"
                        )}>
                          {record["Received at HO"] || "-"}
                        </span>
                      </div>

                      {/* Holds / Remarks right after Received at HO in RED status style */}
                      {(record["Hold at HO"] === "Yes" || record["Reason For Hold at HO"] || record["Remark HO"]) && (
                        <div className="relative ml-4 text-[10.5px] bg-red-50/75 border border-red-100 p-2 rounded text-red-700 space-y-1 z-10">
                          {record["Hold at HO"] === "Yes" && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-medium uppercase text-red-400">Hold at HO:</span>
                              <span className="font-normal text-red-700">{record["Hold at HO"]}</span>
                            </div>
                          )}
                          {record["Reason For Hold at HO"] && (
                            <div>
                               <span className="text-[9px] font-medium uppercase text-red-400 block pb-0.5">Reason For Hold at HO</span>
                               <span className="font-normal text-red-700 block leading-tight">{record["Reason For Hold at HO"]}</span>
                            </div>
                          )}
                          {record["Remark HO"] && (
                            <div>
                              <span className="text-[9px] font-medium uppercase text-red-400 block pb-0.5">Remark HO</span>
                              <span className="italic font-normal text-red-750 block leading-tight">&ldquo;{record["Remark HO"]}&rdquo;</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dot */}
                      <div className={cn(
                        "absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
                        isCompletedVal(record["Received at HO"]) 
                          ? "bg-blue-500 ring-4 ring-blue-100" 
                          : "bg-slate-300 ring-4 ring-slate-100 text-slate-400"
                      )} />

                      {/* Line connecting to Certified */}
                      <div className={cn(
                        "absolute left-[-13.25px] top-4.5 w-[2.5px] bottom-[-18px] z-0",
                        isLineCompleted("Certified at HO & Sent to Accounts on") ? "bg-blue-500" : "bg-slate-200"
                      )} />
                    </div>
          <div className="relative text-[11px] flex flex-col gap-0.5">
            <div className={cn(
              "absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
              isCompletedVal(record["Certified at HO & Sent to Accounts on"]) ? "bg-blue-500 ring-4 ring-blue-100" : "bg-slate-300 ring-4 ring-slate-100"
            )} />
            <div className={cn(
              "absolute left-[-13.25px] top-4.5 bottom-[-58px] z-0",
              isLineCompleted("Cheque Recd. At HO Date")
                ? "w-[2.5px] bg-emerald-400"
                : isDashedPath
                  ? "w-0 border-l-[2.5px] border-dashed border-blue-400"
                  : "w-[2.5px] bg-slate-200"
            )} />
            <span className={cn("text-[9px] uppercase tracking-wider font-extrabold", isCompletedVal(record["Certified at HO & Sent to Accounts on"]) ? "text-slate-400" : "text-slate-300")}>Certified at HO & Sent to Accounts on</span>
            <span className={cn(
                "font-bold font-mono text-[11px] px-1 rounded inline-block", 
                isCompletedVal(record["Certified at HO & Sent to Accounts on"]) ? "text-slate-700" : "text-slate-400 italic",
                (record["Certified at HO & Sent to Accounts on"] && !record["_rawCertifiedDate"]) && "text-orange-600 bg-transparent"
            )}>
              {record["Certified at HO & Sent to Accounts on"] || "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 bg-emerald-500/10 border-b border-emerald-50/50 space-y-3">
        <div className="flex items-center justify-between border-b border-emerald-100 pb-1 pl-5">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Payment Process</span>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-emerald-600 font-normal">Account Days: <span className="font-normal text-emerald-700">{record["Account Days"] ?? "-"}</span></span>
            <span className="text-emerald-250">|</span>
            <span className="text-slate-400 font-normal">Target: {accTarget}</span>
            {renderDeviationStr(accActual, accTarget)}
          </div>
        </div>
        <div className="relative pl-5 space-y-3.5 pt-0.5">
          <div className="relative text-[11px] flex flex-col gap-0.5">
            <div className={cn(
              "absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
              isCompletedVal(record["Cheque Recd. At HO Date"]) ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-slate-300 ring-4 ring-slate-100"
            )} />
            <div className={cn(
              "absolute left-[-13.25px] top-4.5 w-[2.5px] bottom-[-18px] z-0",
              isLineCompleted("Cheque Recd. At Site Date") ? "bg-emerald-500" : "bg-slate-200"
            )} />
            <span className={cn("text-[9px] uppercase tracking-wider font-extrabold", isCompletedVal(record["Cheque Recd. At HO Date"]) ? "text-slate-400" : "text-slate-300")}>Cheque Recd. At HO Date</span>
            <span className={cn(
                "font-bold font-mono text-[11px] px-1 rounded inline-block", 
                isCompletedVal(record["Cheque Recd. At HO Date"]) ? "text-slate-700" : "text-slate-400 italic",
                (record["Cheque Recd. At HO Date"] && !record["_rawChequeRecdHoDate"]) && "text-orange-600 bg-transparent"
            )}>
              {record["Cheque Recd. At HO Date"] || "-"}
            </span>
          </div>
          <div className="relative text-[11px] flex flex-col gap-0.5">
            <div className={cn(
              "absolute -left-[19px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10",
              isCompletedVal(record["Cheque Recd. At Site Date"]) ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-slate-300 ring-4 ring-slate-100"
            )} />
            <span className={cn("text-[9px] uppercase tracking-wider font-extrabold", isCompletedVal(record["Cheque Recd. At Site Date"]) ? "text-slate-400" : "text-slate-300")}>Cheque Recd. At Site Date</span>
            <span className={cn(
                "font-bold font-mono text-[11px] px-1 rounded inline-block", 
                isCompletedVal(record["Cheque Recd. At Site Date"]) ? "text-slate-700" : "text-slate-400 italic",
                (record["Cheque Recd. At Site Date"] && !record["_rawChequeRecdSiteDate"]) && "text-orange-600 bg-transparent"
            )}>
              {record["Cheque Recd. At Site Date"] || "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="py-2 px-3 bg-slate-50 border-t border-slate-200 flex justify-end">
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-500 font-normal">Total Days: <span className="font-normal text-slate-700">{record["Inward to Payment Cycle Days"] ?? "-"}</span></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-400 font-normal">Target: {totalTarget.toFixed(1)}</span>
          {renderDeviationStr(totalActual, totalTarget)}
        </div>
      </div>
    </div>
  );
}
