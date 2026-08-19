import React, { useMemo, useState, useContext, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
    X, 
    Search,
    AlertCircle, 
    ShieldAlert, 
    CheckCircle,
    CheckCircle2, 
    AlertTriangle,
    Info,
    Calendar,
    RefreshCw,
    ArrowRight,
    MapPin,
    FileText,
    Calculator,
    Zap,
    ChevronDown,
    ChevronUp,
    Clock,
    AlertOctagon,
    Target,
    Building,
    CreditCard,
    FileDown,
    Printer,
    Camera
} from 'lucide-react';
import * as XLSX from "xlsx-js-style";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InvoiceRecord } from '../types';
import { cn } from '@/lib/utils';
import { format, differenceInDays, isValid } from 'date-fns';
import { AppContext } from '../App';
import { DetailTimelineModal } from './dashboard/analytics/DetailTimelineModal';
import { isExemptFromDuplicates, isBillingPeriodExempt } from '../utils/auditUtils';
import { motion } from 'motion/react';
import { getAuditGroupsData } from '../utils/auditUtils';

interface InsightReportProps {
    data: InvoiceRecord[];
    onClose: () => void;
}

const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (Math.abs(val) >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)}`;
};

const formatFullCurrency = (val: number) => {
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)}`;
};

interface ResizableBoxProps {
    children: React.ReactNode;
    defaultMaxHeight: number;
    className?: string;
    style?: React.CSSProperties;
}

const ResizableBox: React.FC<ResizableBoxProps> = ({ 
    children, 
    defaultMaxHeight,
    className,
    style
}) => {
    const initialHeight = useMemo(() => {
        if (style && style.height !== undefined) {
            const hStr = String(style.height);
            if (hStr.endsWith('px')) {
                const parsed = parseInt(hStr, 10);
                if (!isNaN(parsed)) return parsed;
            } else if (!isNaN(Number(style.height))) {
                return Number(style.height);
            }
        }
        return defaultMaxHeight;
    }, [style, defaultMaxHeight]);

    const containerRef = useRef<HTMLDivElement>(null);
    const [isScrollable, setIsScrollable] = useState(false);
    const [maxHeight, setMaxHeight] = useState(initialHeight);
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(0);

    // Keep state in sync if initialHeight prop changes
    useEffect(() => {
        setMaxHeight(initialHeight);
    }, [initialHeight]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        
        const checkScroll = () => {
            setIsScrollable(el.scrollHeight > el.clientHeight + 2);
        };
        
        checkScroll();
        const observer = new ResizeObserver(checkScroll);
        observer.observe(el);
        
        const checkTimeout = setTimeout(checkScroll, 500);
        
        return () => {
            observer.disconnect();
            clearTimeout(checkTimeout);
        };
    }, [children, maxHeight]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        startYRef.current = e.clientY;
        startHeightRef.current = maxHeight;
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        startYRef.current = e.touches[0].clientY;
        startHeightRef.current = maxHeight;
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaY = e.clientY - startYRef.current;
            const newHeight = Math.max(100, Math.min(1000, startHeightRef.current + deltaY));
            setMaxHeight(newHeight);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches && e.touches[0]) {
                const deltaY = e.touches[0].clientY - startYRef.current;
                const newHeight = Math.max(100, Math.min(1000, startHeightRef.current + deltaY));
                setMaxHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging]);

    const sanitizedStyle = useMemo(() => {
        if (!style) return undefined;
        const { height, ...rest } = style;
        return rest;
    }, [style]);

    return (
        <div className="relative group/resize select-none">
            <div 
                ref={containerRef} 
                style={{ 
                    maxHeight: `${maxHeight}px`, 
                    height: isDragging ? `${maxHeight}px` : (maxHeight > initialHeight ? `${maxHeight}px` : 'auto'),
                    ...sanitizedStyle 
                }}
                className={cn("overflow-y-auto", className)}
            >
                {children}
            </div>
            
            {isScrollable && (
                <div 
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    className={cn(
                        "w-full h-2 bg-slate-100 hover:bg-slate-250 border-t border-slate-200 cursor-ns-resize flex items-center justify-center transition-all mt-1 rounded-b select-none",
                        isDragging ? "bg-slate-300" : ""
                    )}
                    title="Drag to resize vertically"
                >
                    <div className="flex gap-[3px] items-center">
                        <span className="w-1.5 h-1 bg-slate-400 rounded-full" />
                        <span className="w-1.5 h-1 bg-slate-400 rounded-full" />
                        <span className="w-1.5 h-1 bg-slate-400 rounded-full" />
                    </div>
                </div>
            )}
        </div>
    );
};

const isValMissing = (val: any): boolean => {
    if (val === undefined || val === null) return true;
    const s = String(val).trim();
    return s === "" || s.toLowerCase() === "n/a" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined";
};

const renderMissingValueAlert = (val: any) => {
    if (isValMissing(val)) {
        return <span className="bg-red-100 text-red-800 font-bold px-1 rounded border border-red-200 text-[8px] uppercase select-none inline-block">MISSING</span>;
    }
    return <span>{String(val)}</span>;
};

const renderMissingValueAlertCurrency = (val: any) => {
    if (isValMissing(val)) {
        return <span className="bg-red-100 text-red-800 font-bold px-1 rounded border border-red-200 text-[8px] uppercase select-none inline-block">MISSING</span>;
    }
    return <span className="font-bold text-slate-800">{formatFullCurrency(Number(val || 0))}</span>;
};

const parseDateStr = (str: any): Date | null => {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

const checkChronologyViolations = (r: InvoiceRecord) => {
    // Use raw dates for auditing strictly
    const d1 = parseDateStr(r._rawInwardDate);
    const d2_ex = parseDateStr(r._rawEXCELDate);
    const d2_hi = parseDateStr(r._rawHighriseRADate);
    const d3 = parseDateStr(r._rawHOSubmissionDate);
    const d4 = parseDateStr(r._rawReceivedHODate);
    const d5 = parseDateStr(r._rawCertifiedDate);
    const d6 = parseDateStr(r._rawChequeRecdHoDate);
    const d7 = parseDateStr(r._rawChequeRecdSiteDate);

    const violations = {
        inward: false,
        excel: false,
        highrise: false,
        excelOrHi: false,
        submission: false,
        received: false,
        certified: false,
        chequeHo: false,
        chequeSite: false,
    };

    // To identify which column is the actual violator (for the icon)
    const violators = {
        inward: false,
        excel: false,
        highrise: false,
        excelOrHi: false,
        submission: false,
        received: false,
        certified: false,
        chequeHo: false,
        chequeSite: false,
    };

    const status = String(r['Status'] || '').trim().toLowerCase();
    const billType = String(r['Bill Type'] || '').trim().toLowerCase();

    // Status containing 'HOLD' is exempted from violations
    if (status.includes('hold')) return { violations, violators };

    const isSameDay = (a: Date | null, b: Date | null) => {
        if (!a || !b) return false;
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth() === b.getMonth() &&
               a.getDate() === b.getDate();
    };

    const isFinancialYearEndGrace = (d: Date | null) => {
        if (!d) return false;
        // March is month 2 (0-indexed)
        return d.getMonth() === 2 && d.getDate() >= 25 && d.getDate() <= 31;
    };

    const hiGrace = isFinancialYearEndGrace(d2_hi);
    const exGrace = isFinancialYearEndGrace(d2_ex);

    const EXEMPT_HI_TYPES = ['advance', 'retention', 'quality', 'sd release', 'sd-release'];
    const EXEMPT_EXCEL_TYPES = ['acs', 'advance', 'retention', 'quality', 'sd release'];

    const hiExempt = hiGrace || EXEMPT_HI_TYPES.some(t => billType.includes(t));
    const exExempt = exGrace || EXEMPT_EXCEL_TYPES.some(t => billType.includes(t));

    // Check d2_ex >= d1
    if (d1 && d2_ex && !exExempt && d2_ex < d1 && !isSameDay(d2_ex, d1)) {
        violations.excel = true;
        violations.inward = true;
        violators.excel = true;
    }

    // Check d2_hi (Highrise RA Date)
    if (d2_hi && !hiExempt) {
        if (d1 && d2_hi < d1 && !isSameDay(d2_hi, d1)) {
            violations.highrise = true;
            violations.inward = true;
            violators.highrise = true;
        }
    }

    // Check d3 (HO Submission)
    if (d3) {
        if (d2_ex && d3 < d2_ex && !isSameDay(d3, d2_ex)) {
            violations.submission = true;
            violations.excel = true;
            violators.submission = true;
        } else if (d1 && d3 < d1 && !isSameDay(d3, d1)) {
            violations.submission = true;
            violations.inward = true;
            violators.submission = true;
        }
    }

    // Check d4 (Received at HO)
    if (d4) {
        if (d3 && d4 < d3 && !isSameDay(d4, d3)) {
            violations.received = true;
            violations.submission = true;
            violators.received = true;
        } else if (d2_ex && d4 < d2_ex && !isSameDay(d4, d2_ex)) {
            violations.received = true;
            violations.excel = true;
            violators.received = true;
        } else if (d1 && d4 < d1 && !isSameDay(d4, d1)) {
            violations.received = true;
            violations.inward = true;
            violators.received = true;
        }
    }

    // Check d5 (Certified Date) - d5 >= d4
    if (d5 && d4 && d5 < d4 && !isSameDay(d5, d4)) {
        violations.certified = true;
        violations.received = true;
        violators.certified = true;
    }

    // Check d6 (Cheque HO)
    if (d6) {
        if (d4 && d6 < d4 && !isSameDay(d6, d4)) {
            violations.chequeHo = true;
            violations.received = true;
            violators.chequeHo = true;
        } else if (d2_hi && !hiGrace && d6 < d2_hi && !isSameDay(d6, d2_hi)) {
            violations.chequeHo = true;
            violations.highrise = true;
            violators.chequeHo = true;
        }
    }

    // Check d7 (Cheque Site)
    if (d7) {
        if (d6 && d7 < d6 && !isSameDay(d7, d6)) {
            violations.chequeSite = true;
            violations.chequeHo = true;
            violators.chequeSite = true;
        }
    }

    violations.excelOrHi = violations.excel || violations.highrise;
    violators.excelOrHi = violators.excel || violators.highrise;

    return { violations, violators };
};

const checkMissingFlowViolations = (r: InvoiceRecord) => {
    // Use raw dates for auditing strictly
    const m1 = r._rawInwardDate;
    const m2_ex = r._rawEXCELDate;
    const m2_hi = r._rawHighriseRADate;
    const m3 = r._rawHOSubmissionDate;
    const m4 = r._rawReceivedHODate;
    const m5 = r._rawCertifiedDate;
    const m6 = r._rawChequeRecdHoDate;
    const m7 = r._rawChequeRecdSiteDate;

    const isPresent = (val: any) => {
        if (val === null || val === undefined) return false;
        const s = String(val).trim().toLowerCase();
        return s !== "" && s !== "0" && s !== "na" && s !== "n/a" && s !== "0.00" && s !== "invalid date";
    };

    const p1 = isPresent(m1);
    const p2_ex = isPresent(m2_ex);
    const p2_hi = isPresent(m2_hi);
    const p3 = isPresent(m3);
    const p4 = isPresent(m4);
    const p5 = isPresent(m5);
    const p6 = isPresent(m6);
    const p7 = isPresent(m7);

    // Identify current data progress
    let dataIdx = -1;
    if (p7) dataIdx = 7;
    else if (p6) dataIdx = 6;
    else if (p5) dataIdx = 5;
    else if (p4) dataIdx = 4;
    else if (p3) dataIdx = 3;
    else if (p2_hi) dataIdx = 2; // Highrise RA
    else if (p2_ex) dataIdx = 1; // EXCEL RA
    else if (p1) dataIdx = 0;   // Inward

    // Identify status-based expected progress
    const status = String(r['Status'] || '').trim();
    const statusLower = status.toLowerCase();
    const billType = String(r['Bill Type'] || '').trim().toLowerCase();

    let statusIdx = -1;
    if (status.includes('09 Cheque Recd. At site')) statusIdx = 7;
    else if (status.includes('09 Cheque Recd. At HO')) statusIdx = 6;
    else if (status.includes('08 Send To Accounts')) statusIdx = 5;
    else if (status.includes('06 Received At HO')) statusIdx = 4;
    else if (status.includes('05 Send To HO')) statusIdx = 3;
    else if (status.includes('03 Site - High Rise Done')) statusIdx = 2;
    else if (status.includes('02 Site - Excel Done')) statusIdx = 1;
    else if (status.includes('01 Site - In Process')) statusIdx = 0;

    const maxIdx = Math.max(dataIdx, statusIdx);

    let lastExistIdx = -1;
    if (p7) lastExistIdx = 7;
    else if (p6) lastExistIdx = 6;
    else if (p5) lastExistIdx = 5;
    else if (p4) lastExistIdx = 4;
    else if (p3) lastExistIdx = 3;
    else if (p2_hi) lastExistIdx = 2;
    else if (p2_ex) lastExistIdx = 1;
    else if (p1) lastExistIdx = 0;

    const EXEMPT_HI_TYPES = ['advance', 'retention', 'quality', 'sd release', 'sd-release'];
    const EXEMPT_EXCEL_TYPES = ['acs', 'advance', 'retention', 'quality', 'sd release'];

    const hiExempt = EXEMPT_HI_TYPES.some(t => billType.includes(t));
    const exExempt = EXEMPT_EXCEL_TYPES.some(t => billType.includes(t));

    const missingViolations = {
        inward: lastExistIdx > 0 && !p1,
        excel: lastExistIdx > 1 && !p2_ex && !exExempt,
        highrise: lastExistIdx > 2 && !p2_hi && !hiExempt,
        excelOrHi: (lastExistIdx > 1 && !p2_ex && !exExempt) || (lastExistIdx > 2 && !p2_hi && !hiExempt),
        submission: lastExistIdx > 3 && !p3,
        received: lastExistIdx > 4 && !p4,
        certified: lastExistIdx > 5 && !p5,
        chequeHo: lastExistIdx > 6 && !p6,
        chequeSite: false, // Site date is the last, so nothing "after" it to trigger "missing in flow"
    };

    // Status containing 'HOLD' is exempted from all missing violations
    if (statusLower.includes('hold')) {
        return {
            inward: false,
            excel: false,
            highrise: false,
            excelOrHi: false,
            submission: false,
            received: false,
            certified: false,
            chequeHo: false,
            chequeSite: false,
        };
    }

    return missingViolations;
};

const checkFutureDateViolations = (r: InvoiceRecord) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const dates: Record<string, string | null | undefined> = {
        inward: r._rawInwardDate ?? r['Inward Date'],
        excel: r._rawEXCELDate ?? r['EXCEL Date'],
        highrise: r._rawHighriseRADate ?? r['Highrise RA Date'],
        submission: r._rawHOSubmissionDate ?? r['HO Submission Date'],
        received: r._rawReceivedHODate ?? r['Received at HO'],
        certified: r._rawCertifiedDate ?? r['Certified at HO & Sent to Accounts on'],
        chequeHo: r._rawChequeRecdHoDate ?? r['Cheque Recd. At HO Date'],
        chequeSite: r._rawChequeRecdSiteDate ?? r['Cheque Recd. At Site Date'],
    };

    const violations: Record<string, boolean> = {};
    Object.entries(dates).forEach(([key, val]) => {
        const dateObj = val ? new Date(val as string) : null;
        violations[key] = !!(dateObj && !isNaN(dateObj.getTime()) && dateObj > today);
    });

    return violations;
};

const renderBillInfoCell = (r: InvoiceRecord, highlightMissing: boolean) => {
    const typeMissing = isValMissing(r['Bill Type']);
    const headMissing = isValMissing(r['Work Head']);
    const periodMissing = isValMissing(r['Billing Period']) && !isBillingPeriodExempt(r);
    const locMissing = isValMissing(r['LOCATION/Bldg.']);

    if (!typeMissing && !headMissing && !locMissing && !periodMissing) {
        return `${r['Bill Type']} | ${r['Work Head']} | ${r['Billing Period']} [${r['LOCATION/Bldg.']}]`;
    }

    return (
        <span className="inline-flex flex-nowrap gap-1 items-center font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
            {typeMissing && highlightMissing ? (
                <span className="bg-red-100 text-red-800 font-bold px-1 rounded border border-red-200 text-[8px] uppercase select-none inline-block shrink-0">MISSING (BILL TYPE)</span>
            ) : (<span className="shrink-0">{r['Bill Type'] || 'N/A'}</span>)}
            <span className="text-slate-300 shrink-0">|</span>
            {headMissing && highlightMissing ? (
                <span className="bg-red-100 text-red-800 font-bold px-1 rounded border border-red-200 text-[8px] uppercase select-none inline-block shrink-0">missing (Work Head)</span>
            ) : (<span className="shrink-0">{r['Work Head'] || 'N/A'}</span>)}
            <span className="text-slate-300 shrink-0">|</span>
            {periodMissing && highlightMissing ? (
                <span className="bg-red-100 text-red-800 font-bold px-1 rounded border border-red-200 text-[8px] uppercase select-none inline-block shrink-0">missing (Billing Period)</span>
            ) : (<span className="shrink-0">{r['Billing Period'] || 'N/A'}</span>)}
            <span className="text-slate-300 shrink-0">[</span>
            {locMissing && highlightMissing ? (
                <span className="bg-red-100 text-red-800 font-bold px-1 rounded border border-red-200 text-[8px] uppercase select-none inline-block shrink-0">missing (Location)</span>
            ) : (<span className="shrink-0">{r['LOCATION/Bldg.'] || 'N/A'}</span>)}
            <span className="text-slate-300 shrink-0">]</span>
        </span>
    );
};

