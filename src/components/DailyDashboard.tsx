import React, { useMemo, useState, useEffect } from 'react';
import { 
    X, 
    Calendar as CalendarIcon, 
    RefreshCw, 
    FileSpreadsheet, 
    ChevronLeft, 
    ChevronRight,
    ChevronDown,
    ChevronsDown,
    ChevronsUp,
    MapPin,
    User,
    ArrowRight
} from 'lucide-react';
import { InvoiceRecord } from '../types';
import { cn } from '@/lib/utils';
import { 
    format, 
    subDays, 
    startOfDay, 
    endOfDay, 
    startOfWeek, 
    endOfWeek, 
    startOfMonth, 
    endOfMonth, 
    subWeeks, 
    subMonths,
    isValid 
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DetailTimelineModal } from './dashboard/analytics/DetailTimelineModal';
import { motion } from 'motion/react';
import { parseRecordDate } from '../utils/recordUtils';

interface DailyDashboardProps {
    data: InvoiceRecord[];
    onClose: () => void;
}

const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (Math.abs(val) >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)}`;
};

// High-fidelity AgeingQuickFiltersWidget identical to the project control (PivotAnalyzer)
function AgeingQuickFiltersWidget({ 
  onSelect,
  currentRange
}: { 
  onSelect: (range: {from: Date | null, to: Date | null}) => void,
  currentRange: { from: Date | null, to: Date | null }
}) {
  const [mode, setMode] = useState<'This' | 'Last' | 'Before'>('This');
  const [num, setNum] = useState(1);
  const [activeDays, setActiveDays] = useState<string | null>(null);
  const [activeUnit, setActiveUnit] = useState<'Week' | 'Month' | 'Year' | null>(null);

  useEffect(() => {
    if (!currentRange.from && !currentRange.to) {
      setActiveDays(null);
      setActiveUnit(null);
    } else if (currentRange.from && currentRange.to) {
      const today = new Date();
      if (format(currentRange.from, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') && format(currentRange.to, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
        setActiveDays(null);
        setActiveUnit(null);
      }
    }
  }, [currentRange]);

  const applyRange = (from: Date | null, to: Date | null) => {
    onSelect({ from, to });
  };

  const applyRelative = (unit: 'Week' | 'Month' | 'Year', customMode?: 'This' | 'Last' | 'Before', customNum?: number) => {
    const currentMode = customMode || mode;
    const currentNum = customNum !== undefined ? customNum : num;
    const today = new Date();
    if (currentMode === 'This') {
       if (unit === 'Week') applyRange(startOfWeek(today), endOfWeek(today));
       if (unit === 'Month') applyRange(startOfMonth(today), endOfMonth(today));
       if (unit === 'Year') applyRange(new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31));
    } else if (currentMode === 'Last') {
       if (unit === 'Week') applyRange(startOfWeek(subWeeks(today, currentNum)), endOfWeek(subWeeks(today, 1)));
       if (unit === 'Month') applyRange(startOfMonth(subMonths(today, currentNum)), endOfMonth(subMonths(today, 1)));
       if (unit === 'Year') applyRange(new Date(today.getFullYear() - currentNum, 0, 1), new Date(today.getFullYear() - 1, 11, 31));
    } else if (currentMode === 'Before') {
       if (unit === 'Week') applyRange(null, endOfWeek(subWeeks(today, currentNum)));
       if (unit === 'Month') applyRange(null, endOfMonth(subMonths(today, currentNum)));
       if (unit === 'Year') applyRange(null, new Date(today.getFullYear() - currentNum, 11, 31));
    }
  };

  const handleModeChange = (newMode: 'This' | 'Last' | 'Before') => {
    setMode(newMode);
    setActiveDays(null);
    if (!activeUnit) {
      setActiveUnit('Week');
      setTimeout(() => {
        applyRelative('Week', newMode, num);
      }, 0);
    } else {
      setTimeout(() => {
        applyRelative(activeUnit, newMode, num);
      }, 0);
    }
  };

  const handleNumChange = (newNum: number) => {
    setNum(newNum);
    setActiveDays(null);
    if (!activeUnit) {
      setActiveUnit('Week');
      setTimeout(() => {
        applyRelative('Week', mode, newNum);
      }, 0);
    } else {
      setTimeout(() => {
        applyRelative(activeUnit, mode, newNum);
      }, 0);
    }
  };

  const today = new Date();
  const isModeActive = (m: 'This' | 'Last' | 'Before') => activeUnit !== null && mode === m;

  return (
    <div className="p-[5px] border-b border-slate-150 flex flex-col gap-3 min-w-[220px]" style={{ height: '247.5px' }}>
       <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Quick Filters</span>
       
       <div className="grid grid-cols-3 gap-1.5 px-1 items-center" style={{ marginTop: '5px', marginBottom: '5px', height: '96.5px' }}>
          <span 
            className="text-[11px] font-bold text-[#1d2130] pr-2 flex items-center justify-end h-full select-none"
            style={{ textAlign: 'right', fontSize: '12px', height: '20.7031px' }}
          >
            Days:
          </span>
          {[
            { label: 'Today', isToday: true },
            { label: '0-2', d1: 2, d2: 0 },
            { label: '3-5', d1: 5, d2: 3 },
            { label: '6-15', d1: 15, d2: 6 },
            { label: '15-30', d1: 30, d2: 15 },
            { label: '30-60', d1: 60, d2: 30 },
            { label: '60-90', d1: 90, d2: 60 },
            { label: '90+', d1: null, d2: 90 },
          ].map(opt => (
             <button
               key={opt.label}
               className={`px-1 py-1 text-[11px] font-bold border rounded transition-colors text-center cursor-pointer ${activeDays === opt.label ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50 active:bg-blue-100'}`}
               onClick={() => {
                  setActiveDays(opt.label);
                  setActiveUnit(null);
                  if (opt.isToday) {
                     applyRange(startOfDay(today), endOfDay(today));
                  } else {
                     const to = endOfDay(subDays(today, opt.d2!));
                     const from = opt.d1 !== null ? startOfDay(subDays(today, opt.d1)) : null;
                     applyRange(from, to);
                  }
               }}
             >
                {opt.label}
             </button>
          ))}
       </div>

       <div className="grid grid-cols-[76px_40px_76px] grid-rows-3 gap-1.5 items-stretch px-1 text-[11px] font-bold text-[#1d2130]" style={{ paddingLeft: '10px' }}>
          {/* Row 1 */}
          <button 
            className={`px-2 py-1 border rounded flex items-center justify-center text-[11px] font-bold col-span-2 w-full cursor-pointer ${isModeActive('This') ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50'}`} 
            onClick={() => handleModeChange('This')}
          >
            This
          </button>
          <button 
            className={`px-2 py-1 border rounded w-full text-[11px] font-bold cursor-pointer ${activeUnit === 'Week' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50 active:bg-blue-100'}`} 
            onClick={() => {
              setActiveDays(null);
              setActiveUnit('Week');
              applyRelative('Week');
            }}
          >
            Week
          </button>

          {/* Row 2 */}
          <button 
            className={`px-2 py-1 border rounded flex items-center justify-center text-[11px] font-bold cursor-pointer ${isModeActive('Last') ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50'}`} 
            onClick={() => handleModeChange('Last')}
          >
            Last
          </button>
          
          <div className="col-start-2 row-start-2 row-span-2 flex justify-center items-center">
             <div className="flex justify-center items-center bg-white border border-slate-300 rounded h-full w-full">
                <select 
                  value={num} 
                  onChange={e => handleNumChange(parseInt(e.target.value))} 
                  disabled={mode === 'This' || activeUnit === null}
                  className="w-full text-center text-sm font-black outline-none bg-transparent cursor-pointer text-[#1d2130] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
             </div>
          </div>

          <button 
            className={`px-2 py-1 border rounded w-full text-[11px] font-bold cursor-pointer ${activeUnit === 'Month' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50 active:bg-blue-100'}`} 
            onClick={() => {
              setActiveDays(null);
              setActiveUnit('Month');
              applyRelative('Month');
            }}
          >
            Month
          </button>

          {/* Row 3 */}
          <button 
            className={`px-2 py-1 border rounded flex items-center justify-center text-[11px] font-bold cursor-pointer ${isModeActive('Before') ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50'}`} 
            onClick={() => handleModeChange('Before')}
          >
            Before
          </button>
          <button 
            className={`px-2 py-1 border rounded w-full text-[11px] font-bold cursor-pointer ${activeUnit === 'Year' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50 active:bg-blue-100'}`} 
            onClick={() => {
              setActiveDays(null);
              setActiveUnit('Year');
              applyRelative('Year');
            }}
          >
            Year
          </button>
       </div>
    </div>
  );
}

