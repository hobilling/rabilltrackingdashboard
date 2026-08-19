import { parse, isValid, startOfDay } from 'date-fns';
import { InvoiceRecord } from '../types';

export const parseRecordDate = (rawDate: any) => {
  if (!rawDate) return null;
  
  let dateObj: Date | null = null;
  
  if (typeof rawDate === 'number') {
    // Excel serial date conversion
    dateObj = new Date((rawDate - 25569) * 86400 * 1000);
  } else if (typeof rawDate === 'string') {
    // Try parsing common formats
    const formats = ['dd-MM-yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'd-MMM-yy', 'yyyy-MM-dd\'T\'HH:mm:ss.SSSX'];
    for (const f of formats) {
      const parsed = parse(rawDate, f, new Date());
      if (isValid(parsed)) {
        dateObj = parsed;
        break;
      }
    }
    
    // Fallback to native Date parser if formats fail
    if (!dateObj) {
      const native = new Date(rawDate);
      if (isValid(native)) dateObj = native;
    }
  } else if (rawDate instanceof Date) {
    dateObj = rawDate;
  }

  if (dateObj && isValid(dateObj)) {
    return startOfDay(dateObj);
  }
  return null;
};

export const isCompletedVal = (val: any) => {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return s !== "" && s !== "-" && s !== "pending" && s !== "na" && s !== "n/a";
};

export const getStatusDateVal = (rec: InvoiceRecord) => {
  const s = String(rec["Status"] || "").toLowerCase();
  if (s.includes("inward") || s.includes("01")) return rec["Inward Date"];
  if (s.includes("excel done") || s.includes("02")) return rec["EXCEL Date"];
  if (s.includes("high rise") || s.includes("highrise") || s.includes("03")) return rec["Highrise RA Date"];
  if (s.includes("hold at site") || s.includes("04")) return rec["Inward Date"]; // Approximate
  if (s.includes("send to ho") || s.includes("sent to ho") || s.includes("05")) return rec["HO Submission Date"];
  if (s.includes("received at ho") || s.includes("receive at ho") || s.includes("06")) return rec["Received at HO"];
  if (s.includes("hold at ho") || s.includes("07")) return rec["Received at HO"]; // Approximate
  if (s.includes("send to accounts") || s.includes("sent to accounts") || s.includes("08")) return rec["Certified at HO & Sent to Accounts on"];
  if (s.includes("cleared") || s.includes("cheque") || s.includes("09") || s.includes("10")) return rec["Cheque Recd. At Site Date"] || rec["Cheque Recd. At HO Date"];
  return null;
};

export const formatDaysOrMonths = (days: number) => {
  if (days <= 0) return "Today";
  if (days <= 30) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const monthsVal = days / 30;
  const formatted = parseFloat(monthsVal.toFixed(1));
  return `${formatted} month${formatted === 1 ? "" : "s"}`;
};

export const getStatusStyles = (statusStr: string, currentRecord: InvoiceRecord) => {
  const s = (statusStr || "").toLowerCase();
  
  // Specific catch for Cyan: Sent to Account AND Has Balance
  const paymentStatus = String(currentRecord?.["Payment Status"] || "").toLowerCase();
  const isSentToAccount = s.includes("08 ") || s.includes("send to accounts") || s.includes("sent to accounts");
  const hasBalance = paymentStatus.includes("balance");

  if (isSentToAccount && hasBalance) {
    return "bg-cyan-100 text-cyan-800 border-cyan-200";
  }

  // RED: Hold Status (Lightened to use dark text)
  if (s.includes("hold") || (currentRecord && (currentRecord["Hold at Site"] === "Yes" || currentRecord["Hold at HO"] === "Yes"))) {
    return "bg-red-100 text-red-800 border-red-200 shadow-sm";
  }
  
  // EMERALD: Payment Cleared / Cheque Received
  if (s.includes("10 ") || s.includes("09 ") || s.includes("cheque") || s.includes("payment") || s.includes("cleared")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  
  // BLUE: Received at HO / Certified
  if (s.includes("07 ") || s.includes("06 ") || s.includes("certified") || s.includes("received at ho") || s.includes("receive at ho")) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  
  // AMBER: Site Level / Send to HO
  if (s.includes("01 ") || s.includes("02 ") || s.includes("03 ") || s.includes("04 ") || s.includes("05 ") || s.includes("site") || s.includes("inward") || s.includes("excel") || s.includes("highrise") || s.includes("send to ho") || s.includes("sent to ho")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  
  return "bg-slate-100 text-slate-800 border-slate-200";
};

export const getPaymentStatusStyles = (statusVal: any) => {
  const s = String(statusVal || "").toLowerCase();
  if (s.includes("cleared")) {
    return "bg-emerald-50 text-emerald-705 border-emerald-250 font-bold";
  }
  if (s.includes("partially") || s.includes("partial")) {
    return "bg-orange-50 text-orange-705 border-orange-250 font-bold";
  }
  return "bg-red-50 text-red-650 border-red-250 font-bold";
};