const renderDateCell = (
    r: InvoiceRecord, 
    fieldKey: 'Inward Date' | 'EXCEL Date' | 'Highrise RA Date' | 'HO Submission Date' | 'Received at HO' | 'Certified at HO & Sent to Accounts on' | 'Cheque Recd. At HO Date' | 'Cheque Recd. At Site Date',
    chronoKey: keyof ReturnType<typeof checkChronologyViolations>['violations'],
    missingKey: keyof ReturnType<typeof checkMissingFlowViolations>
) => {
    const { violations: chrono, violators } = checkChronologyViolations(r);
    const flow = checkMissingFlowViolations(r);
    
    // Mapping for raw dates
    const rawFields: Record<string, keyof InvoiceRecord> = {
        'Inward Date': '_rawInwardDate',
        'EXCEL Date': '_rawEXCELDate',
        'Highrise RA Date': '_rawHighriseRADate',
        'HO Submission Date': '_rawHOSubmissionDate',
        'Received at HO': '_rawReceivedHODate',
        'Certified at HO & Sent to Accounts on': '_rawCertifiedDate',
        'Cheque Recd. At HO Date': '_rawChequeRecdHoDate',
        'Cheque Recd. At Site Date': '_rawChequeRecdSiteDate'
    };

    const rawKey = rawFields[fieldKey];
    const originalVal = rawKey ? r[rawKey] : null;
    const processedVal = r[fieldKey];
    let val = originalVal || processedVal;
    
    // Transformed means original was missing but processed value exists
    let isTransformer = !!(!originalVal && processedVal);

    if (fieldKey === 'Cheque Recd. At Site Date') {
        val = originalVal;
        isTransformer = false;
    }

    const isChronoViold = chrono[chronoKey];
    const isFlowViold = flow[missingKey];
    const isPrimaryViolator = violators[chronoKey];

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const parseRawDate = (v: any): Date | null => {
        if (v === undefined || v === null || v === '') return null;
        let dObj: Date;
        const numVal = typeof v === 'number' ? v : (String(v).match(/^\d+$/) ? Number(v) : NaN);
        if (!isNaN(numVal)) {
            dObj = new Date((numVal - 25569) * 86400 * 1000);
        } else {
            dObj = new Date(v);
        }
        return (dObj && !isNaN(dObj.getTime())) ? dObj : null;
    };

    const dateObj = parseRawDate(val);
    const isFutureDate = !!(dateObj && dateObj > today);

    let formatted = '';
    if (fieldKey === 'Cheque Recd. At Site Date') {
        formatted = String(val ?? '-');
    } else if (val !== undefined && val !== null && val !== '') {
        const numVal = typeof val === 'number' ? val : (String(val).match(/^\d+$/) ? Number(val) : NaN);
        if (!isNaN(numVal)) {
            try {
                const d = new Date((numVal - 25569) * 86400 * 1000);
                if (!isNaN(d.getTime())) {
                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = months[d.getMonth()];
                    const year = String(d.getFullYear()).slice(-2);
                    formatted = `${day}-${month}-${year}`;
                }
            } catch (e) {}
        }
        if (!formatted) {
            formatted = String(val);
        }
    }

    if (isFlowViold) {
        return (
            <span className="bg-red-100/80 text-red-700 font-bold px-1 rounded border border-red-300 text-[8px] uppercase select-none inline-block">
                MISSING (SEQ)
            </span>
        );
    }

    if (isFutureDate && val) {
        return (
            <span className="bg-yellow-100 text-yellow-900 font-bold px-1 rounded border border-yellow-300 text-[8px] uppercase select-none inline-block" title="Future date violation">
                {formatted}
            </span>
        );
    }

    if (isChronoViold && val) {
        return (
            <span className="bg-orange-100 text-orange-900 font-bold px-1 rounded border border-orange-300 text-[8px] uppercase select-none inline-block" title="Chronology backdating violation">
                {formatted}
            </span>
        );
    }

    if (isTransformer && processedVal) {
        return (
            <span className="bg-orange-50 text-orange-700 font-bold px-1 rounded border border-orange-200 text-[8px] uppercase select-none inline-block" title="Transformed via Reverse Waterfall">
                {formatted}
            </span>
        );
    }

    if (val) {
        return (
            <span className="text-slate-600 font-semibold text-[10px] select-none inline-block py-0.5">
                {formatted}
            </span>
        );
    }

    return (
        <span className="text-slate-300 font-normal text-[10px] select-none inline-block py-0.5">
            N/A
        </span>
    );
};