export const DailyDashboard: React.FC<DailyDashboardProps> = ({ data, onClose }) => {
    // Default range is Today
    const defaultTodayRange = useMemo(() => ({
        from: startOfDay(new Date()),
        to: endOfDay(new Date())
    }), []);

    // Active ageing date range applied to columns (controlled by side filters)
    const [ageingDateRange, setAgeingDateRange] = useState<{ from: Date | null; to: Date | null }>(defaultTodayRange);
    
    // View mode: Project wise or Billing Engineer wise
    const [viewMode, setViewMode] = useState<'project' | 'engineer'>('project');
    const [isViewModeDropdownOpen, setIsViewModeDropdownOpen] = useState(false);
    
    // Track collapsed state for projects (or engineers if in engineer view)
    const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

    // Helper for column-specific styling
    const getColumnStyles = (colKey: string, type: 'header' | 'group' | 'cell' = 'cell') => {
        const colors: Record<string, { bg: string, text: string }> = {
            'excel': { bg: 'bg-amber-100', text: 'text-amber-800' },
            'highrise': { bg: 'bg-amber-100', text: 'text-amber-800' },
            'receivedAtHo': { bg: 'bg-blue-100', text: 'text-blue-800' },
            'sendToAccount': { bg: 'bg-cyan-100', text: 'text-cyan-800' },
            'payment': { bg: 'bg-green-100', text: 'text-green-800' }
        };

        const theme = colors[colKey];

        if (type === 'header') {
            return theme ? `${theme.bg} ${theme.text}` : "bg-slate-200 text-slate-800";
        }
        
        // For body rows (group or details), if it's a colored column, use text color and transparent background
        if (theme) {
            return `bg-transparent ${theme.text}`;
        }

        return "text-slate-800";
    };

    const toggleProject = (project: string) => {
        setCollapsedProjects(prev => ({
            ...prev,
            [project]: !prev[project]
        }));
    };

    // Detail timeline modal state
    const [selectedDetailRecords, setSelectedDetailRecords] = useState<InvoiceRecord[] | null>(null);
    const [detailTitle, setDetailTitle] = useState<string>('');

    // Check if record is "Hold" (Site or HO level)
    const isHoldRecord = (rec: InvoiceRecord): boolean => {
        const s = String(rec['Status'] || '').toLowerCase();
        const holdSite = String(rec['Hold at Site'] || '').toLowerCase() === 'yes';
        const holdHo = String(rec['Hold at HO'] || '').toLowerCase() === 'yes';
        return s.includes('hold') || holdSite || holdHo;
    };

    // Compact currency formatter supporting Rupees and lakhs/crores/thousands
    const formatCurrencyCompact = (val: number) => {
        const absVal = Math.abs(val);
        if (absVal >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
        if (absVal >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
        if (absVal >= 1000) return `₹${(val / 1000).toFixed(1)} Th`;
        return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)}`;
    };

    // Check if currently filtering anything other than Today
    const isFilteringOtherThanToday = useMemo(() => {
        const todayStart = format(new Date(), 'yyyy-MM-dd');
        const fromStr = ageingDateRange.from ? format(ageingDateRange.from, 'yyyy-MM-dd') : '';
        const toStr = ageingDateRange.to ? format(ageingDateRange.to, 'yyyy-MM-dd') : '';
        return fromStr !== todayStart || toStr !== todayStart;
    }, [ageingDateRange, defaultTodayRange]);

    // Get status date val for specific columns
    const getRecordColumnDate = (rec: InvoiceRecord, col: string): Date | null => {
        let rawDate: any = null;
        switch (col) {
            case 'inward':
                rawDate = rec['Inward'] || rec['_rawInwardDate'];
                break;
            case 'excel':
                rawDate = rec['Excel RA Done'] || rec['_rawEXCELDate'];
                break;
            case 'highrise':
                rawDate = rec['Highrise VPC Done'] || rec['_rawHighriseRADate'];
                break;
            case 'sendToHo':
                rawDate = rec['HO Submit'] || rec['_rawHOSubmissionDate'];
                break;
            case 'receivedAtHo':
                rawDate = rec['Recd at HO'] || rec['_rawReceivedHODate'];
                break;
            case 'sendToAccount':
                rawDate = rec['Certified at HO & Sent to Accounts on'] || rec['_rawCertifiedDate'];
                break;
            case 'payment':
                rawDate = rec['Cheque Recd. At Site Date'] || rec['_rawChequeRecdSiteDate'] || rec['Cheque Recd. At HO Date'] || rec['_rawChequeRecdHoDate'];
                break;
        }
        return parseRecordDate(rawDate);
    };

    const isDateInRange = (date: Date | null, range: { from: Date | null; to: Date | null }): boolean => {
        if (!date) return false;
        const { from, to } = range;
        if (from && to) {
            return date >= startOfDay(from) && date <= endOfDay(to);
        } else if (from) {
            return date >= startOfDay(from);
        } else if (to) {
            return date <= endOfDay(to);
        }
        return true;
    };

    // Aggregating grouped rows dynamically by Project and Billing Engineer
    const groupedProjects = useMemo(() => {
        const projectGroups: Record<string, Record<string, {
            columns: {
                inward: { count: number; amount: number; records: InvoiceRecord[] };
                excel: { count: number; amount: number; records: InvoiceRecord[] };
                highrise: { count: number; amount: number; records: InvoiceRecord[] };
                sendToHo: { count: number; amount: number; records: InvoiceRecord[] };
                receivedAtHo: { count: number; amount: number; records: InvoiceRecord[] };
                sendToAccount: { count: number; amount: number; records: InvoiceRecord[] };
                payment: { count: number; amount: number; records: InvoiceRecord[] };
            }
        }>> = {};

        data.forEach(rec => {
            // Exclude hold records completely
            if (isHoldRecord(rec)) return;

            // Swap primary and secondary keys based on viewMode
            const primaryKey = viewMode === 'project' ? (rec['Project'] || 'N/A') : (rec['Billing Eng Name'] || 'N/A');
            const secondaryKey = viewMode === 'project' ? (rec['Billing Eng Name'] || 'N/A') : (rec['Project'] || 'N/A');

            if (!projectGroups[primaryKey]) {
                projectGroups[primaryKey] = {};
            }

            if (!projectGroups[primaryKey][secondaryKey]) {
                projectGroups[primaryKey][secondaryKey] = {
                    columns: {
                        inward: { count: 0, amount: 0, records: [] },
                        excel: { count: 0, amount: 0, records: [] },
                        highrise: { count: 0, amount: 0, records: [] },
                        sendToHo: { count: 0, amount: 0, records: [] },
                        receivedAtHo: { count: 0, amount: 0, records: [] },
                        sendToAccount: { count: 0, amount: 0, records: [] },
                        payment: { count: 0, amount: 0, records: [] }
                    }
                };
            }

            const subRow = projectGroups[primaryKey][secondaryKey];
            const amount = Number(rec['Bill Amount (Net Payble)'] || 0);

            const colKeys: Array<'inward' | 'excel' | 'highrise' | 'sendToHo' | 'receivedAtHo' | 'sendToAccount' | 'payment'> = [
                'inward', 'excel', 'highrise', 'sendToHo', 'receivedAtHo', 'sendToAccount', 'payment'
            ];

            colKeys.forEach(colKey => {
                const colDate = getRecordColumnDate(rec, colKey);
                if (isDateInRange(colDate, ageingDateRange)) {
                    subRow.columns[colKey].count += 1;
                    const amountForCol = colKey === 'payment' ? Number(rec['Paid Amount'] || 0) : amount;
                    subRow.columns[colKey].amount += amountForCol;
                    subRow.columns[colKey].records.push(rec);
                }
            });
        });

        const result: Array<{
            project: string;
            engineers: Array<{
                billingEngName: string;
                columns: {
                    inward: { count: number; amount: number; records: InvoiceRecord[] };
                    excel: { count: number; amount: number; records: InvoiceRecord[] };
                    highrise: { count: number; amount: number; records: InvoiceRecord[] };
                    sendToHo: { count: number; amount: number; records: InvoiceRecord[] };
                    receivedAtHo: { count: number; amount: number; records: InvoiceRecord[] };
                    sendToAccount: { count: number; amount: number; records: InvoiceRecord[] };
                    payment: { count: number; amount: number; records: InvoiceRecord[] };
                }
            }>
        }> = [];

        Object.entries(projectGroups).forEach(([primary, secondaryMap]) => {
            const activeSubs = Object.entries(secondaryMap)
                .map(([secondary, value]) => ({
                    billingEngName: secondary,
                    columns: value.columns
                }))
                .filter(sub => {
                    return (
                        sub.columns.inward.count > 0 ||
                        sub.columns.excel.count > 0 ||
                        sub.columns.highrise.count > 0 ||
                        sub.columns.sendToHo.count > 0 ||
                        sub.columns.receivedAtHo.count > 0 ||
                        sub.columns.sendToAccount.count > 0 ||
                        sub.columns.payment.count > 0
                    );
                })
                .sort((a, b) => a.billingEngName.localeCompare(b.billingEngName));

            if (activeSubs.length > 0) {
                result.push({
                    project: primary,
                    engineers: activeSubs
                });
            }
        });

        return result.sort((a, b) => a.project.localeCompare(b.project));
    }, [data, ageingDateRange, viewMode]);

    // Compute dynamic project-level totals for expand/collapse views
    const projectTotals = useMemo(() => {
        const totalsMap: Record<string, {
            inward: { count: number; amount: number; records: InvoiceRecord[] };
            excel: { count: number; amount: number; records: InvoiceRecord[] };
            highrise: { count: number; amount: number; records: InvoiceRecord[] };
            sendToHo: { count: number; amount: number; records: InvoiceRecord[] };
            receivedAtHo: { count: number; amount: number; records: InvoiceRecord[] };
            sendToAccount: { count: number; amount: number; records: InvoiceRecord[] };
            payment: { count: number; amount: number; records: InvoiceRecord[] };
        }> = {};

        groupedProjects.forEach(proj => {
            const sum = {
                inward: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
                excel: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
                highrise: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
                sendToHo: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
                receivedAtHo: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
                sendToAccount: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
                payment: { count: 0, amount: 0, records: [] as InvoiceRecord[] }
            };
            proj.engineers.forEach(eng => {
                sum.inward.count += eng.columns.inward.count;
                sum.inward.amount += eng.columns.inward.amount;
                sum.inward.records.push(...eng.columns.inward.records);

                sum.excel.count += eng.columns.excel.count;
                sum.excel.amount += eng.columns.excel.amount;
                sum.excel.records.push(...eng.columns.excel.records);

                sum.highrise.count += eng.columns.highrise.count;
                sum.highrise.amount += eng.columns.highrise.amount;
                sum.highrise.records.push(...eng.columns.highrise.records);

                sum.sendToHo.count += eng.columns.sendToHo.count;
                sum.sendToHo.amount += eng.columns.sendToHo.amount;
                sum.sendToHo.records.push(...eng.columns.sendToHo.records);

                sum.receivedAtHo.count += eng.columns.receivedAtHo.count;
                sum.receivedAtHo.amount += eng.columns.receivedAtHo.amount;
                sum.receivedAtHo.records.push(...eng.columns.receivedAtHo.records);

                sum.sendToAccount.count += eng.columns.sendToAccount.count;
                sum.sendToAccount.amount += eng.columns.sendToAccount.amount;
                sum.sendToAccount.records.push(...eng.columns.sendToAccount.records);

                sum.payment.count += eng.columns.payment.count;
                sum.payment.amount += eng.columns.payment.amount;
                sum.payment.records.push(...eng.columns.payment.records);
            });
            totalsMap[proj.project] = sum;
        });

        return totalsMap;
    }, [groupedProjects]);

    // Totals for bottom row summary
    const totals = useMemo(() => {
        const sum = {
            inward: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
            excel: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
            highrise: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
            sendToHo: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
            receivedAtHo: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
            sendToAccount: { count: 0, amount: 0, records: [] as InvoiceRecord[] },
            payment: { count: 0, amount: 0, records: [] as InvoiceRecord[] }
        };

        groupedProjects.forEach(proj => {
            proj.engineers.forEach(eng => {
                sum.inward.count += eng.columns.inward.count;
                sum.inward.amount += eng.columns.inward.amount;
                sum.inward.records.push(...eng.columns.inward.records);

                sum.excel.count += eng.columns.excel.count;
                sum.excel.amount += eng.columns.excel.amount;
                sum.excel.records.push(...eng.columns.excel.records);

                sum.highrise.count += eng.columns.highrise.count;
                sum.highrise.amount += eng.columns.highrise.amount;
                sum.highrise.records.push(...eng.columns.highrise.records);

                sum.sendToHo.count += eng.columns.sendToHo.count;
                sum.sendToHo.amount += eng.columns.sendToHo.amount;
                sum.sendToHo.records.push(...eng.columns.sendToHo.records);

                sum.receivedAtHo.count += eng.columns.receivedAtHo.count;
                sum.receivedAtHo.amount += eng.columns.receivedAtHo.amount;
                sum.receivedAtHo.records.push(...eng.columns.receivedAtHo.records);

                sum.sendToAccount.count += eng.columns.sendToAccount.count;
                sum.sendToAccount.amount += eng.columns.sendToAccount.amount;
                sum.sendToAccount.records.push(...eng.columns.sendToAccount.records);

                sum.payment.count += eng.columns.payment.count;
                sum.payment.amount += eng.columns.payment.amount;
                sum.payment.records.push(...eng.columns.payment.records);
            });
        });

        return sum;
    }, [groupedProjects]);

    const formattedActiveRange = useMemo(() => {
        const { from, to } = ageingDateRange;
        if (from && to) {
            if (format(from, 'yyyy-MM-dd') === format(to, 'yyyy-MM-dd')) {
                return format(from, 'MMM dd, yyyy');
            }
            return `${format(from, 'MMM dd')} - ${format(to, 'MMM dd, yyyy')}`;
        }
        if (from) return `From ${format(from, 'MMM dd, yyyy')}`;
        if (to) return `Until ${format(to, 'MMM dd, yyyy')}`;
        return 'All Dates';
    }, [ageingDateRange]);

    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/10 backdrop-blur-sm p-2 md:p-4 font-sans selection:bg-blue-100 selection:text-blue-900" style={{ paddingTop: '5px' }}>
            <motion.div 
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full h-full flex flex-col overflow-hidden text-left relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Compact Header */}
                <div className="shrink-0 h-[32px] border-b border-slate-200 bg-slate-50 px-5 flex items-center justify-between select-none">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <motion.span 
                                animate={{
                                    scale: [1, 1.4, 1],
                                    opacity: [0.6, 1, 0.6],
                                }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 1.5,
                                    ease: "easeInOut"
                                }}
                                className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" 
                            />
                            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 font-sans">
                                Daily Dashboard
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Current Filter Indicator - Simplified */}
                        <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 rounded-md border border-slate-200 font-mono flex items-center gap-1.5 h-5">
                            <span>Filter: <span className="text-blue-600 font-bold">{formattedActiveRange}</span></span>
                            {isFilteringOtherThanToday && (
                                <button 
                                    onClick={() => {
                                        setAgeingDateRange(defaultTodayRange);
                                        setCollapsedProjects({});
                                    }}
                                    className="text-red-500 hover:text-red-700 font-extrabold hover:underline cursor-pointer transition-colors border-l border-slate-300 pl-1.5 leading-none"
                                    title="Reset to Today"
                                >
                                    RESET
                                </button>
                            )}
                        </div>

                        <button 
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Close dashboard"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content Layout */}
                <div className="flex-1 flex min-h-0 min-w-0 flex-row">
                    
                    {/* Left Grid Section - Taking remaining width */}
                    <div className="flex-1 flex flex-col min-h-0 bg-transparent p-0 overflow-hidden border-r border-slate-200">
                        
                        {/* Grid Container */}
                        <div className="flex-1 bg-transparent overflow-hidden flex flex-col min-h-0">
                            <div className="flex-1 overflow-scroll custom-scrollbar">
                                <table className="w-max min-w-full text-left border-collapse select-none font-mono text-[11.5px] md:text-[13px] border-none whitespace-nowrap">
                                    <thead className="sticky top-0 bg-slate-200 z-20 select-none border-b border-slate-300 shadow-sm">
                                        <tr className="h-8 text-slate-800 font-bold uppercase bg-slate-200 border-none">
                                            <th className="px-0 py-1 bg-slate-200 text-slate-800 border-none text-left font-extrabold w-[130px]">
                                                <div className="flex items-center gap-1.5 h-[24px]">
                                                    <div className="relative">
                                                        <button 
                                                            onClick={() => setIsViewModeDropdownOpen(!isViewModeDropdownOpen)}
                                                            className="flex items-center gap-1 bg-white border border-slate-300 rounded pl-[1px] pr-1 py-0.5 text-[9px] font-black uppercase tracking-tight outline-none hover:border-blue-400 transition-all shadow-xs text-slate-800 h-[21px] w-[120px] justify-between cursor-pointer"
                                                        >
                                                            <span className="truncate text-[10px]">{viewMode === 'project' ? 'Project Wise' : 'Bill. Engr. Wise'}</span>
                                                            <ChevronDown size={10} className={cn("text-slate-400 transition-transform shrink-0", isViewModeDropdownOpen && "rotate-180")} />
                                                        </button>
                                                        
                                                        {isViewModeDropdownOpen && (
                                                            <>
                                                                <div 
                                                                    className="fixed inset-0 z-40" 
                                                                    onClick={() => setIsViewModeDropdownOpen(false)}
                                                                />
                                                                <div className="absolute left-0 mt-1 w-[130px] bg-white border border-slate-200 rounded-md shadow-xl z-[100] overflow-visible py-1 animate-in fade-in zoom-in-95 duration-150">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setViewMode('project');
                                                                            setIsViewModeDropdownOpen(false);
                                                                        }}
                                                                        className={cn(
                                                                            "w-full text-left px-3 py-2 text-[9px] font-black uppercase transition-colors hover:bg-slate-50 flex items-center",
                                                                            viewMode === 'project' ? "text-blue-600 bg-blue-50/50" : "text-slate-600"
                                                                        )}
                                                                    >
                                                                        Project Wise
                                                                    </button>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setViewMode('engineer');
                                                                            setIsViewModeDropdownOpen(false);
                                                                        }}
                                                                        className={cn(
                                                                            "w-full text-left px-3 py-2 text-[9px] font-black uppercase transition-colors hover:bg-slate-50 flex items-center",
                                                                            viewMode === 'engineer' ? "text-blue-600 bg-blue-50/50" : "text-slate-600"
                                                                        )}
                                                                    >
                                                                        Bill. Engr. Wise
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                            const allExpanded = groupedProjects.every(p => !collapsedProjects[p.project]);
                                                            if (allExpanded) {
                                                                const newState = { ...collapsedProjects };
                                                                groupedProjects.forEach(p => newState[p.project] = true);
                                                                setCollapsedProjects(newState);
                                                            } else {
                                                                setCollapsedProjects({});
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-slate-300 rounded-full transition-colors text-slate-600"
                                                        title="Toggle All"
                                                    >
                                                        {groupedProjects.every(p => !collapsedProjects[p.project]) ? (
                                                            <ChevronsUp size={12} strokeWidth={3} />
                                                        ) : (
                                                            <ChevronsDown size={12} strokeWidth={3} />
                                                        )}
                                                    </button>
                                                </div>
                                            </th>
                                            <th className="px-0.5 py-1 text-right font-extrabold bg-slate-100 text-slate-800 border-none">
                                                Inward
                                            </th>
                                            <th className={cn("px-0.5 py-1 text-right font-extrabold border-none", getColumnStyles('excel', 'header'))}>
                                                Excel RA Done
                                            </th>
                                            <th className={cn("px-0.5 py-1 text-right font-extrabold border-none", getColumnStyles('highrise', 'header'))}>
                                                Highrise VPC Done
                                            </th>
                                            <th className="px-0.5 py-1 text-right font-extrabold bg-slate-100 text-slate-800 border-none">
                                                HO Submit
                                            </th>
                                            <th className={cn("px-0.5 py-1 text-right font-extrabold border-none", getColumnStyles('receivedAtHo', 'header'))}>
                                                Recd at HO
                                            </th>
                                            <th className={cn("px-0.5 py-1 text-right font-extrabold border-none", getColumnStyles('sendToAccount', 'header'))}>
                                                Send to Acct
                                            </th>
                                            <th className={cn("px-0.5 py-1 text-right font-extrabold border-none", getColumnStyles('payment', 'header'))}>
                                                Payment Done
                                            </th>
                                        </tr>
                                    </thead>
                                    
                                    <tbody className="divide-y divide-slate-200/60 text-slate-700">
                                        {groupedProjects.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="text-center py-16 text-slate-400 font-bold uppercase font-mono tracking-widest bg-transparent">
                                                    No billing activities recorded in active date range.
                                                </td>
                                            </tr>
                                        ) : (
                                            groupedProjects.map((proj, projIdx) => {
                                                const isCollapsed = !!collapsedProjects[proj.project];
                                                return (
                                                    <React.Fragment key={`proj-${proj.project}-${projIdx}`}>
                                                        {/* Expandable Project Row - Styled with lighter gray as requested */}
                                                        <tr 
                                                            className="bg-slate-100/50 hover:bg-slate-200/40 select-none transition-all border-b border-slate-200/60 cursor-pointer group"
                                                            onClick={() => toggleProject(proj.project)}
                                                        >
                                                            <td className="py-1 pl-1.5 font-extrabold text-slate-800 uppercase tracking-wide border-none select-none text-[13px]">
                                                                <div className="flex items-center gap-1.5 select-none">
                                                                    {isCollapsed ? (
                                                                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                                    ) : (
                                                                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                                    )}
                                                                    <span className="truncate">{proj.project}</span>
                                                                </div>
                                                            </td>
                                                            
                                                            {/* Render Project totals across all 7 statuses if collapsed */}
                                                            {Object.entries(projectTotals[proj.project]).map(([colKey, cellVal]) => {
                                                                const cell = cellVal as { count: number; amount: number; records: InvoiceRecord[] };
                                                                const hasData = cell.count > 0;
                                                                const colNameDisplay = colKey === 'inward' ? 'Inward' : 
                                                                                       colKey === 'excel' ? 'Excel RA Done' :
                                                                                       colKey === 'highrise' ? 'Highrise VPC Done' :
                                                                                       colKey === 'sendToHo' ? 'HO Submit' :
                                                                                       colKey === 'receivedAtHo' ? 'Recd at HO' :
                                                                                       colKey === 'sendToAccount' ? 'Send to Acct' : 'Payment Done';
                                                                return (
                                                                    <td 
                                                                        key={colKey}
                                                                        onClick={(e) => {
                                                                            if (hasData && isCollapsed) {
                                                                                e.stopPropagation();
                                                                                setSelectedDetailRecords(cell.records);
                                                                                setDetailTitle(`${proj.project} Total - ${colNameDisplay} Details`);
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            "px-0.5 text-right border-none font-bold text-[10px] transition-all",
                                                                            getColumnStyles(colKey, 'group'),
                                                                            hasData && isCollapsed 
                                                                                ? "cursor-pointer hover:brightness-75" 
                                                                                : isCollapsed ? "text-slate-300 font-normal" : ""
                                                                        )}
                                                                    >
                                                                        {isCollapsed && hasData ? (
                                                                            <div className="flex items-center justify-end whitespace-nowrap">
                                                                                <span className={cn("text-[11.5px] font-black transition-colors", getColumnStyles(colKey, 'cell'))}>
                                                                                    {cell.count} {cell.count === 1 ? 'Bill' : 'Bills'} <span className="text-[10px] opacity-70 font-medium">({formatCurrencyCompact(cell.amount)})</span>
                                                                                </span>
                                                                            </div>
                                                                        ) : isCollapsed ? (
                                                                            <span className="text-[10px] text-slate-300">-</span>
                                                                        ) : null}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>

                                                        {/* Billing Engineers belonging to this project (rendered only if not collapsed) */}
                                                        {!isCollapsed && proj.engineers.map((eng, engIdx) => (
                                                            <tr key={`eng-${eng.billingEngName}-${engIdx}`} className="hover:bg-slate-50/40 transition-colors h-7 border-none">
                                                                <td className="pl-5 font-medium text-slate-600 truncate pr-1.5 border-none text-left select-none text-[12px]" title={eng.billingEngName}>
                                                                    {eng.billingEngName}
                                                                </td>
                                                                
                                                                {Object.entries(eng.columns).map(([colKey, cellVal]) => {
                                                                    const cell = cellVal as { count: number; amount: number; records: InvoiceRecord[] };
                                                                    const hasData = cell.count > 0;
                                                                    const colNameDisplay = colKey === 'inward' ? 'Inward' : 
                                                                                           colKey === 'excel' ? 'Excel RA Done' :
                                                                                           colKey === 'highrise' ? 'Highrise VPC Done' :
                                                                                           colKey === 'sendToHo' ? 'HO Submit' :
                                                                                           colKey === 'receivedAtHo' ? 'Recd at HO' :
                                                                                           colKey === 'sendToAccount' ? 'Send to Acct' : 'Payment Done';
                                                                    return (
                                                                        <td 
                                                                            key={colKey}
                                                                            onClick={() => {
                                                                                if (hasData) {
                                                                                    setSelectedDetailRecords(cell.records);
                                                                                    setDetailTitle(`${proj.project} • ${eng.billingEngName} - ${colNameDisplay} Details`);
                                                                                }
                                                                            }}
                                                                            className={cn(
                                                                                "px-0.5 text-right border-none transition-all h-full",
                                                                                getColumnStyles(colKey, 'cell'),
                                                                                hasData 
                                                                                    ? "cursor-pointer hover:brightness-75" 
                                                                                    : "text-slate-300 font-normal"
                                                                            )}
                                                                        >
                                                                            {hasData ? (
                                                                                <div className="flex items-center justify-end whitespace-nowrap h-full">
                                                                                    <span className={cn("text-[11.5px] font-bold hover:underline", getColumnStyles(colKey, 'cell'))}>
                                                                                        {cell.count} {cell.count === 1 ? 'Bill' : 'Bills'} <span className="opacity-70 font-medium">({formatCurrencyCompact(cell.amount)})</span>
                                                                                    </span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-[10px] text-slate-300">-</span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </tbody>
                                    
                                    {/* Darker Grand Total Row - Styled as requested */}
                                    {groupedProjects.length > 0 && (
                                        <tfoot className="sticky bottom-0 bg-slate-200 border-t border-slate-300 z-10 text-xs md:text-sm font-black uppercase text-slate-800 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                                            <tr className="h-8 border-none">
                                                <td className="pl-1.5 font-extrabold text-slate-800 border-none text-left bg-slate-200" colSpan={1}>
                                                    Grand Total
                                                </td>
                                                
                                                {Object.entries(totals).map(([colKey, cellVal]) => {
                                                    const cell = cellVal as { count: number; amount: number; records: InvoiceRecord[] };
                                                    const hasData = cell.count > 0;
                                                    const colNameDisplay = colKey === 'inward' ? 'Inward' : 
                                                                           colKey === 'excel' ? 'Excel RA Done' :
                                                                           colKey === 'highrise' ? 'Highrise VPC Done' :
                                                                           colKey === 'sendToHo' ? 'HO Submit' :
                                                                           colKey === 'receivedAtHo' ? 'Recd at HO' :
                                                                           colKey === 'sendToAccount' ? 'Send to Acct' : 'Payment Done';
                                                    return (
                                                        <td 
                                                            key={colKey}
                                                            onClick={() => {
                                                                if (hasData) {
                                                                    setSelectedDetailRecords(cell.records);
                                                                    setDetailTitle(`Grand Total - ${colNameDisplay} Details`);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "px-0.5 text-right border-none transition-colors h-full",
                                                                "bg-slate-200", // Keep the footer background
                                                                getColumnStyles(colKey, 'cell'), // Use cell style for font color
                                                                hasData ? "cursor-pointer hover:brightness-95" : ""
                                                            )}
                                                        >
                                                            {hasData ? (
                                                                <div className="flex items-center justify-end whitespace-nowrap h-full">
                                                                    <span className={cn("text-[11.5px] font-black transition-colors hover:underline", getColumnStyles(colKey, 'cell'))}>
                                                                        {cell.count} {cell.count === 1 ? 'Bill' : 'Bills'} <span className="opacity-80">({formatCurrencyCompact(cell.amount)})</span>
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 font-black">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar Filter panel */}
                    <div className="w-[245px] bg-slate-50 flex flex-col p-[5px] shrink-0 select-none overflow-y-auto">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                                {/* Quick Filters panel */}
                                <div className="border-b border-slate-150 w-full shrink-0">
                                    <AgeingQuickFiltersWidget 
                                        currentRange={ageingDateRange} 
                                        onSelect={(range) => {
                                            setAgeingDateRange({ from: range.from, to: range.to });
                                        }} 
                                    />
                                </div>
                                
                                {/* Calendar Panel */}
                                <div className="px-3 pt-[5px] pb-[6px] flex flex-col gap-2 bg-slate-50/50">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">
                                        Ageing Dates
                                    </span>
                                    <div className="flex justify-center bg-white border border-slate-150 rounded-lg p-2">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={ageingDateRange.from || new Date()}
                                            selected={{ from: ageingDateRange.from || undefined, to: ageingDateRange.to || undefined }}
                                            onSelect={(range: any) => {
                                                if (range?.from && range?.to) {
                                                    setAgeingDateRange({ from: range.from, to: range.to });
                                                } else if (range?.from) {
                                                    setAgeingDateRange({ from: range.from, to: null });
                                                } else {
                                                    setAgeingDateRange({ from: null, to: null });
                                                }
                                            }}
                                            numberOfMonths={1}
                                            className="bg-white pointer-events-auto"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Centralized Tooltip / Detail Timeline Modal - Sit on top (z-index 999 is greater than z-index 900) */}
            {selectedDetailRecords && (
                <DetailTimelineModal 
                    records={selectedDetailRecords}
                    title={detailTitle}
                    onClose={() => setSelectedDetailRecords(null)}
                />
            )}
        </div>
    );
};