export const InsightReport: React.FC<InsightReportProps> = ({ data, onClose }) => {
    const context = useContext(AppContext);
    const siteTargetDays = context?.targets?.site ?? 5;

    const isPaid = (r: InvoiceRecord) => {
        const s = String(r['Payment Status'] || '').toLowerCase();
        return s.includes('cleared') || s.includes('full');
    };

    const isSiteHoldFn = (r: InvoiceRecord) => {
        if (isPaid(r)) return false;
        const statusLower = String(r['Status'] || '').toLowerCase();
        const holdAtSiteVal = String(r['Hold at Site'] || '').toLowerCase() === 'yes';
        return statusLower.includes('hold at site') || holdAtSiteVal;
    };

    const isHoHoldFn = (r: InvoiceRecord) => {
        if (isPaid(r)) return false;
        const statusLower = String(r['Status'] || '').toLowerCase();
        const holdAtHoVal = String(r['Hold at HO'] || '').toLowerCase() === 'yes';
        return statusLower.includes('hold at ho') || holdAtHoVal;
    };

    const hoTargetDays = context?.targets?.ho ?? 1.5;
    const accountsTargetDays = context?.targets?.accounts ?? 6;
    
    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 5 },
        show: (i: number) => ({ 
            opacity: 1, 
            y: 0,
            transition: {
                delay: Math.min(i * 0.05, 2), // Cap delay so it doesn't take forever
                duration: 0.2,
                ease: "easeOut"
            }
        })
    };

    // Filter site active/pending bills (status contains 01 to 05, or is site hold)
    const sitePendingBills = useMemo(() => {
        return data.filter(r => {
            if (isPaid(r)) return false;
            if (isSiteHoldFn(r)) return true;
            const s = String(r['Status'] || '');
            return s.includes('01') || s.includes('02') || s.includes('03') || s.includes('04') || s.includes('05');
        });
    }, [data]);

    // Filter HO active/pending bills (status contains 06 or 07 or contains "HO", or is HO hold)
    const hoPendingBills = useMemo(() => {
        return data.filter(r => {
            if (isPaid(r)) return false;
            if (isHoHoldFn(r)) return true;
            const s = String(r['Status'] || '');
            const isSite = s.includes('01') || s.includes('02') || s.includes('03') || s.includes('04') || s.includes('05') || isSiteHoldFn(r);
            return !isSite && (s.includes('06') || s.includes('07') || s.toLowerCase().includes('ho'));
        });
    }, [data]);

    // Filter Accounts active/pending bills (status contains 08, 09, 10 or "Accounts")
    const accountsPendingBills = useMemo(() => {
        return data.filter(r => {
            if (isPaid(r)) return false;
            const s = String(r['Status'] || '');
            const pStatus = String(r['Payment Status'] || '').trim().toLowerCase();
            const isTargetPaymentStatus = pStatus === 'payment balance' || pStatus === 'partial payment balance';
            return isTargetPaymentStatus && (s.includes('08') || s.includes('09') || s.includes('10') || s.toLowerCase().includes('account'));
        });
    }, [data]);

    // Group and calculate Within Target & Ageing bands for Site
    const siteLevelPerformance = useMemo(() => {
        const today = new Date();
        const target = siteTargetDays;
        const b1Limit = Math.round(target * 3);
        const b2Limit = Math.round(target * 6);
        const groups: Record<string, {
            projectName: string;
            allBills: InvoiceRecord[];
            withinTarget: { count: number; amount: number; bills: InvoiceRecord[] };
            overdueBand1: { count: number; amount: number; bills: InvoiceRecord[] }; 
            overdueBand2: { count: number; amount: number; bills: InvoiceRecord[] }; 
            overdueBand3: { count: number; amount: number; bills: InvoiceRecord[] }; 
            hold: { count: number; amount: number; bills: InvoiceRecord[] };
        }> = {};

        sitePendingBills.forEach(r => {
            const pName = r['Project'] || r['Source'] || 'Main Site';
            if (!groups[pName]) {
                groups[pName] = {
                    projectName: pName,
                    allBills: [],
                    withinTarget: { count: 0, amount: 0, bills: [] },
                    overdueBand1: { count: 0, amount: 0, bills: [] },
                    overdueBand2: { count: 0, amount: 0, bills: [] },
                    overdueBand3: { count: 0, amount: 0, bills: [] },
                    hold: { count: 0, amount: 0, bills: [] }
                };
            }

            const g = groups[pName];
            g.allBills.push(r);

            const netPayable = Number(r['Bill Amount (Net Payble)'] || 0);

            if (isSiteHoldFn(r)) {
                g.hold.count++;
                g.hold.amount += netPayable;
                g.hold.bills.push(r);
            } else {
                const dInward = r['Inward Date'] ? new Date(r['Inward Date']) : null;
                const days = dInward && isValid(dInward) ? Math.max(0, differenceInDays(today, dInward)) : 0;

                if (days <= target) {
                    g.withinTarget.count++;
                    g.withinTarget.amount += netPayable;
                    g.withinTarget.bills.push(r);
                } else if (days <= b1Limit) {
                    g.overdueBand1.count++;
                    g.overdueBand1.amount += netPayable;
                    g.overdueBand1.bills.push(r);
                } else if (days <= b2Limit) {
                    g.overdueBand2.count++;
                    g.overdueBand2.amount += netPayable;
                    g.overdueBand2.bills.push(r);
                } else {
                    g.overdueBand3.count++;
                    g.overdueBand3.amount += netPayable;
                    g.overdueBand3.bills.push(r);
                }
            }
        });

        return Object.values(groups).sort((a, b) => a.projectName.localeCompare(b.projectName));
    }, [sitePendingBills, siteTargetDays]);

    // Group and calculate Within Target & Ageing bands for HO
    const hoLevelPerformance = useMemo(() => {
        const today = new Date();
        const target = hoTargetDays;
        const b1Limit = Math.round(target * 3);
        const b2Limit = Math.round(target * 6);
        const groups: Record<string, {
            projectName: string;
            allBills: InvoiceRecord[];
            withinTarget: { count: number; amount: number; bills: InvoiceRecord[] };
            overdueBand1: { count: number; amount: number; bills: InvoiceRecord[] }; 
            overdueBand2: { count: number; amount: number; bills: InvoiceRecord[] }; 
            overdueBand3: { count: number; amount: number; bills: InvoiceRecord[] }; 
            hold: { count: number; amount: number; bills: InvoiceRecord[] };
        }> = {};

        hoPendingBills.forEach(r => {
            const pName = r['Project'] || r['Source'] || 'Main Site';
            if (!groups[pName]) {
                groups[pName] = {
                    projectName: pName,
                    allBills: [],
                    withinTarget: { count: 0, amount: 0, bills: [] },
                    overdueBand1: { count: 0, amount: 0, bills: [] },
                    overdueBand2: { count: 0, amount: 0, bills: [] },
                    overdueBand3: { count: 0, amount: 0, bills: [] },
                    hold: { count: 0, amount: 0, bills: [] }
                };
            }

            const g = groups[pName];
            g.allBills.push(r);

            const netPayable = Number(r['Bill Amount (Net Payble)'] || 0);

            if (isHoHoldFn(r)) {
                g.hold.count++;
                g.hold.amount += netPayable;
                g.hold.bills.push(r);
            } else {
                // Strictly Received at HO for ageing, DO NOT FALLBACK
                const dHO = r['Received at HO'] ? new Date(r['Received at HO']) : null;
                const days = dHO && isValid(dHO) ? Math.max(0, differenceInDays(today, dHO)) : 0;

                if (days <= target) {
                    g.withinTarget.count++;
                    g.withinTarget.amount += netPayable;
                    g.withinTarget.bills.push(r);
                } else if (days <= b1Limit) {
                    g.overdueBand1.count++;
                    g.overdueBand1.amount += netPayable;
                    g.overdueBand1.bills.push(r);
                } else if (days <= b2Limit) {
                    g.overdueBand2.count++;
                    g.overdueBand2.amount += netPayable;
                    g.overdueBand2.bills.push(r);
                } else {
                    g.overdueBand3.count++;
                    g.overdueBand3.amount += netPayable;
                    g.overdueBand3.bills.push(r);
                }
            }
        });

        return Object.values(groups).sort((a, b) => a.projectName.localeCompare(b.projectName));
    }, [hoPendingBills, hoTargetDays]);

    // Group and calculate Within Target & Ageing bands for Accounts/Finance (nested 3 lines for each project)
    const accountsLevelPerformance = useMemo(() => {
        const today = new Date();

        // Group raw accounts pending bills by project
        const projectGroupsRaw: Record<string, InvoiceRecord[]> = {};
        accountsPendingBills.forEach(r => {
            const pName = r['Project'] || r['Source'] || 'Main Site';
            if (!projectGroupsRaw[pName]) projectGroupsRaw[pName] = [];
            projectGroupsRaw[pName].push(r);
        });

        const buildSection = (projectName: string, billsList: InvoiceRecord[], subType: 'partial' | 'unpaid' | 'total') => {
            const result = {
                projectName: `${projectName} - ${subType === 'partial' ? 'Partial Payment Balance' : subType === 'unpaid' ? 'Payment Balance' : 'Total Payment Balance'}`,
                subType,
                allBills: billsList,
                withinTarget: { count: 0, amount: 0, bills: [] as InvoiceRecord[] },
                overdueBand1: { count: 0, amount: 0, bills: [] as InvoiceRecord[] },
                overdueBand2: { count: 0, amount: 0, bills: [] as InvoiceRecord[] },
                overdueBand3: { count: 0, amount: 0, bills: [] as InvoiceRecord[] },
                overdueBand4: { count: 0, amount: 0, bills: [] as InvoiceRecord[] },
                overdueBand5: { count: 0, amount: 0, bills: [] as InvoiceRecord[] },
                hold: { count: 0, amount: 0, bills: [] as InvoiceRecord[] }
            };

            billsList.forEach(r => {
                const dCert = r['Certified at HO & Sent to Accounts on'] ? new Date(r['Certified at HO & Sent to Accounts on']) : null;
                const days = dCert && isValid(dCert) ? Math.max(0, differenceInDays(today, dCert)) : 0;
                
                // For outstanding accounts, use Balance Payment!
                const amtOutstanding = Number(r['Balance Payment'] || r['Bill Amount (Net Payble)'] || 0);

                if (days <= 6) {
                    result.withinTarget.count++;
                    result.withinTarget.amount += amtOutstanding;
                    result.withinTarget.bills.push(r);
                } else if (days <= 15) {
                    result.overdueBand1.count++;
                    result.overdueBand1.amount += amtOutstanding;
                    result.overdueBand1.bills.push(r);
                } else if (days <= 30) {
                    result.overdueBand2.count++;
                    result.overdueBand2.amount += amtOutstanding;
                    result.overdueBand2.bills.push(r);
                } else if (days <= 60) {
                    result.overdueBand3.count++;
                    result.overdueBand3.amount += amtOutstanding;
                    result.overdueBand3.bills.push(r);
                } else if (days <= 90) {
                    result.overdueBand4.count++;
                    result.overdueBand4.amount += amtOutstanding;
                    result.overdueBand4.bills.push(r);
                } else {
                    result.overdueBand5.count++;
                    result.overdueBand5.amount += amtOutstanding;
                    result.overdueBand5.bills.push(r);
                }
            });

            return result;
        };

        const accountsList: any[] = [];

        // Build the 3 lines for each project
        Object.entries(projectGroupsRaw).sort((a, b) => a[0].localeCompare(b[0])).forEach(([projectName, bills]) => {
            const partialBills = bills.filter(r => String(r['Payment Status'] || '').trim().toLowerCase() === 'partial payment balance');
            const unpaidBills = bills.filter(r => String(r['Payment Status'] || '').trim().toLowerCase() === 'payment balance');
            
            const partialLine = buildSection(projectName, partialBills, 'partial');
            const unpaidLine = buildSection(projectName, unpaidBills, 'unpaid');
            
            if (bills.length > 0) {
                 const totalLine = buildSection(projectName, bills, 'total');
                 accountsList.push(totalLine, partialLine, unpaidLine);
            }
        });

        return accountsList;
    }, [accountsPendingBills, accountsTargetDays]);

    // Group holds by Hold Type (Site vs HO) and then by Project Name
    const holdDataGrouped = useMemo(() => {
        const siteHolds: Record<string, InvoiceRecord[]> = {};
        const hoHolds: Record<string, InvoiceRecord[]> = {};

        data.forEach(r => {
            if (isPaid(r)) return;

            const statusLower = String(r['Status'] || '').toLowerCase();
            const holdAtSiteVal = String(r['Hold at Site'] || '').toLowerCase() === 'yes';
            const holdAtHoVal = String(r['Hold at HO'] || '').toLowerCase() === 'yes';

            // Explicitly classify based on matching words to avoid word-overlap
            const isSiteHold = statusLower.includes('hold at site') || holdAtSiteVal;
            const isHoHold = statusLower.includes('hold at ho') || holdAtHoVal;

            if (!isSiteHold && !isHoHold) return;

            const pName = r['Project'] || r['Source'] || 'Unspecified Project';

            if (isSiteHold) {
                if (!siteHolds[pName]) siteHolds[pName] = [];
                siteHolds[pName].push(r);
            }
            if (isHoHold) {
                if (!hoHolds[pName]) hoHolds[pName] = [];
                hoHolds[pName].push(r);
            }
        });

        return { siteHolds, hoHolds };
    }, [data]);

    // States for interactive filters
    const [discType, setDiscType] = useState<'all' | 'duplicates' | 'sequence' | 'metagaps' | 'negative_check'>('all');
    const [auditSubTab, setAuditSubTab] = useState<'grp1' | 'grp2' | 'grp3' | 'grp4' | 'grp5' | 'grp6'>('grp1');
    const [hoSearch, setHoSearch] = useState('');
    const [hoFilter, setHoFilter] = useState<'all' | 'pending' | 'certified' | 'hold'>('all');
    const [selectedLevel, setSelectedLevel] = useState<'all' | 'site' | 'ho' | 'accounts'>('all');

    // Tooltip detail popup states
    const [popoverRecords, setPopoverRecords] = useState<InvoiceRecord[] | null>(null);
    const [popoverTitle, setPopoverTitle] = useState<string>('');

    // States for export popovers
    const [isExportOpenSite, setIsExportOpenSite] = useState(false);
    const [isExportOpenHolds, setIsExportOpenHolds] = useState(false);
    const [isExportOpenTransit, setIsExportOpenTransit] = useState(false);
    const [isExportOpenHO, setIsExportOpenHO] = useState(false);
    const [isExportOpenAccounts, setIsExportOpenAccounts] = useState(false);
    const [isExportOpenDiscrepancies, setIsExportOpenDiscrepancies] = useState(false);

    // Export & Print utility handlers
    const getTablesFromSelector = (selector: string | string[]): HTMLTableElement[] => {
        if (Array.isArray(selector)) {
            return selector.map(id => document.getElementById(id) as HTMLTableElement).filter(Boolean);
        }
        if (typeof selector === 'string' && selector.startsWith('.')) {
            return Array.from(document.querySelectorAll(selector)) as HTMLTableElement[];
        }
        const el = document.getElementById(selector as string);
        return el ? [el as HTMLTableElement] : [];
    };

    const getTailwindColors = (classes: string, isHeader: boolean) => {
        let fillColor = "FFFFFF";
        let textColor = isHeader ? "1E293B" : "334155";
        let isBold = isHeader;

        if (classes.includes("bg-emerald-50") || classes.includes("bg-emerald-100")) fillColor = "ECFDF5";
        else if (classes.includes("bg-amber-50") || classes.includes("bg-amber-100")) fillColor = "FEF3C7";
        else if (classes.includes("bg-orange-50") || classes.includes("bg-orange-100")) fillColor = "FFEDD5";
        else if (classes.includes("bg-rose-50")) fillColor = "FFF1F2";
        else if (classes.includes("bg-rose-100")) fillColor = "FFE4E6";
        else if (classes.includes("bg-red-50") || classes.includes("bg-red-100")) fillColor = "FEF2F2";
        else if (classes.includes("bg-indigo-50")) fillColor = "EEF2FF";
        else if (classes.includes("bg-slate-50")) fillColor = "F8FAFC";
        else if (classes.includes("bg-slate-100") || classes.includes("bg-slate-200")) fillColor = "F1F5F9";
        else if (classes.includes("bg-blue-50") || classes.includes("bg-blue-100")) fillColor = "EFF6FF";
        else if (classes.includes("bg-cyan-50") || classes.includes("bg-cyan-100")) fillColor = "ECFEFF";

        if (classes.includes("text-emerald-")) textColor = "047857";
        else if (classes.includes("text-amber-")) textColor = "B45309";
        else if (classes.includes("text-orange-")) textColor = "C2410C";
        else if (classes.includes("text-rose-")) textColor = "BE123C";
        else if (classes.includes("text-red-")) textColor = "B91C1C";
        else if (classes.includes("text-indigo-")) textColor = "4338CA";
        else if (classes.includes("text-slate-")) textColor = "475569";
        else if (classes.includes("text-blue-")) textColor = "1D4ED8";
        else if (classes.includes("text-cyan-")) textColor = "0E7490";
        else if (classes.includes("text-yellow-")) textColor = "A16207";

        if (classes.includes("font-bold") || classes.includes("font-black") || classes.includes("font-semibold")) {
            isBold = true;
        }

        return { fillColor, textColor, isBold };
    };

    const handleExportExcel = (selector: string | string[], title: string) => {
        try {
            const tables = getTablesFromSelector(selector);
            if (tables.length === 0) return;

            const wb = XLSX.utils.book_new();

            tables.forEach((table, index) => {
                const rows = Array.from(table.querySelectorAll("tr"));
                const numRows = rows.length;
                if (numRows === 0) return;

                let maxCols = 0;
                rows.forEach((tr) => {
                    let colsInRow = 0;
                    Array.from(tr.children).forEach((cell: any) => {
                        colsInRow += cell.colSpan || 1;
                    });
                    if (colsInRow > maxCols) maxCols = colsInRow;
                });

                // Create a 2D grid matrix of size numRows x maxCols
                const grid: any[][] = Array(numRows)
                    .fill(null)
                    .map(() => Array(maxCols).fill(null));

                const merges: any[] = [];

                rows.forEach((tr, r) => {
                    let c = 0;
                    Array.from(tr.children).forEach((cell: any) => {
                        while (c < maxCols && grid[r][c] !== null) {
                            c++;
                        }
                        if (c >= maxCols) return;

                        const rowSpan = cell.rowSpan || 1;
                        const colSpan = cell.colSpan || 1;

                        if (rowSpan > 1 || colSpan > 1) {
                            merges.push({
                                s: { r: r, c: c },
                                e: { r: r + rowSpan - 1, c: c + colSpan - 1 }
                            });
                        }

                        for (let dr = 0; dr < rowSpan; dr++) {
                            for (let dc = 0; dc < colSpan; dc++) {
                                if (r + dr < numRows && c + dc < maxCols) {
                                    grid[r + dr][c + dc] = {
                                        element: cell,
                                        isOrigin: dr === 0 && dc === 0
                                    };
                                }
                            }
                        }
                        c += colSpan;
                    });
                });

                const ws: any = {
                    "!merges": merges
                };

                const encodeCellAddress = (r: number, c: number) => {
                    let colName = "";
                    let temp = c;
                    while (temp >= 0) {
                        colName = String.fromCharCode((temp % 26) + 65) + colName;
                        temp = Math.floor(temp / 26) - 1;
                    }
                    return `${colName}${r + 1}`;
                };

                let colWidths: Record<number, number> = {};

                for (let r = 0; r < numRows; r++) {
                    for (let c = 0; c < maxCols; c++) {
                        const entry = grid[r][c];
                        if (!entry) continue;

                        const element = entry.element;
                        const isOrigin = entry.isOrigin;
                        let text = "";
                        if (isOrigin) {
                            const clone = element.cloneNode(true) as HTMLElement;
                            clone.querySelectorAll("button, svg, script, .no-print").forEach(el => el.remove());
                            text = (clone.textContent || "").trim();
                        }

                        const classes = element.className || "";
                        const isHeader = element.tagName === "TH" || element.closest("thead") !== null;

                        let alignment: any = { vertical: "center", wrapText: true };
                        if (classes.includes("text-right")) {
                            alignment.horizontal = "right";
                        } else if (classes.includes("text-center")) {
                            alignment.horizontal = "center";
                        } else {
                            alignment.horizontal = "left";
                        }

                        if (c === 0) {
                            alignment.horizontal = "left";
                        }

                        const colors = getTailwindColors(classes, isHeader);
                        let fillColor = colors.fillColor;
                        let textColor = colors.textColor;
                        let isBold = colors.isBold;

                        if (!isHeader && fillColor === "FFFFFF" && r % 2 === 0) {
                            fillColor = "F8FAFC";
                        }

                        if (isHeader && fillColor === "FFFFFF") {
                            fillColor = "1E293B";
                            textColor = "FFFFFF";
                        }

                        let font: any = {
                            name: "Segoe UI",
                            sz: isHeader ? 10 : 9.5,
                            bold: isBold,
                            color: { rgb: textColor }
                        };

                        let border: any = {
                            top: { style: "thin", color: { rgb: "E2E8F0" } },
                            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                            left: { style: "thin", color: { rgb: "E2E8F0" } },
                            right: { style: "thin", color: { rgb: "E2E8F0" } }
                        };

                        let cellType = "s";
                        let val: any = text;
                        let numFormat: string | undefined = undefined;

                        if (isOrigin && text !== "" && c !== 0) {
                            const cleaned = text.replace(/,/g, "").trim();
                            if (cleaned === "-") {
                                val = "-";
                                cellType = "s";
                            } else if (text.includes("Bills") || /^\d+\s*Bill/.test(text)) {
                                val = text;
                                cellType = "s";
                            } else if ((text.includes("₹") || text.includes("Rs") || text.includes("Rs.")) && !text.includes("Bills") && !text.includes("Bill")) {
                                if (text.includes("L") || text.includes("Cr")) {
                                    val = text;
                                    cellType = "s";
                                } else {
                                    const digits = text.replace(/[^0-9.-]/g, "");
                                    const num = parseFloat(digits);
                                    if (!isNaN(num)) {
                                        val = num;
                                        cellType = "n";
                                        numFormat = '"\u20B9"#,##0;("\u20B9"#,##0);"-"';
                                    }
                                }
                            } else if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
                                const num = parseFloat(cleaned);
                                if (!isNaN(num)) {
                                    val = num;
                                    cellType = "n";
                                    if (text.includes("%")) {
                                        val = num / 100;
                                        numFormat = "0.0%";
                                    } else if (cleaned.includes(".")) {
                                        numFormat = "#,##0.00";
                                    } else {
                                        numFormat = "#,##0";
                                    }
                                }
                            }
                        }

                        const cellRef = encodeCellAddress(r, c);
                        ws[cellRef] = {
                            v: val,
                            t: cellType,
                            s: {
                                fill: { fgColor: { rgb: fillColor } },
                                font: font,
                                alignment: alignment,
                                border: border
                            }
                        };

                        if (numFormat) {
                            ws[cellRef].z = numFormat;
                        }

                        const charLen = String(val).length || 5;
                        let colW = Math.max(colWidths[c] || 10, charLen + 3);
                        if (c === 0) colW = Math.max(colW, 25);
                        colWidths[c] = colW;
                    }
                }

                ws["!cols"] = Object.keys(colWidths).map((colIdx) => ({
                    wch: Math.min(60, colWidths[Number(colIdx)])
                }));

                const maxRef = encodeCellAddress(numRows - 1, maxCols - 1);
                ws["!ref"] = `A1:${maxRef}`;

                let sheetName = title;
                if (tables.length > 1) {
                    const tableTitle = table.getAttribute('data-sheet-title') || `Sheet ${index + 1}`;
                    sheetName = tableTitle.substring(0, 31);
                } else {
                    sheetName = sheetName.substring(0, 31);
                }
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });

            XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, '_')}_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        } catch (err) {
            console.error("Excel export error", err);
        }
    };

    const handleExportPDF = (selector: string | string[], title: string) => {
        try {
            const tables = getTablesFromSelector(selector);
            if (tables.length === 0) return;

            const doc = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: "a4",
            });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(title, 14, 15);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 21);

            let currentY = 26;

            tables.forEach((table, index) => {
                if (index > 0) {
                    currentY += 10;
                    if (currentY > 180) {
                        doc.addPage();
                        currentY = 20;
                    }
                }

                const tableTitle = table.getAttribute('data-sheet-title');
                if (tableTitle && tables.length > 1) {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);
                    doc.setTextColor(30, 41, 59);
                    doc.text(tableTitle, 14, currentY);
                    currentY += 5;
                }

                autoTable(doc, {
                    html: table,
                    startY: currentY,
                    styles: {
                        fontSize: 7.5,
                        cellPadding: 2,
                        valign: "middle",
                        font: "helvetica",
                        overflow: 'linebreak',
                        textColor: [51, 65, 85],
                        lineColor: [226, 232, 240],
                        lineWidth: 0.1,
                    },
                    headStyles: {
                        fillColor: [30, 41, 59],
                        textColor: [255, 255, 255],
                        fontSize: 8,
                        fontStyle: "bold",
                    },
                    alternateRowStyles: {
                        fillColor: [248, 250, 252],
                    },
                    didParseCell: (data) => {
                        const cellRaw = data.cell.raw as HTMLElement;
                        if (cellRaw) {
                            if (cellRaw.tagName === 'BUTTON' || cellRaw.classList?.contains('no-print') || cellRaw.querySelector?.('button')) {
                                data.cell.text = [];
                                return;
                            }

                            const classes = cellRaw.className || "";
                            
                            let fillColor: [number, number, number] | null = null;
                            let textColor: [number, number, number] | null = null;
                            let fontStyle: any = null;

                            if (classes.includes("bg-emerald-50") || classes.includes("bg-emerald-100")) fillColor = [236, 253, 245];
                            else if (classes.includes("bg-amber-50") || classes.includes("bg-amber-100")) fillColor = [254, 243, 199];
                            else if (classes.includes("bg-orange-50") || classes.includes("bg-orange-100")) fillColor = [255, 237, 213];
                            else if (classes.includes("bg-rose-50")) fillColor = [255, 241, 242];
                            else if (classes.includes("bg-rose-100")) fillColor = [255, 228, 230];
                            else if (classes.includes("bg-red-50") || classes.includes("bg-red-100")) fillColor = [254, 242, 242];
                            else if (classes.includes("bg-indigo-50")) fillColor = [238, 242, 255];
                            else if (classes.includes("bg-slate-50")) fillColor = [248, 250, 252];
                            else if (classes.includes("bg-slate-100") || classes.includes("bg-slate-200")) fillColor = [241, 245, 249];
                            else if (classes.includes("bg-blue-50") || classes.includes("bg-blue-100")) fillColor = [239, 246, 255];
                            else if (classes.includes("bg-cyan-50") || classes.includes("bg-cyan-100")) fillColor = [236, 254, 255];

                            if (classes.includes("text-emerald-")) textColor = [4, 120, 87];
                            else if (classes.includes("text-amber-")) textColor = [180, 83, 9];
                            else if (classes.includes("text-orange-")) textColor = [194, 65, 12];
                            else if (classes.includes("text-rose-")) textColor = [190, 18, 60];
                            else if (classes.includes("text-red-")) textColor = [185, 28, 28];
                            else if (classes.includes("text-indigo-")) textColor = [67, 56, 202];
                            else if (classes.includes("text-slate-")) textColor = [71, 85, 105];
                            else if (classes.includes("text-blue-")) textColor = [29, 78, 216];
                            else if (classes.includes("text-cyan-")) textColor = [14, 116, 144];
                            else if (classes.includes("text-yellow-")) textColor = [161, 98, 7];

                            if (classes.includes("font-bold") || classes.includes("font-black") || classes.includes("font-semibold") || cellRaw.tagName === 'TH') {
                                fontStyle = "bold";
                            }

                            if (fillColor) data.cell.styles.fillColor = fillColor;
                            if (textColor) data.cell.styles.textColor = textColor;
                            if (fontStyle) data.cell.styles.fontStyle = fontStyle;
                        }
                    }
                });

                currentY = (doc as any).lastAutoTable.finalY;
            });

            doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        } catch (err) {
            console.error("PDF Export error", err);
        }
    };

    const handlePrintTable = (selector: string | string[], title: string) => {
        try {
            const tables = getTablesFromSelector(selector);
            if (tables.length === 0) return;

            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (!printWindow) {
                console.error("Print window could not be opened. Please check pop-up blockers.");
                return;
            }

            const doc = printWindow.document;

            let tablesHtml = '';
            tables.forEach(table => {
                const tableTitle = table.getAttribute('data-sheet-title');
                const tableClone = table.cloneNode(true) as HTMLElement;
                
                tableClone.querySelectorAll("button, select, svg, .no-print, input").forEach(el => el.remove());
                tableClone.className = tableClone.className + " w-full border border-slate-200 text-[10px]";
                
                tablesHtml += `
                    <div class="table-section mb-8 avoid-break">
                        ${tableTitle && tables.length > 1 ? `<div class="text-xs font-bold text-slate-700 uppercase mb-2 tracking-wider font-sans border-l-4 border-slate-700 pl-2">${tableTitle}</div>` : ''}
                        <div class="overflow-x-auto">
                            ${tableClone.outerHTML}
                        </div>
                    </div>
                `;
            });

            // Prepare styles
            const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(el => el.outerHTML)
                .join('');

            doc.open();
            doc.write(`
                <html>
                    <head>
                        <title>${title} - Print</title>
                        ${styles}
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700;900&display=swap');
                            body { font-family: "Inter", system-ui, -apple-system, sans-serif; color: #1e293b; padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            table { font-family: "JetBrains Mono", monospace; width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse; }
                            th, td { overflow: hidden; word-wrap: break-word; }
                            .no-print, button, select, svg, input { display: none !important; }
                            .avoid-break { page-break-inside: avoid; break-inside: avoid; }
                            @media print {
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                @page { size: auto; margin: 10mm; }
                            }
                        </style>
                    </head>
                    <body class="bg-white">
                        <div class="mb-6">
                            <h2 class="text-lg font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-200 pb-2">${title}</h2>
                            <div class="text-[10px] text-slate-500 font-mono mt-1">Generated on: ${new Date().toLocaleString()}</div>
                        </div>
                        ${tablesHtml}
                    </body>
                </html>
            `);
            doc.close();

            // Wait for load/render before printing
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    // Optional: printWindow.close(); // User might want to keep it open
                }, 500);
            };

        } catch (error) {
            console.error("Print error", error);
        }
    };

    const handleScreenshot = async (selector: string, title: string) => {
        const element = document.querySelector(selector) as HTMLElement;
        if (!element) return;

        try {
            const canvas = await html2canvas(element, {
                scrollX: 0,
                scrollY: 0,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
                scale: 2,
                logging: false,
                useCORS: true,
                onclone: (doc) => {
                    doc.querySelectorAll('*').forEach((el) => {
                        const hEl = el as HTMLElement;
                        if (hEl.style) {
                            for (let i = 0; i < hEl.style.length; i++) {
                                const prop = hEl.style[i];
                                const val = hEl.style.getPropertyValue(prop);
                                if (val && val.includes('oklch')) {
                                    hEl.style.setProperty(prop, 'transparent');
                                }
                            }
                        }
                    });
                }
            });

            const link = document.createElement('a');
            link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_screenshot_${new Date().toISOString()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error("Screenshot error", error);
        }
    };

    const reportData = useMemo(() => {
        if (!data.length) return null;

        // --- 1. CARD METRICS & SUMMARY ---
        const totalBillAmount = data.reduce((sum, r) => sum + Number(r['Bill Amount (Net Payble)'] || 0), 0);
        const totalBillCount = data.length;

        const totalPaidAmount = data.reduce((sum, r) => sum + Number(r['Paid Amount'] || 0), 0);
        const totalPaidCount = data.filter(r => Number(r['Paid Amount'] || 0) > 0).length;

        const totalBalanceAmount = data.reduce((sum, r) => sum + Number(r['Balance Payment'] || 0), 0);
        const totalBalanceCount = data.filter(r => Number(r['Balance Payment'] || 0) > 0).length;

        const liquidationIndex = (totalBillAmount > 0) ? (totalPaidAmount / totalBillAmount) * 100 : 0;

        // --- 2. DISCREPANCIES (AUDIT EXCEPTIONS) ---
        const integrity = {
            duplicates: [] as { r: InvoiceRecord; key: string }[],
            negativeSequence: [] as { r: InvoiceRecord; desc: string; flow: string }[],
            missingMeta: [] as { r: InvoiceRecord; missing: string[] }[],
            transportFirst: [] as { r: InvoiceRecord; desc: string }[]
        };

        const seenKeys = new Map<string, string>();
        const projectGroups: Record<string, InvoiceRecord[]> = {};

        data.forEach((r, idx) => {
            const pid = r.Project || r.Source || 'Unknown';
            if (!projectGroups[pid]) projectGroups[pid] = [];
            projectGroups[pid].push(r);

            // a. Duplicate identification: Same serial, project, amount, inward
            const inwardRaw = r['Inward Date'] ? String(r['Inward Date']).split('T')[0] : 'No-Inward';
            const dKey = `${r['Sr no']}-${pid}-${Number(r['Bill Amount (Net Payble)'] || 0).toFixed(0)}-${inwardRaw}`;
            if (!isExemptFromDuplicates(r) && seenKeys.has(dKey)) {
                integrity.duplicates.push({ r, key: dKey });
            } else if (!isExemptFromDuplicates(r)) {
                seenKeys.set(dKey, `Row_${idx}`);
            }

            // b. Missing Metadata gaps
            const missingFields: string[] = [];
            if (!r['Highrise WO No'] || String(r['Highrise WO No']).trim() === "" || r['Highrise WO No'] === "N/A") {
                missingFields.push('WO No');
            }
            if (!r['Work Head'] || String(r['Work Head']).trim() === "") {
                missingFields.push('Work Head');
            }
            if (!r['LOCATION/Bldg.'] || String(r['LOCATION/Bldg.']).trim() === "") {
                missingFields.push('Location/Bldg');
            }
            if ((!r['Billing Period'] || String(r['Billing Period']).trim() === "") && !isBillingPeriodExempt(r)) {
                missingFields.push('Billing Period');
            }
            if (missingFields.length > 0) {
                integrity.missingMeta.push({ r, missing: missingFields });
            }

            // c. Sequence date checks
            const iDate = r['Inward Date'] ? new Date(r['Inward Date']) : null;
            const hDate = r['Received at HO'] ? new Date(r['Received at HO']) : null;
            const cDate = r['Certified at HO & Sent to Accounts on'] ? new Date(r['Certified at HO & Sent to Accounts on']) : null;
            const pDate = r['Cheque Recd. At HO Date'] ? new Date(r['Cheque Recd. At HO Date']) : null;
            
            const isStrictlyEarlierCalendarDay = (dSub: Date | null, dPre: Date | null) => {
                if (!dSub || !dPre) return false;
                const isSameDay = dSub.getFullYear() === dPre.getFullYear() &&
                                  dSub.getMonth() === dPre.getMonth() &&
                                  dSub.getDate() === dPre.getDate();
                if (isSameDay) return false;
                return dSub < dPre;
            };

            if (hDate && iDate && isStrictlyEarlierCalendarDay(hDate, iDate)) {
                integrity.negativeSequence.push({ 
                    r, 
                    desc: `HO Received (${format(hDate, "dd-MMM-yy")}) occurred prior to Inward Date (${format(iDate, "dd-MMM-yy")})`,
                    flow: 'Received HO < Inward Site' 
                });
            } else if (cDate && hDate && isStrictlyEarlierCalendarDay(cDate, hDate)) {
                integrity.negativeSequence.push({ 
                    r, 
                    desc: `Certified Date (${format(cDate, "dd-MMM-yy")}) occurred before HO Received (${format(hDate, "dd-MMM-yy")})`,
                    flow: 'Certified HO < Received HO' 
                });
            } else if (pDate && cDate && isStrictlyEarlierCalendarDay(pDate, cDate)) {
                integrity.negativeSequence.push({ 
                    r, 
                    desc: `Disbursement (${format(pDate, "dd-MMM-yy")}) occurred before Certification (${format(cDate, "dd-MMM-yy")})`,
                    flow: 'Paid Date < Certified Date' 
                });
            }
        });

        // Transport first checks
        Object.values(projectGroups).forEach(group => {
            const sorted = [...group].sort((a,b) => (Number(a['Sr no']) || 0) - (Number(b['Sr no']) || 0));
            const first = sorted[0];
            if (first && (String(first['Bill Type']).toLowerCase().includes('transport') || String(first['Highrise WO No']).toLowerCase().includes('transport'))) {
                integrity.transportFirst.push({
                    r: first,
                    desc: "First project billing starts with Transport type instead of Civil / Structural initial work."
                });
            }
        });

        // --- 3. HARMONIZED LEVEL LOAD METRICS ---
        const load = {
            atSite: data.filter(r => !r['HO Submission Date'] && !isPaid(r)).length,
            atHO: data.filter(r => r['HO Submission Date'] && !r['Certified at HO & Sent to Accounts on'] && !isPaid(r)).length,
            atAccounts: data.filter(r => r['Certified at HO & Sent to Accounts on'] && !isPaid(r)).length,
            totalPendingCount: data.filter(r => !isPaid(r)).length,
            totalPendingAmount: data.filter(r => !isPaid(r)).reduce((sum, r) => sum + Number(r['Bill Amount (Net Payble)'] || 0), 0)
        };

        // --- 4. SITE SPECIFIC CALCULATIONS ---
        const siteStats: Record<string, any> = {};
        data.forEach(r => {
            const site = r.Source || r.Project || 'Main Site';
            if (!siteStats[site]) {
                siteStats[site] = {
                    total: 0,
                    pending: 0,
                    amount: 0,
                    avgDays: 0,
                    aging: { '1-7': 0, '8-15': 0, '16+': 0 }
                };
            }
            const s = siteStats[site];
            s.total++;
            const days = Number(r['Bill Process Days']) || 0;
            s.avgDays += days;
            
            if (!isPaid(r)) {
                s.pending++;
                s.amount += Number(r['Bill Amount (Net Payble)'] || 0);
                if (days > 15) s.aging['16+']++;
                else if (days > 7) s.aging['8-15']++;
                else s.aging['1-7']++;
            }
        });
        Object.values(siteStats).forEach((s: any) => {
            s.avgDays = s.total > 0 ? Math.round(s.avgDays / s.total) : 0;
        });

        // Dynamic guidelines / intelligence
        const facts: string[] = [];
        const improvements: string[] = [];
        const maxStage = Math.max(load.atSite, load.atHO, load.atAccounts);
        if (maxStage === load.atSite) {
            facts.push("Level 1 (Site-level Work) carries the highest pending bill volume currently.");
        } else if (maxStage === load.atHO) {
            facts.push("Level 2 (Head Office validation queue) is currently the primary verification bottleneck.");
        } else {
            facts.push("Level 3 (Accounts / billing dispatch) has the highest concentration of resolved but unpaid bills.");
        }

        if (integrity.duplicates.length > 0) {
            facts.push(`Identified ${integrity.duplicates.length} duplicate entries across billing lists.`);
        }
        if (integrity.negativeSequence.length > 0) {
            facts.push(`Identified ${integrity.negativeSequence.length} chronologically backdated date flow anomalies.`);
        }

        const avgGlobalCycle = Object.keys(siteStats).length > 0 
            ? Object.values(siteStats).reduce((acc: number, s: any) => acc + s.avgDays, 0) / Object.keys(siteStats).length 
            : 0;

        improvements.push(`Clear present backlog of ${load.totalPendingCount} pending bills by processing at a target rate of ${(load.totalPendingCount / 7).toFixed(1)} bills/day.`);
        if (liquidationIndex < 80) {
            improvements.push("Overall vendor payout liquidation rate is low. Suggest bundling bulk clearing for minor accounts.");
        }

        return { 
            totalBillAmount, totalBillCount,
            totalPaidAmount, totalPaidCount,
            totalBalanceAmount, totalBalanceCount,
            liquidationIndex,
            integrity, load, siteStats, facts, improvements, avgGlobalCycle 
        };
    }, [data]);

    // Ageing Matrix calculation based on today's local anchor date
    const ageingMatrix = useMemo(() => {
        const matrix = {
            site: { '0-7': [] as InvoiceRecord[], '8-15': [] as InvoiceRecord[], '16-30': [] as InvoiceRecord[], '31+': [] as InvoiceRecord[] },
            ho: { '0-7': [] as InvoiceRecord[], '8-15': [] as InvoiceRecord[], '16-30': [] as InvoiceRecord[], '31+': [] as InvoiceRecord[] },
            accounts: { '0-7': [] as InvoiceRecord[], '8-15': [] as InvoiceRecord[], '16-30': [] as InvoiceRecord[], '31+': [] as InvoiceRecord[] },
        };

        const today = new Date();

        data.forEach(r => {
            if (isPaid(r)) return; // pending items only

            const hasHOSubmission = !!r['HO Submission Date'];
            const hasCertified = !!r['Certified at HO & Sent to Accounts on'];

            const parseToDate = (val: any) => {
                if (!val) return null;
                const d = new Date(val);
                return isValid(d) ? d : null;
            };

            if (!hasHOSubmission) {
                // stuck at Site Level
                const dInward = parseToDate(r['Inward Date']);
                const days = dInward ? Math.max(0, differenceInDays(today, dInward)) : 0;
                if (days <= 7) matrix.site['0-7'].push(r);
                else if (days <= 15) matrix.site['8-15'].push(r);
                else if (days <= 30) matrix.site['16-30'].push(r);
                else matrix.site['31+'].push(r);
            } else if (hasHOSubmission && !hasCertified) {
                // stuck at HO Level
                const dReceivedHO = parseToDate(r['Received at HO']);
                const days = dReceivedHO ? Math.max(0, differenceInDays(today, dReceivedHO)) : 0;
                if (days <= 7) matrix.ho['0-7'].push(r);
                else if (days <= 15) matrix.ho['8-15'].push(r);
                else if (days <= 30) matrix.ho['16-30'].push(r);
                else matrix.ho['31+'].push(r);
            } else if (hasCertified) {
                // stuck at Accounts Level
                const dCert = parseToDate(r['Certified at HO & Sent to Accounts on']);
                const days = dCert ? Math.max(0, differenceInDays(today, dCert)) : 0;
                if (days <= 6) matrix.accounts['0-7'].push(r);
                else if (days <= 15) matrix.accounts['8-15'].push(r);
                else if (days <= 30) matrix.accounts['16-30'].push(r);
                else matrix.accounts['31+'].push(r);
            }
        });

        return matrix;
    }, [data]);

    // Submitted to HO active registry (sent to HO bills list)
    const hoBills = useMemo(() => {
        return data.filter(r => {
            const stat = String(r['Status'] || '').toLowerCase().trim();
            return stat === '05 send to ho' || stat.includes('send to ho');
        });
    }, [data]);

    const hoBillsByProject = useMemo(() => {
        const groups: Record<string, InvoiceRecord[]> = {};
        hoBills.forEach(r => {
            // Group by Project
            const projName = r.Project || r.Source || 'Unspecified Project';
            if (!groups[projName]) {
                groups[projName] = [];
            }
            groups[projName].push(r);
        });
        return groups;
    }, [hoBills]);

    // Filtering sent to HO bills list
    const filteredHoBills = useMemo(() => {
        return hoBills.filter(r => {
            // Search matches Contractor, Project, or WO
            const searchStr = `${r['Contractor Name'] || ''} ${r.Project || ''} ${r['Highrise WO No'] || ''} ${r['Sr no'] || ''}`.toLowerCase();
            const matchesSearch = searchStr.includes(hoSearch.toLowerCase());

            const isCert = !!r['Certified at HO & Sent to Accounts on'];
            const paid = isPaid(r);

            let matchesTab = true;
            if (hoFilter === 'pending') {
                matchesTab = !isCert && !paid;
            } else if (hoFilter === 'certified') {
                matchesTab = isCert && !paid;
            } else if (hoFilter === 'hold') {
                matchesTab = r['Hold at HO'] === 'Yes';
            }

            return matchesSearch && matchesTab;
        });
    }, [hoBills, hoSearch, hoFilter]);

    // Filtering discrepancies lists based on current selected tab
    const filteredDiscrepancies = useMemo(() => {
        if (!reportData) return [];

        const list: { type: string; level: string; label: string; details: string; record: InvoiceRecord }[] = [];

        // Duplicates
        reportData.integrity.duplicates.forEach(d => {
            list.push({
                type: 'duplicates',
                level: 'Duplicate Key',
                label: `Serial No ${d.r['Sr no']}`,
                details: `Potential duplicate of key (${d.key.split('-')[0]}): ${formatFullCurrency(Number(d.r['Bill Amount (Net Payble)'] || 0))} | Inward: ${d.r['Inward Date'] ? format(new Date(d.r['Inward Date']), 'dd-MMM-yy') : 'N/A'}`,
                record: d.r
            });
        });

        // Sequence Date FLOW
        reportData.integrity.negativeSequence.forEach(s => {
            list.push({
                type: 'sequence',
                level: 'Chronology Exception',
                label: `Serial No ${s.r['Sr no']}`,
                details: `${s.desc} [${s.flow}]`,
                record: s.r
            });
        });

        // Missing metadata
        reportData.integrity.missingMeta.forEach(m => {
            list.push({
                type: 'metagaps',
                level: 'Metadata Gap',
                label: `Serial No ${m.r['Sr no']}`,
                details: `Attributes missing: [${m.missing.join(', ')}]. Contractor: ${m.r['Contractor Name'] || 'N/A'} | WO: ${m.r['Highrise WO No'] || 'N/A'}`,
                record: m.r
            });
        });

        // Payment Check Amounts as -Ve
        data.forEach(r => {
            if (r['Payment Status'] === 'Check Amounts as -Ve') {
                list.push({
                    type: 'negative_check',
                    level: 'Payment Anomaly',
                    label: `Serial No ${r['Sr no']}`,
                    details: `Check Amounts as -Ve. Project: ${r.Project} | Contractor: ${r['Contractor Name']} | Bill Amount: ${formatFullCurrency(Number(r['Bill Amount (Net Payble)'] || 0))} | Paid Amount: ${formatFullCurrency(Number(r['Paid Amount'] || 0))}`,
                    record: r
                });
            }
        });

        if (discType === 'all') return list;
        return list.filter(item => item.type === discType);
    }, [reportData, discType, data]);

    const woExcelMap = useMemo(() => {
        const map = new Map<string, InvoiceRecord[]>();
        data.forEach(r => {
            const wo = String(r['Highrise WO No'] || '').trim();
            const excelNo = String(r['Excel RA Bill NO'] || '').trim();

            const condStatus = String(r['Status'] || '').trim().toLowerCase();
            const isExcluded = condStatus === 'hold at site' || condStatus === 'site - excel done' || condStatus === '01 site - in process';
            if (isExcluded) return;

            if (wo && wo !== "N/A" && excelNo && excelNo !== "N/A") {
                const k = `${wo.toLowerCase()}|||${excelNo.toLowerCase()}`;
                if (!map.has(k)) map.set(k, []);
                map.get(k)!.push(r);
            }
        });
        return map;
    }, [data]);

    const woHighriseRaMap = useMemo(() => {
        const map = new Map<string, InvoiceRecord[]>();
        data.forEach(r => {
            const wo = String(r['Highrise WO No'] || '').trim();
            const raNo = String(r['Highrise RA No'] || '').trim();

            const condStatus = String(r['Status'] || '').trim().toLowerCase();
            const isExcluded = condStatus === 'hold at site' || condStatus === 'site - excel done' || condStatus === '01 site - in process';
            if (isExcluded) return;

            if (wo && wo !== "N/A" && raNo && raNo !== "N/A") {
                const k = `${wo.toLowerCase()}|||${raNo.toLowerCase()}`;
                if (!map.has(k)) map.set(k, []);
                map.get(k)!.push(r);
            }
        });
        return map;
    }, [data]);

    const auditGroupsData = useMemo(() => {
        const groups = getAuditGroupsData(data);

        const helperGroup = (records: InvoiceRecord[]) => {
            const groups: { [key: string]: { project: string; source: string; items: InvoiceRecord[] } } = {};
            records.forEach(r => {
                const proj = r.Project || 'N/A';
                const src = r.Source || 'N/A';
                const key = `${proj}|||${src}`;
                if (!groups[key]) {
                    groups[key] = { project: proj, source: src, items: [] };
                }
                groups[key].items.push(r);
            });
            return Object.values(groups).sort((a, b) => {
                const pComp = a.project.localeCompare(b.project);
                if (pComp !== 0) return pComp;
                return a.source.localeCompare(b.source);
            });
        };

        const duplicateSubGroup = (records: InvoiceRecord[]) => {
            const results: { project: string; source: string; items: InvoiceRecord[] }[] = [];
            const visited = new Set<string>();

            const isValInvalid = (val: string) => {
                const v = val.toLowerCase().trim();
                return !v || v === "" || v === "0" || v === "na" || v === "n/a" || v.includes("advance") || v.includes("retention") || v.includes("quality release") || v.includes("sd release") || v.includes("sd-release");
            };

            records.forEach(r => {
                const rUID = `${r.Project || 'N/A'}|||${r['Sr no']}`;
                if (visited.has(rUID)) return;

                const currentGroup: InvoiceRecord[] = [];
                const queue: InvoiceRecord[] = [r];
                visited.add(rUID);

                while (queue.length > 0) {
                    const node = queue.shift()!;
                    currentGroup.push(node);

                    const hiWo = String(node['Highrise WO No'] || '').trim().toLowerCase();
                    const hiRa = String(node['Highrise RA No'] || '').trim().toLowerCase();
                    const excelNo = String(node['Excel RA Bill NO'] || '').trim().toLowerCase();

                    const isHiValid = !isValInvalid(hiWo) && !isValInvalid(hiRa);
                    const isExValid = !isValInvalid(hiWo) && !isValInvalid(excelNo);

                    records.forEach(r2 => {
                        const rUID2 = `${r2.Project || 'N/A'}|||${r2['Sr no']}`;
                        if (visited.has(rUID2)) return;

                        const hiWo2 = String(r2['Highrise WO No'] || '').trim().toLowerCase();
                        const hiRa2 = String(r2['Highrise RA No'] || '').trim().toLowerCase();
                        const excelNo2 = String(r2['Excel RA Bill NO'] || '').trim().toLowerCase();

                        let match = false;
                        if (isHiValid && hiWo === hiWo2 && hiRa === hiRa2) match = true;
                        if (isExValid && hiWo === hiWo2 && excelNo === excelNo2) match = true;

                        if (match) {
                            visited.add(rUID2);
                            queue.push(r2);
                        }
                    });
                }

                if (currentGroup.length > 0) {
                    results.push({
                        project: currentGroup[0].Project || 'N/A',
                        source: currentGroup[0].Source || 'N/A',
                        items: currentGroup
                    });
                }
            });
            return results;
        };

        return {
            grp1: { records: groups.grp1, grouped: helperGroup(groups.grp1) },
            grp2: { records: groups.grp2, grouped: helperGroup(groups.grp2) },
            grp3: { records: groups.grp3, grouped: helperGroup(groups.grp3) },
            grp4: { records: groups.grp4, grouped: helperGroup(groups.grp4) },
            grp5: { records: groups.grp5, grouped: helperGroup(groups.grp5) },
            grp6: { records: groups.grp6, grouped: duplicateSubGroup(groups.grp6) },
        };
    }, [data]);

    const auditingDiscrepanciesCount = useMemo(() => {
        const unionSet = new Set<number>();
        auditGroupsData.grp1.records.forEach(r => unionSet.add(r['Sr no']));
        auditGroupsData.grp2.records.forEach(r => unionSet.add(r['Sr no']));
        auditGroupsData.grp3.records.forEach(r => unionSet.add(r['Sr no']));
        auditGroupsData.grp4.records.forEach(r => unionSet.add(r['Sr no']));
        auditGroupsData.grp5.records.forEach(r => unionSet.add(r['Sr no']));
        auditGroupsData.grp6.records.forEach(r => unionSet.add(r['Sr no']));
        return unionSet.size;
    }, [auditGroupsData]);

    const isExcelDup = (r: InvoiceRecord): boolean => {
        if (isValMissing(r['Highrise WO No']) || isValMissing(r['Excel RA Bill NO'])) return false;
        const key = `${r['Highrise WO No']}||${r['Excel RA Bill NO']}`;
        return (woExcelMap.get(key)?.length || 0) > 1;
    };

    const isRaNoDup = (r: InvoiceRecord): boolean => {
        if (isValMissing(r['Highrise WO No']) || isValMissing(r['Highrise RA No'])) return false;
        const key = `${r['Highrise WO No']}||${r['Highrise RA No']}`;
        return (woHighriseRaMap.get(key)?.length || 0) > 1;
    };

    // Compute cell specific lists for pending work interactive click-to-see list
    const [selectedAgeingCell, setSelectedAgeingCell] = useState<{ level: 'site' | 'ho' | 'accounts'; band: '0-7' | '8-15' | '16-30' | '31+' } | null>(null);

    const cellBills = useMemo(() => {
        if (!selectedAgeingCell) return [];
        return ageingMatrix[selectedAgeingCell.level][selectedAgeingCell.band];
    }, [selectedAgeingCell, ageingMatrix]);

    const renderPerformanceTable = (
        title: string,
        targetDays: number,
        targetDaysLabel: string,
        dataList: any[],
        levelName: 'site' | 'ho' | 'accounts',
        targetColorClass: string,
        borderColorClass: string
    ) => {
        // Calculate dynamic proportionate aging bands based on targetDays
        const minB1 = Math.floor(targetDays) + 1;
        const maxB1 = Math.round(targetDays * 3);
        const minB2 = maxB1 + 1;
        const maxB2 = Math.round(targetDays * 6);
        const minB3 = maxB2 + 1;

        const isAccounts = levelName === 'accounts';
        const onTrackRange = isAccounts ? "0 - 06" : `0 - ${targetDays}`;
        const warningRange = isAccounts ? "7 - 15" : `${minB1} - ${maxB1}`;
        const severeRange = isAccounts ? "15 - 30" : `${minB2} - ${maxB2}`;
        const criticalRange = isAccounts ? "30+" : `${minB3}+`;

        // Sum across all projects in the dataList if projects list length > 1
        const showTotals = levelName === 'accounts' 
            ? (new Set(dataList.map(p => p.projectName.split(' - ')[0])).size > 1)
            : (dataList.length > 1);

        const getTotalsObj = (subTypeFilter?: 'total' | 'partial' | 'unpaid') => {
            const listToSum = (levelName === 'accounts' && subTypeFilter)
                ? dataList.filter(p => p.subType === subTypeFilter)
                : dataList;

            if (listToSum.length === 0) return null;

            return {
                totalBillsCount: listToSum.reduce((acc, p) => acc + p.allBills.length, 0),
                withinTarget: {
                    count: listToSum.reduce((acc, p) => acc + p.withinTarget.count, 0),
                    amount: listToSum.reduce((acc, p) => acc + p.withinTarget.amount, 0),
                    bills: listToSum.reduce((acc, p) => [...acc, ...p.withinTarget.bills], [] as InvoiceRecord[])
                },
                overdueBand1: {
                    count: listToSum.reduce((acc, p) => acc + p.overdueBand1.count, 0),
                    amount: listToSum.reduce((acc, p) => acc + p.overdueBand1.amount, 0),
                    bills: listToSum.reduce((acc, p) => [...acc, ...p.overdueBand1.bills], [] as InvoiceRecord[])
                },
                overdueBand2: {
                    count: listToSum.reduce((acc, p) => acc + p.overdueBand2.count, 0),
                    amount: listToSum.reduce((acc, p) => acc + p.overdueBand2.amount, 0),
                    bills: listToSum.reduce((acc, p) => [...acc, ...p.overdueBand2.bills], [] as InvoiceRecord[])
                },
                overdueBand3: {
                    count: listToSum.reduce((acc, p) => acc + p.overdueBand3.count, 0),
                    amount: listToSum.reduce((acc, p) => acc + p.overdueBand3.amount, 0),
                    bills: listToSum.reduce((acc, p) => [...acc, ...p.overdueBand3.bills], [] as InvoiceRecord[])
                },
                overdueBand4: {
                    count: listToSum.reduce((acc, p) => acc + (p.overdueBand4?.count || 0), 0),
                    amount: listToSum.reduce((acc, p) => acc + (p.overdueBand4?.amount || 0), 0),
                    bills: listToSum.reduce((acc, p) => [...acc, ...(p.overdueBand4?.bills || [])], [] as InvoiceRecord[])
                },
                overdueBand5: {
                    count: listToSum.reduce((acc, p) => acc + (p.overdueBand5?.count || 0), 0),
                    amount: listToSum.reduce((acc, p) => acc + (p.overdueBand5?.amount || 0), 0),
                    bills: listToSum.reduce((acc, p) => [...acc, ...(p.overdueBand5?.bills || [])], [] as InvoiceRecord[])
                },
                hold: {
                    count: listToSum.reduce((acc, p) => acc + (p.hold?.count || 0), 0),
                    amount: listToSum.reduce((acc, p) => acc + (p.hold?.amount || 0), 0),
                    bills: listToSum.reduce((acc, p) => [...acc, ...(p.hold?.bills || [])], [] as InvoiceRecord[])
                },
                requiredDailyRate: Math.round(listToSum.reduce((acc, p) => acc + p.allBills.length, 0) / Math.max(1, targetDays))
            };
        };

        const renderTotalRow = (label: string, totalsObj: any, isSubRow: boolean) => {
            if (!totalsObj) return null;
            const textWeightClass = isSubRow ? "font-normal" : "font-extrabold";
            const severeWeightClass = isSubRow ? "font-normal" : "font-black";
            const pyClass = isSubRow ? "py-0.5" : "py-1";
            return (
                <motion.tr 
                    variants={itemVariants}
                    initial="hidden"
                    animate="show"
                    custom={10} // Constant delay for total row
                    className={cn(
                        isSubRow 
                            ? cn("bg-slate-100 text-slate-700 font-medium select-none animate-fade-in", label.includes("Total Payment Bal") ? "border-none" : "border-t border-slate-205") 
                            : "bg-slate-100 font-black border-t-2 border-slate-350 select-none",
                        "hover:bg-slate-300/40"
                    )}
                >
                    {/* Total Label */}
                    <td className={cn(pyClass, "px-2 border-none", isSubRow ? "pl-4 text-slate-700 font-normal" : "font-extrabold text-slate-900")}>
                        <div className={cn(isSubRow ? "text-[11.5px] font-normal" : "font-extrabold text-slate-900 uppercase text-[12.5px]", "whitespace-nowrap")}>
                            {label} - {totalsObj.totalBillsCount} {totalsObj.totalBillsCount === 1 ? 'Bill' : 'Bills'}
                            <span className={cn("ml-1 font-bold", isSubRow ? "text-slate-600 font-normal text-[10.5px]" : "text-slate-700 text-[11px]")}>
                                ({formatCurrency(
                                    totalsObj.withinTarget.amount +
                                    totalsObj.overdueBand1.amount +
                                    totalsObj.overdueBand2.amount +
                                    totalsObj.overdueBand3.amount +
                                    (totalsObj.overdueBand4?.amount || 0) +
                                    (totalsObj.overdueBand5?.amount || 0) +
                                    totalsObj.hold.amount
                                )})
                            </span>
                        </div>
                    </td>
                                       {/* Total On Track */}
                    <td 
                        onClick={() => {
                            if (totalsObj.withinTarget.count > 0) {
                                setPopoverRecords(totalsObj.withinTarget.bills);
                                setPopoverTitle(`${label} - On Track (${levelName.toUpperCase()})`);
                            }
                        }}
                        className={cn(
                            pyClass,
                            "px-2 border-none text-right text-[12.5px]",
                            textWeightClass,
                            isSubRow ? "text-emerald-650" : "text-emerald-750",
                            totalsObj.withinTarget.count > 0 ? "cursor-pointer hover:bg-emerald-100/30" : "text-slate-300 font-normal"
                        )}
                    >
                        {totalsObj.withinTarget.count > 0 ? (
                            <>{totalsObj.withinTarget.count} Bills <span className={cn('text-slate-650', isSubRow ? 'font-normal' : 'font-semibold')}>({formatCurrency(totalsObj.withinTarget.amount)})</span></>
                        ) : (
                            "-"
                        )}
                    </td>

                    {/* Total Warning */}
                    <td 
                        onClick={() => {
                            if (totalsObj.overdueBand1.count > 0) {
                                setPopoverRecords(totalsObj.overdueBand1.bills);
                                setPopoverTitle(`${label} - Warning (${levelName.toUpperCase()})`);
                            }
                        }}
                        className={cn(
                            pyClass,
                            "px-2 border-none text-right text-[12.5px]",
                            textWeightClass,
                            isSubRow ? "text-amber-650" : "text-amber-750",
                            totalsObj.overdueBand1.count > 0 ? cn("cursor-pointer hover:bg-amber-100/30", isSubRow ? "font-normal" : "font-extrabold") : "text-slate-300 font-normal"
                        )}
                    >
                        {totalsObj.overdueBand1.count > 0 ? (
                            <>{totalsObj.overdueBand1.count} Bills <span className={cn('text-slate-650', isSubRow ? 'font-normal' : 'font-semibold')}>({formatCurrency(totalsObj.overdueBand1.amount)})</span></>
                        ) : (
                            "-"
                        )}
                    </td>

                    {/* Total Severe */}
                    <td 
                        onClick={() => {
                            if (totalsObj.overdueBand2.count > 0) {
                                setPopoverRecords(totalsObj.overdueBand2.bills);
                                setPopoverTitle(`${label} - Severe (${levelName.toUpperCase()})`);
                            }
                        }}
                        className={cn(
                            pyClass,
                            "px-2 border-none text-right text-[12.5px]",
                            severeWeightClass,
                            isSubRow ? "text-[#c2410c]/80" : "text-[#c2410c]",
                            totalsObj.overdueBand2.count > 0 ? "cursor-pointer hover:bg-orange-100/20" : "text-slate-300 font-normal"
                        )}
                    >
                        {totalsObj.overdueBand2.count > 0 ? (
                            <>{totalsObj.overdueBand2.count} Bills <span className={cn('text-slate-650', isSubRow ? 'font-normal' : 'font-semibold')}>({formatCurrency(totalsObj.overdueBand2.amount)})</span></>
                        ) : (
                            "-"
                        )}
                    </td>

                    {/* Total Critical (or split for accounts) */}
                    {levelName === 'accounts' ? (
                        <>
                            {/* Critical 31-60 */}
                            <td 
                                onClick={() => {
                                    if (totalsObj.overdueBand3.count > 0) {
                                        setPopoverRecords(totalsObj.overdueBand3.bills);
                                        setPopoverTitle(`${label} - Critical 31-60 Days (${levelName.toUpperCase()})`);
                                    }
                                }}
                                className={cn(
                                    pyClass,
                                    "px-2 border-none text-right text-[12.5px]",
                                    textWeightClass,
                                    isSubRow ? "text-[#800020]/80" : "text-[#800020]",
                                    totalsObj.overdueBand3.count > 0 ? "cursor-pointer hover:bg-rose-50/30" : "text-slate-300 font-normal"
                                )}
                            >
                                {totalsObj.overdueBand3.count > 0 ? (
                                    <>{totalsObj.overdueBand3.count} Bills <span className={cn('text-slate-650', isSubRow ? 'font-normal' : 'font-semibold')}>({formatCurrency(totalsObj.overdueBand3.amount)})</span></>
                                ) : (
                                    "-"
                                )}
                            </td>

                            {/* Critical 61-90 */}
                            <td 
                                onClick={() => {
                                    if ((totalsObj.overdueBand4?.count || 0) > 0) {
                                        setPopoverRecords(totalsObj.overdueBand4.bills);
                                        setPopoverTitle(`${label} - Critical 61-90 Days (${levelName.toUpperCase()})`);
                                    }
                                }}
                                className={cn(
                                    pyClass,
                                    "px-2 border-none text-right text-[12.5px]",
                                    textWeightClass,
                                    isSubRow ? "text-red-750/80" : "text-red-800",
                                    (totalsObj.overdueBand4?.count || 0) > 0 ? "cursor-pointer hover:bg-rose-100/30" : "text-slate-300 font-normal"
                                )}
                            >
                                {(totalsObj.overdueBand4?.count || 0) > 0 ? (
                                    <>{totalsObj.overdueBand4.count} Bills <span className={cn('text-slate-650', isSubRow ? 'font-normal' : 'font-semibold')}>({formatCurrency(totalsObj.overdueBand4.amount)})</span></>
                                ) : (
                                    "-"
                                )}
                            </td>

                            {/* Critical 91+ */}
                            <td 
                                onClick={() => {
                                    if ((totalsObj.overdueBand5?.count || 0) > 0) {
                                        setPopoverRecords(totalsObj.overdueBand5.bills);
                                        setPopoverTitle(`${label} - Critical 91+ Days (${levelName.toUpperCase()})`);
                                    }
                                }}
                                className={cn(
                                    pyClass,
                                    "px-2 border-none text-right text-[12.5px]",
                                    textWeightClass,
                                    isSubRow ? "text-[#800020]/80" : "text-[#5C061C]",
                                    (totalsObj.overdueBand5?.count || 0) > 0 ? "cursor-pointer hover:bg-red-200/20" : "text-slate-300 font-normal"
                                )}
                            >
                                {(totalsObj.overdueBand5?.count || 0) > 0 ? (
                                    <>{totalsObj.overdueBand5.count} Bills <span className={cn('text-slate-650', isSubRow ? 'font-normal' : 'font-semibold')}>({formatCurrency(totalsObj.overdueBand5.amount)})</span></>
                                ) : (
                                    "-"
                                )}
                            </td>
                        </>
                    ) : (
                        <td 
                            onClick={() => {
                                if (totalsObj.overdueBand3.count > 0) {
                                    setPopoverRecords(totalsObj.overdueBand3.bills);
                                    setPopoverTitle(`${label} - Critical (${levelName.toUpperCase()})`);
                                }
                            }}
                            className={cn(
                                pyClass,
                                "px-2 border-none text-right text-[12.5px]",
                                textWeightClass,
                                isSubRow ? "text-[#800020]/80" : "text-[#800020]",
                                totalsObj.overdueBand3.count > 0 ? "cursor-pointer hover:bg-red-100/20" : "text-slate-300 font-normal"
                            )}
                        >
                            {totalsObj.overdueBand3.count > 0 ? (
                                <>{totalsObj.overdueBand3.count} Bills <span className='text-slate-650 font-semibold'>({formatCurrency(totalsObj.overdueBand3.amount)})</span></>
                            ) : (
                                "-"
                            )}
                        </td>
                    )}

                    {/* Total Hold (Site/HO only) */}
                    {(levelName === 'site' || levelName === 'ho') && (
                        <td 
                            onClick={() => {
                                if (totalsObj.hold.count > 0) {
                                    setPopoverRecords(totalsObj.hold.bills);
                                    setPopoverTitle(`${label} - Holds (${levelName.toUpperCase()})`);
                                }
                            }}
                            className={cn(
                                pyClass,
                                "px-2 border-none text-right text-[12.5px] text-red-700 bg-red-50/10",
                                severeWeightClass,
                                totalsObj.hold.count > 0 ? "cursor-pointer hover:bg-red-100/20" : "text-slate-300 font-normal"
                            )}
                        >
                            {totalsObj.hold.count > 0 ? (
                                <>{totalsObj.hold.count} Bills <span className='text-slate-650 font-semibold'>({formatCurrency(totalsObj.hold.amount)})</span></>
                            ) : (
                                "-"
                            )}
                        </td>
                    )}

                    {/* Total Required processing rate */}
                    {levelName !== 'accounts' && (
                        <td className={cn(pyClass, "px-2 bg-indigo-50/10 text-right border-none")}>
                            <div className="font-extrabold text-[#111] text-[12.5px] leading-tight text-right">
                                {totalsObj.requiredDailyRate} <span className="text-[10px] font-normal text-slate-500">/day</span>
                            </div>
                        </td>
                    )}
                </motion.tr>
            );
        };

        const defaultHeight = levelName === 'accounts' ? 450 : 350;
        const outerBorderColor = 
            levelName === 'site' ? 'border-amber-200 shadow-amber-100/50' : 
            levelName === 'ho' ? 'border-blue-200 shadow-blue-100/50' : 
            'border-cyan-200 shadow-cyan-100/50';

        return (
            <div className={cn(
                "border rounded-xl bg-white shadow-md overflow-hidden p-0.5 transition-all duration-300",
                outerBorderColor
            )}>
                <ResizableBox 
                    defaultMaxHeight={defaultHeight} 
                    className="pr-1 border-none bg-transparent"
                >
                    <table id={`insight-table-${levelName}`} data-sheet-title={title} className="w-full text-left border-collapse text-[11px] md:text-[12px] font-mono border-none table-auto">
                    <thead>
                        <tr className="bg-white sticky top-0 z-20 border-b border-slate-100 text-slate-550 font-bold uppercase select-none">
                            <th className="py-1 px-2 border-none text-left bg-slate-100 text-slate-700">Project</th>
                            <th className="py-1 px-2 bg-emerald-50 text-emerald-800 border-none text-right whitespace-nowrap">On Track ({onTrackRange} Days)</th>
                            <th className="py-1 px-2 bg-amber-50 text-amber-800 border-none text-right whitespace-nowrap">Warning ({warningRange} Days)</th>
                            <th className="py-1 px-2 bg-orange-100 text-orange-950 border-none text-right whitespace-nowrap">Severe ({severeRange} Days)</th>
                            {levelName === 'accounts' ? (
                                <>
                                    <th className="py-1 px-2 bg-rose-50 text-rose-800 border-none text-right whitespace-nowrap">Critical (31-60 Days)</th>
                                    <th className="py-1 px-2 bg-rose-100 text-rose-900 border-none text-right whitespace-nowrap">Critical (61-90 Days)</th>
                                    <th className="py-1 px-2 bg-[#800020]/15 text-[#800020] border-none text-right whitespace-nowrap">Critical (91+ Days)</th>
                                </>
                            ) : (
                                <th className="py-1 px-2 bg-[#800020]/10 text-[#800020] border-none text-right whitespace-nowrap">Critical ({criticalRange} Days)</th>
                            )}
                            {(levelName === 'site' || levelName === 'ho') && (
                                <th className="py-1 px-2 bg-red-50 text-red-700 border-none text-right whitespace-nowrap">Hold</th>
                            )}
                            {levelName !== 'accounts' && (
                                <th className="py-1 px-2 bg-indigo-50 text-indigo-850 font-black border-none text-right whitespace-nowrap">Required Clearing rate (Bills/Day)</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y-0">
                        {dataList.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-3 text-center text-slate-400 italic font-mono text-[10.5px]">
                                    No active pending bills found for {title}.
                                </td>
                            </tr>
                        ) : (
                            dataList.map((project, idx) => {
                                const totalPending = project.allBills.length;
                                const requiredDailyRate = Math.round(totalPending / Math.max(1, targetDays));

                                const totalAmount = project.allBills.reduce((sum: number, r: InvoiceRecord) => {
                                    if (levelName === 'accounts') {
                                        return sum + Number(r['Balance Payment'] || r['Bill Amount (Net Payble)'] || 0);
                                    }
                                    return sum + Number(r['Bill Amount (Net Payble)'] || 0);
                                }, 0);

                                // Determine age color for the total backlog font
                                let ageColorClass = "text-emerald-700 font-extrabold";
                                if (project.hold && project.hold.count > 0) {
                                    ageColorClass = "text-red-700 font-extrabold";
                                } else if (project.overdueBand3.count > 0) {
                                    ageColorClass = "text-[#800020] font-extrabold";
                                } else if (project.overdueBand2.count > 0) {
                                    ageColorClass = "text-[#c2410c] font-extrabold";
                                } else if (project.overdueBand1.count > 0) {
                                    ageColorClass = "text-amber-550 font-extrabold";
                                }

                                let isAccountsRow = levelName === 'accounts';
                                let formattedProjectName = project.projectName;
                                let displayName = "";
                                let cellStyle = "py-1 px-2 text-[12.5px] whitespace-nowrap";
                                if (isAccountsRow) {
                                    const baseName = project.allBills[0]?.Project || 'Main Project';
                                    if (project.subType === 'partial') {
                                        formattedProjectName = `└─ Partial Payment Bal`;
                                        displayName = formattedProjectName;
                                        cellStyle = "py-0.5 px-2 text-[11.5px] pl-4 whitespace-nowrap text-slate-900 font-bold";
                                    } else if (project.subType === 'unpaid') {
                                        formattedProjectName = `└─ Payment Bal`;
                                        displayName = formattedProjectName;
                                        cellStyle = "py-0.5 px-2 text-[11.5px] pl-4 whitespace-nowrap text-slate-900 font-bold";
                                    } else {
                                        formattedProjectName = `${baseName}`;
                                        displayName = `${formattedProjectName} - ${totalPending} ${totalPending === 1 ? 'Bill' : 'Bills'}`;
                                        cellStyle = "py-1 px-2 text-xs md:text-[13px] whitespace-nowrap text-slate-950 font-black bg-slate-50 border-t border-slate-205";
                                    }
                                } else {
                                    displayName = `${project.projectName} - ${totalPending} Bills`;
                                    cellStyle = "py-1 px-2 text-xs md:text-[13px] font-black whitespace-nowrap text-slate-950";
                                }

                                const isBoldRow = !isAccountsRow || project.subType === 'total';

                                return (
                                    <motion.tr 
                                        key={idx}
                                        variants={itemVariants}
                                        initial="hidden"
                                        animate="show"
                                        custom={idx}
                                        className={cn(
                                            "border-none", 
                                            (levelName === 'accounts' && project.subType === 'total') 
                                                ? "bg-slate-100 hover:bg-slate-200 sticky top-[27.5px] z-10" 
                                                : "hover:bg-slate-50/40"
                                        )}
                                    >
                                        {/* Project Column with Name and Amounts */}
                                        <td className={cn(cellStyle, "border-none bg-transparent")}>
                                            <span className={cn(isBoldRow ? "text-slate-950 font-black" : "text-slate-900 font-bold")}>
                                                {displayName}
                                            </span>
                                            {(project.subType === 'total' || !isAccountsRow) && (
                                                <span className="ml-1 text-[11px] font-extrabold text-slate-800">
                                                    ({formatCurrency(totalAmount)})
                                                </span>
                                            )}
                                        </td>

                                        {/* On Track Column */}
                                        <td 
                                            onClick={() => {
                                                if (project.withinTarget.count > 0) {
                                                    setPopoverRecords(project.withinTarget.bills);
                                                    setPopoverTitle(`${project.projectName} - On Track (${levelName.toUpperCase()})`);
                                                }
                                            }}
                                            className={cn(
                                                "py-0.5 px-2 border-none text-right text-[12.5px]",
                                                project.withinTarget.count > 0 
                                                    ? cn("cursor-pointer hover:bg-emerald-100/20 text-emerald-700", isBoldRow ? "font-extrabold" : "font-normal") 
                                                    : "text-slate-300 font-normal"
                                            )}
                                        >
                                            {project.withinTarget.count > 0 ? (
                                                <>{project.withinTarget.count} Bills <span className='text-slate-650 font-medium'>({formatCurrency(project.withinTarget.amount)})</span></>
                                            ) : (
                                                "-"
                                            )}
                                        </td>

                                        {/* Warning Column */}
                                        <td 
                                            onClick={() => {
                                                if (project.overdueBand1.count > 0) {
                                                    setPopoverRecords(project.overdueBand1.bills);
                                                    setPopoverTitle(`${project.projectName} - Warning (${levelName.toUpperCase()})`);
                                                }
                                            }}
                                            className={cn(
                                                "py-0.5 px-2 border-none text-right text-[12.5px]",
                                                project.overdueBand1.count > 0 
                                                    ? cn("cursor-pointer hover:bg-amber-100/20 text-amber-700", isBoldRow ? "font-extrabold" : "font-normal") 
                                                    : "text-slate-350 font-normal"
                                            )}
                                        >
                                            {project.overdueBand1.count > 0 ? (
                                                <>{project.overdueBand1.count} Bills <span className='text-slate-650 font-medium'>({formatCurrency(project.overdueBand1.amount)})</span></>
                                            ) : (
                                                "-"
                                            )}
                                        </td>

                                        {/* Severe Column */}
                                        <td 
                                            onClick={() => {
                                                if (project.overdueBand2.count > 0) {
                                                    setPopoverRecords(project.overdueBand2.bills);
                                                    setPopoverTitle(`${project.projectName} - Severe (${levelName.toUpperCase()})`);
                                                }
                                            }}
                                            className={cn(
                                                "py-0.5 px-2 border-none text-right text-[12.5px]",
                                                project.overdueBand2.count > 0 
                                                    ? cn("cursor-pointer hover:bg-orange-100/20 text-[#c2410c]", isBoldRow ? "font-black" : "font-normal") 
                                                    : "text-slate-350 font-normal"
                                            )}
                                        >
                                            {project.overdueBand2.count > 0 ? (
                                                <>{project.overdueBand2.count} Bills <span className='text-slate-650 font-medium'>({formatCurrency(project.overdueBand2.amount)})</span></>
                                            ) : (
                                                "-"
                                            )}
                                        </td>

                                        {/* Critical Column (or split for accounts) */}
                                        {levelName === 'accounts' ? (
                                            <>
                                                {/* OverdueBand3 (31-60 Days) */}
                                                <td 
                                                    onClick={() => {
                                                        if (project.overdueBand3.count > 0) {
                                                            setPopoverRecords(project.overdueBand3.bills);
                                                            setPopoverTitle(`${project.projectName} - Critical (31-60 Days)`);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "py-0.5 px-2 border-none text-right text-[12.5px]",
                                                        project.overdueBand3.count > 0 
                                                            ? cn("cursor-pointer hover:bg-rose-50/30 text-[#800020]/90", isBoldRow ? "font-extrabold" : "font-normal") 
                                                            : "text-slate-350 font-normal"
                                                    )}
                                                >
                                                    {project.overdueBand3.count > 0 ? (
                                                        <>{project.overdueBand3.count} Bills <span className='text-slate-650 font-medium'>({formatCurrency(project.overdueBand3.amount)})</span></>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>

                                                {/* OverdueBand4 (61-90 Days) */}
                                                <td 
                                                    onClick={() => {
                                                        if ((project.overdueBand4?.count || 0) > 0) {
                                                            setPopoverRecords(project.overdueBand4.bills);
                                                            setPopoverTitle(`${project.projectName} - Critical (61-90 Days)`);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "py-0.5 px-2 border-none text-right text-[12.5px]",
                                                        (project.overdueBand4?.count || 0) > 0 
                                                            ? "cursor-pointer hover:bg-rose-100/30 text-rose-950 font-normal"
                                                            : "text-slate-350 font-normal"
                                                    )}
                                                >
                                                    {(project.overdueBand4?.count || 0) > 0 ? (
                                                        <>{project.overdueBand4.count} Bills <span className='text-slate-650 font-medium'>({formatCurrency(project.overdueBand4.amount)})</span></>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>

                                                {/* OverdueBand5 (91+ Days) */}
                                                <td 
                                                    onClick={() => {
                                                        if ((project.overdueBand5?.count || 0) > 0) {
                                                            setPopoverRecords(project.overdueBand5.bills);
                                                            setPopoverTitle(`${project.projectName} - Critical (91+ Days)`);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "py-0.5 px-2 border-none text-right text-[12.5px]",
                                                        (project.overdueBand5?.count || 0) > 0 
                                                            ? "cursor-pointer hover:bg-red-200/20 text-[#800020] font-normal"
                                                            : "text-slate-350 font-normal"
                                                    )}
                                                >
                                                    {(project.overdueBand5?.count || 0) > 0 ? (
                                                        <>{project.overdueBand5.count} Bills <span className='text-slate-650 font-medium'>({formatCurrency(project.overdueBand5.amount)})</span></>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
                                            </>
                                        ) : (
                                            <td 
                                                onClick={() => {
                                                    if (project.overdueBand3.count > 0) {
                                                        setPopoverRecords(project.overdueBand3.bills);
                                                        setPopoverTitle(`${project.projectName} - Critical (${levelName.toUpperCase()})`);
                                                    }
                                                }}
                                                className={cn(
                                                    "py-0.5 px-2 border-none text-right text-[12.5px]",
                                                    project.overdueBand3.count > 0 
                                                        ? cn("cursor-pointer hover:bg-red-100/20 text-[#800020]", isBoldRow ? "font-extrabold" : "font-normal") 
                                                        : "text-slate-350 font-normal"
                                                )}
                                            >
                                                {project.overdueBand3.count > 0 ? (
                                                    <>{project.overdueBand3.count} Bills <span className='text-slate-650 font-medium'>({formatCurrency(project.overdueBand3.amount)})</span></>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                        )}

                                        {/* Hold Column (Visible only for site/ho level) */}
                                        {(levelName === 'site' || levelName === 'ho') && (
                                            <td 
                                                onClick={() => {
                                                    if (project.hold.count > 0) {
                                                        setPopoverRecords(project.hold.bills);
                                                        setPopoverTitle(`${project.projectName} - Holds (${levelName.toUpperCase()})`);
                                                    }
                                                }}
                                                className={cn(
                                                    "py-0.5 px-2 border-none text-right text-[12.5px] bg-red-50/5",
                                                    project.hold.count > 0 ? "cursor-pointer hover:bg-red-100/25 text-red-700 font-black" : "text-slate-350 font-normal"
                                                )}
                                            >
                                                {project.hold.count > 0 ? (
                                                    <>{project.hold.count} Bills <span className='text-slate-650 font-medium'>({formatCurrency(project.hold.amount)})</span></>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                        )}

                                        {/* Required processing rate */}
                                        {levelName !== 'accounts' && (
                                            <td className="py-0.5 px-2 bg-indigo-50/5 transition-all text-right border-none">
                                                <div className="font-extrabold text-indigo-700 font-mono text-[12.5px] leading-tight text-right">
                                                    {requiredDailyRate} <span className="text-[10px] font-normal text-slate-500">/day</span>
                                                </div>
                                            </td>
                                        )}
                                    </motion.tr>
                                );
                            })
                        )}

                    </tbody>
                    {/* RENDER TOTAL ROW IF THERE ARE MULTIPLE PROJECTS IN STICKY TFOOT */}
                    {showTotals && (
                        <tfoot className="sticky bottom-0 z-10 bg-white border-t-2 border-slate-350 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            {levelName === 'accounts' ? (
                                <>
                                    {renderTotalRow("TOTAL", getTotalsObj('total'), false)}
                                    {renderTotalRow("└─ Total Partial Payment Bal", getTotalsObj('partial'), true)}
                                    {renderTotalRow("└─ Total Payment Bal", getTotalsObj('unpaid'), true)}
                                </>
                            ) : (
                                renderTotalRow("TOTAL", getTotalsObj(), false)
                            )}
                        </tfoot>
                    )}
                </table>
            </ResizableBox>
            </div>
        );
    };

    // Render detailed list of bills in holds as requested by user
    const renderHoldTable = (
        title: string,
        holdsData: Record<string, InvoiceRecord[]>,
        isSiteHold: boolean
    ) => {
        const today = new Date();
        const projectsWithHolds = Object.entries(holdsData).sort((a, b) => a[0].localeCompare(b[0]));

        if (projectsWithHolds.length === 0) {
            return (
                <div className="py-2 px-3 text-left text-red-650 font-mono text-xs italic bg-transparent select-none">
                    No active {isSiteHold ? 'Hold at Site' : 'Hold at Head Office'} registered.
                </div>
            );
        }

        return (
            <ResizableBox defaultMaxHeight={300} className="bg-transparent pr-1 border-none">
                    <table id={isSiteHold ? "insight-table-holds-site" : "insight-table-holds-ho"} data-sheet-title={isSiteHold ? "Holds at Site" : "Holds at Head Office"} className="w-full text-left font-mono text-[10.5px] md:text-xs border-none table-fixed">
                        <colgroup>
                            <col className="w-[28%]" />
                            <col className="w-[44%]" />
                            <col className="w-[12%]" />
                            <col className="w-[16%]" />
                        </colgroup>
                        <tbody className="divide-y divide-red-100">
                            {projectsWithHolds.map(([projectName, bills]) => {
                                const projectRows = bills.map((b, idx) => {
                                    const parseToDate = (val: any) => {
                                        if (!val) return null;
                                        const d = new Date(val);
                                        return isValid(d) ? d : null;
                                    };
                                    const dateRef = isSiteHold 
                                        ? parseToDate(b['Inward Date'])
                                        : parseToDate(b['Received at HO']);
                                    const pendingDays = dateRef
                                        ? Math.max(0, differenceInDays(today, dateRef))
                                        : 0;
    
                                    const contractorName = b['Contractor Name'] || 'N/A';
                                    const workHead = b['Work Head'] || 'N/A';
                                    const bldg = b['LOCATION/Bldg.'] || 'N/A';
                                    const billType = b['Bill Type'] || 'N/A';
    
                                    const holdReason = isSiteHold 
                                        ? b['Reason For Hold at Site'] || 'N/A'
                                        : b['Reason For Hold at HO'] || 'N/A';
                                    const remark = isSiteHold
                                        ? b['Remark Site'] || 'N/A'
                                        : b['Remark HO'] || 'N/A';
    
                                    const dateStr = dateRef ? format(dateRef, 'dd-MM-yy') : 'N/A';
                                    
                                    // Format age
                                    let ageDays = "";
                                    let ageSince = "";
                                    if (pendingDays === 0) {
                                        ageDays = "Today";
                                    } else if (pendingDays > 30) {
                                        const monthsVal = (pendingDays / 30).toFixed(1);
                                        ageDays = `${monthsVal} months`;
                                        ageSince = `since ${dateStr}`;
                                    } else {
                                        ageDays = `${pendingDays} days`;
                                        ageSince = `since ${dateStr}`;
                                    }
    
                                    const srNo = b['Sr no'] || 'N/A';
    
                                    return (
                                        <motion.tr 
                                            key={b['Sr no'] || idx}
                                            variants={itemVariants}
                                            initial="hidden"
                                            animate="show"
                                            custom={idx}
                                            onClick={() => {
                                                setPopoverRecords([b]);
                                                setPopoverTitle(`Ref #${srNo} - ${contractorName} Detail`);
                                            }}
                                            className="hover:bg-red-50/10 cursor-pointer border-b border-red-50/60"
                                        >
                                            {/* Contractor Info */}
                                            <td className="py-1 px-3 border-none align-top text-red-600 font-normal leading-tight w-[28%]">
                                                <div className="font-bold uppercase text-[11px] truncate text-red-800" title={contractorName}>
                                                    {contractorName}
                                                </div>
                                                <div className="text-[9.5px] text-red-400 truncate mt-0.5">
                                                    {billType} | {workHead} [{bldg}]
                                                </div>
                                            </td>
    
                                            {/* Reason & Remarks */}
                                            <td className="py-1 px-3 border-none align-top text-red-600 leading-tight w-[44%]">
                                                <div className="font-normal text-[10.5px] truncate text-red-800" title={holdReason}>
                                                    {holdReason}
                                                </div>
                                                {remark && remark !== 'N/A' && (
                                                    <div className="text-[9.5px] text-red-400 font-medium italic mt-0.5" title={remark}>
                                                        Rem: {remark}
                                                    </div>
                                                )}
                                            </td>
    
                                            {/* Net Payable Amount */}
                                            <td className="py-1 px-3 border-none text-right font-normal text-red-800 text-[11px] align-top font-mono w-[12%]">
                                                {formatCurrency(Number(b['Bill Amount (Net Payble)'] || 0))}
                                            </td>
    
                                            {/* Ageing Details */}
                                            <td className="py-1 px-3 border-none text-right align-top text-red-700 font-normal leading-tight select-none w-[16%]">
                                                <div className="text-[10px] font-bold whitespace-nowrap">
                                                    {ageDays}
                                                </div>
                                                {ageSince && (
                                                    <div className="text-[8px] text-red-400 whitespace-nowrap font-normal mt-0.5">
                                                        {ageSince}
                                                    </div>
                                                )}
                                            </td>
                                        </motion.tr>
                                    );
                                });
    
                                return [
                                    <tr key={`grp-${projectName}`} className="bg-red-50 border-b border-red-200 sticky top-0 z-30" onClick={() => {
                                        setPopoverRecords(bills);
                                        setPopoverTitle(`${projectName} - ${bills.length} Bills Check Details`);
                                    }}>
                                        <td colSpan={4} className="py-1 px-3 font-bold text-slate-800 uppercase text-[10px] md:text-xs tracking-wider border-none select-none cursor-pointer bg-red-50/95 backdrop-blur-sm">
                                            {projectName} - {bills.length} Bills ({formatCurrency(bills.reduce((sum, b) => sum + Number(b['Bill Amount (Net Payble)'] || 0), 0))})
                                        </td>
                                    </tr>,
                                    ...projectRows
                                ];
                            })}
                        </tbody>
                    </table>
            </ResizableBox>
        );
    };

    const renderSendToHoTable = (groups: Record<string, InvoiceRecord[]>) => {
        const today = new Date();
        const parseToDate = (val: any) => {
            if (!val) return null;
            const parsed = new Date(val);
            return isNaN(parsed.getTime()) ? null : parsed;
        };

        return (
            <div className="space-y-2">
                {Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])).map(([projectName, bills]: [string, InvoiceRecord[]]) => {
                    const sumPayable = bills.reduce((sum, b) => sum + Number(b['Bill Amount (Net Payble)'] || 0), 0);
                    
                    const rows = bills.map((b) => {
                        const dateRef = parseToDate(b['HO Submission Date'] || b['Received at HO']);
                        const pendingDays = dateRef ? Math.max(0, differenceInDays(today, dateRef)) : 0;
                        const dateStr = dateRef ? format(dateRef, 'dd-MM-yy') : 'N/A';
                        
                        let ageDays = pendingDays === 0 ? "Today" : `${pendingDays} days`;
                        let ageSince = pendingDays === 0 ? "" : `since ${dateStr}`;
                        
                        return { 
                            ...b, 
                            isToday: pendingDays === 0,
                            ageDays,
                            ageSince,
                            srNo: b['Sr no'] || 'N/A',
                            contractorName: b['Contractor Name'] || 'N/A'
                        };
                    });
 
                    const todayBills = rows.filter(r => r.isToday);
                    const otherBills = rows.filter(r => !r.isToday);
 
                    const renderTable = (bills: any[], title: string) => (
                        <div className="space-y-1">
                            <h4 className="font-bold text-[10px] uppercase bg-slate-100 px-2 py-0.5">{title} ({bills.length})</h4>
                            <ResizableBox defaultMaxHeight={200} className="pr-1">
                                <table className="insight-table-transit-element w-full text-left font-mono text-xs table-fixed" data-sheet-title={`${projectName} - ${title}`}>
                                    <colgroup>
                                        <col className="w-[74%]" />
                                        <col className="w-[10%]" />
                                        <col className="w-[16%]" />
                                    </colgroup>
                                    <tbody className="divide-y divide-slate-100">
                                        {bills.map((b, bIdx) => (
                                            <motion.tr 
                                                key={b.srNo} 
                                                variants={itemVariants}
                                                initial="hidden"
                                                animate="show"
                                                custom={bIdx}
                                                onClick={() => {
                                                    setPopoverRecords([b]);
                                                    setPopoverTitle(`Ref #${b.srNo} - ${b.contractorName} Detail`);
                                                }}
                                                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                                            >
                                                <td className="py-0.5 w-[74%] pr-2">
                                                    <div className="font-bold text-slate-800 truncate" title={`${b.contractorName} - ${b['Bill Type'] || 'N/A'} | ${b['Work Head'] || 'N/A'} [${b['LOCATION/Bldg.'] || 'N/A'}]`}>
                                                        <span>{b.contractorName}</span>
                                                        <span className="text-[10px] text-slate-500 font-normal ml-1.5">
                                                            - {b['Bill Type'] || 'N/A'} | {b['Work Head'] || 'N/A'} [{b['LOCATION/Bldg.'] || 'N/A'}]
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-0.5 text-right font-semibold text-slate-700 w-[10%] whitespace-nowrap pr-2">
                                                    {formatCurrency(Number(b['Bill Amount (Net Payble)'] || 0))}
                                                </td>
                                                <td className="py-0.5 text-right text-slate-600 whitespace-nowrap w-[16%] truncate leading-tight select-none">
                                                    <div className="text-[9.5px] font-bold">
                                                        {b.ageDays}
                                                    </div>
                                                    {b.ageSince && (
                                                        <div className="text-[7.5px] text-slate-400 font-normal">
                                                            {b.ageSince}
                                                        </div>
                                                    )}
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ResizableBox>
                        </div>
                    );

                    return (
                        <div key={projectName} className="border border-slate-200 rounded p-1">
                            <h3 onClick={() => {
                                setPopoverRecords(bills);
                                setPopoverTitle(`${projectName} - ${bills.length} Bills Detail`);
                            }} 
                            className="font-bold text-xs bg-slate-50 px-2 py-0.5 mb-1 hover:bg-slate-100 cursor-pointer">
                                {projectName} - {bills.length} Bills ({formatCurrency(sumPayable)})
                            </h3>
                            <div className="grid grid-cols-2 gap-2 divide-x divide-slate-200">
                                <div className="pr-2">{renderTable(todayBills, "Today")}</div>
                                <div className="pl-2">{renderTable(otherBills, "Before Today")}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (!reportData) return null;

    return (
        <div className="relative w-full bg-white min-h-screen font-sans text-slate-800 leading-normal selection:bg-blue-100 selection:text-blue-900">
            <motion.main 
                initial="hidden"
                animate="show"
                variants={{
                    hidden: { opacity: 0 },
                    show: {
                        opacity: 1,
                        transition: {
                            staggerChildren: 0.4
                        }
                    }
                }}
                style={{ backgroundColor: '#f8fafc' }}
                className="max-w-[98%] w-[98%] mx-auto py-[5px] px-[5px] space-y-32"
            >
                <div className="space-y-24">
                    {/* SECTION A: SITE-LEVEL OPERATIONAL BACKLOG & TARGET RATES */}
                    <motion.section 
                        variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                        style={{ marginTop: '50px', marginBottom: '50px' }}
                        className="space-y-12"
                    >
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2 mb-2">
                            <div className="flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-amber-600" />
                                <h2 className="text-xs font-bold tracking-wider uppercase text-slate-900">Site Level Bills <span className="italic font-normal capitalize ml-1.5 text-[11px] text-slate-500">Balance to prepare and submit to HO</span></h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono py-0.5 px-2 text-amber-800 font-bold bg-amber-50 rounded">
                                    Site Target: {siteTargetDays} Days
                                </span>
                                <Popover open={isExportOpenSite} onOpenChange={setIsExportOpenSite}>
                                    <PopoverTrigger className="h-6 text-[10px] px-2 py-0 border border-slate-305 bg-white hover:bg-gray-100 text-gray-750 flex items-center gap-1 shadow-sm font-semibold rounded-lg cursor-pointer transition-all">
                                        <FileDown className="w-3.5 h-3.5 text-gray-650" /> Export / Print <ChevronDown className="w-3 h-3 text-gray-500" />
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-36 p-1 bg-white border border-gray-200 rounded-lg shadow-md z-[110] flex flex-col gap-1">
                                        <button 
                                            onClick={() => {
                                                handleExportExcel('insight-table-site', 'Site Level Bills');
                                                setIsExportOpenSite(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleExportPDF('insight-table-site', 'Site Level Bills');
                                                setIsExportOpenSite(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-red-600" /> Export PDF
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handlePrintTable('insight-table-site', 'Site Level Bills');
                                                setIsExportOpenSite(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Printer className="w-3.5 h-3.5 text-blue-600" /> Print Table
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleScreenshot('#insight-table-site', 'Site Level Bills');
                                                setIsExportOpenSite(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Camera className="w-3.5 h-3.5 text-green-600" /> Screenshot
                                        </button>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {renderPerformanceTable(
                                "Site-Level Outward",
                                siteTargetDays,
                                "Site Target Days Inward",
                                siteLevelPerformance,
                                'site',
                                'text-amber-600',
                                'border-amber-200 bg-amber-50/20'
                            )}
                        </div>
                    </motion.section>
 
                    {/* Actionable Holds section (Consolidated Actionable Holds below Site Level Tables and above HO queue) */}
                    <motion.section 
                        variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                        style={{ marginBottom: '50px' }}
                        className="space-y-12"
                    >
                        <div className="flex items-center justify-between border-b border-red-200 pb-2 mb-2">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-red-650" />
                                <h2 className="text-xs font-extrabold tracking-wider uppercase text-slate-900 font-mono">Hold Bills <span className="italic font-normal capitalize ml-1.5 text-[11px] text-slate-500">Actionable for site team.</span></h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono py-0.5 px-2 text-red-800 font-bold bg-red-50 rounded">
                                    Total Actionable holds: {Object.values(holdDataGrouped.siteHolds).flat().length + Object.values(holdDataGrouped.hoHolds).flat().length} Bills
                                </span>
                                <Popover open={isExportOpenHolds} onOpenChange={setIsExportOpenHolds}>
                                    <PopoverTrigger className="h-6 text-[10px] px-2 py-0 border border-slate-305 bg-white hover:bg-gray-100 text-gray-750 flex items-center gap-1 shadow-sm font-semibold rounded-lg cursor-pointer transition-all">
                                        <FileDown className="w-3.5 h-3.5 text-gray-650" /> Export / Print <ChevronDown className="w-3 h-3 text-gray-500" />
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-36 p-1 bg-white border border-gray-200 rounded-lg shadow-md z-[110] flex flex-col gap-1">
                                        <button 
                                            onClick={() => {
                                                handleExportExcel(['insight-table-holds-site', 'insight-table-holds-ho'], 'Hold Bills');
                                                setIsExportOpenHolds(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleExportPDF(['insight-table-holds-site', 'insight-table-holds-ho'], 'Hold Bills');
                                                setIsExportOpenHolds(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-red-600" /> Export PDF
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handlePrintTable(['insight-table-holds-site', 'insight-table-holds-ho'], 'Hold Bills');
                                                setIsExportOpenHolds(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Printer className="w-3.5 h-3.5 text-blue-600" /> Print Table
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleScreenshot('#insight-table-holds-site, #insight-table-holds-ho', 'Hold Bills');
                                                setIsExportOpenHolds(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Camera className="w-3.5 h-3.5 text-green-600" /> Screenshot
                                        </button>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {/* Groups: Hold Tables Side-by-Side */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Group 1: Hold @ Site Table */}
                                <div className="space-y-1.5 border-none">
                                    <div className="flex items-center justify-between bg-slate-100 border border-slate-200 px-3 py-1.5 rounded">
                                        <h3 className="text-[11px] font-extrabold uppercase text-slate-800 font-sans cursor-pointer hover:text-slate-950" onClick={() => {
                                             setPopoverRecords(Object.values(holdDataGrouped.siteHolds).flat());
                                             setPopoverTitle("Hold Bills at Site");
                                        }}>
                                             Hold Bills at Site
                                        </h3>
                                        <span className="text-[10px] font-mono font-extrabold text-slate-700">
                                            {Object.values(holdDataGrouped.siteHolds).flat().length} Bills ({formatCurrency((Object.values(holdDataGrouped.siteHolds).flat() as any[]).reduce((sum, b) => sum + Number(b['Bill Amount (Net Payble)'] || 0), 0))})
                                        </span>
                                    </div>
                                    {renderHoldTable("Hold at Site", holdDataGrouped.siteHolds, true)}
                                </div>
                                
                                {/* Group 2: Hold @ HO Table (Site Rectifiable Actions) */}
                                <div className="space-y-1.5 border-none">
                                    <div className="flex items-center justify-between bg-slate-100 border border-slate-200 px-3 py-1.5 rounded">
                                        <h3 className="text-[11px] font-extrabold uppercase text-slate-800 font-sans cursor-pointer hover:text-slate-950" onClick={() => {
                                             setPopoverRecords(Object.values(holdDataGrouped.hoHolds).flat());
                                             setPopoverTitle("Hold Bills at HO");
                                        }}>
                                             Hold Bills at HO
                                        </h3>
                                        <span className="text-[10px] font-mono font-extrabold text-slate-700">
                                             {Object.values(holdDataGrouped.hoHolds).flat().length} Bills ({formatCurrency((Object.values(holdDataGrouped.hoHolds).flat() as any[]).reduce((sum, b) => sum + Number(b['Bill Amount (Net Payble)'] || 0), 0))})
                                        </span>
                                    </div>
                                    {renderHoldTable("Hold at HO", holdDataGrouped.hoHolds, false)}
                                </div>
                            </div>
                        </div>
                    </motion.section>
 
                    {/* SECTION for Bills Send to HO */}
                    <motion.section 
                        variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                        className="space-y-12"
                    >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-600" />
                                <h2 className="text-xs font-extrabold tracking-wider uppercase text-slate-900 font-mono">Bill Send to HO <span className="italic font-normal capitalize ml-1.5 text-[11px] text-slate-500">Bills in Transit from site to HO</span></h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono py-0.5 px-2 text-slate-700 font-bold bg-slate-50 rounded">
                                    {hoBills.length} {hoBills.length === 1 ? 'Bill' : 'Bills'}
                                </span>
                                <Popover open={isExportOpenTransit} onOpenChange={setIsExportOpenTransit}>
                                    <PopoverTrigger className="h-6 text-[10px] px-2 py-0 border border-slate-305 bg-white hover:bg-gray-100 text-gray-750 flex items-center gap-1 shadow-sm font-semibold rounded-lg cursor-pointer transition-all">
                                        <FileDown className="w-3.5 h-3.5 text-gray-650" /> Export / Print <ChevronDown className="w-3 h-3 text-gray-500" />
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-36 p-1 bg-white border border-gray-200 rounded-lg shadow-md z-[110] flex flex-col gap-1">
                                        <button 
                                            onClick={() => {
                                                handleExportExcel('.insight-table-transit-element', 'Bill Send to HO');
                                                setIsExportOpenTransit(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleExportPDF('.insight-table-transit-element', 'Bill Send to HO');
                                                setIsExportOpenTransit(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-red-600" /> Export PDF
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handlePrintTable('.insight-table-transit-element', 'Bill Send to HO');
                                                setIsExportOpenTransit(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Printer className="w-3.5 h-3.5 text-blue-600" /> Print Table
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleScreenshot('.insight-table-transit-element', 'Bill Send to HO');
                                                setIsExportOpenTransit(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Camera className="w-3.5 h-3.5 text-green-600" /> Screenshot
                                        </button>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {renderSendToHoTable(hoBillsByProject)}
                        </div>
                    </motion.section>
 
                    {/* SECTION B: HEAD OFFICE (HO) VALIDATION QUEUE & TARGET RATES */}
                    <motion.section 
                        variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                        className="space-y-12"
                    >
                        <div className="flex items-center justify-between border-b border-blue-200 pb-2 mb-2">
                            <div className="flex items-center gap-1.5">
                                <Building className="w-4 h-4 text-blue-600" />
                                <h2 className="text-xs font-bold tracking-wider uppercase text-slate-900">HO level Bills <span className="italic font-normal capitalize ml-1.5 text-[11px] text-slate-500">Balance for certification</span></h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono py-0.5 px-2 text-blue-800 font-bold bg-blue-50 rounded">
                                    HO Target: {hoTargetDays} Days
                                </span>
                                <Popover open={isExportOpenHO} onOpenChange={setIsExportOpenHO}>
                                    <PopoverTrigger className="h-6 text-[10px] px-2 py-0 border border-slate-305 bg-white hover:bg-gray-100 text-gray-750 flex items-center gap-1 shadow-sm font-semibold rounded-lg cursor-pointer transition-all">
                                        <FileDown className="w-3.5 h-3.5 text-gray-650" /> Export / Print <ChevronDown className="w-3 h-3 text-gray-500" />
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-36 p-1 bg-white border border-gray-200 rounded-lg shadow-md z-[110] flex flex-col gap-1">
                                        <button 
                                            onClick={() => {
                                                handleExportExcel('insight-table-ho', 'HO Level Bills');
                                                setIsExportOpenHO(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleExportPDF('insight-table-ho', 'HO Level Bills');
                                                setIsExportOpenHO(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-red-650" /> Export PDF
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handlePrintTable('insight-table-ho', 'HO Level Bills');
                                                setIsExportOpenHO(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Printer className="w-3.5 h-3.5 text-blue-600" /> Print Table
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleScreenshot('#insight-table-ho', 'HO Level Bills');
                                                setIsExportOpenHO(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Camera className="w-3.5 h-3.5 text-green-600" /> Screenshot
                                        </button>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {renderPerformanceTable(
                                "Head Office Validations",
                                hoTargetDays,
                                "HO Target Days",
                                hoLevelPerformance,
                                'ho',
                                'text-blue-650',
                                'border-blue-200 bg-blue-50/20'
                            )}
                        </div>
                    </motion.section>
 
                    {/* SECTION C: FINANCE & ACCOUNTS DESK */}
                    <motion.section 
                        variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                        className="space-y-12"
                    >
                        <div className="flex items-center justify-between border-b border-cyan-200 pb-2 mb-2">
                            <div className="flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-cyan-600" />
                                <h2 className="text-xs font-bold tracking-wider uppercase text-slate-900">Account Level Bills <span className="italic font-normal capitalize ml-1.5 text-[11px] text-slate-500">Payment Balance</span></h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono py-0.5 px-2 text-cyan-800 font-bold bg-cyan-50 rounded">
                                    Accounts Target: {accountsTargetDays} Days
                                </span>
                                <Popover open={isExportOpenAccounts} onOpenChange={setIsExportOpenAccounts}>
                                    <PopoverTrigger className="h-6 text-[10px] px-2 py-0 border border-slate-305 bg-white hover:bg-gray-100 text-gray-750 flex items-center gap-1 shadow-sm font-semibold rounded-lg cursor-pointer transition-all">
                                        <FileDown className="w-3.5 h-3.5 text-gray-650" /> Export / Print <ChevronDown className="w-3 h-3 text-gray-500" />
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-36 p-1 bg-white border border-gray-200 rounded-lg shadow-md z-[110] flex flex-col gap-1">
                                        <button 
                                            onClick={() => {
                                                handleExportExcel('insight-table-accounts', 'Account Level Bills');
                                                setIsExportOpenAccounts(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleExportPDF('insight-table-accounts', 'Account Level Bills');
                                                setIsExportOpenAccounts(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <FileDown className="w-3.5 h-3.5 text-red-650" /> Export PDF
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handlePrintTable('insight-table-accounts', 'Account Level Bills');
                                                setIsExportOpenAccounts(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Printer className="w-3.5 h-3.5 text-blue-600" /> Print Table
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleScreenshot('#insight-table-accounts', 'Account Level Bills');
                                                setIsExportOpenAccounts(false);
                                            }}
                                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                        >
                                            <Camera className="w-3.5 h-3.5 text-green-600" /> Screenshot
                                        </button>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="px-0 space-y-2">
                            {renderPerformanceTable(
                                "Finance & Accounts Clearances",
                                accountsTargetDays,
                                "Accounts Target Days",
                                accountsLevelPerformance,
                                'accounts',
                                'text-cyan-650',
                                'border-cyan-200 bg-cyan-50/20'
                            )}
                        </div>
                    </motion.section>
                </div>

                {/* SECTION 5.0: TABLE OF DISCREPANCIES */}
                <motion.section 
                    variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                    style={{ marginBottom: '50px' }}
                    className="space-y-10"
                >
                    <div className="flex items-center justify-between border-b border-rose-200 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                            <h2 className="text-xs font-bold tracking-widest uppercase text-slate-700">Auditing Discrepancies</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono py-0.5 px-2 text-rose-700 font-bold bg-rose-50 rounded">
                                Flags: {auditingDiscrepanciesCount} Exceptions
                            </span>
                            <Popover open={isExportOpenDiscrepancies} onOpenChange={setIsExportOpenDiscrepancies}>
                                <PopoverTrigger className="h-6 text-[10px] px-2 py-0 border border-slate-305 bg-white hover:bg-gray-100 text-gray-750 flex items-center gap-1 shadow-sm font-semibold rounded-lg cursor-pointer transition-all">
                                    <FileDown className="w-3.5 h-3.5 text-gray-650" /> Export / Print <ChevronDown className="w-3 h-3 text-gray-500" />
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-36 p-1 bg-white border border-gray-200 rounded-lg shadow-md z-[110] flex flex-col gap-1">
                                    <button 
                                        onClick={() => {
                                            handleExportExcel('insight-table-discrepancies', 'Auditing Discrepancies');
                                            setIsExportOpenDiscrepancies(false);
                                        }}
                                        className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                    >
                                        <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                                    </button>
                                    <button 
                                        onClick={() => {
                                            handleExportPDF('insight-table-discrepancies', 'Auditing Discrepancies');
                                            setIsExportOpenDiscrepancies(false);
                                        }}
                                        className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                    >
                                        <FileDown className="w-3.5 h-3.5 text-red-650" /> Export PDF
                                    </button>
                                    <button 
                                        onClick={() => {
                                            handlePrintTable('insight-table-discrepancies', 'Auditing Discrepancies');
                                            setIsExportOpenDiscrepancies(false);
                                        }}
                                        className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                                    >
                                        <Printer className="w-3.5 h-3.5 text-blue-600" /> Print Table
                                    </button>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="space-y-3 bg-transparent overflow-hidden">
                        
                        {/* 5-Sub-tabs Selector with distinct red theme, promoted to primary tabs */}
                        <div className="flex flex-wrap gap-2 mb-4 border-b border-rose-100 pb-2">
                            {[
                                { key: 'grp1', num: '1', title: 'Check Balance Payment Amount -ve', count: auditGroupsData.grp1.records.length },
                                { key: 'grp2', num: '2', title: 'Payment Fields Missing', count: auditGroupsData.grp2.records.length },
                                { key: 'grp3', num: '3', title: 'Baisc Fields missing', count: auditGroupsData.grp3.records.length },
                                { key: 'grp4', num: '4', title: 'Wo/BIll Numbers Missing', count: auditGroupsData.grp4.records.length },
                                { key: 'grp5', num: '5', title: 'Date flow violations', count: auditGroupsData.grp5.records.length },
                                { key: 'grp6', num: '6', title: 'probable Duplication of bill nos', count: auditGroupsData.grp6.records.length }
                            ].map(item => (
                                <button
                                    key={item.key}
                                    onClick={() => setAuditSubTab(item.key as any)}
                                    className={cn(
                                        "px-4 py-2 text-[10.5px] font-bold uppercase transition-all border-b-2",
                                        auditSubTab === item.key
                                            ? "border-rose-600 text-rose-700 bg-rose-50/50"
                                            : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{item.title}</span>
                                        <motion.span 
                                            animate={item.count > 0 ? {
                                                scale: [1, 1.12, 1],
                                                boxShadow: [
                                                    "0 0 0 0px rgba(225, 29, 72, 0)",
                                                     "0 0 0 4px rgba(225, 29, 72, 0.25)",
                                                     "0 0 0 0px rgba(225, 29, 72, 0)"
                                                ]
                                            } : {}}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 2,
                                                ease: "easeInOut"
                                            }}
                                            whileHover={{ scale: 1.28, rotate: 360 }}
                                            className={cn(
                                                "inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[9px] px-1 font-mono font-bold transition-all",
                                                auditSubTab === item.key 
                                                    ? "bg-rose-600 text-white font-black" 
                                                    : item.count > 0 
                                                        ? "bg-rose-100 text-rose-700 border border-rose-200" 
                                                        : "bg-slate-100 text-slate-500"
                                            )}
                                        >
                                            {item.count}
                                        </motion.span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Resizable and scrollable wrapper container */}
                        <ResizableBox
                            defaultMaxHeight={450}
                            className="border border-red-200/60 rounded-xl bg-white shadow-sm overflow-auto"
                        >
                            {/* Table View of current sub-tab */}
                            <div>
                                {auditGroupsData[auditSubTab].grouped.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 font-mono text-[10px] italic bg-white rounded border border-slate-100">
                                        ✓ Zero auditing discrepancies found in this sub-category. All records compliant.
                                    </div>
                                ) : (
                                    <table id="insight-table-discrepancies" data-sheet-title={`Discrepancy - ${{grp1:'Check Balance Payment Amount -ve',grp2:'Payment Fields Missing',grp3:'Basic Fields missing',grp4:'Wo-Bill Numbers Missing',grp5:'Date flow violations',grp6:'probable Duplication of bill nos'}[auditSubTab] || 'Exceptions'}`} className={cn("text-left font-mono text-[9.5px] border-separate border-spacing-0 border-none whitespace-nowrap", auditSubTab === 'grp5' ? "w-full table-fixed" : "min-w-[1250px] w-full")}>
                                        <thead className="sticky top-0 z-40 bg-white">
                                            <tr className="bg-red-50 text-red-800 font-bold h-[28px]">
                                                    {auditSubTab === 'grp1' && (
                                                        <>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Sr No</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Contractor</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Status</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] cursor-help" title="Bill Type, Work Head, Billing Period, Location">Bill Info (Type/Head/Period/Loc)</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 font-bold text-red-700 whitespace-nowrap h-[28px]">Bill Amount</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 font-bold text-red-700 whitespace-nowrap h-[28px]">Payment Amount</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 font-bold text-red-700 whitespace-nowrap h-[28px]">Balance Payment</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Cheque No</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Cheque Recd. At Site Date</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 font-bold text-red-700 whitespace-nowrap h-[28px]">Payment Status</th>
                                                        </>
                                                    )}
                                                    {auditSubTab === 'grp2' && (
                                                        <>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Sr No</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Contractor</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Status</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Billing Eng Name</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] cursor-help" title="Bill Type, Work Head, Billing Period, Location">Bill Info (Type/Head/Period/Loc)</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Bill Amount</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Payment Amount</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Balance Payment</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Cheque Recd. At HO Date</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Cheque Recd. At Site Date</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Cheque No</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Payment Status</th>
                                                        </>
                                                    )}
                                                    {auditSubTab === 'grp3' && (
                                                        <>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Sr No</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Contractor</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Status</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] max-w-[75px] truncate" title="Billing Eng Name">Billing Eng Name</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] cursor-help max-w-[425px] truncate" title="Bill Type, Work Head, Billing Period, Location">Bill Info (Type/Head/Period/Loc)</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Bill Amount</th>
                                                        </>
                                                    )}
                                                    {auditSubTab === 'grp4' && (
                                                        <>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Sr No</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Contractor</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Status</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Billing Eng Name</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] cursor-help" title="Bill Type, Work Head, Billing Period, Location">Bill Info (Type/Head/Period/Loc)</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Bill Amount</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Excel RA Bill NO</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Highrise WO No</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Highrise RA No</th>
                                                        </>
                                                    )}
                                                    {auditSubTab === 'grp6' && (
                                                        <>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Sr No</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Contractor</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Status</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Billing Eng Name</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] cursor-help" title="Bill Type, Work Head, Billing Period, Location">Bill Info (Type/Head/Period/Loc)</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Bill Amount</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Excel RA Bill NO</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Highrise WO No</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px]">Highrise RA No</th>
                                                        </>
                                                    )}
                                                    {auditSubTab === 'grp5' && (
                                                        <>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[3%] truncate" title="Sr No">Sr No</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[9%] truncate" title="Contractor">Contractor</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[5%] truncate" title="Status">Status</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[6%] truncate" title="Billing Eng Name">Billing Eng Name</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[12%] truncate" title="Bill Info">Bill Info</th>
                                                            <th className="py-1 px-2 text-right sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[6%] truncate" title="Bill Amount">Bill Amount</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[7%] truncate" title="Inward Date">Inward Date</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[7%] truncate" title="EXCEL Date">EXCEL Date</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[7%] truncate" title="Highrise RA Date">Highrise RA Date</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[8%] truncate" title="HO Submission Date">HO Sub Date</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[8%] truncate" title="Received at HO">Recd at HO</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[8%] truncate" title="Certified HO & Sent Acc">Cert & Sent HO</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[7%] truncate" title="Chq Recd HO">Chq Recd HO</th>
                                                            <th className="py-1 px-2 sticky top-0 z-40 bg-red-100 border-b border-red-200 whitespace-nowrap h-[28px] w-[7%] truncate" title="Chq Recd Site">Chq Recd Site</th>
                                                        </>
                                                    )}
                                                    {/* End of grp1-grp6 rendering */}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-red-100/50">
                                                {auditGroupsData[auditSubTab].grouped.map((group, groupIdx) => (
                                                    <React.Fragment key={groupIdx}>
                                                        {/* Project and Source Group Header */}
                                                        <tr className="bg-red-50/50 border-y border-red-100/60 font-bold text-slate-800 select-none">
                                                            <td colSpan={20} className="py-1.5 px-2 border-none bg-red-50/90 backdrop-blur-sm sticky top-[28px] z-30 shadow-xs">
                                                                <span className="text-[10px] uppercase tracking-wider text-slate-700">
                                                                    Project: <span className="font-extrabold text-red-700">{group.project}</span> 
                                                                    <span className="mx-2 text-slate-300">|</span> 
                                                                    Source: <span className="font-bold text-slate-700">{group.source}</span>
                                                                </span>
                                                                {auditSubTab !== 'grp6' && (
                                                                    <span className="ml-2 text-[9px] font-mono font-normal text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-100">
                                                                        {group.items.length} {group.items.length === 1 ? 'Record' : 'Records'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>

                                                        {/* Items in the active group */}
                                                        {group.items.map((r, itemIdx) => {
                                                            const rawSiteVal = r._rawChequeRecdSiteDate;
                                                            const formattedRecdSiteDate = rawSiteVal !== undefined && rawSiteVal !== null && rawSiteVal !== ''
                                                                ? (() => {
                                                                    const numVal = typeof rawSiteVal === 'number' ? rawSiteVal : (String(rawSiteVal).match(/^\d+$/) ? Number(rawSiteVal) : NaN);
                                                                    if (!isNaN(numVal)) {
                                                                        try {
                                                                            const d = new Date((numVal - 25569) * 86400 * 1000);
                                                                            if (!isNaN(d.getTime())) {
                                                                                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                                                                const day = String(d.getDate()).padStart(2, '0');
                                                                                const month = months[d.getMonth()];
                                                                                const year = String(d.getFullYear()).slice(-2);
                                                                                return `${day}-${month}-${year}`;
                                                                            }
                                                                        } catch (e) {}
                                                                    }
                                                                    return String(rawSiteVal);
                                                                })()
                                                                : '';

                                                            const rawHoVal = r._rawChequeRecdHoDate ?? r['Cheque Recd. At HO Date'];
                                                            const formattedRecdHoDate = rawHoVal !== undefined && rawHoVal !== null && rawHoVal !== ''
                                                                ? (() => {
                                                                    const numVal = typeof rawHoVal === 'number' ? rawHoVal : (String(rawHoVal).match(/^\d+$/) ? Number(rawHoVal) : NaN);
                                                                    if (!isNaN(numVal)) {
                                                                        try {
                                                                            const d = new Date((numVal - 25569) * 86400 * 1000);
                                                                            if (!isNaN(d.getTime())) {
                                                                                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                                                                const day = String(d.getDate()).padStart(2, '0');
                                                                                const month = months[d.getMonth()];
                                                                                const year = String(d.getFullYear()).slice(-2);
                                                                                return `${day}-${month}-${year}`;
                                                                            }
                                                                        } catch (e) {}
                                                                    }
                                                                    return String(rawHoVal);
                                                                })()
                                                                : '';

                                                            return (
                                                                <motion.tr
                                                                    key={itemIdx}
                                                                    variants={itemVariants}
                                                                    initial="hidden"
                                                                    animate="show"
                                                                    custom={itemIdx}
                                                                    onClick={() => {
                                                                        setPopoverRecords([r]);
                                                                        setPopoverTitle(`Ref #${r['Sr no']} - ${r['Contractor Name']} Detail`);
                                                                    }}
                                                                    className="hover:bg-red-50/30 transition-colors border-none text-slate-600 font-medium cursor-pointer"
                                                                >
                                                                    {/* Group 1 Row */}
                                                                    {auditSubTab === 'grp1' && (
                                                                        <>
                                                                            <td className="py-1.5 px-2 border-none text-slate-400 font-normal truncate" title={String(r['Sr no'] || '')}>{r['Sr no'] || 'N/A'}</td>
                                                                            <td className="py-1.5 px-2 border-none uppercase truncate max-w-[130px] font-bold text-red-655" title={r['Contractor Name']}>{r['Contractor Name'] || 'N/A'}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]" title={r['Status']}>{r['Status'] || 'N/A'}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate max-w-[250px] whitespace-nowrap text-slate-600 font-mono text-[9px]" title={typeof renderBillInfoCell(r, false) === 'string' ? (renderBillInfoCell(r, false) as string) : (r['Bill Type'] + ' | ' + r['Work Head'] + ' | ' + r['Billing Period'] + ' [' + r['LOCATION/Bldg.'] + ']')}>
                                                                                <div className="w-full truncate whitespace-nowrap">{renderBillInfoCell(r, false)}</div>
                                                                            </td>
                                                                            <td className="py-1.5 px-2 text-right border-none font-bold text-red-700 truncate">{formatFullCurrency(Number(r['Bill Amount (Net Payble)'] || 0))}</td>
                                                                            <td className="py-1.5 px-2 text-right border-none font-bold text-red-700 truncate">{formatFullCurrency(Number(r['Paid Amount'] || 0))}</td>
                                                                            <td className="py-1.5 px-2 text-right border-none font-bold text-red-700 truncate">{formatFullCurrency(Number(r['Balance Payment'] || 0))}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]" title={r['Cheque No']}>{r['Cheque No'] || 'N/A'}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[120px]" title={formattedRecdSiteDate}>{formattedRecdSiteDate || 'N/A'}</td>
                                                                            <td className="py-1.5 px-2 border-none text-red-700 font-bold truncate max-w-[100px]" title={r['Payment Status']}>{r['Payment Status'] || 'N/A'}</td>
                                                                        </>
                                                                    )}

                                                                    {/* Group 2 Row */}
                                                                    {auditSubTab === 'grp2' && (
                                                                        <>
                                                                            <td className="py-1.5 px-2 border-none text-slate-400 font-normal truncate">{renderMissingValueAlert(r['Sr no'])}</td>
                                                                            <td className="py-1.5 px-2 border-none uppercase truncate max-w-[130px] font-bold" title={r['Contractor Name']}>
                                                                                {isValMissing(r['Contractor Name']) ? renderMissingValueAlert(r['Contractor Name']) : <span className="text-slate-800">{r['Contractor Name']}</span>}
                                                                            </td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]">{renderMissingValueAlert(r['Status'])}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]">{renderMissingValueAlert(r['Billing Eng Name'])}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate max-w-[250px] whitespace-nowrap text-slate-500 font-mono text-[9px]" title={typeof renderBillInfoCell(r, true) === 'string' ? (renderBillInfoCell(r, true) as string) : (r['Bill Type'] + ' | ' + r['Work Head'] + ' | ' + r['Billing Period'] + ' [' + r['LOCATION/Bldg.'] + ']')}>
                                                                                <div className="w-full truncate whitespace-nowrap">{renderBillInfoCell(r, true)}</div>
                                                                            </td>
                                                                            <td className="py-1.5 px-2 text-right border-none truncate">{renderMissingValueAlertCurrency(r['Bill Amount (Net Payble)'])}</td>
                                                                            <td className="py-1.5 px-2 text-right border-none truncate">{renderMissingValueAlertCurrency(r['Paid Amount'])}</td>
                                                                            <td className="py-1.5 px-2 text-right border-none truncate">{renderMissingValueAlertCurrency(r['Balance Payment'])}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[120px]">{renderMissingValueAlert(formattedRecdHoDate)}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[120px]">{renderMissingValueAlert(formattedRecdSiteDate)}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]">{renderMissingValueAlert(r['Cheque No'])}</td>
                                                                            <td className="py-1.5 px-2 border-none font-bold text-red-700 truncate max-w-[100px]">{renderMissingValueAlert(r['Payment Status'])}</td>
                                                                        </>
                                                                    )}

                                                                    {/* Group 3 Row */}
                                                                    {auditSubTab === 'grp3' && (
                                                                        <>
                                                                            <td className="py-1.5 px-2 border-none text-slate-400 font-normal truncate">{renderMissingValueAlert(r['Sr no'])}</td>
                                                                            <td className="py-1.5 px-2 border-none uppercase truncate max-w-[130px] font-bold" title={r['Contractor Name']}>
                                                                                {isValMissing(r['Contractor Name']) ? renderMissingValueAlert(r['Contractor Name']) : <span className="text-slate-800">{r['Contractor Name']}</span>}
                                                                            </td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]">{renderMissingValueAlert(r['Status'])}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[75px]" title={r['Billing Eng Name'] || undefined}>{renderMissingValueAlert(r['Billing Eng Name'])}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate max-w-[425px] whitespace-nowrap text-slate-500 font-mono text-[9px]" title={typeof renderBillInfoCell(r, true) === 'string' ? (renderBillInfoCell(r, true) as string) : (r['Bill Type'] + ' | ' + r['Work Head'] + ' | ' + r['Billing Period'] + ' [' + r['LOCATION/Bldg.'] + ']')}>
                                                                                <div className="w-full truncate whitespace-nowrap">{renderBillInfoCell(r, true)}</div>
                                                                            </td>
                                                                            <td className="py-1.5 px-2 text-right border-none font-bold text-slate-800 truncate">{formatFullCurrency(Number(r['Bill Amount (Net Payble)'] || 0))}</td>
                                                                        </>
                                                                    )}

                                                                    {/* Group 4 Row */}
                                                                    {auditSubTab === 'grp4' && (
                                                                        <>
                                                                            <td className="py-1.5 px-2 border-none text-slate-400 font-normal truncate">{renderMissingValueAlert(r['Sr no'])}</td>
                                                                            <td className="py-1.5 px-2 border-none uppercase truncate max-w-[130px] font-bold" title={r['Contractor Name']}>
                                                                                {isValMissing(r['Contractor Name']) ? renderMissingValueAlert(r['Contractor Name']) : <span className="text-slate-800">{r['Contractor Name']}</span>}
                                                                            </td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]">{renderMissingValueAlert(r['Status'])}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]">{renderMissingValueAlert(r['Billing Eng Name'])}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate max-w-[250px] whitespace-nowrap text-slate-500 font-mono text-[9px]" title={typeof renderBillInfoCell(r, true) === 'string' ? (renderBillInfoCell(r, true) as string) : (r['Bill Type'] + ' | ' + r['Work Head'] + ' | ' + r['Billing Period'] + ' [' + r['LOCATION/Bldg.'] + ']')}>
                                                                                <div className="w-full truncate whitespace-nowrap">{renderBillInfoCell(r, true)}</div>
                                                                            </td>
                                                                            <td className="py-1.5 px-2 text-right border-none font-bold text-slate-800 truncate">{formatFullCurrency(Number(r['Bill Amount (Net Payble)'] || 0))}</td>
                                                                            <td className="py-1.5 px-2 text-right border-none truncate">
                                                                                {isValMissing(r['Excel RA Bill NO']) ? renderMissingValueAlert(r['Excel RA Bill NO']) : <span>{r['Excel RA Bill NO']}</span>}
                                                                            </td>
                                                                            <td className="py-1.5 px-2 text-right border-none truncate">
                                                                                {renderMissingValueAlert(r['Highrise WO No'])}
                                                                            </td>
                                                                            <td className="py-1.5 px-2 text-right border-none truncate">
                                                                                {isValMissing(r['Highrise RA No']) ? renderMissingValueAlert(r['Highrise RA No']) : <span>{r['Highrise RA No'] || 'N/A'}</span>}
                                                                            </td>
                                                                        </>
                                                                    )}

                                                                    {/* Group 6 Row with Smart Highlighting */}
                                                                    {auditSubTab === 'grp6' && (() => {
                                                                        const otherRecords = group.items.filter(item => item['Sr no'] !== r['Sr no']);
                                                                        const hiWo = String(r['Highrise WO No'] || '').trim().toLowerCase();
                                                                        const hiRa = String(r['Highrise RA No'] || '').trim().toLowerCase();
                                                                        const excelNo = String(r['Excel RA Bill NO'] || '').trim().toLowerCase();

                                                                        const isValInvalid = (val: string) => {
                                                                            const v = val.toLowerCase();
                                                                            return !v || v === "" || v === "0" || v === "na" || v === "n/a" || v.includes("advance") || v.includes("retention") || v.includes("quality release") || v.includes("sd release") || v.includes("sd-release");
                                                                        };

                                                                        const dupRA = !isValInvalid(hiRa) && !isValInvalid(hiWo) && otherRecords.some(o => 
                                                                            String(o['Highrise WO No']).trim().toLowerCase() === hiWo && 
                                                                            String(o['Highrise RA No']).trim().toLowerCase() === hiRa
                                                                        );
                                                                        
                                                                        const dupEx = !isValInvalid(excelNo) && !isValInvalid(hiWo) && otherRecords.some(o => 
                                                                            String(o['Highrise WO No']).trim().toLowerCase() === hiWo && 
                                                                            String(o['Excel RA Bill NO']).trim().toLowerCase() === excelNo
                                                                        );

                                                                        return (
                                                                            <>
                                                                                <td className="py-1.5 px-2 border-none text-slate-400 font-normal truncate">{renderMissingValueAlert(r['Sr no'])}</td>
                                                                                <td className="py-1.5 px-2 border-none uppercase truncate max-w-[130px] font-bold" title={r['Contractor Name']}>
                                                                                    {isValMissing(r['Contractor Name']) ? renderMissingValueAlert(r['Contractor Name']) : <span className="text-slate-800">{r['Contractor Name']}</span>}
                                                                                </td>
                                                                                <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]">{renderMissingValueAlert(r['Status'])}</td>
                                                                                <td className="py-1.5 px-2 border-none text-slate-500 truncate max-w-[100px]">{renderMissingValueAlert(r['Billing Eng Name'])}</td>
                                                                                <td className="py-1.5 px-2 border-none truncate max-w-[250px] whitespace-nowrap text-slate-500 font-mono text-[9px]" title={typeof renderBillInfoCell(r, true) === 'string' ? (renderBillInfoCell(r, true) as string) : (r['Bill Type'] + ' | ' + r['Work Head'] + ' | ' + r['Billing Period'] + ' [' + r['LOCATION/Bldg.'] + ']')}>
                                                                                    <div className="w-full truncate whitespace-nowrap">{renderBillInfoCell(r, true)}</div>
                                                                                </td>
                                                                             <td className="py-1.5 px-2 text-right border-none font-bold text-slate-800 truncate">{formatFullCurrency(Number(r['Bill Amount (Net Payble)'] || 0))}</td>
                                                                                <td className="py-1.5 px-2 text-right border-none truncate">
                                                                                    {dupEx ? (
                                                                                        <span className="bg-amber-100 text-amber-800 font-bold px-1 rounded border border-amber-200 text-[8px] uppercase whitespace-nowrap">
                                                                                            {r['Excel RA Bill NO'] || 'N/A'} (DUP-EX) 📋
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span>{r['Excel RA Bill NO'] || 'N/A'}</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-1.5 px-2 text-right border-none">
                                                                                    <span className={cn("font-bold", (dupRA || dupEx) ? "text-amber-700 underline decoration-amber-300 underline-offset-2" : "text-slate-800")}>
                                                                                        {r['Highrise WO No'] || 'N/A'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="py-1.5 px-2 text-right border-none">
                                                                                    {dupRA ? (
                                                                                        <span className="bg-amber-100 text-amber-800 font-bold px-1 rounded border border-amber-200 text-[8px] uppercase whitespace-nowrap">
                                                                                            {r['Highrise RA No'] || 'N/A'} (DUP-RA) 🏢
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span>{r['Highrise RA No'] || 'N/A'}</span>
                                                                                    )}
                                                                                </td>
                                                                            </>
                                                                        );
                                                                    })()}

                                                                    {/* Group 5 Row */}
                                                                    {auditSubTab === 'grp5' && (
                                                                        <>
                                                                            <td className="py-1.5 px-2 border-none text-slate-400 font-normal truncate" title={String(r['Sr no'] || '')}>{r['Sr no'] || 'N/A'}</td>
                                                                            <td className="py-1.5 px-2 border-none uppercase truncate max-w-[130px] font-bold text-slate-700" title={r['Contractor Name']}>{r['Contractor Name'] || 'N/A'}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 text-[8.5px] truncate max-w-[80px]" title={r['Status']}>{r['Status'] || 'N/A'}</td>
                                                                            <td className="py-1.5 px-2 border-none text-slate-500 text-[8.5px] truncate max-w-[80px]" title={r['Billing Eng Name']}>{r['Billing Eng Name'] || 'N/A'}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate text-slate-500 text-[8.5px] font-mono" title={typeof renderBillInfoCell(r, false) === 'string' ? (renderBillInfoCell(r, false) as string) : (r['Bill Type'] + ' | ' + r['Work Head'] + ' | ' + r['Billing Period'] + ' [' + r['LOCATION/Bldg.'] + ']')}>
                                                                                <div className="w-full truncate whitespace-nowrap">{renderBillInfoCell(r, false)}</div>
                                                                            </td>
                                                                            <td className="py-1.5 px-2 text-right border-none font-bold text-slate-800 truncate" title={formatFullCurrency(Number(r['Bill Amount (Net Payble)'] || 0))}>{formatFullCurrency(Number(r['Bill Amount (Net Payble)'] || 0))}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate">{renderDateCell(r, 'Inward Date', 'inward', 'inward')}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate">{renderDateCell(r, 'EXCEL Date', 'excelOrHi', 'excel')}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate">{renderDateCell(r, 'Highrise RA Date', 'excelOrHi', 'highrise')}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate">{renderDateCell(r, 'HO Submission Date', 'submission', 'submission')}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate">{renderDateCell(r, 'Received at HO', 'received', 'received')}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate">{renderDateCell(r, 'Certified at HO & Sent to Accounts on', 'certified', 'certified')}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate">{renderDateCell(r, 'Cheque Recd. At HO Date', 'chequeHo', 'chequeHo')}</td>
                                                                            <td className="py-1.5 px-2 border-none truncate">{renderDateCell(r, 'Cheque Recd. At Site Date', 'chequeSite', 'chequeSite')}</td>
                                                                        </>
                                                                    )}


                                                                </motion.tr>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                        </ResizableBox>
                    </div>
                </motion.section>






                {/* Spacer */}
                <div className="pt-0 h-0" />

            </motion.main>

            {popoverRecords && (
                <DetailTimelineModal
                    records={popoverRecords}
                    title={popoverTitle}
                    onClose={() => setPopoverRecords(null)}
                />
            )}
        </div>
    );
};
