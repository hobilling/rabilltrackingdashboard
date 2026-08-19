import { motion } from "motion/react";
import React, { useState, useMemo, useEffect, useContext, useCallback, useRef } from "react";
import { AppContext } from "../../../App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Columns,
  LayoutList,
  GripVertical,
  Check,
  List as Rows,
  BarChart3,
  PieChart,
  ArrowLeftRight,
  X,
  FileDown,
  Printer,
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Coins,
  Receipt,
  Filter,
  Search,
  Table as TableIcon,
  TrendingUp,
  AreaChart as LucideAreaChart,
  CalendarDays,
  ListChecks,
} from "lucide-react";

import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  startOfDay, 
  endOfDay,
  parse, 
  isValid,
  eachDayOfInterval,
  isToday,
  subWeeks,
  addWeeks,
  subDays
} from 'date-fns';
import * as XLSX from "xlsx-js-style";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Customized,
} from "recharts";
import { cn } from "@/lib/utils";
import UnifiedJourney from "../../UnifiedJourney";
import { isCompletedVal, parseRecordDate, getStatusDateVal, formatDaysOrMonths, getStatusStyles, getPaymentStatusStyles } from "../../../utils/recordUtils";
import { DetailTimelineModal } from "./DetailTimelineModal";
export { DetailTimelineModal };
import { CalendarViewInternal } from "./CalendarView";

const AVAILABLE_ROWS = [
  "Project",
  "Source",
  "Contractor Name",
  "Bill Type",
  "Status",
  "Billing Eng Name",
  "Site",
  "Hold at Site",
  "Reason For Hold at Site",
  "Hold at HO",
  "Reason For Hold at HO",
];

const TIMELINE_OPTIONS = [
  { id: "Inward Date", name: "Inward Date" },
  { id: "Received at HO", name: "Received at HO Date" },
  { id: "Send to Account Date", name: "Send to Account Date" },
  { id: "Payment Date", name: "Payment Date" },
];

const HIERARCHY_LEVELS = ["Year", "Month", "Date"];

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
    <div className="p-[5px] border-b border-gray-100 flex flex-col gap-3 min-w-[220px]" style={{ height: '290.5px' }}>
       <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">Quick Filters</span>
       
       <div className="grid grid-cols-3 gap-1.5 px-1 items-center" style={{ marginTop: '16px', marginBottom: '33px' }}>
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
               className={`px-1 py-1 text-[11px] font-bold border rounded transition-colors text-center ${activeDays === opt.label ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50 active:bg-blue-100'}`}
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

       <div className="grid grid-cols-[76px_40px_76px] grid-rows-3 gap-1.5 items-stretch px-1 text-[11px] font-bold text-[#1d2130]">
          {/* Row 1 */}
          <button 
            className={`px-2 py-1 border rounded flex items-center justify-center text-[11px] font-bold col-span-2 w-full ${isModeActive('This') ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50'}`} 
            onClick={() => handleModeChange('This')}
          >
            This
          </button>
          <button 
            className={`px-2 py-1 border rounded w-full text-[11px] font-bold ${activeUnit === 'Week' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50 active:bg-blue-100'}`} 
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
            className={`px-2 py-1 border rounded flex items-center justify-center text-[11px] font-bold ${isModeActive('Last') ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50'}`} 
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
                 className="w-full text-center text-lg font-black outline-none bg-transparent cursor-pointer text-[#1d2130] disabled:opacity-30 disabled:cursor-not-allowed"
               >
                 {[...Array(12)].map((_, i) => (
                   <option key={i + 1} value={i + 1}>{i + 1}</option>
                 ))}
               </select>
             </div>
          </div>

          <button 
            className={`px-2 py-1 border rounded w-full text-[11px] font-bold ${activeUnit === 'Month' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50 active:bg-blue-100'}`} 
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
            className={`px-2 py-1 border rounded flex items-center justify-center text-[11px] font-bold ${isModeActive('Before') ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50'}`} 
            onClick={() => handleModeChange('Before')}
          >
            Before
          </button>
          <button 
            className={`px-2 py-1 border rounded w-full text-[11px] font-bold ${activeUnit === 'Year' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-[#1d2130] hover:bg-blue-50 active:bg-blue-100'}`} 
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

const AVAILABLE_METRICS = [
  { id: "count", label: "No. of Bills", type: "count" },
  { id: "Bill Amount (Net Payble)", label: "Sum of Bill Amount", type: "sum" },
  { id: "Paid Amount", label: "Sum of Paid Amount", type: "sum" },
  { id: "Balance Payment", label: "Sum of Balance Payment", type: "sum" },
  { id: "Site Days", label: "Average of Site Days", type: "avg" },
  { id: "HO Days", label: "Average of HO Days", type: "avg" },
  {
    id: "Bill Process Days",
    label: "Average of Bill Process Days",
    type: "avg",
  },
  { id: "Account Days", label: "Average of Account Days", type: "avg" },
  {
    id: "Inward to Payment Cycle Days",
    label: "Average of Inward to Payment Cycle Days",
    type: "avg",
  },
];

const getDisplayName = (mId: string) => {
  if (mId && mId.includes(":")) {
    const [id, level] = mId.split(":");
    return `${id} (${level})`;
  }
  let label = AVAILABLE_METRICS.find((m) => m.id === mId)?.label || mId;
  if (label.startsWith("Average of ")) label = label.replace("Average of ", "");
  if (label.startsWith("Sum of ")) label = label.replace("Sum of ", "");
  return label;
};

// Isolated Popover contents with local React states to ensure fast, lag-free click selections
interface SummariesSelectorProps {
  selectedSummaries: string[];
  onApply: (selected: string[], newOrder: string[]) => void;
  onClose: () => void;
  pageId?: string;
}

const SummariesSelector: React.FC<SummariesSelectorProps> = ({
  selectedSummaries,
  onApply,
  onClose,
  pageId,
}) => {
  const pKey = useCallback((key: string) => pageId ? `pivot_${pageId}_${key}` : key, [pageId]);
  
  const SUMMARIES = AVAILABLE_METRICS.filter(
    (m) => m.type === "sum" || m.type === "count"
  );

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

  // Initialize order with selected items first, retaining active sequence or custom persistent order
  const [localOrder, setLocalOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_summaries_order"));
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const validIds = SUMMARIES.map(m => m.id);
        const filtered = parsed.filter(id => validIds.includes(id));
        const missing = validIds.filter(id => !filtered.includes(id));
        return [...filtered, ...missing];
      }
    } catch (e) {}

    const selectedSorted = selectedSummaries.filter(id => SUMMARIES.some(m => m.id === id));
    const unselected = SUMMARIES.filter(m => !selectedSummaries.includes(m.id)).map(m => m.id);
    return [...selectedSorted, ...unselected];
  });
  const [localSelected, setLocalSelected] = useState<string[]>(selectedSummaries);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    if (draggedIdx === index) {
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isTopHalf = relativeY < rect.height / 2;

    setDragOverIdx(index);
    setDropPosition(isTopHalf ? 'top' : 'bottom');
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex || !dropPosition) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }

    const itemToMove = localOrder[draggedIdx];
    const remaining = localOrder.filter((_, idx) => idx !== draggedIdx);
    const bIndexInRemaining = remaining.indexOf(localOrder[targetIndex]);
    
    let finalInsertIndex = bIndexInRemaining;
    if (dropPosition === 'bottom') {
      finalInsertIndex = bIndexInRemaining + 1;
    }

    const newOrder = [...remaining];
    newOrder.splice(finalInsertIndex, 0, itemToMove);

    setLocalOrder(newOrder);
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const toggleMetric = (id: string) => {
    setLocalSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleClearAll = () => {
    setLocalSelected([]);
  };

  return (
    <div className="flex flex-col h-[260px] w-full bg-white rounded-lg select-none">
      <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 bg-slate-50/40 flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Summaries By (Drag to order)
        </span>
        <button
          onClick={handleClearAll}
          className="text-[10px] text-blue-600 hover:underline font-medium uppercase cursor-pointer"
        >
          Clear All
        </button>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0 scrollbar-thin"
        onDragLeave={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverIdx(null);
            setDropPosition(null);
          }
        }}
      >
        {localOrder.map((id, idx) => {
          const m = SUMMARIES.find((metric) => metric.id === id);
          if (!m) return null;
          const isSelected = localSelected.includes(id);
          const isDragged = draggedIdx === idx;

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg border border-transparent transition-all relative",
                isDragged
                  ? "bg-blue-50/90 border-2 border-dashed border-blue-400 opacity-45 scale-[0.98] shadow-inner"
                  : "hover:bg-slate-50/80 hover:border-slate-100 cursor-grab active:cursor-grabbing"
              )}
            >
              {dragOverIdx === idx && dropPosition === 'top' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              )}
              {dragOverIdx === idx && dropPosition === 'bottom' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              )}

              <span className="text-slate-400 pr-1 select-none font-bold text-sm tracking-tighter shrink-0 hover:text-blue-500 transition-colors">
                ⠿
              </span>
              <div
                className="flex items-center gap-2 flex-1 cursor-pointer py-0.5 min-w-0"
                onClick={() => toggleMetric(id)}
              >
                <div className="pointer-events-none shrink-0 animate-none">
                  <Checkbox checked={isSelected} readOnly />
                </div>
                <span className="text-xs font-semibold text-slate-700 select-none whitespace-nowrap">
                  {m.label.replace("Sum of ", "")}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-1.5 border-t border-gray-150 flex justify-end gap-1.5 bg-slate-50/50 shrink-0 sticky bottom-0 rounded-b-lg">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-7 text-xs px-2.5 cursor-pointer hover:bg-white bg-transparent text-gray-650 border-gray-250 font-semibold"
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            const sortedSelection = localOrder.filter(id => localSelected.includes(id));
            onApply(sortedSelection, localOrder);
          }}
          className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
        >
          Apply
        </Button>
      </div>
    </div>
  );
};

interface AvgSelectorProps {
  selectedAvg: string[];
  onApply: (selected: string[], newOrder: string[]) => void;
  onClose: () => void;
  pageId?: string;
}

const AvgSelector: React.FC<AvgSelectorProps> = ({
  selectedAvg,
  onApply,
  onClose,
  pageId,
}) => {
  const pKey = useCallback((key: string) => pageId ? `pivot_${pageId}_${key}` : key, [pageId]);
  const AVG_METRICS = AVAILABLE_METRICS.filter((m) => m.type === "avg");

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

  // Initialize order with selected items first, retaining active sequence or custom persistent order
  const [localOrder, setLocalOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_avg_order"));
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const validIds = AVG_METRICS.map(m => m.id);
        const filtered = parsed.filter(id => validIds.includes(id));
        const missing = validIds.filter(id => !filtered.includes(id));
        return [...filtered, ...missing];
      }
    } catch (e) {}

    const selectedSorted = selectedAvg.filter(id => AVG_METRICS.some(m => m.id === id));
    const unselected = AVG_METRICS.filter(m => !selectedAvg.includes(m.id)).map(m => m.id);
    return [...selectedSorted, ...unselected];
  });
  const [localSelected, setLocalSelected] = useState<string[]>(selectedAvg);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    if (draggedIdx === index) {
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isTopHalf = relativeY < rect.height / 2;

    setDragOverIdx(index);
    setDropPosition(isTopHalf ? 'top' : 'bottom');
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex || !dropPosition) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }

    const itemToMove = localOrder[draggedIdx];
    const remaining = localOrder.filter((_, idx) => idx !== draggedIdx);
    const bIndexInRemaining = remaining.indexOf(localOrder[targetIndex]);
    
    let finalInsertIndex = bIndexInRemaining;
    if (dropPosition === 'bottom') {
      finalInsertIndex = bIndexInRemaining + 1;
    }

    const newOrder = [...remaining];
    newOrder.splice(finalInsertIndex, 0, itemToMove);

    setLocalOrder(newOrder);
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const toggleMetric = (id: string) => {
    setLocalSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleClearAll = () => {
    setLocalSelected([]);
  };

  return (
    <div className="flex flex-col h-[260px] w-full bg-white rounded-lg select-none">
      <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 bg-slate-50/40 flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Average Of (Drag to order)
        </span>
        <button
          onClick={handleClearAll}
          className="text-[10px] text-blue-600 hover:underline font-medium uppercase cursor-pointer"
        >
          Clear All
        </button>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0 scrollbar-thin"
        onDragLeave={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverIdx(null);
            setDropPosition(null);
          }
        }}
      >
        {localOrder.map((id, idx) => {
          const m = AVG_METRICS.find((metric) => metric.id === id);
          if (!m) return null;
          const isSelected = localSelected.includes(id);
          const isDragged = draggedIdx === idx;

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg border border-transparent transition-all relative",
                isDragged
                  ? "bg-blue-50/90 border-2 border-dashed border-blue-400 opacity-45 scale-[0.98] shadow-inner"
                  : "hover:bg-slate-50/80 hover:border-slate-100 cursor-grab active:cursor-grabbing"
              )}
            >
              {dragOverIdx === idx && dropPosition === 'top' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              )}
              {dragOverIdx === idx && dropPosition === 'bottom' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              )}

              <span className="text-slate-400 pr-1 select-none font-bold text-sm tracking-tighter shrink-0 hover:text-blue-500 transition-colors">
                ⠿
              </span>
              <div
                className="flex items-center gap-2 flex-1 cursor-pointer py-0.5 min-w-0"
                onClick={() => toggleMetric(id)}
              >
                <div className="pointer-events-none shrink-0">
                  <Checkbox checked={isSelected} readOnly />
                </div>
                <span className="text-xs font-semibold text-slate-700 select-none whitespace-nowrap">
                  {m.label.replace("Average of ", "")}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-1.5 border-t border-gray-150 flex justify-end gap-1.5 bg-slate-50/50 shrink-0 sticky bottom-0 rounded-b-lg">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-7 text-xs px-2.5 cursor-pointer hover:bg-white bg-transparent text-gray-650 border-gray-250 font-semibold"
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            const sortedSelection = localOrder.filter(id => localSelected.includes(id));
            onApply(sortedSelection, localOrder);
          }}
          className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
        >
          Apply
        </Button>
      </div>
    </div>
  );
};

interface RowLevelsSelectorProps {
  selectedRows: string[];
  pivotItemsOrder: string[];
  onApply: (selectedRows: string[], pivotItemsOrder: string[]) => void;
  onClose: () => void;
}

const RowLevelsSelector: React.FC<RowLevelsSelectorProps> = ({
  selectedRows,
  pivotItemsOrder,
  onApply,
  onClose,
}) => {
  const [localSelectedRows, setLocalSelectedRows] = useState<string[]>(selectedRows);
  const [localPivotOrder, setLocalPivotOrder] = useState<string[]>(pivotItemsOrder);
  const [localDraggedIdx, setLocalDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setLocalDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (localDraggedIdx === null) return;
    if (localDraggedIdx === index) {
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isTopHalf = relativeY < rect.height / 2;

    setDragOverIdx(index);
    setDropPosition(isTopHalf ? 'top' : 'bottom');
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (localDraggedIdx === null || localDraggedIdx === targetIndex || !dropPosition) {
      setLocalDraggedIdx(null);
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }

    const itemToMove = localPivotOrder[localDraggedIdx];
    const remaining = localPivotOrder.filter((_, idx) => idx !== localDraggedIdx);
    const bIndexInRemaining = remaining.indexOf(localPivotOrder[targetIndex]);
    
    let finalInsertIndex = bIndexInRemaining;
    if (dropPosition === 'bottom') {
      finalInsertIndex = bIndexInRemaining + 1;
    }

    const newOrder = [...remaining];
    newOrder.splice(finalInsertIndex, 0, itemToMove);

    setLocalPivotOrder(newOrder);
    setLocalDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setLocalDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const toggleRow = (itemId: string) => {
    setLocalSelectedRows((prev) =>
      prev.includes(itemId) ? prev.filter((r) => r !== itemId) : [...prev, itemId]
    );
  };

  return (
    <div className="flex flex-col h-[320px] w-full bg-white rounded-lg select-none">
      <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 bg-slate-50/40 flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Row Levels (Drag / Tick Active)
        </span>
        <button
          onClick={() => setLocalSelectedRows([])}
          className="text-[10px] text-blue-600 hover:underline font-medium uppercase cursor-pointer"
        >
          Clear All
        </button>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0 scrollbar-thin"
        onDragLeave={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverIdx(null);
            setDropPosition(null);
          }
        }}
      >
        {localPivotOrder.map((itemId, idx) => {
          const isTimeline = TIMELINE_OPTIONS.some((t) => t.id === itemId);
          const timelineOpt = TIMELINE_OPTIONS.find((t) => t.id === itemId);
          const isDragged = localDraggedIdx === idx;

          return (
            <div
              key={itemId}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 border rounded-lg border-transparent transition-all relative",
                isDragged
                  ? "bg-blue-50/90 border-2 border-dashed border-blue-400 opacity-45 scale-[0.98] shadow-inner"
                  : "hover:bg-slate-50/80 hover:border-slate-100 cursor-grab active:cursor-grabbing"
              )}
            >
              {dragOverIdx === idx && dropPosition === 'top' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              )}
              {dragOverIdx === idx && dropPosition === 'bottom' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              )}

              <span className="text-slate-400 pr-0.5 select-none font-bold text-sm tracking-tighter shrink-0 hover:text-blue-500 transition-colors">
                ⠿
              </span>

              {!isTimeline ? (
                <div
                  className="flex items-center gap-1.5 flex-1 cursor-pointer py-0.5 min-w-0"
                  onClick={() => toggleRow(itemId)}
                >
                  <div className="pointer-events-none shrink-0">
                    <Checkbox
                      checked={localSelectedRows.includes(itemId)}
                      readOnly
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 select-none whitespace-nowrap">
                    {itemId}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-800 select-none">
                    {timelineOpt ? timelineOpt.name : itemId}
                  </span>
                  <div className="flex items-center gap-1 pl-0.5">
                    {HIERARCHY_LEVELS.map((level) => {
                      const id = `${itemId}:${level}`;
                      const isChecked = localSelectedRows.includes(id);
                      return (
                        <div
                          key={id}
                          className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-gray-150 bg-slate-50/55 hover:bg-white cursor-pointer transition-all",
                            isChecked
                              ? "bg-blue-50/30 border-blue-200/50 text-blue-600 font-semibold"
                              : ""
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(id);
                          }}
                        >
                          <div className="pointer-events-none">
                            <Checkbox
                              checked={isChecked}
                              className="w-3"
                              readOnly
                            />
                          </div>
                          <span className="text-[9px] text-gray-650 select-none leading-none font-medium">
                            {level}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-1.5 border-t border-gray-150 flex justify-end gap-1.5 bg-slate-50/50 shrink-0 sticky bottom-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-7 text-xs px-2.5 cursor-pointer hover:bg-white bg-transparent text-gray-650 border-gray-250 font-semibold"
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => onApply(localSelectedRows, localPivotOrder)}
          className="h-7 text-xs w-20 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
        >
          Apply
        </Button>
      </div>
    </div>
  );
};

interface ColumnizeBySelectorProps {
  columnizeBy: string | null;
  pivotItemsOrder: string[];
  onApply: (columnizeBy: string | null, newPivotOrder: string[]) => void;
  onClose: () => void;
}

const ColumnizeBySelector: React.FC<ColumnizeBySelectorProps> = ({
  columnizeBy,
  pivotItemsOrder,
  onApply,
  onClose,
}) => {
  const selectField = (itemId: string | null) => {
    onApply(itemId, pivotItemsOrder);
  };

  return (
    <div className="flex flex-col h-[260px] w-full bg-white select-none">
      <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 bg-slate-50/40 flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Columnize By
        </span>
        <button
          onClick={() => selectField(null)}
          className="text-[10px] text-blue-600 hover:underline font-normal uppercase cursor-pointer"
        >
          Reset/None
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0 scrollbar-thin">
        {/* Option for None */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 border rounded-lg border-transparent transition-all hover:bg-slate-50/80 hover:border-slate-100 cursor-pointer",
            columnizeBy === null ? "bg-blue-50/40 border-blue-100/50" : ""
          )}
          onClick={() => selectField(null)}
        >
          <div
            className={cn(
              "w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0",
              columnizeBy === null ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"
            )}
          >
            {columnizeBy === null ? (
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            ) : null}
          </div>
          <span className={cn("text-xs font-semibold select-none whitespace-nowrap", columnizeBy === null ? "text-blue-600 font-bold" : "text-slate-700")}>
            None (No Columnizing)
          </span>
        </div>

        {pivotItemsOrder.map((itemId) => {
          const isTimeline = TIMELINE_OPTIONS.some((t) => t.id === itemId);
          const timelineOpt = TIMELINE_OPTIONS.find((t) => t.id === itemId);
          const isFieldSelected = columnizeBy === itemId;

          return (
            <div
              key={itemId}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 border rounded-lg border-transparent transition-all hover:bg-slate-50/80 hover:border-slate-100",
                !isTimeline ? "cursor-pointer" : ""
              )}
              onClick={!isTimeline ? () => selectField(itemId) : undefined}
            >
              {!isTimeline ? (
                <div className="flex items-center gap-1.5 flex-1 py-0.5 min-w-0">
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors shrink-0",
                      isFieldSelected
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-300 bg-white"
                    )}
                  >
                    {isFieldSelected ? (
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold select-none transition-colors whitespace-nowrap",
                      isFieldSelected ? "text-blue-600 font-bold" : "text-slate-700"
                    )}
                  >
                    {itemId}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1 flex-1 min-w-0 py-0.5">
                  <span className="text-xs font-bold text-slate-800 select-none whitespace-nowrap">
                    {timelineOpt ? timelineOpt.name : itemId}
                  </span>
                  <div className="flex items-center gap-1 pl-0.5">
                    {HIERARCHY_LEVELS.map((level) => {
                      const id = `${itemId}:${level}`;
                      const isLevelSelected = columnizeBy === id;
                      return (
                        <div
                          key={id}
                          className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-gray-150 bg-slate-50/55 hover:bg-white cursor-pointer transition-all",
                            isLevelSelected
                              ? "bg-blue-50/30 border-blue-200/50 text-blue-600 font-semibold"
                              : ""
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectField(id);
                          }}
                        >
                          <div
                            className={cn(
                              "w-3 h-3 rounded-full border flex items-center justify-center shrink-0",
                              isLevelSelected ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"
                            )}
                          >
                            {isLevelSelected ? (
                              <div className="w-1 bg-white h-1 rounded-full" />
                            ) : null}
                          </div>
                          <span className="text-[9px] text-gray-650 select-none leading-none font-medium whitespace-nowrap">
                            {level}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const getRecordKeyForCol = (colKey: string): string => {
  if (colKey && colKey.includes(':')) {
    const [id, level] = colKey.split(':');
    return `${id} ${level}`;
  }
  if (colKey === "LOCATION / Bldg." || colKey === "LOCATION/Bldg.") {
    return "LOCATION/Bldg.";
  }
  if (colKey === "Remark" || colKey === "And Remark") {
    return "Remark";
  }
  if (colKey === "Sr. No." || colKey === "Sr no") {
    return "Sr no";
  }
  if (colKey === "Year" || colKey === "_year") {
    return "_year";
  }
  if (colKey === "Quarter" || colKey === "_quarter") {
    return "_quarter";
  }
  if (colKey === "Month" || colKey === "_month") {
    return "_month";
  }
  if (colKey === "Site Config Name" || colKey === "siteConfigName") {
    return "siteConfigName";
  }
  return colKey;
};

interface PivotInlineFilterProps {
  field: string;
  data: any[];
  allData?: any[];
  selected: string[];
  onChange: (val: string[]) => void;
  constraints?: Record<string, string[]>;
}

const PivotInlineFilter: React.FC<PivotInlineFilterProps> = ({ field, data, allData, selected, onChange, constraints }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localSelected, setLocalSelected] = useState<string[]>(selected);
  const context = useContext(AppContext);

  const allowedValues = useMemo(() => {
    const actualField = getRecordKeyForCol(field);
    return constraints?.[actualField] || context?.filterConstraints?.[actualField] || [];
  }, [constraints, context?.filterConstraints, field]);

  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selected);
      setSearch("");
    }
  }, [isOpen, selected]);

  const options = useMemo(() => {
    if (!isOpen) return [];
    
    // Get raw data (either global context or fall back to local props)
    const rawData = allData || context?.data || data;
    if (!rawData || rawData.length === 0) return [];
    
    // Enrich date-based fields so that derived fields (like Inward Date Year) are available in the check
    let enriched = rawData.map((d) => {
      const res = { ...d };
      const parseD = (f: string, pre: string) => {
        if (res[f]) {
          const dt = new Date(res[f]);
          if (!isNaN(dt.getTime())) {
            res[`${pre} Year`] = dt.getFullYear().toString();
            res[`${pre} Month`] = dt.toLocaleString("default", {
              month: "short",
            });
            res[`${pre} Date`] = dt.getDate().toString();
            res[`${pre} Year-Month`] =
              `${dt.getFullYear()} - ${dt.toLocaleString("default", { month: "short" })}`;
          } else {
            res[`${pre} Year`] = "N/A";
            res[`${pre} Month`] = "N/A";
            res[`${pre} Date`] = "N/A";
            res[`${pre} Year-Month`] = "N/A";
          }
        } else {
          res[`${pre} Year`] = "N/A";
          res[`${pre} Month`] = "N/A";
          res[`${pre} Date`] = "N/A";
          res[`${pre} Year-Month`] = "N/A";
        }
      };
      parseD("Inward Date", "Inward Date");
      parseD("Received at HO", "Received at HO");
      parseD("Certified at HO & Sent to Accounts on", "Send to Account Date");
      parseD("Cheque Recd. At Site Date", "Payment Date");
      return res;
    });

    // Filter by Site Selections if context is available
    if (context?.siteSelections) {
      enriched = enriched.filter(item => {
        const siteConfigName = (item as any)['siteConfigName'];
        if (!siteConfigName) return true;
        
        const selection = context.siteSelections[siteConfigName];
        if (!selection) return false;
        
        const source = (item as any)['Source'] || '';
        if (source.includes('Invoice Tracking')) return selection.Invoice === true;
        if (source.includes('History Data')) return selection.History === true;
        
        return selection.Invoice || selection.History;
      });
    }

    // Filter by Global Search if context is available
    if (context?.globalSearch) {
      const term = context.globalSearch.toLowerCase();
      enriched = enriched.filter(item => 
        (item as any)._searchStr ? (item as any)._searchStr.includes(term) : Object.values(item).some(val => String(val).toLowerCase().includes(term))
      );
    }

    // Filter by other column filters, EXCEPT the current field itself
    const columnFilters = context?.columnFilters || {};
    const currentFieldKey = getRecordKeyForCol(field);

    Object.keys(columnFilters).forEach(key => {
      const colFilterKey = getRecordKeyForCol(key);
      if (colFilterKey === currentFieldKey) return; // Skip current field's filter
      
      const filterValOrVals = columnFilters[key];
      if (Array.isArray(filterValOrVals)) {
         if (filterValOrVals.length > 0) {
           enriched = enriched.filter(item => {
             const itemVal = String((item as any)[colFilterKey] || '').trim().toLowerCase();
             return filterValOrVals.some(v => String(v).trim().toLowerCase() === itemVal);
           });
         }
      } else {
        const filterVal = filterValOrVals?.toLowerCase();
        if (filterVal) {
          enriched = enriched.filter(item => 
            String((item as any)[colFilterKey] || '').toLowerCase().includes(filterVal)
          );
        }
      }
    });

    // Gather unique options from the resulting dataset
    const unique = new Set<string>();
    enriched.forEach(item => {
      const val = item[currentFieldKey];
      if (val !== undefined && val !== null && val !== "") {
        unique.add(String(val));
      }
    });

    // Make sure we always include currently selected/ticked values in the options list
    if (selected && selected.length > 0) {
      selected.forEach(val => {
        if (val !== undefined && val !== null && val !== "") {
          unique.add(String(val));
        }
      });
    }

    return Array.from(unique)
      .filter(o => {
        // Hide purely numeric options as per request
        if (/^\d+$/.test(o)) return false;
        return o.toLowerCase().includes(search.toLowerCase());
      })
      .sort();
  }, [context?.data, data, allData, context?.siteSelections, context?.globalSearch, context?.columnFilters, field, search, isOpen, selected]);

  const isOptionAllowed = (option: string) => {
    if (!allowedValues || allowedValues.length === 0) return true;
    const opt = option.trim().toLowerCase();
    return allowedValues.some(v => String(v).trim().toLowerCase() === opt);
  };

    const isManualFilter = useMemo(() => {
        if (!selected || selected.length === 0) return false;
        const constraint = context?.filterConstraints?.[getRecordKeyForCol(field)] || constraints?.[getRecordKeyForCol(field)];
        if (!constraint || constraint.length === 0) return true;
        
        const s1 = [...selected].sort().join(',').toLowerCase();
        const s2 = [...constraint].sort().join(',').toLowerCase();
        return s1 !== s2;
    }, [selected, field, context?.filterConstraints, constraints]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger 
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-black/10 text-slate-500 hover:text-blue-600 transition-opacity z-10 flex",
          isManualFilter ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        title={`Filter ${field}`} 
        onClick={(e: any) => { e.stopPropagation(); setIsOpen(true); }}
      >
        <Filter className="w-3 h-3" />
        {isManualFilter && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-[200px] max-w-[500px] p-0 border-none shadow-xl bg-white z-[150] flex flex-col max-h-60 rounded-lg overflow-hidden">
         <div className="shrink-0 space-y-2 p-2 border-b border-gray-50 bg-white sticky top-0">
             <div className="relative">
                 <input 
                     className="w-full border border-gray-200 rounded-md py-1 pl-2 pr-7 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500" 
                     placeholder="Search..." 
                     value={search} 
                     onChange={e => setSearch(e.target.value)}
                     onKeyDown={e => e.stopPropagation()}
                 />
                 <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
             </div>
             <div className="flex justify-between gap-2 text-[10px] font-normal uppercase tracking-widest px-1">
                 <span className="text-slate-500 font-semibold truncate leading-none pt-0.5">{field}</span>
                 {(!allowedValues || allowedValues.length === 0) && (
                   <div className="flex gap-2">
                       <button 
                          className="text-blue-600 hover:underline cursor-pointer" 
                          onClick={(e) => { 
                              e.stopPropagation(); 
                              setLocalSelected(options); 
                          }}
                      >
                          All
                      </button>
                       <button 
                          className="text-red-500 hover:underline cursor-pointer" 
                          onClick={(e) => { 
                              e.stopPropagation(); 
                              setLocalSelected([]); 
                          }}
                      >
                          Reset
                      </button>
                   </div>
                 )}
             </div>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 p-1">
             {options.length === 0 ? (
                 <span className="text-[10px] text-gray-400 text-center py-2 italic font-sans flex items-center justify-center min-h-[40px]">No options</span>
             ) : (
                 options.map(option => {
                     const allowed = isOptionAllowed(option);
                     return (
                      <div 
                          key={option} 
                          className={cn(
                              "flex items-center gap-2 px-1.5 py-1 rounded transition-colors group/opt",
                              allowed ? "hover:bg-gray-50 cursor-pointer" : "cursor-not-allowed opacity-40 bg-gray-50/30 grayscale"
                          )} 
                          onClick={(e) => {
                              e.stopPropagation();
                              if (!allowed) return;
                              if(localSelected.includes(option)) setLocalSelected(localSelected.filter(s => s !== option));
                              else setLocalSelected([...localSelected, option]);
                          }}
                      >
                          <div className={cn(
                              "w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all shadow-[inset_0_1px_rgba(255,255,255,0.8)] shrink-0",
                              localSelected.includes(option) 
                                ? (allowed ? "bg-blue-500 border-blue-600" : "bg-gray-400 border-gray-500") 
                                : (allowed ? "bg-white border-slate-300 group-hover/opt:border-blue-400" : "bg-gray-100 border-slate-200")
                          )}>
                              {localSelected.includes(option) && <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />}
                          </div>
                          <span className={cn(
                              "text-[11px] tabular-nums flex items-center gap-0.5 whitespace-nowrap select-none leading-tight", 
                              localSelected.includes(option) ? "text-blue-800 font-bold" : "text-slate-600 font-medium",
                              !allowed && "text-slate-400 italic font-normal"
                          )}>
                              {option}
                          </span>
                      </div>
                     );
                 })
             )}
         </div>
         <div className="shrink-0 p-2 border-t border-gray-50 bg-gray-50 flex justify-end gap-2 sticky bottom-0">
             <button 
                className="px-3 py-1 text-[11px] font-bold text-gray-600 hover:text-gray-900 transition-colors"
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
             >
                Cancel
             </button>
             <button 
                className="px-3 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm"
                onClick={(e) => { e.stopPropagation(); onChange(localSelected); setIsOpen(false); }}
             >
                Apply
             </button>
         </div>
      </PopoverContent>
    </Popover>
  );
};

interface ExtraColumnsSelectorProps {
  selectedExtraColumns: string[];
  onApply: (extra: string[], newOrder: string[]) => void;
  onClose: () => void;
  pageId?: string;
}

const ExtraColumnsSelector: React.FC<ExtraColumnsSelectorProps> = ({
  selectedExtraColumns,
  onApply,
  onClose,
  pageId,
}) => {
  const pKey = useCallback((key: string) => pageId ? `pivot_${pageId}_${key}` : key, [pageId]);
  const [localSelected, setLocalSelected] = useState<string[]>(selectedExtraColumns);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

  const FLAT_COLS = useMemo(() => {
    return EXTRA_SELECTABLE_COLUMNS;
  }, []);

  const [localOrder, setLocalOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_extra_columns_order"));
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const timelineHierarchyIds = TIMELINE_OPTIONS.map((t) => `HIERARCHY:${t.id}`);
        const allDimensions = [
          ...timelineHierarchyIds,
          ...FLAT_COLS,
        ];
        const filtered = parsed.filter(id => allDimensions.includes(id));
        const missing = allDimensions.filter(id => !filtered.includes(id));
        return [...filtered, ...missing];
      }
    } catch (e) {}

    const timelineHierarchyIds = TIMELINE_OPTIONS.map((t) => `HIERARCHY:${t.id}`);
    const allDimensions = [
      ...timelineHierarchyIds,
      ...FLAT_COLS,
    ];

    const activeDimensions: string[] = [];
    selectedExtraColumns.forEach((col) => {
      if (col.includes(":")) {
        const baseId = col.split(":")[0];
        const hierarchyId = `HIERARCHY:${baseId}`;
        if (!activeDimensions.includes(hierarchyId)) {
          activeDimensions.push(hierarchyId);
        }
      } else {
        if (!activeDimensions.includes(col)) {
          activeDimensions.push(col);
        }
      }
    });

    const inactiveDimensions = allDimensions.filter(d => !activeDimensions.includes(d));
    return [...activeDimensions, ...inactiveDimensions];
  });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    if (draggedIdx === index) {
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isTopHalf = relativeY < rect.height / 2;

    setDragOverIdx(index);
    setDropPosition(isTopHalf ? 'top' : 'bottom');
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex || !dropPosition) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }

    const itemToMove = localOrder[draggedIdx];
    const remaining = localOrder.filter((_, idx) => idx !== draggedIdx);
    const bIndexInRemaining = remaining.indexOf(localOrder[targetIndex]);
    
    let finalInsertIndex = bIndexInRemaining;
    if (dropPosition === 'bottom') {
      finalInsertIndex = bIndexInRemaining + 1;
    }

    const newOrder = [...remaining];
    newOrder.splice(finalInsertIndex, 0, itemToMove);

    setLocalOrder(newOrder);
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  const toggleColumn = (itemId: string) => {
    setLocalSelected((prev) =>
      prev.includes(itemId) ? prev.filter((c) => c !== itemId) : [...prev, itemId]
    );
  };

  const handleClearAll = () => {
    setLocalSelected([]);
  };

  return (
    <div className="flex flex-col h-[320px] w-full bg-white select-none">
      <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 bg-slate-50/40 flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Select Columns (Drag / Tick Active)
        </span>
        <button
          onClick={handleClearAll}
          className="text-[10px] text-blue-600 hover:underline font-medium uppercase cursor-pointer"
        >
          Clear All
        </button>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0 scrollbar-thin"
        onDragLeave={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverIdx(null);
            setDropPosition(null);
          }
        }}
      >
        {localOrder.map((itemId, idx) => {
          const isTimeline = itemId.startsWith("HIERARCHY:");
          const baseId = isTimeline ? itemId.replace("HIERARCHY:", "") : itemId;
          const timelineOpt = isTimeline ? TIMELINE_OPTIONS.find((t) => t.id === baseId) : null;
          const isDragged = draggedIdx === idx;

          return (
            <div
              key={itemId}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 border rounded-lg border-transparent transition-all relative",
                isDragged
                  ? "bg-blue-50/90 border-2 border-dashed border-blue-400 opacity-45 scale-[0.98] shadow-inner"
                  : "hover:bg-slate-50/80 hover:border-slate-100 cursor-grab active:cursor-grabbing"
              )}
            >
              {dragOverIdx === idx && dropPosition === 'top' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              )}
              {dragOverIdx === idx && dropPosition === 'bottom' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              )}

              <span className="text-slate-400 pr-0.5 select-none font-bold text-sm tracking-tighter shrink-0 hover:text-blue-500 transition-colors">
                ⠿
              </span>

              {!isTimeline ? (
                <div
                  className="flex items-center gap-1.5 flex-1 cursor-pointer py-0.5 min-w-0"
                  onClick={() => toggleColumn(itemId)}
                >
                  <div className="pointer-events-none shrink-0">
                    <Checkbox
                      checked={localSelected.includes(itemId)}
                      readOnly
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 select-none whitespace-nowrap">
                    {itemId}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-800 select-none text-left">
                    {timelineOpt ? `${timelineOpt.name} (Hierarchy)` : itemId}
                  </span>
                  <div className="flex items-center gap-1 pl-0.5">
                    {HIERARCHY_LEVELS.map((level) => {
                      const id = `${baseId}:${level}`;
                      const isChecked = localSelected.includes(id);
                      return (
                        <div
                          key={id}
                          className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-gray-150 bg-slate-50/55 hover:bg-white cursor-pointer transition-all",
                            isChecked
                              ? "bg-blue-50/30 border-blue-200/50 text-blue-600 font-semibold"
                              : ""
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleColumn(id);
                          }}
                        >
                          <div className="pointer-events-none">
                            <Checkbox
                              checked={isChecked}
                              className="w-3"
                              readOnly
                            />
                          </div>
                          <span className="text-[9px] text-gray-650 select-none leading-none font-medium">
                            {level}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-1.5 border-t border-gray-150 flex justify-end gap-1.5 bg-slate-50/50 shrink-0 sticky bottom-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-7 text-xs px-2.5 cursor-pointer hover:bg-white bg-transparent text-gray-650 border-gray-250 font-semibold"
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            const finalSelected: string[] = [];
            localOrder.forEach((dimId) => {
              const isTimeline = dimId.startsWith("HIERARCHY:");
              if (isTimeline) {
                const baseId = dimId.replace("HIERARCHY:", "");
                HIERARCHY_LEVELS.forEach((level) => {
                  const key = `${baseId}:${level}`;
                  if (localSelected.includes(key)) {
                    finalSelected.push(key);
                  }
                });
              } else {
                if (localSelected.includes(dimId)) {
                  finalSelected.push(dimId);
                }
              }
            });
            onApply(finalSelected, localOrder);
          }}
          className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
        >
          Apply
        </Button>
      </div>
    </div>
  );
};

// Independent wrapper components around Popovers with localized open states
// to guarantee 100% lag-free popup mounting, clicks, and cancellation
interface SummariesPopoverProps {
  selectedSummaries: string[];
  AVAILABLE_METRICS: any[];
  onApply: (selected: string[], newOrder: string[]) => void;
  pageId?: string;
}

const SummariesPopover: React.FC<SummariesPopoverProps> = ({
  selectedSummaries,
  AVAILABLE_METRICS,
  onApply,
  pageId,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger 
        className="flex items-center gap-1 font-normal text-blue-600 hover:underline cursor-pointer text-sm"
        style={{ fontSize: '14px', lineHeight: '14px' }}
      >
        {selectedSummaries.length > 0
          ? selectedSummaries
              .map((id) =>
                AVAILABLE_METRICS.find((m) => m.id === id)?.label.replace("Sum of ", "")
              )
              .join(", ")
          : "None"}
        <ChevronDown className="w-3 h-3 text-blue-600" />
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[240px] p-0 border-none shadow-xl bg-white z-[120]">
        <SummariesSelector
          selectedSummaries={selectedSummaries}
          onApply={(selected, newOrder) => {
            onApply(selected, newOrder);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          pageId={pageId}
        />
      </PopoverContent>
    </Popover>
  );
};

interface AvgPopoverProps {
  selectedAvg: string[];
  AVAILABLE_METRICS: any[];
  onApply: (selected: string[], newOrder: string[]) => void;
  pageId?: string;
}

const AvgPopover: React.FC<AvgPopoverProps> = ({
  selectedAvg,
  AVAILABLE_METRICS,
  onApply,
  pageId,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger 
        className="flex items-center gap-1 font-normal text-blue-600 hover:underline cursor-pointer text-sm"
        style={{ lineHeight: '14px' }}
      >
        {selectedAvg.length > 0
          ? selectedAvg
              .map((id) =>
                AVAILABLE_METRICS.find((m) => m.id === id)?.label.replace("Average of ", "")
              )
              .join(", ")
          : "None"}
        <ChevronDown className="w-3 h-3 text-blue-600" />
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[240px] p-0 border-none shadow-xl bg-white z-[120]">
        <AvgSelector
          selectedAvg={selectedAvg}
          onApply={(selected, newOrder) => {
            onApply(selected, newOrder);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          pageId={pageId}
        />
      </PopoverContent>
    </Popover>
  );
};

interface RowLevelsPopoverProps {
  selectedRows: string[];
  pivotItemsOrder: string[];
  onApply: (selectedRows: string[], pivotItemsOrder: string[]) => void;
}

const RowLevelsPopover: React.FC<RowLevelsPopoverProps> = ({
  selectedRows,
  pivotItemsOrder,
  onApply,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger 
        className="flex items-center gap-1 font-normal text-blue-600 hover:underline cursor-pointer text-sm"
        style={{ lineHeight: '14px' }}
      >
        {selectedRows.length > 0
          ? selectedRows.map((row) => (row.includes(":") ? row.split(":")[1] : row)).join(", ")
          : "None"}
        <ChevronDown className="w-3 h-3 text-blue-600" />
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[240px] p-0 border-none shadow-xl bg-white z-[130]">
        <RowLevelsSelector
          selectedRows={selectedRows}
          pivotItemsOrder={pivotItemsOrder}
          onApply={(rows, order) => {
            onApply(rows, order);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
};

interface ColumnizeByPopoverProps {
  columnizeBy: string | null;
  pivotItemsOrder: string[];
  onApply: (colBy: string | null, newPivotOrder: string[]) => void;
}

const ColumnizeByPopover: React.FC<ColumnizeByPopoverProps> = ({
  columnizeBy,
  pivotItemsOrder,
  onApply,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger 
        className="flex items-center gap-1 font-normal text-blue-600 hover:underline cursor-pointer text-sm"
        style={{ lineHeight: '14px', fontWeight: 'normal' }}
      >
        {columnizeBy ? (columnizeBy.includes(":") ? columnizeBy.split(":")[1] : columnizeBy) : "None"}
        <ChevronDown className="w-3 h-3 text-blue-600" />
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[240px] p-0 border-none shadow-xl bg-white z-[120]">
        <ColumnizeBySelector
          columnizeBy={columnizeBy}
          pivotItemsOrder={pivotItemsOrder}
          onApply={(colBy, newOrder) => {
            onApply(colBy, newOrder);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
};

interface ExtraColumnsPopoverProps {
  selectedExtraColumns: string[];
  onApply: (extra: string[], newOrder: string[]) => void;
  pageId?: string;
}

const ExtraColumnsPopover: React.FC<ExtraColumnsPopoverProps> = ({
  selectedExtraColumns,
  onApply,
  pageId,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger 
        className="text-[12px] text-blue-600 hover:underline cursor-pointer uppercase tracking-wider font-normal h-7 flex items-center gap-1"
        style={{ lineHeight: '14px' }}
      >
        Select Columns {selectedExtraColumns.length > 0 ? `(${selectedExtraColumns.length})` : ""}{" "}
        <ChevronDown className="w-3 h-3 text-blue-600" />
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[240px] p-0 border-none shadow-xl bg-white z-[110]">
        <ExtraColumnsSelector
          selectedExtraColumns={selectedExtraColumns}
          onApply={(extra, order) => {
            onApply(extra, order);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          pageId={pageId}
        />
      </PopoverContent>
    </Popover>
  );
};

const getMetricStyling = (mId: string, index: number, chartType: string) => {
  const baseColors = [
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#f97316",
    "#ef4444",
    "#eab308",
  ];
  const darkColors = [
    "#1d4ed8",
    "#7c3aed",
    "#059669",
    "#ea580c",
    "#dc2626",
    "#ca8a04",
  ];
  let fill = baseColors[index % 6];
  let type = AVAILABLE_METRICS.find((m) => m.id === mId)?.type || "sum";
  let stackId: string | undefined = type;
  let fillOpacity = chartType === "area" ? 0.6 : 1;
  let stroke = chartType === "area" ? darkColors[index % 6] : fill;
  let xAxisId = "0";

  switch (mId) {
    case "Site Days":
      fill = "#3B82F6";
      stackId = "stack_days";
      stroke = "#1D4ED8";
      xAxisId = "0";
      break;
    case "HO Days":
      fill = "#1D4ED8";
      stackId = "stack_days";
      stroke = "#1E3A8A";
      xAxisId = "0";
      break;
    case "Account Days":
      fill = "#F97316";
      stackId = "stack_days";
      stroke = "#C2410C";
      xAxisId = "0";
      break;
    case "Bill Process Days":
      fill = "#ca8a04";
      stackId = "stack_days_back";
      stroke = "#854D0E";
      xAxisId = "1";
      fillOpacity = 0.7;
      break;
    case "Inward to Payment Cycle Days":
      fill = "#db2777";
      stackId = "stack_days_deep_back";
      stroke = "#9D174D";
      xAxisId = "2";
      fillOpacity = 0.4;
      break;
    case "count":
      fill = "#8B5CF6";
      stackId = "stack_count";
      stroke = "#6D28D9";
      xAxisId = "0";
      break;
    case "Bill Amount (Net Payble)":
      fill = "#3B82F6";
      stackId = "stack_amount_back";
      xAxisId = "1";
      fillOpacity = 0.3;
      if (chartType === "area") {
        fillOpacity = 0.15;
        stroke = "none";
      }
      break;
    case "Paid Amount":
      fill = "#10B981";
      stackId = "stack_amount";
      xAxisId = "0";
      if (chartType === "area") {
        fillOpacity = 0.4;
        stroke = "none";
      }
      break;
    case "Balance Payment":
      fill = "#EF4444";
      stackId = "stack_amount";
      xAxisId = "0";
      if (chartType === "area") {
        fillOpacity = 0.4;
        stroke = "none";
      }
      break;
    default:
      stackId =
        type === "sum"
          ? "stack_amount"
          : type === "avg"
            ? "stack_days"
            : "stack_count";
  }

  if (chartType === "line") stroke = fill;
  return { fill, stackId, fillOpacity, stroke, type, xAxisId };
};

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const getSortValue = (val: string, field: string) => {
  if (val === "N/A") return Infinity;

  const lowerVal = val.toLowerCase().trim();

  if (field.endsWith("Month")) {
    const monthIndex = MONTH_MAP[lowerVal];
    if (monthIndex !== undefined) return monthIndex;
  }

  if (field.endsWith("Year-Month")) {
    const parts = val.split(" - ");
    if (parts.length === 2) {
      const year = parseInt(parts[0], 10);
      const monthIndex = MONTH_MAP[parts[1].toLowerCase().trim()];
      if (!isNaN(year) && monthIndex !== undefined) {
        return year * 12 + monthIndex;
      }
    }
  }

  return null;
};

const compareValues = (aKey: string, bKey: string, field: string) => {
  const aSort = getSortValue(aKey, field);
  const bSort = getSortValue(bKey, field);

  if (aSort !== null && bSort !== null) {
    return aSort - bSort;
  }

  if (aKey === "N/A" && bKey !== "N/A") return 1;
  if (bKey === "N/A" && aKey !== "N/A") return -1;

  return aKey.localeCompare(bKey, undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const PivotXAxisTick = (props: any) => {
  const { x, y, payload, chartData } = props;
  const value = String(payload.value || "");

  const index = chartData.findIndex((d: any) => d.name === payload.value);
  if (index === -1) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={8}
          textAnchor="end"
          fill="#6B7280"
          fontSize={9}
          fontWeight="bold"
          transform="rotate(-90)"
        >
          {value.length > 14 ? `${value.slice(0, 12)}...` : value}
        </text>
      </g>
    );
  }

  const current = chartData[index];
  const prev = index > 0 ? chartData[index - 1] : null;

  const yrMmmRegex = /^(\d{4})\s*-\s*([A-Za-z]+)$/;
  const match = value.match(yrMmmRegex);

  if (match) {
    const year = match[1];
    const month = match[2];

    let isFirstOfYear = true;
    if (prev) {
      const prevMatch = String(prev.name || "").match(yrMmmRegex);
      if (prevMatch && prevMatch[1] === year) {
        isFirstOfYear = false;
      }
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={8}
          textAnchor="end"
          fill="#6B7280"
          fontSize={9}
          fontWeight="bold"
          transform="rotate(-90)"
        >
          {month}
        </text>

        {isFirstOfYear && (
          <g>
            <line x1={-12} y1={40} x2={-12} y2={60} stroke="#9CA3AF" />
            <text
              x={0}
              y={54}
              textAnchor="start"
              fill="#374151"
              fontSize={10}
              fontWeight="900"
            >
              {year}
            </text>
          </g>
        )}
      </g>
    );
  }

  const isMonth = MONTH_MAP[value.toLowerCase().trim()] !== undefined;
  if (isMonth) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={8}
          textAnchor="end"
          fill="#6B7280"
          fontSize={9}
          fontWeight="bold"
          transform="rotate(-90)"
        >
          {value}
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={4}
        textAnchor="end"
        fill="#374151"
        fontSize={9}
        fontWeight={500}
        transform="rotate(-45)"
      >
        {value.length > 14 ? `${value.slice(0, 12)}...` : value}
      </text>
    </g>
  );
};

const EXTRA_SELECTABLE_COLUMNS = [
  // Keeping Project, Contractor Name, and Status above Source
  "Project",
  "Contractor Name",
  "Status",

  // Original standard columns (default selected)
  "Source",
  "Payment Status",
  "Site",
  "Billing Eng Name",
  "Bill Type",
  "Work Head",
  "LOCATION / Bldg.",
  "Inward Date",
  "EXCEL Date",
  "Highrise RA Date",
  "HO Submission Date",
  "Received at HO",
  "Bills at Accounts",
  "Certified at HO & Sent to Accounts on",
  "Cheque No",
  "Cheque Recd. At HO Date",
  "Cheque Recd. At Site Date",
  "Reason For Hold at Site",
  "Remark Site",
  "Reason For Hold at HO",
  "Remark HO",
  "Remark",
  "Excel RA Bill NO",
  "Billing Period",
  "Highrise WO No",
  "Highrise RA No",

  // Moving other recently added columns after Highrise RA No
  "Sr. No.",
  "Hold at Site",
  "Hold at HO",
  "Bill Amount (Net Payble)",
  "Paid Amount",
  "Balance Payment",
  "Site Days",
  "HO Days",
  "Account Days",
  "Bill Process Days",
  "Inward to Payment Cycle Days",
  "Site Config Name",
];

const DEFAULT_EXTRA_COLUMNS_SANS_SITE = [
  "Source",
  "Payment Status",
  "Billing Eng Name",
  "Bill Type",
  "Work Head",
  "LOCATION / Bldg.",
  "Inward Date",
  "EXCEL Date",
  "Highrise RA Date",
  "HO Submission Date",
  "Received at HO",
  "Bills at Accounts",
  "Certified at HO & Sent to Accounts on",
  "Cheque No",
  "Cheque Recd. At HO Date",
  "Cheque Recd. At Site Date",
  "Reason For Hold at Site",
  "Remark Site",
  "Reason For Hold at HO",
  "Remark HO",
  "Remark",
  "Excel RA Bill NO",
  "Billing Period",
  "Highrise WO No",
  "Highrise RA No",
];

const COMPACT_COLUMNS = [
  "Bill Type",
  "LOCATION / Bldg.",
  "Billing Eng Name",
  "Cheque No",
  "Received at HO",
  "Certified at HO & Sent to Accounts on",
  "Billing Period",
  "Work Head"
];

// Now we consider almost all extra columns as having specific width behavior
const isCompactColumn = (col: string) => {
  return true; 
};

const getCompactWidth = (col: string): string => {
  const c = col.toLowerCase();
  
  // Date columns and specific dates: Requested 80px
  if (c.includes("date") || c === "received at ho" || c === "certified at ho & sent to accounts on") {
    return "w-[80px] max-w-[80px]";
  }

  // Bill Type: 90px
  if (c === "bill type") {
    return "w-[90px] max-w-[90px]";
  }

  // 85px columns: Location, Billing Eng, Cheque No
  if (c === "location / bldg." || c === "billing eng name" || c === "cheque no") {
    return "w-[85px] max-w-[85px]";
  }

  // 120px columns: Billing Period, Remark, Hold Reason, etc.
  if (
    c === "billing period" || 
    c === "remark" || 
    c === "reason for hold at site" || 
    c === "remark site" || 
    c === "reason for hold at ho" || 
    c === "remark ho"
  ) {
    return "w-[120px] max-w-[120px]";
  }

  // Work Head: 150px
  if (c === "work head") {
    return "w-[150px] max-w-[150px]";
  }

  // Other Extra Columns: auto fit
  return "w-auto min-w-[100px]";
};

const getStaticColumnValue = (node: any, colKey: string): string => {
  if (!node || !node.records || node.records.length === 0) return "";
  
  const actualKey = getRecordKeyForCol(colKey);

  const values = node.records
    .map((r: any) => {
      const val = r[actualKey];
      if (val === undefined || val === null) return "";
      if (typeof val === "string") return val.trim();
      return String(val);
    })
    .filter((v: string) => v !== "");
  
  const uniqueVals = Array.from(new Set(values));
  if (uniqueVals.length === 0) return "-";
  return uniqueVals.join(", ");
};

export const PivotAnalyzer = React.memo(({ 
  data, 
  allData,
  tableFirst = false, 
  defaultRows = ["Project", "Status", "Contractor Name"],
  enableExtraColumns = false,
  pageId,
  constraints,
  defaultSummaries: propDefaultSummaries,
  defaultAvg: propDefaultAvg,
  defaultExtraColumns: propDefaultExtraColumns,
  activeView: propActiveView,
  setActiveView: propSetActiveView
}: { 
  data: any[]; 
  allData?: any[];
  tableFirst?: boolean; 
  defaultRows?: string[];
  enableExtraColumns?: boolean;
  pageId?: string;
  constraints?: Record<string, string[]>;
  defaultSummaries?: string[];
  defaultAvg?: string[];
  defaultExtraColumns?: string[];
  activeView?: 'table' | 'chart' | 'calendar' | 'both';
  setActiveView?: (view: 'table' | 'chart' | 'calendar' | 'both') => void;
}) => {
  const context = useContext(AppContext);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Use prop constraints if provided, otherwise context
  const effectiveConstraints = useMemo(() => {
    return constraints || context?.filterConstraints || {};
  }, [constraints, context?.filterConstraints]);
  const [isExportOpen1, setIsExportOpen1] = useState(false);
  const [isExportOpen2, setIsExportOpen2] = useState(false);
  
  // States for row/cell click detail tooltip
  const [selectedDetailRecords, setSelectedDetailRecords] = useState<any[] | null>(null);
  const [detailTitle, setDetailTitle] = useState<string>("");

  const pKey = useCallback((key: string) => pageId ? `pivot_${pageId}_${key}` : key, [pageId]);

  const isTrackingSheet = pageId && pageId.startsWith("tracking-");
  const trackingTab = isTrackingSheet ? pageId.split("-")[1] : null;

  const isHoldActive = useMemo(() => {
    const statusConstraints = effectiveConstraints?.Status || [];
    if (isTrackingSheet) {
      if (statusConstraints.includes("04 Hold At Site") || statusConstraints.includes("07 Hold At Ho")) {
        if (trackingTab === 'site' && statusConstraints.length === 1 && statusConstraints[0] === '04 Hold At Site') {
          return true;
        }
        if (trackingTab === 'ho' && statusConstraints.length === 1 && statusConstraints[0] === '07 Hold At Ho') {
          return true;
        }
        if (trackingTab === 'all' && statusConstraints.length === 2 && statusConstraints.includes('04 Hold At Site') && statusConstraints.includes('07 Hold At Ho')) {
          return true;
        }
      }
    }
    return false;
  }, [isTrackingSheet, trackingTab, effectiveConstraints]);

  const getTrackingHeaderBg = (type: 'corner' | 'extra' | 'column' | 'metric' | 'total') => {
    if (!isTrackingSheet || pageId === 'tat') {
      if (type === 'corner') return 'bg-slate-300 text-slate-800';
      if (type === 'extra') return 'bg-slate-200 text-slate-800';
      if (type === 'column') return 'bg-slate-200 hover:bg-slate-300 text-slate-900';
      if (type === 'metric') return 'bg-slate-100/90 text-slate-800';
      return 'bg-slate-300 text-slate-950 font-black border-l border-slate-400';
    }

    if (isHoldActive) {
      if (type === 'corner') return 'bg-red-300 text-red-955 border-b border-red-400 font-extrabold';
      if (type === 'extra') return 'bg-red-105 text-red-900 border-r border-red-200';
      if (type === 'column') return 'bg-red-200 hover:bg-red-300 text-red-955 font-extrabold';
      if (type === 'metric') return 'bg-red-50 text-red-900 font-bold';
      return 'bg-red-300 text-red-955 font-black border-l border-red-400';
    }

    if (trackingTab === 'site') {
      if (type === 'corner') return 'bg-amber-300 text-amber-955 border-b border-amber-400 font-black';
      if (type === 'extra') return 'bg-amber-100 text-amber-900 border-r border-amber-200';
      if (type === 'column') return 'bg-amber-200 hover:bg-amber-300 text-amber-955 font-extrabold';
      if (type === 'metric') return 'bg-amber-50 text-amber-900 font-bold';
      return 'bg-amber-300 text-amber-955 font-black border-l border-amber-400';
    }

    if (trackingTab === 'ho') {
      if (type === 'corner') return 'bg-blue-300 text-blue-955 border-b border-blue-400 font-extrabold';
      if (type === 'extra') return 'bg-blue-200 text-blue-900 border-r border-blue-300';
      if (type === 'column') return 'bg-blue-200 hover:bg-blue-300 text-blue-955 font-extrabold';
      if (type === 'metric') return 'bg-blue-50 text-blue-900';
      return 'bg-blue-300 text-blue-955 font-black border-l border-blue-400';
    }

    if (trackingTab === 'accounts') {
      if (type === 'corner') return 'bg-cyan-300 text-cyan-955 border-b border-cyan-400 font-extrabold';
      if (type === 'extra') return 'bg-cyan-200 text-cyan-950 border-r border-cyan-300';
      if (type === 'column') return 'bg-cyan-200 hover:bg-cyan-300 text-cyan-955 font-extrabold';
      if (type === 'metric') return 'bg-cyan-100 text-cyan-955';
      return 'bg-cyan-300 text-cyan-955 font-black border-l border-cyan-400';
    }

    if (trackingTab === 'paid') {
      if (type === 'corner') return 'bg-green-300 text-green-955 border-b border-green-400 font-extrabold';
      if (type === 'extra') return 'bg-green-105 text-green-900 border-r border-green-200';
      if (type === 'column') return 'bg-green-200 hover:bg-green-300 text-green-955 font-extrabold';
      if (type === 'metric') return 'bg-green-50 text-green-900 font-bold';
      return 'bg-green-300 text-green-955 font-black border-l border-green-400';
    }

    // Default or "all" tab
    if (type === 'corner') return 'bg-slate-300 text-slate-850';
    if (type === 'extra') return 'bg-slate-200 text-slate-800';
    if (type === 'column') return 'bg-slate-200 hover:bg-slate-300 text-slate-900';
    if (type === 'metric') return 'bg-slate-100/90 text-slate-800';
    return 'bg-slate-300 text-slate-950 font-black border-l border-slate-400';
  };

  const getTrackingRowBg = (depth: number, isLeaf: boolean, isGrandTotal: boolean = false) => {
    if (isLeaf && !isGrandTotal) {
      return "bg-white";
    }

    if (!isTrackingSheet || pageId === 'tat') {
      if (isGrandTotal) return 'bg-slate-300';
      if (depth === 0) return 'bg-slate-300';
      if (depth === 1) return 'bg-slate-200';
      if (depth === 2) return 'bg-slate-105';
      return 'bg-slate-50';
    }

    if (isHoldActive) {
      if (isGrandTotal) return 'bg-red-300 font-black border-t-2 border-red-400 text-red-955';
      if (depth === 0) return 'bg-red-300 font-bold text-red-955';
      if (depth === 1) return 'bg-red-200 font-bold text-red-900';
      if (depth === 2) return 'bg-red-100 text-red-900';
      return 'bg-red-50 text-red-900';
    }

    if (trackingTab === 'site') {
      if (isGrandTotal) return 'bg-amber-300 font-black border-t-2 border-amber-400';
      if (depth === 0) return 'bg-amber-300 font-bold text-amber-955';
      if (depth === 1) return 'bg-amber-200 font-bold';
      if (depth === 2) return 'bg-amber-100';
      return 'bg-amber-50';
    }

    if (trackingTab === 'ho') {
      if (isGrandTotal) return 'bg-blue-300 font-black border-t-2 border-blue-400';
      if (depth === 0) return 'bg-blue-300 font-bold text-blue-955';
      if (depth === 1) return 'bg-blue-200 font-bold';
      if (depth === 2) return 'bg-blue-100';
      return 'bg-blue-50';
    }

    if (trackingTab === 'accounts') {
      if (isGrandTotal) return 'bg-cyan-300 font-black border-t-2 border-cyan-400';
      if (depth === 0) return 'bg-cyan-300 font-bold text-cyan-955';
      if (depth === 1) return 'bg-cyan-200 font-bold';
      if (depth === 2) return 'bg-cyan-100';
      return 'bg-cyan-50';
    }

    if (trackingTab === 'paid') {
      if (isGrandTotal) return 'bg-green-300 font-black border-t-2 border-green-400 text-green-955';
      if (depth === 0) return 'bg-green-200 font-bold text-green-955';
      if (depth === 1) return 'bg-green-150 font-bold text-green-905';
      if (depth === 2) return 'bg-green-100 text-green-900';
      return 'bg-green-50 text-green-900';
    }

    // Default or "all" tab: Using slate-ish but with better contrast for grouping
    if (isGrandTotal) return 'bg-slate-300 font-black border-t-2 border-slate-400';
    if (depth === 0) return 'bg-slate-300 font-bold text-slate-955';
    if (depth === 1) return 'bg-slate-200 font-bold';
    if (depth === 2) return 'bg-slate-100';
    return 'bg-slate-50';
  };
  
  // --- Decoupled Effective & Temporary/Staged States for Fast UI Interactivity ---
  
  // 1. Effective states (trigger heavy rendering and tree/chart calculations)
  const [selectedExtraColumns, setSelectedExtraColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_selected_extra_columns"));
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    if (propDefaultExtraColumns) return propDefaultExtraColumns;
    return enableExtraColumns ? DEFAULT_EXTRA_COLUMNS_SANS_SITE : [];
  });
  const [selectedSummaries, setSelectedSummaries] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_selected_summaries"));
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    if (propDefaultSummaries) return propDefaultSummaries;
    return [
      "count",
      "Bill Amount (Net Payble)",
      "Paid Amount",
      "Balance Payment",
    ];
  });
  const [selectedAvg, setSelectedAvg] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_selected_avg"));
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    if (propDefaultAvg) return propDefaultAvg;
    return [
      "Site Days",
      "HO Days",
      "Bill Process Days",
      "Account Days",
      "Inward to Payment Cycle Days",
    ];
  });
  const [selectedRows, setSelectedRows] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_selected_rows"));
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return defaultRows;
  });
  const [columnizeBy, setColumnizeBy] = useState<string | null>(() => {
    try {
      return localStorage.getItem(pKey("pivot_columnize_by"));
    } catch (e) {
      return null;
    }
  });
  const [chartType, setChartType] = useState("bar");
  const [chartMetric, setChartMetric] = useState("count");

  const [tableHeight, setTableHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_table_height"));
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) {
          return val;
        }
      }
    } catch (e) {}
    if (typeof window !== 'undefined' && pageId && pageId.startsWith('tracking')) {
      return 700;
    }
    if (pageId === 'tat') {
      return 350;
    }
    return 330; // 10% increase from 300 for TAT
  });

  const [chartHeight, setChartHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_chart_height"));
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) {
          return val;
        }
      }
    } catch (e) {}
    if (typeof window !== 'undefined' && pageId && pageId.startsWith('tracking')) {
      return 600;
    }
    if (pageId === 'tat') {
      return 340;
    }
    return 286; // 10% increase from 260 for TAT
  });

  const [calendarHeight, setCalendarHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_calendar_height"));
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return val;
      }
    } catch (e) {}
    if (typeof window !== 'undefined' && pageId && pageId.startsWith('tracking')) {
      return 700;
    }
    return 450;
  });

  const isTableResizing = useRef(false);
  const isChartResizing = useRef(false);
  const isCalendarResizing = useRef(false);

  const lastWindowHeight = useRef<number>(typeof window !== 'undefined' ? window.innerHeight : 800);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const newWinHeight = window.innerHeight;
      const oldWinHeight = lastWindowHeight.current;
      if (newWinHeight === oldWinHeight) return;

      const diff = newWinHeight - oldWinHeight;

      if (pageId && pageId.startsWith('tracking')) {
        setTableHeight(prev => Math.max(150, Math.min(1500, prev + diff)));
        setChartHeight(prev => Math.max(150, Math.min(1500, prev + diff)));
        setCalendarHeight(prev => Math.max(150, Math.min(1500, prev + diff)));
      }

      lastWindowHeight.current = newWinHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageId]);

  const handleTableResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isTableResizing.current = true;
    const startY = e.clientY;
    const startHeight = tableHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isTableResizing.current) return;
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(150, Math.min(1500, startHeight + deltaY));
      setTableHeight(newHeight);
      try {
        localStorage.setItem(pKey("pivot_table_height"), String(newHeight));
      } catch (err) {}
    };

    const handleMouseUp = () => {
      isTableResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [tableHeight, pKey]);

  const handleChartResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isChartResizing.current = true;
    const startY = e.clientY;
    const startHeight = chartHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isChartResizing.current) return;
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(150, Math.min(1500, startHeight + deltaY));
      setChartHeight(newHeight);
      try {
        localStorage.setItem(pKey("pivot_chart_height"), String(newHeight));
      } catch (err) {}
    };

    const handleMouseUp = () => {
      isChartResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [chartHeight, pKey]);

  const handleCalendarResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isCalendarResizing.current = true;
    const startY = e.clientY;
    const startHeight = calendarHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isCalendarResizing.current) return;
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(150, Math.min(1500, startHeight + deltaY));
      setCalendarHeight(newHeight);
      try {
        localStorage.setItem(pKey("pivot_calendar_height"), String(newHeight));
      } catch (err) {}
    };

    const handleMouseUp = () => {
      isCalendarResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [calendarHeight, pKey]);

  // Inline column filters (for hovering on left column / headers)
  const [pivotInlineFilters, setPivotInlineFilters] = useState<Record<string, string[]>>({});

  // 2. Active temporary states (deprecated, list selections now isolated internally in popovers)
  // Pivot list layout drag ordering tracking
  const [pivotItemsOrder, setPivotItemsOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pKey("pivot_items_order"));
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const base = [
      "Project",
      "Status",
      "Contractor Name",
      "Source",
      "Payment Status",
      "Site",
      "Billing Eng Name",
      "Bill Type",
      "Inward Date",
      "Received at HO",
      "Send to Account Date",
      "Payment Date",
    ];
    if (pageId === "tat") {
      return base.filter(item => item !== "Contractor Name");
    }
    return base;
  });
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null);

  // Fast direct state update apply handlers for the isolated list selections to ensure zero lags
  const handleApplySummaries = (newSummaries: string[], newOrder?: string[]) => {
    if (newOrder) {
      try {
        localStorage.setItem(pKey("pivot_summaries_order"), JSON.stringify(newOrder));
      } catch (e) {}
    }
    try {
      localStorage.setItem(pKey("pivot_selected_summaries"), JSON.stringify(newSummaries));
    } catch (e) {}

    if (JSON.stringify(selectedSummaries) !== JSON.stringify(newSummaries)) {
      setIsChartLoading(true);
      setTimeout(() => {
        setDrillPath([]);
        setSelectedSummaries([...newSummaries]);
        setOpenPopover(null);
      }, 50);
    } else {
      setOpenPopover(null);
    }
  };

  const handleApplyAvg = (newAvg: string[], newOrder?: string[]) => {
    if (newOrder) {
      try {
        localStorage.setItem(pKey("pivot_avg_order"), JSON.stringify(newOrder));
      } catch (e) {}
    }
    try {
      localStorage.setItem(pKey("pivot_selected_avg"), JSON.stringify(newAvg));
    } catch (e) {}

    if (JSON.stringify(selectedAvg) !== JSON.stringify(newAvg)) {
      setIsChartLoading(true);
      setTimeout(() => {
        setDrillPath([]);
        setSelectedAvg([...newAvg]);
        setOpenPopover(null);
      }, 50);
    } else {
      setOpenPopover(null);
    }
  };

  const handleApplyRows = (newRows: string[], newPivotOrder: string[]) => {
    const getGroupIndex = (row: string) => {
      const key = row.includes(':') ? row.split(':')[0] : row;
      const oIdx = newPivotOrder.indexOf(key);
      return oIdx === -1 ? 999 : oIdx;
    };
    
    const getSubLevelIndex = (row: string) => {
      if (!row.includes(':')) return 0;
      const level = row.split(':')[1];
      return HIERARCHY_LEVELS.indexOf(level);
    };

    const sortedRows = [...newRows].sort((a, b) => {
      const idxA = getGroupIndex(a);
      const idxB = getGroupIndex(b);
      if (idxA !== idxB) {
        return idxA - idxB;
      }
      return getSubLevelIndex(a) - getSubLevelIndex(b);
    });

    const isRowsChanged = JSON.stringify(selectedRows) !== JSON.stringify(sortedRows);
    const isOrderChanged = JSON.stringify(pivotItemsOrder) !== JSON.stringify(newPivotOrder);
    
    try {
      localStorage.setItem(pKey("pivot_items_order"), JSON.stringify(newPivotOrder));
      localStorage.setItem(pKey("pivot_selected_rows"), JSON.stringify(sortedRows));
    } catch (e) {}

    if (isRowsChanged || isOrderChanged) {
      setIsChartLoading(true);
      setTimeout(() => {
        setDrillPath([]);
        setPivotItemsOrder([...newPivotOrder]);
        setSelectedRows([...sortedRows]);
        setOpenPopover(null);
      }, 50);
    } else {
      setOpenPopover(null);
    }
  };

  const handleApplyColumnizeBy = (newColumnizeBy: string | null, newPivotOrder?: string[]) => {
    if (newPivotOrder) {
      setPivotItemsOrder(newPivotOrder);
      try {
        localStorage.setItem(pKey("pivot_items_order"), JSON.stringify(newPivotOrder));
      } catch (e) {}
    }
    try {
      if (newColumnizeBy) {
        localStorage.setItem(pKey("pivot_columnize_by"), newColumnizeBy);
      } else {
        localStorage.removeItem(pKey("pivot_columnize_by"));
      }
    } catch (e) {}

    const isModelColSame = columnizeBy === newColumnizeBy;
    const isOrderSame = newPivotOrder ? (JSON.stringify(pivotItemsOrder) === JSON.stringify(newPivotOrder)) : true;
    if (!isModelColSame || !isOrderSame) {
      setIsChartLoading(true);
      setTimeout(() => {
        setDrillPath([]);
        setColumnizeBy(newColumnizeBy);
        setColumnByOpen(false);
      }, 50);
    } else {
      setColumnByOpen(false);
    }
  };

  const handleApplyExtraColumns = (newExtraCols: string[], newOrder?: string[]) => {
    if (newOrder) {
      try {
        localStorage.setItem(pKey("pivot_extra_columns_order"), JSON.stringify(newOrder));
      } catch (e) {}
    }
    try {
      localStorage.setItem(pKey("pivot_selected_extra_columns"), JSON.stringify(newExtraCols));
    } catch (e) {}

    if (JSON.stringify(selectedExtraColumns) !== JSON.stringify(newExtraCols)) {
      setIsChartLoading(true);
      setTimeout(() => {
        setDrillPath([]);
        setSelectedExtraColumns([...newExtraCols]);
        setOpenPopover(null);
      }, 50);
    } else {
      setOpenPopover(null);
    }
  };

  const commitChanges = () => {
    // Deprecated: Selections now use fast direct apply handlers
  };

  const handleClosePopover = () => {
    setOpenPopover(null);
  };

  const handleCloseColumnBy = () => {
    setColumnByOpen(false);
  };

  const handleCloseChartType = () => {
    setChartTypeOpen(false);
  };

  const handleCloseChartMetric = () => {
    setChartMetricOpen(false);
  };

  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [localActiveView, setLocalActiveView] = useState<'table' | 'chart' | 'calendar' | 'both'>(pageId === 'tat' ? 'both' : 'table');
  const activeView = propActiveView !== undefined ? propActiveView : localActiveView;
  const setActiveView = propSetActiveView !== undefined ? propSetActiveView : setLocalActiveView;

  const handleCardResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startTableHeight = tableHeight;
    const startChartHeight = chartHeight;
    const startCalendarHeight = calendarHeight;
    const cardEl = cardRef.current;
    if (!cardEl) return;

    // Direct styling for fluid buttery smooth rendering
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      if (activeView === 'calendar') {
        const newHeight = Math.max(150, Math.min(5000, startCalendarHeight + deltaY));
        setCalendarHeight(newHeight);
        cardEl.style.height = `${newHeight}px`;
      } else if (activeView === 'chart') {
        const newHeight = Math.max(150, Math.min(5000, startChartHeight + deltaY));
        setChartHeight(newHeight);
        cardEl.style.height = `${newHeight}px`;
      } else if (activeView === 'both') {
        const newTableHeight = Math.max(150, Math.min(4000, startTableHeight + deltaY * 0.5));
        const newChartHeight = Math.max(150, Math.min(4000, startChartHeight + deltaY * 0.5));
        setTableHeight(newTableHeight);
        setChartHeight(newChartHeight);
        cardEl.style.height = `${newTableHeight + newChartHeight + 40}px`;
      } else {
        const newHeight = Math.max(150, Math.min(5000, startTableHeight + deltaY));
        setTableHeight(newHeight);
        cardEl.style.height = `${newHeight}px`;
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      const deltaY = upEvent.clientY - startY;
      if (activeView === 'calendar') {
        const newHeight = Math.max(150, Math.min(5000, startCalendarHeight + deltaY));
        setCalendarHeight(newHeight);
        try {
          localStorage.setItem(pKey("pivot_calendar_height"), String(newHeight));
        } catch (err) {}
      } else if (activeView === 'chart') {
        const newHeight = Math.max(150, Math.min(5000, startChartHeight + deltaY));
        setChartHeight(newHeight);
        try {
          localStorage.setItem(pKey("pivot_chart_height"), String(newHeight));
        } catch (err) {}
      } else if (activeView === 'both') {
        const newTableHeight = Math.max(150, Math.min(4000, startTableHeight + deltaY * 0.5));
        const newChartHeight = Math.max(150, Math.min(4000, startChartHeight + deltaY * 0.5));
        setTableHeight(newTableHeight);
        setChartHeight(newChartHeight);
        try {
          localStorage.setItem(pKey("pivot_table_height"), String(newTableHeight));
          localStorage.setItem(pKey("pivot_chart_height"), String(newChartHeight));
        } catch (err) {}
      } else {
        const newHeight = Math.max(150, Math.min(5000, startTableHeight + deltaY));
        setTableHeight(newHeight);
        try {
          localStorage.setItem(pKey("pivot_table_height"), String(newHeight));
        } catch (err) {}
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [activeView, tableHeight, chartHeight, calendarHeight, pKey]);
  const ageingBasis = context?.ageingBasis ?? 'Inward Date';
  const setAgeingBasis = context?.setAgeingBasis ?? (() => {});
  const ageingDateRange = context?.ageingDateRange ?? { from: null, to: null };
  const setAgeingDateRange = context?.setAgeingDateRange ?? (() => {});
  const [isAgeingPopoverOpen, setIsAgeingPopoverOpen] = useState(false);
  const [localAgeingDateRange, setLocalAgeingDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [calendarViewType, setCalendarViewType] = useState<'month' | 'week' | 'day'>('month');

  const nextPeriod = () => {
    if (calendarViewType === 'month') setCurrentCalendarDate(addMonths(currentCalendarDate, 1));
    else if (calendarViewType === 'week') setCurrentCalendarDate(addWeeks(currentCalendarDate, 1));
    else setCurrentCalendarDate(addDays(currentCalendarDate, 1));
  };

  const prevPeriod = () => {
    if (calendarViewType === 'month') setCurrentCalendarDate(subMonths(currentCalendarDate, 1));
    else if (calendarViewType === 'week') setCurrentCalendarDate(subWeeks(currentCalendarDate, 1));
    else setCurrentCalendarDate(addDays(currentCalendarDate, -1));
  };

  // Auto-switch ageingBasis when trackingTab changes
  useEffect(() => {
    if (!isTrackingSheet) return;
    if (trackingTab === 'all' || trackingTab === 'site') setAgeingBasis('Inward Date');
    else if (trackingTab === 'ho') setAgeingBasis('Received at HO');
    else if (trackingTab === 'accounts') setAgeingBasis('Certified at HO & Sent to Accounts on');
    else if (trackingTab === 'paid') setAgeingBasis('Cheque Recd. At Site Date');
  }, [trackingTab, isTrackingSheet]);

  const [columnByOpen, setColumnByOpen] = useState(false);
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const [chartVisTypeOpen, setChartVisTypeOpen] = useState(false);
  const [chartMetricOpen, setChartMetricOpen] = useState(false);
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});

  const AMOUNT_METRICS = [
    "Bill Amount (Net Payble)",
    "Paid Amount",
    "Balance Payment"
  ];
  
  const DAYS_METRICS = [
    "Site Days",
    "HO Days",
    "Bill Process Days",
    "Account Days",
    "Inward to Payment Cycle Days"
  ];

  const showCount = selectedSummaries.includes("count");
  const amountCount = AMOUNT_METRICS.filter(m => selectedSummaries.includes(m)).length;
  const showAmount = amountCount === 0 ? false : (amountCount === AMOUNT_METRICS.length ? true : "indeterminate");
  const daysCountSafe = DAYS_METRICS.filter(m => selectedAvg.includes(m)).length;
  const showDays = daysCountSafe === 0 ? false : (daysCountSafe === DAYS_METRICS.length ? true : "indeterminate");

  // Table expansion state
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    {},
  );
  const [expansionLevel, setExpansionLevel] = useState(10); // Default to expanded all level to match reset logic

  // Drill-down and legend state
  const [drillPath, setDrillPath] = useState<string[]>([]);
  const [hiddenMetrics, setHiddenMetrics] = useState<string[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);

  // Table Height Resize state handled in parent state section

  // Chart loading/updating simulation & Resetting states
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  // Monitor activeView prop and update isChartLoading immediately during render
  const [prevActiveView, setPrevActiveView] = useState(activeView);
  if (activeView !== prevActiveView) {
    setPrevActiveView(activeView);
    setIsChartLoading(true);
  }

  // Trigger calculating spinning wheel when switching between Table, Chart, and Calendar
  useEffect(() => {
    setIsChartLoading(true);
    const timer = setTimeout(() => {
      setIsChartLoading(false);
    }, 550);
    return () => clearTimeout(timer);
  }, [activeView]);

  const resetTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleInlineFilterChange = useCallback((field: string, vals: string[]) => {
    setIsChartLoading(true);
    setTimeout(() => {
      setPivotInlineFilters(prev => ({...prev, [field]: vals}));
      if (context?.setColumnFilters) {
         context.setColumnFilters(prev => ({...prev, [field]: vals}));
      }
      setIsChartLoading(false);
    }, 1500); // Simulated delay like the other apply actions
  }, [context?.setColumnFilters]);

  // Synchronize inline filters with global filters (mutual dependency/sync)
  useEffect(() => {
    if (context?.columnFilters) {
      setPivotInlineFilters(context.columnFilters);
    } else {
      setPivotInlineFilters({});
    }
  }, [context?.columnFilters]);

  // Top scrollbar synchronization refs and states
  const topScrollRef = React.useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollWidth, setScrollWidth] = useState<number>(0);
  const [clientWidth, setClientWidth] = useState<number>(0);


  // Immediate chart spinning visualization on click change
  useEffect(() => {
    setIsChartLoading(true);
    const timer = setTimeout(() => {
      setIsChartLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [
    data,
    constraints,
    selectedRows,
    columnizeBy,
    hiddenCategories,
    hiddenMetrics,
    selectedSummaries,
    selectedAvg,
    chartType,
    chartMetric,
    showDays,
    showCount,
    showAmount,
    expansionLevel,
    drillPath,
    selectedExtraColumns,
  ]);

  const handleResetClick = () => {
    handleResetAll();
  };

  const handleChartClick = (name: string) => {
    if (!name || name === "Others") return;
    setDrillPath((current) => {
      if (current[current.length - 1] === name) return current;
      return [...current, name];
    });
  };

  const isPivotChanged = () => {
    // Determine defaults consistently with state initialization
    const defaultSummaries = (propDefaultSummaries) ? propDefaultSummaries : [
      "count",
      "Bill Amount (Net Payble)",
      "Paid Amount",
      "Balance Payment",
    ];
    const defaultAvg = (propDefaultAvg) ? propDefaultAvg : [
      "Site Days",
      "HO Days",
      "Bill Process Days",
      "Account Days",
      "Inward to Payment Cycle Days",
    ];
    const activeDefaultRows = defaultRows || ["Project", "Status", "Contractor Name"];
    const defaultExtraCols = (propDefaultExtraColumns) ? propDefaultExtraColumns : (enableExtraColumns ? DEFAULT_EXTRA_COLUMNS_SANS_SITE : []);

    const summariesChanged = selectedSummaries.length !== defaultSummaries.length || 
      !selectedSummaries.every((s, i) => s === defaultSummaries[i]);
    const avgChanged = selectedAvg.length !== defaultAvg.length || 
      !selectedAvg.every((s, i) => s === defaultAvg[i]);
    const rowsChanged = selectedRows.length !== activeDefaultRows.length || 
      !selectedRows.every((r, i) => r === activeDefaultRows[i]);
    const extraColsChanged = selectedExtraColumns.length !== defaultExtraCols.length || 
      !selectedExtraColumns.every((col, i) => col === defaultExtraCols[i]);

    const defaultBasis = (() => {
      if (!isTrackingSheet) return 'Inward Date';
      if (trackingTab === 'all' || trackingTab === 'site') return 'Inward Date';
      if (trackingTab === 'ho') return 'Received at HO';
      if (trackingTab === 'accounts') return 'Certified at HO & Sent to Accounts on';
      if (trackingTab === 'paid') return 'Cheque Recd. At Site Date';
      return 'Inward Date';
    })();
    const ageingChanged = (ageingDateRange.from !== null || ageingDateRange.to !== null);

    const changedResult = (
      rowsChanged ||
      columnizeBy !== null ||
      hiddenCategories.length > 0 ||
      hiddenMetrics.length > 0 ||
      summariesChanged ||
      avgChanged ||
      extraColsChanged ||
      chartType !== "bar" ||
      chartMetric !== "count" ||
      expansionLevel !== 10 ||
      drillPath.length > 0 ||
      ageingChanged
    );

    return changedResult;
  };

  const handleResetAll = useCallback(() => {
    try {
      localStorage.removeItem(pKey("pivot_items_order"));
      localStorage.removeItem(pKey("pivot_selected_rows"));
      localStorage.removeItem(pKey("pivot_columnize_by"));
      localStorage.removeItem(pKey("pivot_selected_summaries"));
      localStorage.removeItem(pKey("pivot_summaries_order"));
      localStorage.removeItem(pKey("pivot_selected_avg"));
      localStorage.removeItem(pKey("pivot_avg_order"));
      localStorage.removeItem(pKey("pivot_selected_extra_columns"));
      localStorage.removeItem(pKey("pivot_extra_columns_order"));
    } catch (e) {}

    setSelectedRows(defaultRows);
    setColumnizeBy(null);
    setHiddenCategories([]);
    setHiddenMetrics([]);
    
    const defSummaries = propDefaultSummaries || [
      "count",
      "Bill Amount (Net Payble)",
      "Paid Amount",
      "Balance Payment",
    ];
    setSelectedSummaries(defSummaries);

    const defAvg = propDefaultAvg || [
      "Site Days",
      "HO Days",
      "Bill Process Days",
      "Account Days",
      "Inward to Payment Cycle Days",
    ];
    setSelectedAvg(defAvg);

    setChartType("bar");
    setChartMetric("count");

    setExpansionLevel(10);
    setCollapsedCols({});
    setDrillPath([]);
    setExpandedNodes({});

    const defExtraColumns = propDefaultExtraColumns || (enableExtraColumns ? DEFAULT_EXTRA_COLUMNS_SANS_SITE : []);
    setSelectedExtraColumns(defExtraColumns);

    const defaultBasis = (() => {
      if (!isTrackingSheet) return 'Inward Date';
      if (trackingTab === 'all' || trackingTab === 'site') return 'Inward Date';
      if (trackingTab === 'ho') return 'Received at HO';
      if (trackingTab === 'accounts') return 'Certified at HO & Sent to Accounts on';
      if (trackingTab === 'paid') return 'Cheque Recd. At Site Date';
      return 'Inward Date';
    })();
    setAgeingDateRange({ from: null, to: null });
    setAgeingBasis(defaultBasis);
  }, [defaultRows, enableExtraColumns, propDefaultSummaries, propDefaultAvg, propDefaultExtraColumns, pKey, isTrackingSheet, trackingTab, setAgeingDateRange, setAgeingBasis]);

  useEffect(() => {
    if (context?.registerResetPivot) {
      context.registerResetPivot('pivotAnalyzer', handleResetAll);
    }
    return () => {
      if (context?.unregisterResetPivot) {
        context.unregisterResetPivot('pivotAnalyzer');
      }
    };
  }, [handleResetAll]);

  // Sync scrollbars
  useEffect(() => {
    const topEl = topScrollRef.current;
    const bottomEl = bottomScrollRef.current;
    if (!topEl || !bottomEl) return;

    const handleTopScroll = () => {
      if (bottomEl.scrollLeft !== topEl.scrollLeft) {
        bottomEl.scrollLeft = topEl.scrollLeft;
      }
    };

    const handleBottomScroll = () => {
      if (topEl.scrollLeft !== bottomEl.scrollLeft) {
        topEl.scrollLeft = bottomEl.scrollLeft;
      }
    };

    topEl.addEventListener("scroll", handleTopScroll, { passive: true });
    bottomEl.addEventListener("scroll", handleBottomScroll, { passive: true });

    return () => {
      topEl.removeEventListener("scroll", handleTopScroll);
      bottomEl.removeEventListener("scroll", handleBottomScroll);
    };
  }, [scrollWidth, clientWidth, activeView, isChartLoading]);

  const currentPivotChanged = isPivotChanged();
  useEffect(() => {
    if (context?.setModuleChanged) {
      context.setModuleChanged('pivotAnalyzer', currentPivotChanged);
    }
  }, [currentPivotChanged, context?.setModuleChanged]);

  // Combine for processing with master quick filtering
  const allSelectedMetrics = useMemo(() => {
    const raw = [...selectedSummaries, ...selectedAvg];
    return raw.filter((m) => !!AVAILABLE_METRICS.find((def) => def.id === m));
  }, [selectedSummaries, selectedAvg]);

  // Handle active metric validation
  useEffect(() => {
    if (
      allSelectedMetrics.length > 0 &&
      !allSelectedMetrics.includes(chartMetric)
    ) {
      setChartMetric(allSelectedMetrics[0]);
    }
  }, [allSelectedMetrics, chartMetric]);

  const activeMetrics = allSelectedMetrics.filter(
    (m) => !hiddenMetrics.includes(m),
  );

  const activeTypes = Array.from(
    new Set(
      activeMetrics
        .map((mId) => AVAILABLE_METRICS.find((m) => m.id === mId)?.type)
        .filter((t): t is string => !!t)
    )
  );

  const getYAxisOrientation = (type: string): "left" | "right" => {
    return activeTypes.indexOf(type) === 0 ? "left" : "right";
  };

  const isThirdAxis = (type: string): boolean => {
    return activeTypes.indexOf(type) >= 2;
  };

  const toggleMetricVisibility = (metricId: string) => {
    setHiddenMetrics((prev) =>
      prev.includes(metricId)
        ? prev.filter((m) => m !== metricId)
        : [...prev, metricId],
    );
  };

  useEffect(() => {
    setExpansionLevel(10);
    setCollapsedCols({});
    setExpandedNodes({});
  }, [selectedRows, columnizeBy]);

  const toggleCategoryVisibility = (catName: string) => {
    setHiddenCategories((prev) =>
      prev.includes(catName)
        ? prev.filter((c) => c !== catName)
        : [...prev, catName],
    );
  };

  const toggleMetric = (
    metricId: string,
    setMetric: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setMetric((prev) =>
      prev.includes(metricId)
        ? prev.filter((m) => m !== metricId)
        : [...prev, metricId],
    );
  };

  const AVAILABLE_ROWS = useMemo(() => {
    const base = [
      "Project",
      "Source",
      "Site",
      "Contractor Name",
      "Bill Type",
      "Billing Eng Name",
      "Status",
      "Payment Status",
    ];
    if (pageId === "tat") {
      return base.filter(row => row !== "Contractor Name");
    }
    return base;
  }, [pageId]);

  const SUMMARIES = AVAILABLE_METRICS.filter(
    (m) => m.type === "sum" || m.type === "count",
  );
  const AVG_METRICS = AVAILABLE_METRICS.filter((m) => m.type === "avg");

  const computedColumnField = useMemo(() => {
    let field = columnizeBy;
    if (field && field.includes(':')) {
        const [id, level] = field.split(':');
        return `${id} ${level}`;
    }
    return field;
  }, [columnizeBy]);

  const rowsToUse = useMemo(() => {
    const base = selectedRows.map(row => {
        if (row.includes(':')) {
            const [id, level] = row.split(':');
            return `${id} ${level}`;
        }
        return row;
    });
    return base;
  }, [selectedRows]);

  const processedData = useMemo(() => {
    let baseFiltered = data;
    
    // Add Ageing Date Range Filter
    if (isTrackingSheet && (ageingDateRange.from || ageingDateRange.to)) {
      baseFiltered = data.filter(record => {
        const dateVal = record[ageingBasis as any];
        const parsed = parseRecordDate(dateVal);
        if (!parsed) return false;
        
        if (ageingDateRange.from && ageingDateRange.to) {
          return parsed >= startOfDay(ageingDateRange.from) && parsed <= endOfDay(ageingDateRange.to);
        } else if (ageingDateRange.from) {
          return parsed >= startOfDay(ageingDateRange.from);
        } else if (ageingDateRange.to) {
          return parsed <= endOfDay(ageingDateRange.to);
        }
        return true;
      });
    }

    let enriched = baseFiltered.map((d) => {
      const res = { ...d };
      const parseD = (f: string, pre: string) => {
        if (res[f]) {
          const dt = new Date(res[f]);
          if (!isNaN(dt.getTime())) {
            res[`${pre} Year`] = dt.getFullYear().toString();
            res[`${pre} Month`] = dt.toLocaleString("default", {
              month: "short",
            });
            res[`${pre} Date`] = dt.getDate().toString();
            res[`${pre} Year-Month`] =
              `${dt.getFullYear()} - ${dt.toLocaleString("default", { month: "short" })}`;
          } else {
            res[`${pre} Year`] = "N/A";
            res[`${pre} Month`] = "N/A";
            res[`${pre} Date`] = "N/A";
            res[`${pre} Year-Month`] = "N/A";
          }
        } else {
          res[`${pre} Year`] = "N/A";
          res[`${pre} Month`] = "N/A";
          res[`${pre} Date`] = "N/A";
          res[`${pre} Year-Month`] = "N/A";
        }
      };
      parseD("Inward Date", "Inward Date");
      parseD("Received at HO", "Received at HO");
      parseD("Certified at HO & Sent to Accounts on", "Send to Account Date");
      parseD("Cheque Recd. At Site Date", "Payment Date");
      return res;
    });

    // Filter out N/A for selected date-based hierarchy/column fields
    const dateFieldsToCheck = [...rowsToUse, computedColumnField].filter(field => field && (field.includes('Year') || field.includes('Month') || field.includes('Date')));
    enriched = enriched.filter(record => {
        return dateFieldsToCheck.every(field => {
            const val = record[field];
            return val !== undefined && val !== null && val !== "" && val !== "N/A";
        });
    });

    // Apply inline quick filters from pivot table headers
    if (pivotInlineFilters && Object.keys(pivotInlineFilters).length > 0) {
      enriched = enriched.filter(record => {
        return Object.entries(pivotInlineFilters).every(([field, selectedVals]) => {
          const vals = selectedVals as string[];
          if (!vals || vals.length === 0) return true;
          const actualField = getRecordKeyForCol(field);
          const val = String(record[actualField] || "N/A");
          return vals.includes(val);
        });
      });
    }

    let columnKeys: string[] = [];
    if (computedColumnField) {
      const keysSet = new Set<string>();
      enriched.forEach((r) => keysSet.add(String(r[computedColumnField] || "N/A")));
      columnKeys = Array.from(keysSet).sort((a, b) => {
        return compareValues(a, b, computedColumnField);
      });
    }

    const buildColAgg = (records: any[]) => {
      const agg: any = { count: records.length };
      AVAILABLE_METRICS.forEach((m) => {
        if (m.type === "sum" || m.type === "avg") {
          const sum = records.reduce(
            (acc, val) => acc + (Number(val[m.id]) || 0),
            0,
          );
          agg[m.id] =
            m.type === "avg" && records.length > 0 ? sum / records.length : sum;
        }
      });
      return agg;
    };

    const buildTree = (records: any[], depth: number, currentPath: string = ""): any => {
      let node: any = { isLeaf: false, records };
      
      // Calculate totals for backward compatibility and chart usage
      const totalAgg = buildColAgg(records);
      Object.assign(node, totalAgg);
      
      // Column aggregation
      if (computedColumnField) {
         node.cols = {};
         columnKeys.forEach((ck) => {
           const colRecords = records.filter((r) => String(r[computedColumnField] || "N/A") === ck);
           node.cols[ck] = buildColAgg(colRecords);
         });
      }

      if (depth >= rowsToUse.length) {
        if (enableExtraColumns && selectedExtraColumns && selectedExtraColumns.length > 0) {
          // Group records by unique combinations of selectedExtraColumns
          const combos = new Map<string, { keyValues: Record<string, any>, records: any[] }>();
          records.forEach((r) => {
            const comboObj: Record<string, any> = {};
            selectedExtraColumns.forEach((col) => {
              const recKey = getRecordKeyForCol(col);
              const val = r[recKey];
              comboObj[col] = (val !== undefined && val !== null) ? String(val).trim() : "";
            });
            const comboStr = JSON.stringify(comboObj);
            if (!combos.has(comboStr)) {
              combos.set(comboStr, { keyValues: comboObj, records: [] });
            }
            combos.get(comboStr)!.records.push(r);
          });

          // Create children for each unique combination in the original sequence
          const children: any[] = [];
          const sortedKeys = Array.from(combos.keys());
          sortedKeys.forEach((comboStr) => {
            const item = combos.get(comboStr)!;
            const subLeaf: any = {
              isLeaf: true,
              isSubLeaf: true,
              records: item.records,
              name: "", // Will be set by parent propagation
              extraValues: item.keyValues,
            };
            
            // Assign aggregated metrics
            const subAgg = buildColAgg(item.records);
            Object.assign(subLeaf, subAgg);
            
            // Column wise aggregation
            if (computedColumnField) {
              subLeaf.cols = {};
              columnKeys.forEach((ck) => {
                const colRecords = item.records.filter((r) => String(r[computedColumnField] || "N/A") === ck);
                subLeaf.cols[ck] = buildColAgg(colRecords);
              });
            }

            children.push(subLeaf);
          });

          node.children = children;
          node.isLeaf = false;
          return node;
        } else {
          node.isLeaf = true;
          return node;
        }
      }

      const rowField = rowsToUse[depth];
      const actualRowField = getRecordKeyForCol(rowField);
      const groups = new Map<string, any[]>();
      records.forEach((r) => {
        const val = String(r[actualRowField] || "N/A");
        if (!groups.has(val)) groups.set(val, []);
        groups.get(val)!.push(r);
      });

      const children: any[] = [];
      node.name = "Total";

      // Lazy evaluation: skip building children if not expanded (unless in drillPath for charts)
      const currentSegments = currentPath ? currentPath.split(" > ") : [];
      const isPathMatchOrPrefix = drillPath.length === 0 || 
        currentSegments.every((seg, idx) => drillPath[idx] === seg);

      const isExpanded = expandedNodes[currentPath || "Total"] !== undefined
        ? expandedNodes[currentPath || "Total"]
        : depth < expansionLevel || isPathMatchOrPrefix;

      if (!isExpanded) {
        node.children = [];
        node.isLeaf = false;
        node.hasHiddenChildren = true;
        return node;
      }

      Array.from(groups.entries())
        .sort((a, b) => compareValues(a[0], b[0], rowField))
        .forEach(([key, groupRecords]) => {
          const childPath = currentPath ? `${currentPath} > ${key}` : key;
          const childNode = buildTree(groupRecords, depth + 1, childPath);
          childNode.name = key;
          childNode.field = rowField;
          
          if (childNode.children) {
            childNode.children.forEach((c: any) => {
              if (c.isSubLeaf) {
                c.name = key;
              }
            });
          }
          children.push(childNode);
        });

      node.children = children;
      return node;
    };

    if (rowsToUse.length === 0) {
       const tree = { children: [], ...buildColAgg(enriched), records: enriched };
       if (computedColumnField) {
         tree.cols = {};
         columnKeys.forEach((ck) => {
           const colRecords = enriched.filter((r) => String(r[computedColumnField] || "N/A") === ck);
           tree.cols[ck] = buildColAgg(colRecords);
         });
       }
       return { tree, columnKeys };
    }
    
    const tree = buildTree(enriched, 0, "");
    return { tree, columnKeys };
  }, [data, selectedRows, computedColumnField, selectedExtraColumns, enableExtraColumns, expandedNodes, expansionLevel, drillPath, pivotInlineFilters]);

  useEffect(() => {
    if (processedData.columnKeys && processedData.columnKeys.length > 0) {
      setCollapsedCols(prev => {
        let changed = false;
        const next = { ...prev };
        processedData.columnKeys.forEach(ck => {
          if (next[ck] === undefined) {
            next[ck] = false;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [processedData.columnKeys]);

  useEffect(() => {
    const bottomEl = bottomScrollRef.current;
    if (!bottomEl) return;

    const updateMeasurements = () => {
      setScrollWidth(bottomEl.scrollWidth);
      setClientWidth(bottomEl.clientWidth);
    };

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        if (!bottomEl) return;
        updateMeasurements();
      });
    });

    observer.observe(bottomEl);
    updateMeasurements();

    const tableEl = bottomEl.querySelector("#pivot-table-element");
    if (tableEl) {
      observer.observe(tableEl);
    }

    // Use a periodic check to fallback in case of late UI / table rendering shifts
    const intervalId = setInterval(updateMeasurements, 500);

    return () => {
      observer.disconnect();
      clearInterval(intervalId);
    };
  }, [processedData, selectedRows, activeView, isChartLoading]);

  // Tree rendering component
  const renderTree = (node: any, depth: number, path: string = "") => {
    let nodePath = path ? `${path} > ${node.name}` : node.name || "Total";
    if (node.isSubLeaf && node.extraValues) {
      nodePath = `${nodePath} | ${JSON.stringify(node.extraValues)}`;
    }
    const isExpanded =
      expandedNodes[nodePath] !== undefined
        ? expandedNodes[nodePath]
        : depth < expansionLevel;

    const hasChildren = (node.children && node.children.length > 0) || node.hasHiddenChildren;

    // Darker hierarchy levels shading as per hierarchy levels
    const rowBgColor = getTrackingRowBg(depth, node.isLeaf);

    // Dynamic hierarchy bold styles
    const fontStyleClass = depth === 0 
      ? "font-extrabold text-[14px] text-slate-950" 
      : depth === 1 
        ? "font-bold text-[13px] text-slate-900" 
        : depth === 2 
          ? "font-semibold text-[12px] text-slate-850" 
          : "font-medium text-[11.5px] text-slate-800";

    const textStyle = node.isLeaf ? "text-gray-900 font-normal" : fontStyleClass;

    return (
      <React.Fragment key={nodePath}>
        <tr 
          onClick={() => {
            if (node.records && node.records.length > 0) {
              setSelectedDetailRecords(node.records);
              const cleanTitle = path ? `${path} > ${node.name || "Record"}` : node.name || "Record Detail";
              setDetailTitle(cleanTitle);
            }
          }}
          className={`border-b border-gray-200 transition-colors group ${rowBgColor} cursor-pointer ${
            isHoldActive 
              ? 'hover:bg-red-100/50 active:bg-red-200/50' 
              : trackingTab === 'site' 
                ? 'hover:bg-[#E6D7A1]/40 active:bg-[#E6D7A1]/60' 
                : trackingTab === 'ho' 
                  ? 'hover:bg-blue-100/50 active:bg-blue-200/50' 
                  : trackingTab === 'accounts'
                    ? 'hover:bg-cyan-100/50 active:bg-cyan-200/50'
                    : trackingTab === 'paid'
                      ? 'hover:bg-green-100/50 active:bg-green-200/50'
                      : 'hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200'
          }`}
        >
          <td
            className={`py-0.5 px-3 text-[13px] sticky left-0 z-10 border-r border-gray-300 whitespace-nowrap w-[280px] min-w-[280px] max-w-[280px] truncate box-border overflow-hidden ${rowBgColor} ${textStyle}`}
            style={{ left: 0, width: '280px', minWidth: '280px', maxWidth: '280px', paddingLeft: `${depth * 14 + 10}px`, boxSizing: 'border-box' }}
          >
            <div className="flex items-center gap-1 overflow-hidden w-full">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedNodes((prev) => ({
                      ...prev,
                      [nodePath]: !isExpanded,
                    }));
                  }}
                  className="hover:bg-gray-300 rounded p-0.5 transition-colors cursor-pointer flex-shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-2.5 h-2.5 text-gray-700" />
                  ) : (
                    <ChevronRight className="w-2.5 h-2.5 text-gray-700" />
                  )}
                </button>
              )}
              {!hasChildren && <span className="w-4 flex-shrink-0" />}
              <span className="truncate pr-5">
                {node.name || "Total"}
              </span>
              {node.name && rowsToUse[depth] && (
                 <PivotInlineFilter 
                    field={rowsToUse[depth]} 
                    allData={allData} 
                    data={data}
                    selected={pivotInlineFilters[rowsToUse[depth]] || []}
                    onChange={(vals) => handleInlineFilterChange(rowsToUse[depth], vals)}
                    constraints={effectiveConstraints}
                 />
              )}
            </div>
          </td>
          {selectedExtraColumns.map((col) => {
            const cellVal = node.isSubLeaf && node.extraValues ? (node.extraValues[col] ?? "-") : "";
            const isCompact = isCompactColumn(col);
            const isDateCol = col.toLowerCase().includes("date") || col.toLowerCase() === "received at ho" || col.toLowerCase() === "certified at ho & sent to accounts on";
            const compactW = isCompact ? getCompactWidth(col) : "w-[140px] max-w-[140px]";
            
            return (
              <td 
                key={col} 
                className={cn(
                  "py-0.5 text-[12px] text-gray-700 border-r border-gray-200 leading-snug font-sans",
                  isCompact ? "px-1 whitespace-nowrap overflow-hidden" : "px-3 whitespace-nowrap overflow-hidden text-ellipsis",
                  compactW,
                  isCompact && isDateCol && "text-center font-mono",
                  rowBgColor
                )}
              >
                {cellVal}
              </td>
            );
          })}
          {computedColumnField &&
            processedData.columnKeys.map((ck) => {
              if (collapsedCols[ck]) {
                return (
                  <td
                    key={`${ck}-empty`}
                    className={`py-0.5 px-3 border-l border-gray-200 ${rowBgColor}`}
                  ></td>
                );
              }
              return allSelectedMetrics.map((mId) => {
                const mDef = AVAILABLE_METRICS.find((m) => m.id === mId) || { id: mId, type: "sum", label: mId };
                const val = node.cols && node.cols[ck] ? node.cols[ck][mId] : 0;
                return (
                  <td
                    key={`${ck}-${mId}`}
                    className={cn(
                      "py-0.5 px-2 text-right text-[12px] font-mono whitespace-nowrap border-l border-gray-200 first:border-l-0 text-gray-900 w-[90px] max-w-[90px] overflow-hidden",
                      rowBgColor
                    )}
                  >
                    {formatVal(val, mDef)}
                  </td>
                );
              });
            })}
          {allSelectedMetrics.map((mId) => {
            const mDef = AVAILABLE_METRICS.find((m) => m.id === mId) || { id: mId, type: "sum", label: mId };
            const val = mId === "count" ? node.count : node[mId];
            const totalCellBg = () => {
              if (isHoldActive) return 'bg-red-50 text-red-950';
              if (trackingTab === 'site') return 'bg-[#E6D7A1]/20 text-[#6c591a]';
              if (trackingTab === 'ho') return 'bg-blue-105/40 text-blue-900';
              if (trackingTab === 'accounts') return 'bg-cyan-105/40 text-cyan-900';
              if (trackingTab === 'paid') return 'bg-green-55/20 text-green-950';
              return 'bg-blue-50/25 text-blue-900';
            };
            return (
              <td
                key={`total-${mId}`}
                className={cn(
                  "py-0.5 px-2 text-right text-[12px] font-mono whitespace-nowrap w-[100px] max-w-[100px] overflow-hidden",
                  computedColumnField ? `${totalCellBg()} border-l border-gray-300 font-bold` : `text-gray-900 border-l border-gray-300 ${rowBgColor}`
                )}
              >
                {formatVal(val, mDef)}
              </td>
            );
          })}
        </tr>
        {isExpanded &&
          node.children &&
          node.children.map((child: any) =>
            renderTree(child, depth + 1, nodePath),
          )}
      </React.Fragment>
    );
  };

  const formatVal = (v: any, mDef: any) => {
    if (typeof v !== "number") return v;
    if (v === 0) return "-";
    if (mDef.type === "sum")
      return v.toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        style: "currency",
        currency: "INR",
      });
    if (mDef.type === "avg")
      return v.toLocaleString("en-IN", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
    return v.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const exportToExcel = () => {
    try {
      const table = document.getElementById("pivot-table-element");
      if (!table) return;

      const rows = Array.from(table.querySelectorAll("tr"));
      const numRows = rows.length;

      // Map out the grid dimensions
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

      // Fill the grid with cell references and track merge ranges
      const merges: any[] = [];

      rows.forEach((tr, r) => {
        let c = 0;
        Array.from(tr.children).forEach((cell: any) => {
          // Find the first empty spot in this row
          while (c < maxCols && grid[r][c] !== null) {
            c++;
          }
          if (c >= maxCols) return;

          const rowSpan = cell.rowSpan || 1;
          const colSpan = cell.colSpan || 1;

          // Record merge if rowSpan or colSpan is > 1
          if (rowSpan > 1 || colSpan > 1) {
            merges.push({
              s: { r: r, c: c }, // start row, col
              e: { r: r + rowSpan - 1, c: c + colSpan - 1 }, // end row, col
            });
          }

          // Fill cells in the grid
          for (let dr = 0; dr < rowSpan; dr++) {
            for (let dc = 0; dc < colSpan; dc++) {
              if (r + dr < numRows && c + dc < maxCols) {
                grid[r + dr][c + dc] = {
                  element: cell,
                  isOrigin: dr === 0 && dc === 0,
                };
              }
            }
          }
          c += colSpan;
        });
      });

      const ws: any = {
        "!merges": merges,
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
          const text = isOrigin ? (element.innerText || "").trim() : "";

          // 1. Identify alignment
          let alignment: any = { vertical: "center", wrapText: true };
          const classes = element.className || "";

          // Section identification
          const isHeader = element.tagName === "TH" || element.closest("thead") !== null;
          const isFooter = element.tagName === "TD" && element.closest("tfoot") !== null;
          const isBody = !isHeader && !isFooter;

          // Check for compact styling
          const isCompact = classes.includes("max-w-[") || classes.includes("w-[80px]") || classes.includes("w-[85px]") || classes.includes("w-[90px]") || classes.includes("w-[120px]") || classes.includes("w-[150px]") || classes.includes("w-auto");
          const isStandardHeader = classes.includes("max-w-[140px]");
          
          if (isCompact && !isStandardHeader && !isHeader) {
            alignment.wrapText = false;
          }

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

          // Compute row depth for body rows based on the first cell in the row (column 0)
          let rowDepth = 2; // Default to leaf/detail row
          if (isBody) {
            const firstCellEntry = grid[r][0];
            if (firstCellEntry && firstCellEntry.element) {
              const firstCellEl = firstCellEntry.element;
              const padLeftStr = firstCellEl.style.paddingLeft || "";
              const padValue = parseInt(padLeftStr) || 0;
              rowDepth = Math.max(0, Math.floor((padValue - 10) / 14));
            }
          }

          // 2. Identify Fills, Text Colors, and Fonts
          let fillColor = "FFFFFF"; // Default white
          let textColor = "374151"; // Default gray-700
          let isBold = false;

          let border: any = {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } }
          };

          const parentRow = element.parentElement;
          const rowClasses = parentRow ? (parentRow.className || "") : "";

          // A. Hierarchy Depth & Indentation for Body column 0 and other body cells
          let val: any = text;
          if (isBody) {
            const isTotalColumnCell = classes.includes("bg-blue-50") || classes.includes("text-blue-900") || text.includes("Total") || classes.includes("text-blue-800");

            if (c === 0) {
              const padLeftStr = element.style.paddingLeft || "";
              const padValue = parseInt(padLeftStr) || 0;
              const depth = Math.max(0, Math.floor((padValue - 10) / 14));
              if (depth > 0) {
                val = "  ".repeat(depth) + text;
                alignment.indent = depth * 2;
              }
            }

            if (isTotalColumnCell) {
              // Highlight blue total column, with background scaled by hierarchy row level for ultimate clarity
              textColor = "1E3A8A";
              isBold = true;

              if (rowDepth === 0) {
                fillColor = "C6DAF3"; // Richer blue-slate for major summary row total
              } else if (rowDepth === 1) {
                fillColor = "DCE6F5"; // Soft blue-slate for minor subgroup row total
              } else {
                fillColor = "F1F6FD"; // Baby-blue tint for detail/leaf totals
              }

              // No vertical lines for total columns as requested
              border = {
                top: { style: "thin", color: { rgb: "E5E7EB" } },
                bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                left: undefined,
                right: undefined
              };
            } else {
              // Standard hierarchy column or regular cell
              if (rowDepth === 0) {
                fillColor = "F1F5F9"; // main group gray (bg-slate-100)
                textColor = "111827";
                isBold = true;
              } else if (rowDepth === 1) {
                fillColor = "F8FAFC"; // subgroup gray (bg-slate-50)
                textColor = "111827";
                isBold = true;
              } else {
                fillColor = "FFFFFF";
                textColor = "374151";
                isBold = classes.includes("font-bold") || classes.includes("font-semibold");
              }

              border = {
                top: { style: "thin", color: { rgb: "E5E7EB" } },
                bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                left: { style: "thin", color: { rgb: "E5E7EB" } },
                right: { style: "thin", color: { rgb: "E5E7EB" } }
              };
            }
          } else if (isFooter) {
            // Footer all columns: formatted uniformly with double lines and no vertical borders
            fillColor = "D1D5DB"; // beautiful gray-300
            textColor = "111827";
            isBold = true;
            border = {
              top: { style: "thin", color: { rgb: "9CA3AF" } },
              bottom: { style: "double", color: { rgb: "111827" } },
              left: undefined,
              right: undefined
            };
          } else if (isHeader) {
            isBold = true;
            // Check if is total header column (blue tones) or category header in total cols
            const isTotalHeader = classes.includes("bg-blue-50") || classes.includes("text-blue-900") || text.includes("Total") || classes.includes("text-blue-800");
            
            // Tab-specific coloring for Pivot Export
            let tabFill = "F3F4F6"; // default gray
            let tabText = "111827";
            
            if (isTrackingSheet) {
               if (isHoldActive) { tabFill = "FEE2E2"; tabText = "991B1B"; } // bg-red-100
               else if (trackingTab === 'site') { tabFill = "FEF3C7"; tabText = "92400E"; } // bg-amber-100
               else if (trackingTab === 'ho') { tabFill = "DBEAFE"; tabText = "1E40AF"; } // bg-blue-100
               else if (trackingTab === 'accounts') { tabFill = "CFFAFE"; tabText = "0E7490"; } // bg-cyan-100
               else if (trackingTab === 'paid') { tabFill = "D1FAE5"; tabText = "065F46"; } // bg-emerald-100
            }

            if (isTotalHeader) {
              fillColor = "DBEAFE"; // lovely blue-100
              textColor = "1E3A8A"; // deep blue-900
              border = {
                top: { style: "thin", color: { rgb: "9CA3AF" } },
                bottom: { style: "medium", color: { rgb: "1E3A8A" } },
                left: undefined,
                right: undefined
              };
            } else {
              fillColor = tabFill;
              textColor = tabText;
              border = {
                top: { style: "thin", color: { rgb: "D1D5DB" } },
                bottom: { style: "medium", color: { rgb: "9CA3AF" } },
                left: { style: "thin", color: { rgb: "E5E7EB" } },
                right: { style: "thin", color: { rgb: "E5E7EB" } }
              };
            }
          }

          let font: any = {
            name: "Calibri",
            sz: 11,
            bold: isBold,
            color: { rgb: textColor }
          };

          // 5. Parse values into numeric formatted cells where possible
          let cellType = "s";
          let numFormat: string | undefined = undefined;

          if (isOrigin && text !== "") {
            // Use the formatted text if we didn't override it for hierarchy indentation (val)
            let rawText = (c === 0 && val !== text) ? text : val;

            if (rawText === "-") {
              val = "-";
              cellType = "s";
            } else if (rawText.includes("₹") || rawText.includes("Rs") || rawText.includes("Rs.")) {
              const cleaned = rawText.replace(/[^0-9.-]/g, "");
              const num = parseFloat(cleaned);
              if (!isNaN(num)) {
                val = num;
                cellType = "n";
                numFormat = '"\u20B9"#,##0;("\u20B9"#,##0);"-"';
              }
            } else {
              const cleaned = rawText.replace(/,/g, "");
              const num = parseFloat(cleaned);
              if (cleaned && !isNaN(num) && /^-?\d+(\.\d+)?$/.test(cleaned)) {
                val = num;
                cellType = "n";
                if (rawText.includes("%")) {
                  val = num / 100;
                  numFormat = "0.0%";
                } else if (rawText.includes(".")) {
                  numFormat = "#,##0.0";
                } else {
                  numFormat = "#,##0";
                }
              }
            }
          }

          const ref = encodeCellAddress(r, c);
          ws[ref] = {
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
            ws[ref].z = numFormat;
          }

          // Column width calculation
          const charLen = String(val).length || 5;
          let calculatedW = Math.max(colWidths[c] || 10, charLen + 3);
          
          if (isOrigin) {
            if (classes.includes("w-[80px]")) calculatedW = 10.8;
            else if (classes.includes("w-[85px]")) calculatedW = 11.5;
            else if (classes.includes("w-[90px]")) calculatedW = 12.2;
            else if (classes.includes("w-[120px]")) calculatedW = 16.5;
            else if (classes.includes("w-[150px]")) calculatedW = 20.5;
            else if (classes.includes("max-w-[140px]")) calculatedW = 20;
            else if (classes.includes("w-auto")) calculatedW = Math.max(calculatedW, charLen + 5);
          }
          
          colWidths[c] = Math.max(colWidths[c] || 0, calculatedW);
        }
      }

      // 6. Apply Column Widths
      ws["!cols"] = Object.keys(colWidths).map((colIndex) => ({
        wch: Math.min(50, colWidths[Number(colIndex)])
      }));

      const maxRef = encodeCellAddress(numRows - 1, maxCols - 1);
      ws["!ref"] = `A1:${maxRef}`;

      const wb = XLSX.utils.book_new();
      
      let sheetName = "Pivot Analysis";
      if (isTrackingSheet) {
        const labels: Record<string, string> = {
          'all': 'All Bills',
          'site': 'Bills at Site',
          'ho': 'Bills at HO',
          'accounts': 'Bills at Accounts',
          'paid': 'Paid Bills'
        };
        sheetName = labels[trackingTab || ""] || "Pivot Analysis";
      }
      if (isHoldActive) sheetName += " (Hold)";

      XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
      XLSX.writeFile(wb, `${sheetName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error("Export error", err);
    }
  };

  const exportToPDF = () => {
    try {
      const table = document.getElementById("pivot-table-element");
      if (!table) return;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Pivot Analysis Report", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 21);

      autoTable(doc, {
        html: "#pivot-table-element",
        startY: 26,
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          valign: "middle",
          font: "helvetica",
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 7,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        theme: "grid",
        margin: { top: 25, bottom: 15, left: 10, right: 10 },
        tableWidth: 'wrap',
        didParseCell: (data: any) => {
          const elem = data.cell.raw;
          if (elem && elem.querySelector) {
             const buttons = elem.querySelectorAll('button');
             buttons.forEach((btn: any) => btn.remove());
             const selects = elem.querySelectorAll('select');
             selects.forEach((sel: any) => sel.remove());
             data.cell.text = [elem.innerText.trim()];
          }
        },
      });

      doc.save("Pivot_Analysis_Report.pdf");
    } catch (err) {
      console.error("PDF export error", err);
    }
  };

  const printTable = () => {
    try {
      const table = document.getElementById("pivot-table-element");
      if (!table) return;

      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        console.error("Print window could not be opened.");
        return;
      }

      const doc = printWindow.document;
      const style = `
        <style>
          @media print {
            @page { size: auto; margin: 10mm; }
          }
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 20px; }
          table { width: 100%; max-width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; overflow: hidden; word-wrap: break-word; }
          th { background-color: #f1f5f9; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8fafc; }
          button, select, svg, .no-print { display: none !important; }
        </style>
      `;

      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Pivot Analysis - Print</title>
            ${style}
          </head>
          <body>
            <h2>Pivot Analysis Report</h2>
            <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
            ${table.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };

    } catch (error) {
      console.error("Print error", error);
    }
  };

  return (
    <Card 
      ref={cardRef}
      className="border border-gray-200 shadow-md rounded-lg overflow-hidden bg-white relative flex flex-col pb-0 w-full"
      style={{ 
        marginTop: '0px', 
        paddingTop: '2px',
        height: `${
          activeView === 'calendar' 
            ? calendarHeight 
            : activeView === 'chart' 
            ? chartHeight 
            : activeView === 'both' 
            ? (tableHeight + chartHeight + 40) 
            : tableHeight
        }px` 
      }}
    >
      <CardHeader 
        className={cn("bg-gray-50/30 border-b border-gray-100 px-3 py-0.5 flex flex-col gap-0", tableFirst && "order-1")}
        style={{ marginTop: '0px', paddingTop: '2px', paddingBottom: '2px', fontWeight: 'normal', minHeight: '36px', height: 'auto', borderStyle: 'none', lineHeight: '14px' }}
      >
        <div 
          className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-normal text-black py-0.5 pr-0"
          style={{ paddingTop: '0px', paddingBottom: '0px', paddingRight: '0px', paddingLeft: '0px', minHeight: '32px', height: 'auto', lineHeight: '14px' }}
        >

          {(activeView === 'table' || activeView === 'chart' || activeView === 'both') && (
            <>
              <span className="font-normal text-gray-550 tracking-wide" style={{ lineHeight: '14px' }}>Summaries</span>
              <div style={{ paddingTop: '0px', paddingBottom: '0px', minWidth: '150px', lineHeight: '14px' }}>
                <SummariesPopover
                  selectedSummaries={selectedSummaries}
                  AVAILABLE_METRICS={AVAILABLE_METRICS}
                  onApply={handleApplySummaries}
                  pageId={pageId}
                />
              </div>

              <span className="font-normal text-gray-550 tracking-wide" style={{ lineHeight: '14px' }}>And Avg. Of</span>
              <div>
                <AvgPopover
                  selectedAvg={selectedAvg}
                  AVAILABLE_METRICS={AVAILABLE_METRICS}
                  onApply={handleApplyAvg}
                  pageId={pageId}
                />
              </div>

              <span className="font-normal text-gray-550 tracking-wide" style={{ lineHeight: '14px' }}>By</span>
              <div>
                <RowLevelsPopover
                  selectedRows={selectedRows}
                  pivotItemsOrder={pivotItemsOrder}
                  onApply={handleApplyRows}
                />
              </div>
            </>
          )}

          {pageId !== "tat" && (activeView === 'table' || activeView === 'both') && (
            <>
              <span className="font-normal text-gray-550 tracking-wide" style={{ lineHeight: '14px' }}>And Columnize By</span>
              <ColumnizeByPopover
                columnizeBy={columnizeBy}
                pivotItemsOrder={pivotItemsOrder}
                onApply={handleApplyColumnizeBy}
              />
            </>
          )}

          {/* Ageing controls grouped on a single line */}
          <div className="flex items-center gap-3.5 shrink-0 flex-nowrap pl-1 bg-transparent border-none">
            {/* Ageing by dropdown */}
            <div className="flex items-center gap-1.5 bg-transparent">
              <span className="font-normal text-gray-550 tracking-wide whitespace-nowrap" style={{ lineHeight: '14px' }}>Ageing by</span>
              <Select 
                value={ageingBasis} 
                onValueChange={(val) => {
                  setIsChartLoading(true);
                  setTimeout(() => {
                    setAgeingBasis(val);
                    setIsChartLoading(false);
                  }, 500);
                }}
              >
                <SelectTrigger 
                  className="flex h-auto w-auto items-center gap-1 text-sm font-normal text-blue-600 hover:underline cursor-pointer focus:ring-0 bg-transparent hover:bg-transparent [&_svg]:size-3 [&_svg]:text-blue-600 [&_svg]:opacity-100 [&_svg]:ml-0.5 border-none p-0 shadow-none outline-none select-none"
                  style={{ 
                    fontSize: '14px', 
                    lineHeight: '14px', 
                    fontWeight: 'normal',
                    padding: '0px',
                    height: 'auto',
                    borderStyle: 'none',
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                  }}
                >
                  <span>
                    {ageingBasis === "Inward Date" && "Site Inward Date"}
                    {ageingBasis === "Received at HO" && "Received at HO Date"}
                    {ageingBasis === "Certified at HO & Sent to Accounts on" && "Send to account date"}
                    {ageingBasis === "Cheque Recd. At Site Date" && "Payment Date"}
                    {!["Inward Date", "Received at HO", "Certified at HO & Sent to Accounts on", "Cheque Recd. At Site Date"].includes(ageingBasis) && ageingBasis}
                  </span>
                </SelectTrigger>
                <SelectContent className="border-none shadow-xl z-[150] bg-white text-slate-800">
                  <SelectItem value="Inward Date">Site Inward Date</SelectItem>
                  <SelectItem value="Received at HO">Received at HO Date</SelectItem>
                  <SelectItem value="Certified at HO & Sent to Accounts on">Send to account date</SelectItem>
                  <SelectItem value="Cheque Recd. At Site Date">Payment Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ageing Dates */}
            <div className="flex items-center gap-1 bg-transparent p-0">
              <Popover open={isAgeingPopoverOpen} onOpenChange={(isOpen) => {
                setIsAgeingPopoverOpen(isOpen);
                if (isOpen) {
                  setLocalAgeingDateRange({ from: ageingDateRange.from, to: ageingDateRange.to });
                }
              }}>
                <PopoverTrigger 
                  className="flex items-center gap-1 font-normal text-blue-600 hover:underline cursor-pointer text-sm outline-none bg-transparent hover:bg-transparent border-none p-0 shadow-none outline-none select-none"
                  style={{ 
                    fontSize: '14px', 
                    lineHeight: '14px', 
                    fontWeight: 'normal',
                    padding: '0px',
                    height: 'auto',
                    borderStyle: 'none',
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                  }}
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-600 shrink-0 mr-0.5" />
                  {ageingDateRange.from || ageingDateRange.to ? (
                    <span>
                      {ageingDateRange.from ? format(ageingDateRange.from, "dd MMM yy") : "Start"} - {ageingDateRange.to ? format(ageingDateRange.to, "dd MMM yy") : "End"}
                    </span>
                  ) : "Ageing Dates"}
                  <ChevronDown className="w-3 h-3 text-blue-600" />
                  {(ageingDateRange.from || ageingDateRange.to) && (
                     <X className="w-3.5 h-3.5 hover:text-red-500 ml-1" onClick={(e) => { e.stopPropagation(); setAgeingDateRange({from: null, to: null}); }} />
                  )}
                </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white border-blue-50 shadow-2xl z-[200]">
                <div className="flex flex-col">
                  <div className="flex">
                    <div className="border-r border-gray-100 max-w-[220px]">
                      <AgeingQuickFiltersWidget currentRange={localAgeingDateRange} onSelect={(range) => {
                         setLocalAgeingDateRange({ from: range.from, to: range.to });
                      }} />
                    </div>
                    <div className="p-[5px] flex flex-col gap-3" style={{ paddingTop: '5px', paddingBottom: '5px' }}>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-1">Ageing dates</span>
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={localAgeingDateRange.from || new Date()}
                        selected={{ from: localAgeingDateRange.from || undefined, to: localAgeingDateRange.to || undefined }}
                        onSelect={(range: any) => {
                          if (range?.from && range?.to) {
                             setLocalAgeingDateRange({ from: range.from, to: range.to });
                          } else if (range?.from) {
                             setLocalAgeingDateRange({ from: range.from, to: null });
                          } else {
                             setLocalAgeingDateRange({ from: null, to: null });
                          }
                        }}
                        numberOfMonths={1}
                        className="bg-white"
                      />
                    </div>
                  </div>
                  <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setIsAgeingPopoverOpen(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-8 w-[125px] text-[11px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        setIsChartLoading(true);
                        setTimeout(() => {
                          setAgeingDateRange({ from: localAgeingDateRange.from, to: localAgeingDateRange.to });
                          setIsChartLoading(false);
                          setIsAgeingPopoverOpen(false);
                        }, 800);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>



          <div className="ml-auto flex items-center gap-3 shrink-0 flex-nowrap justify-end" style={{ fontSize: '12px', lineHeight: '12px' }}>
            {!isTrackingSheet && pageId !== 'tat' && (
              <div className="flex bg-gray-100 p-0.5 rounded-lg shadow-inner items-center h-8 px-1">
                {[
                  { id: 'table', icon: <TableIcon className="w-3 h-3" />, label: 'Table' },
                  { id: 'chart', icon: <BarChart3 className="w-3 h-3" />, label: 'Chart' },
                  { id: 'calendar', icon: <CalendarIcon className="w-3 h-3" />, label: 'Calendar' }
                ].map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setIsChartLoading(true);
                      setTimeout(() => {
                        setActiveView(v.id as any);
                        setIsChartLoading(false);
                      }, 800);
                    }}
                    className={cn(
                      "px-3 h-6.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 border-none bg-transparent",
                      activeView === v.id ? "bg-white text-blue-600 shadow-sm" : "bg-transparent text-gray-400 hover:text-gray-600"
                    )}
                  >
                    {v.icon}
                    {v.label}
                  </button>
                ))}
              </div>
            )}



            {isPivotChanged() && (
              <span
                className="text-[12px] text-red-600 hover:underline cursor-pointer uppercase tracking-wider font-normal"
                onClick={handleResetClick}
              >
                Reset
              </span>
            )}
            
            {(activeView === 'table' || activeView === 'both') && enableExtraColumns && (
              <div>
                <ExtraColumnsPopover
                  selectedExtraColumns={selectedExtraColumns}
                  onApply={handleApplyExtraColumns}
                  pageId={pageId}
                />
              </div>
            )}

            {/* Chart Type and Metric selectors moved into chart container */}

            {activeView === 'calendar' && (
              <div className="flex items-center gap-2 shrink-0 flex-nowrap ml-auto justify-end">
                {/* Date Changer */}
                <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-150 h-7 shrink-0">
                  <button 
                    onClick={prevPeriod} 
                    className="w-6 h-6 hover:bg-white hover:shadow-sm rounded-md transition-all flex items-center justify-center cursor-pointer border-none bg-transparent"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="min-w-[130px] flex items-center justify-center">
                    <Popover>
                      <PopoverTrigger className="px-2 text-[11px] font-black text-gray-900 text-center uppercase tracking-wider h-6 flex items-center justify-center hover:bg-auto rounded transition-colors outline-none cursor-pointer border-none bg-transparent whitespace-nowrap">
                        {calendarViewType === 'month' ? format(currentCalendarDate, 'MMMM yyyy') : 
                         calendarViewType === 'week' ? (() => {
                           const start = startOfWeek(currentCalendarDate, { weekStartsOn: 0 });
                           const weekNum = Math.ceil((format(start, 'd') as any) / 7);
                           const suffix = weekNum === 1 ? 'st' : weekNum === 2 ? 'nd' : weekNum === 3 ? 'rd' : 'th';
                           return `${weekNum}${suffix} week of ${format(start, 'MMMM yy')}`;
                         })() :
                         format(currentCalendarDate, 'MMM dd, yyyy')}
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white border border-gray-100 shadow-xl z-[200]" align="center">
                        <Calendar
                          mode="single"
                          selected={currentCalendarDate}
                          onSelect={(date) => date && setCurrentCalendarDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <button 
                    onClick={nextPeriod} 
                    className="w-6 h-6 hover:bg-white hover:shadow-sm rounded-md transition-all flex items-center justify-center cursor-pointer border-none bg-transparent"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Today Button */}
                <button 
                  onClick={() => setCurrentCalendarDate(new Date())}
                  className="h-7 px-2.5 rounded-lg border border-gray-200 bg-white text-[10px] font-black text-gray-600 uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center cursor-pointer shrink-0"
                >
                  Today
                </button>

                <div className="h-6 w-[1px] bg-gray-250 mx-1 self-center shrink-0" />

                {/* View Type Toggle (month/week/day) */}
                <div className="flex bg-gray-100 p-0.5 rounded-lg shadow-inner items-center h-7 shrink-0">
                  {(['month', 'week', 'day'] as ('month'|'week'|'day')[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setCalendarViewType(type)}
                      className={cn(
                        "px-3 h-6 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center cursor-pointer border-none bg-transparent",
                        calendarViewType === type ? "bg-white text-blue-600 shadow-sm" : "bg-transparent text-gray-400 hover:text-gray-600"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="h-6 w-[1px] bg-gray-250 mx-1 self-center shrink-0" />
              </div>
            )}

            {(activeView === 'table' || activeView === 'chart' || activeView === 'both') && (
              <>


                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="pivotShowDays"
                    checked={showDays === true}
                    indeterminate={showDays === "indeterminate"}
                    onCheckedChange={() => {
                      if (showDays === true || showDays === "indeterminate") {
                        setSelectedAvg([]);
                      } else {
                        setSelectedAvg(DAYS_METRICS);
                      }
                    }}
                  />
                  <label
                    htmlFor="pivotShowDays"
                    className="text-[10px] font-normal uppercase tracking-wider text-gray-600 cursor-pointer"
                  >
                    Days
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="pivotShowCount"
                    checked={showCount}
                    onCheckedChange={() => {
                      if (showCount) setSelectedSummaries(prev => prev.filter(m => m !== "count"));
                      else setSelectedSummaries(prev => ["count", ...prev]);
                    }}
                  />
                  <label
                    htmlFor="pivotShowCount"
                    className="text-[10px] font-normal uppercase tracking-wider text-[#4B5563] cursor-pointer"
                  >
                    No. of Bills
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="pivotShowAmount"
                    checked={showAmount === true}
                    indeterminate={showAmount === "indeterminate"}
                    onCheckedChange={() => {
                      if (showAmount === true || showAmount === "indeterminate") {
                        setSelectedSummaries(prev => prev.filter(m => !AMOUNT_METRICS.includes(m)));
                      } else {
                        setSelectedSummaries(prev => [...prev.filter(m => !AMOUNT_METRICS.includes(m)), ...AMOUNT_METRICS]);
                      }
                    }}
                  />
                  <label
                    htmlFor="pivotShowAmount"
                    className="text-[10px] font-normal uppercase tracking-wider text-gray-600 cursor-pointer"
                  >
                    Amount
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {activeView === 'calendar' && !isChartLoading && (
        <div 
          className="relative flex flex-col mx-0 mt-0 mb-0 pb-0 flex-1 min-h-0"
        >
          <div className="flex-1 overflow-hidden h-full min-h-0">
            <CalendarViewInternal 
                data={processedData.tree.records || []} 
                ageingBasis={ageingBasis} 
                currentDate={currentCalendarDate}
                setCurrentDate={setCurrentCalendarDate}
                viewType={calendarViewType}
                setViewType={setCalendarViewType}
                onOpenDetails={(records, title) => {
                  setSelectedDetailRecords(records);
                  setDetailTitle(title);
                }}
              />
          </div>
        </div>
      )}

      {(activeView === 'chart' || activeView === 'both') && !isChartLoading && processedData.tree.children &&
        processedData.tree.children.length > 0 &&
        selectedRows.length > 0 && (
          <div 
            className={cn("border border-gray-150 rounded-lg bg-white p-1.5 flex flex-col gap-1 shadow-sm mx-0 mt-0 mb-0 relative pb-0 flex-1 min-h-0", activeView === 'both' ? "order-2 mt-2" : "")}
            style={pageId === 'tat' ? { height: `${chartHeight}px`, marginBottom: '0px', paddingBottom: '0px' } : undefined}
          >
            {/* Sleek internal controls toolbar matching drill path design */}
            <div 
              className="flex items-center justify-between px-2 py-0 border-b border-gray-100 flex-shrink-0 text-[10px] uppercase tracking-wider select-none gap-2"
              style={{ paddingTop: '0px', paddingBottom: '0px' }}
            >
              {/* Left Side: Drill Path */}
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="font-bold text-gray-400">Drill Path:</span>
                {drillPath.length === 0 ? (
                  <span className="font-bold text-gray-650">All</span>
                ) : (
                  <>
                    <button
                      onClick={() => setDrillPath([])}
                      className="hover:text-blue-600 font-bold cursor-pointer text-blue-500 transition-colors"
                    >
                      All
                    </button>
                    {drillPath.map((item, idx) => (
                      <React.Fragment key={idx}>
                        <ChevronRight className="w-2.5 h-2.5 text-gray-400" />
                        <button
                          onClick={() => setDrillPath(drillPath.slice(0, idx + 1))}
                          className={cn(
                            "hover:text-blue-600 cursor-pointer transition-colors",
                            idx === drillPath.length - 1 ? "font-bold text-gray-700" : "font-semibold text-blue-500"
                          )}
                        >
                          {item}
                        </button>
                      </React.Fragment>
                    ))}
                    <button
                      className="ml-1 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
                      onClick={() => setDrillPath([])}
                    >
                      <X className="w-2.5 h-2.5 text-gray-400" />
                    </button>
                  </>
                )}
              </div>

              {/* Right Side: Sleek Chart Type & Metric controls */}
              <div 
                className="flex items-center gap-4 h-5"
                style={{ height: '20px' }}
              >
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-400">Type:</span>
                  <Select
                    open={chartTypeOpen}
                    onOpenChange={setChartTypeOpen}
                    value={chartType}
                    onValueChange={(val) => {
                      setIsChartLoading(true);
                      setTimeout(() => {
                        setChartType(val);
                        setIsChartLoading(false);
                      }, 500);
                    }}
                  >
                    <SelectTrigger 
                      className="flex h-auto w-auto items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer focus:ring-0 bg-transparent hover:bg-transparent border-none p-0 shadow-none outline-none select-none uppercase tracking-wider"
                    >
                      <span>
                        {chartType === "bar" && "Bar"}
                        {chartType === "line" && "Line"}
                        {chartType === "area" && "Area"}
                        {chartType === "pie" && "Pie"}
                        {chartType === "donut" && "Donut"}
                        {chartType === "pieOfPie" && "Pie Of Pie"}
                        {chartType === "donutOfDonut" && "Donut Of Donut"}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="border-none shadow-xl bg-white text-slate-800 !w-48 !min-w-[192px] z-[150]">
                      <SelectItem value="bar">
                        <div className="flex items-center gap-2 text-[11px]">
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Bar Chart</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="line">
                        <div className="flex items-center gap-2 text-[11px]">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Line Chart</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="area">
                        <div className="flex items-center gap-2 text-[11px]">
                          <LucideAreaChart className="w-3.5 h-3.5" />
                          <span>Area Chart</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="pie">
                        <div className="flex items-center gap-2 text-[11px]">
                          <PieChart className="w-3.5 h-3.5" />
                          <span>Pie Chart</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="donut">
                        <div className="flex items-center gap-2 text-[11px]">
                          <PieChart className="w-3.5 h-3.5" />
                          <span>Donut Chart</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="pieOfPie">
                        <div className="flex items-center gap-2 text-[11px]">
                          <PieChart className="w-3.5 h-3.5" />
                          <span>Pie Of Pie</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="donutOfDonut">
                        <div className="flex items-center gap-2 text-[11px]">
                          <PieChart className="w-3.5 h-3.5" />
                          <span>Donut Of Donut</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(chartType === "pie" ||
                  chartType === "donut" ||
                  chartType === "pieOfPie" ||
                  chartType === "donutOfDonut") && (
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-400">Metric:</span>
                    <Select
                      open={chartMetricOpen}
                      onOpenChange={setChartMetricOpen}
                      value={chartMetric}
                      onValueChange={(val) => {
                        setIsChartLoading(true);
                        setTimeout(() => {
                          setChartMetric(val);
                          setIsChartLoading(false);
                        }, 500);
                      }}
                    >
                      <SelectTrigger 
                        className="flex h-auto w-auto items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline cursor-pointer focus:ring-0 bg-transparent hover:bg-transparent border-none p-0 shadow-none outline-none select-none uppercase tracking-wider"
                      >
                        <span>{getDisplayName(chartMetric)}</span>
                      </SelectTrigger>
                      <SelectContent className="border-none shadow-xl bg-white text-slate-800 !w-64 !min-w-[256px] z-[150]">
                        {allSelectedMetrics.map((mId) => {
                          const metric = AVAILABLE_METRICS.find((m) => m.id === mId);
                          const isAvg = metric?.type === 'avg';
                          const isSum = metric?.id.includes('Amount');
                          return (
                            <SelectItem key={mId} value={mId}>
                              <div className="flex items-center gap-2 text-[11px]">
                                {isAvg ? <Clock className="w-3 h-3 text-orange-500" /> : isSum ? <Coins className="w-3 h-3 text-emerald-500" /> : <ListChecks className="w-3 h-3 text-blue-500" />}
                                <span>{metric?.label || mId}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <div
              className={cn(
                "w-full bg-transparent transition-all duration-300 relative flex-1 min-h-0",
              )}
              style={pageId === 'tat' ? {
                paddingTop: '0px',
                paddingBottom: '0px',
                height: '340px',
                marginBottom: '0px'
              } : { 
                paddingTop: '5px', 
                paddingBottom: '5px' 
              }}
            >
              {(() => {
                const renderMetrics = [...allSelectedMetrics].sort((a, b) => {
                    const getOrder = (mId: string) => {
                      // Group ordering for side-by-side clusters with internal back-to-front
                      switch (mId) {
                        case "Inward to Payment Cycle Days":
                          return 0;
                        case "Bill Process Days":
                          return 1;
                        case "Site Days":
                          return 2;
                        case "HO Days":
                          return 2;
                        case "Account Days":
                          return 2;
                        case "Bill Amount (Net Payble)":
                          return 10;
                        case "Paid Amount":
                          return 11;
                        case "Balance Payment":
                          return 11;
                        case "count":
                          return 20;
                        default:
                          return 30;
                      }
                    };
                    return getOrder(a) - getOrder(b);
                  });
                  const isMetricActive = (mId: string) =>
                    renderMetrics.includes(mId) && !hiddenMetrics.includes(mId);

                  const currentLevelData = (() => {
                    let currentNode: any = processedData.tree;
                    for (const segment of drillPath) {
                      if (currentNode && currentNode.children) {
                        const found = currentNode.children.find(
                          (child: any) => child.name === segment,
                        );
                        if (found) {
                          currentNode = found;
                        } else {
                          break;
                        }
                      }
                    }
                    return currentNode?.children || [];
                  })();

                  const pieDataForChart = currentLevelData.filter(
                    (child: any) => !hiddenCategories.includes(child.name),
                  );

                  const isPieOfPieVariant =
                    chartType === "pieOfPie" || chartType === "donutOfDonut";

                  const sortedFullData = [...currentLevelData].sort((a, b) => {
                    const valA = Number(a[chartMetric]) || 0;
                    const valB = Number(b[chartMetric]) || 0;
                    return valB - valA;
                  });
                  const totalFullSum = sortedFullData.reduce(
                    (acc, current) => acc + (Number(current[chartMetric]) || 0),
                    0,
                  );

                  let fullPrimaryPies: any[] = [];
                  let fullSecondaryPies: any[] = [];

                  if (isPieOfPieVariant) {
                    let othersSum = 0;
                    let splitIndex = sortedFullData.length;

                    for (let i = sortedFullData.length - 1; i >= 0; i--) {
                      const val = Number(sortedFullData[i][chartMetric]) || 0;
                      if (othersSum + val <= totalFullSum * 0.25) {
                        othersSum += val;
                        splitIndex = i;
                      } else {
                        break;
                      }
                    }

                    if (splitIndex === 0 && sortedFullData.length > 1) {
                      splitIndex = 1;
                    }
                    if (
                      splitIndex === sortedFullData.length &&
                      sortedFullData.length > 1
                    ) {
                      splitIndex = sortedFullData.length - 1;
                    }

                    fullPrimaryPies = sortedFullData.slice(0, splitIndex);
                    fullSecondaryPies = sortedFullData.slice(splitIndex);
                  }

                  // Sort descending by value of active metric
                  const sortedPieData = [...pieDataForChart].sort((a, b) => {
                    const valA = Number(a[chartMetric]) || 0;
                    const valB = Number(b[chartMetric]) || 0;
                    return valB - valA;
                  });

                  const totalPieSum = sortedPieData.reduce(
                    (acc, current) => acc + (Number(current[chartMetric]) || 0),
                    0,
                  );

                  let primaryPies: any[] = [];
                  let secondaryPies: any[] = [];

                  if (isPieOfPieVariant) {
                    // Dynamic split: group the smallest slices into "Others" up to 25% of the total sum
                    let othersSum = 0;
                    let splitIndex = sortedPieData.length;

                    for (let i = sortedPieData.length - 1; i >= 0; i--) {
                      const val = Number(sortedPieData[i][chartMetric]) || 0;
                      if (othersSum + val <= totalPieSum * 0.25) {
                        othersSum += val;
                        splitIndex = i;
                      } else {
                        break;
                      }
                    }

                    // Safety checks to adjust splitIndex if everything gets filtered out or is too large
                    if (splitIndex === 0 && sortedPieData.length > 1) {
                      splitIndex = 1;
                    }
                    if (
                      splitIndex === sortedPieData.length &&
                      sortedPieData.length > 1
                    ) {
                      splitIndex = sortedPieData.length - 1;
                    }

                    const actualPrimary = sortedPieData.slice(0, splitIndex);
                    const actualSecondary = sortedPieData.slice(splitIndex);

                    if (actualSecondary.length > 0) {
                      const secondarySum = actualSecondary.reduce(
                        (acc, current) =>
                          acc + (Number(current[chartMetric]) || 0),
                        0,
                      );
                      primaryPies = [
                        ...actualPrimary,
                        {
                          name: "Others",
                          isOthers: true,
                          [chartMetric]: secondarySum,
                        },
                      ];
                      secondaryPies = actualSecondary;
                    } else {
                      primaryPies = actualPrimary;
                      secondaryPies = [];
                    }
                  }

                  if (false && isPieOfPieVariant) {
                    if (sortedPieData.length <= 4) {
                      if (sortedPieData.length >= 3) {
                        primaryPies = sortedPieData.slice(
                          0,
                          sortedPieData.length - 2,
                        );
                        secondaryPies = sortedPieData.slice(
                          sortedPieData.length - 2,
                        );
                      } else {
                        primaryPies = sortedPieData;
                        secondaryPies = [];
                      }
                    } else {
                      // Top 4 in primary, the rest in secondary
                      primaryPies = sortedPieData.slice(0, 4);
                      secondaryPies = sortedPieData.slice(4);
                    }

                    if (secondaryPies.length > 0) {
                      const secondarySum = secondaryPies.reduce(
                        (acc, current) =>
                          acc + (Number(current[chartMetric]) || 0),
                        0,
                      );
                      primaryPies.push({
                        name: "Others",
                        isOthers: true,
                        [chartMetric]: secondarySum,
                      });
                    }
                  }

                  const renderCustomizedLabel = (props: any) => {
                    const {
                      cx,
                      cy,
                      midAngle,
                      innerRadius,
                      outerRadius,
                      percent,
                      name,
                      value,
                    } = props;
                    if (percent < 0.02) return null;
                    const RADIAN = Math.PI / 180;
                    let radius = outerRadius + 15;
                    if (name === "Others") {
                        radius = outerRadius + 40;
                    }
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    const textAnchor = x > cx ? "start" : "end";

                    let formattedVal = "";
                    const metricType = AVAILABLE_METRICS.find(
                      (m) => m.id === chartMetric,
                    )?.type;
                    if (metricType === "sum") {
                      if (value >= 10000000) {
                        formattedVal = `₹${(value / 10000000).toFixed(2)}Cr`;
                      } else if (value >= 100000) {
                        formattedVal = `₹${(value / 100000).toFixed(1)}L`;
                      } else {
                        formattedVal = `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
                      }
                    } else {
                      formattedVal = value.toLocaleString("en-IN", {
                        maximumFractionDigits: 1,
                      });
                    }

                    const displayName =
                      name.length > 15 ? `${name.slice(0, 13)}...` : name;

                    return (
                      <text
                        x={x}
                        y={y}
                        fill="#4b5563"
                        textAnchor={textAnchor}
                        dominantBaseline="central"
                        className="text-[11px] font-extrabold"
                      >
                        {`${displayName}: ${formattedVal}`}
                      </text>
                    );
                  };

                  const renderCartesian = (variant: "left" | "center" | "right") => {
                    
                    const _getYHide = (type) => false;
                    const pF = (val) => val;
                    const pO = (val) => val;
                    return chartType === "bar" ? (
                    <ReBarChart
                      data={currentLevelData.filter(
                        (child: any) => !hiddenCategories.includes(child.name),
                      )}
                      margin={{ top: 35, right: 60, left: 10, bottom: 45 }}
                      barGap={2}
                      barSize={18}
                      onClick={(state: any) => {
                        if (state && state.activeLabel) {
                          handleChartClick(state.activeLabel);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f3f4f6"
                      />
                      <XAxis
                        dataKey="name"
                        tick={(props) => (
                          <PivotXAxisTick
                            {...props}
                            chartData={currentLevelData.filter(
                              (child: any) =>
                                !hiddenCategories.includes(child.name),
                            )}
                          />
                        )}
                        interval={0}
                        xAxisId="0"
                        
                      />
                      <XAxis dataKey="name" xAxisId="1" hide />
                      <XAxis dataKey="name" xAxisId="2" hide />

                      {activeTypes.includes("avg") && (
                        <YAxis
                          yAxisId="avg"
                          orientation={getYAxisOrientation("avg")}
                          hide={_getYHide("avg")}
                          tickFormatter={(v) =>
                            v.toLocaleString("en-IN", {
                              minimumIntegerDigits: 1,
                              maximumFractionDigits: 1,
                            })
                          }
                          tick={{
                            fontSize: 10,
                            fontWeight: "bold",
                            fill: "#6B7280",
                          }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "Days",
                            angle: -90,
                            position: "insideLeft",
                            offset: 5,
                            style: {
                              fontSize: 10,
                              fontWeight: "bold",
                              fill: "#4B5563",
                            },
                          }}
                          width={75}
                        />
                      )}
                      {activeTypes.includes("count") && (
                        <YAxis
                          yAxisId="count"
                          orientation={getYAxisOrientation("count")}
                          hide={_getYHide("count")}
                          tickFormatter={(v) =>
                            v.toLocaleString("en-IN", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })
                          }
                          tick={{
                            fontSize: 10,
                            fontWeight: "bold",
                            fill: "#6B7280",
                          }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "No. of Bills",
                            angle: 90,
                            position: "insideRight",
                            offset: 5,
                            style: {
                              fontSize: 10,
                              fontWeight: "bold",
                              fill: "#4B5563",
                            },
                          }}
                          width={75}
                        />
                      )}
                      {activeTypes.includes("sum") && (
                        <YAxis
                          yAxisId="sum"
                          orientation={getYAxisOrientation("sum")}
                          hide={_getYHide("sum")}
                          tickFormatter={(v) =>
                            `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 0 })}L`
                          }
                          tick={{
                            fontSize: 10,
                            fontWeight: "bold",
                            fill: "#6B7280",
                          }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "Amount",
                            angle: 90,
                            position: "insideRight",
                            offset: 5,
                            style: {
                              fontSize: 10,
                              fontWeight: "bold",
                              fill: "#4B5563",
                            },
                          }}
                          width={85}
                        />
                      )}

                      <Tooltip wrapperStyle={{ zIndex: 100 }}
                        contentStyle={{
                          fontSize: "11px",
                          borderRadius: "8px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #e5e7eb",
                          boxShadow:
                            "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                        }}
                        /* cursor overridden */
                        itemSorter={(item) => {
                          const getOrder = (mId: string) => {
                            switch (mId) {
                              case "Inward to Payment Cycle Days":
                                return 0;
                              case "Bill Process Days":
                                return 1;
                              case "Site Days":
                                return 2;
                              case "HO Days":
                                return 2;
                              case "Account Days":
                                return 2;
                              case "Bill Amount (Net Payble)":
                                return 3;
                              case "Paid Amount":
                                return 4;
                              case "Balance Payment":
                                return 5;
                              case "count":
                                return 6;
                              default:
                                return 7;
                            }
                          };
                          return getOrder(item.name as string);
                        }}
                        formatter={(value: number, name: string) => {
                          if (name.startsWith("__")) return [null, null]; // Ignore placeholders
                          let type = AVAILABLE_METRICS.find(
                            (m) => m.id === name,
                          )?.type;
                          let displayName = getDisplayName(name);
                          if (type === "sum")
                            return [
                              `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                              displayName,
                            ];
                          if (type === "avg")
                            return [
                              value.toLocaleString("en-IN", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }),
                              displayName,
                            ];
                          if (type === "count")
                            return [
                              value.toLocaleString("en-IN", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }),
                              displayName,
                            ];
                          return [
                            value.toLocaleString("en-IN", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }),
                            displayName,
                          ];
                        }}
                      />


                      {/* Axis 2: Deepest Layer (Back) */}
                      <Bar
                        xAxisId="2"
                        stackId="d2_slot_1"
                        dataKey="__d2_1"
                        fill="transparent"
                      />
                      <Bar
                        xAxisId="2"
                        stackId="d2_slot_2"
                        dataKey="__d2_2"
                        fill="transparent"
                      />
                      <Bar
                        xAxisId="2"
                        yAxisId="avg"
                        stackId="d2_slot_3"
                        dataKey={
                          isMetricActive("Inward to Payment Cycle Days")
                            ? "Inward to Payment Cycle Days"
                            : "__dummy_inward"
                        }
                        fill={pF("#db2777")}
                        stroke={pF("#9D174D")}
                        fillOpacity={pO(0.4)}
                        
                        radius={[2, 2, 0, 0]}
                      />

                      {/* Axis 1: Middle Layer */}
                      <Bar
                        xAxisId="1"
                        stackId="d1_slot_1"
                        dataKey="__d1_1"
                        fill="transparent"
                      />
                      <Bar
                        xAxisId="1"
                        yAxisId="sum"
                        stackId="d1_slot_2"
                        dataKey={
                          isMetricActive("Bill Amount (Net Payble)")
                            ? "Bill Amount (Net Payble)"
                            : "__dummy_bill_amt"
                        }
                        fill={pF("#3B82F6")}
                        fillOpacity={pO(0.3)}
                        
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        xAxisId="1"
                        yAxisId="avg"
                        stackId="d1_slot_3"
                        dataKey={
                          isMetricActive("Bill Process Days")
                            ? "Bill Process Days"
                            : "__dummy_process"
                        }
                        fill="#ca8a04"
                        stroke="#854D0E"
                        fillOpacity={0.7}
                        radius={[2, 2, 0, 0]}
                      />

                      {/* Axis 0: Foreground Layer (Primary) */}
                      {/* Column 1: Bills */}
                      <Bar
                        xAxisId="0"
                        yAxisId="count"
                        stackId="d0_slot_1"
                        dataKey={
                          isMetricActive("count") ? "count" : "__dummy_count"
                        }
                        fill="#8B5CF6"
                        stroke="#6D28D9"
                        radius={[2, 2, 0, 0]}
                      />

                      {/* Column 2: Amounts (Foreground Stack) */}
                      <Bar
                        xAxisId="0"
                        yAxisId="sum"
                        stackId="d0_slot_2"
                        dataKey={
                          isMetricActive("Paid Amount")
                            ? "Paid Amount"
                            : "__dummy_paid"
                        }
                        fill="#10B981"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        xAxisId="0"
                        yAxisId="sum"
                        stackId="d0_slot_2"
                        dataKey={
                          isMetricActive("Balance Payment")
                            ? "Balance Payment"
                            : "__dummy_balance"
                        }
                        fill="#EF4444"
                        radius={[2, 2, 0, 0]}
                      />

                      {/* Column 3: Days (Foreground Stack) */}
                      <Bar
                        xAxisId="0"
                        yAxisId="avg"
                        stackId="d0_slot_3"
                        dataKey={
                          isMetricActive("Site Days")
                            ? "Site Days"
                            : "__dummy_site"
                        }
                        fill="#3B82F6"
                        stroke="#1D4ED8"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        xAxisId="0"
                        yAxisId="avg"
                        stackId="d0_slot_3"
                        dataKey={
                          isMetricActive("HO Days") ? "HO Days" : "__dummy_ho"
                        }
                        fill="#1D4ED8"
                        stroke="#1E3A8A"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        xAxisId="0"
                        yAxisId="avg"
                        stackId="d0_slot_3"
                        dataKey={
                          isMetricActive("Account Days")
                            ? "Account Days"
                            : "__dummy_acc"
                        }
                        fill="#F97316"
                        stroke="#C2410C"
                        radius={[2, 2, 0, 0]}
                      />
                    </ReBarChart>
                  ) : chartType === "line" ? (
                    <LineChart
                      data={currentLevelData.filter(
                        (child: any) => !hiddenCategories.includes(child.name),
                      )}
                      margin={{ top: 35, right: 60, left: 10, bottom: 45 }}
                      onClick={(state: any) => {
                        if (state && state.activeLabel) {
                          handleChartClick(state.activeLabel);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f3f4f6"
                      />
                      <XAxis
                        dataKey="name"
                        tick={(props) => (
                          <PivotXAxisTick
                            {...props}
                            chartData={currentLevelData.filter(
                              (child: any) =>
                                !hiddenCategories.includes(child.name),
                            )}
                          />
                        )}
                        interval={0}
                      />
                      {activeTypes.includes("avg") && (
                        <YAxis
                          yAxisId="avg"
                          orientation={getYAxisOrientation("avg")}
                          hide={_getYHide("avg")}
                          tickFormatter={(v) =>
                            v.toLocaleString("en-IN", {
                              minimumIntegerDigits: 1,
                              maximumFractionDigits: 1,
                            })
                          }
                          tick={{
                            fontSize: 10,
                            fontWeight: "bold",
                            fill: "#6B7280",
                          }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "Days",
                            angle: -90,
                            position: "insideLeft",
                            offset: 5,
                            style: {
                              fontSize: 10,
                              fontWeight: "bold",
                              fill: "#4B5563",
                            },
                          }}
                          width={50}
                        />
                      )}
                      {activeTypes.includes("count") && (                         <YAxis                           yAxisId="count"                           orientation={getYAxisOrientation("count")}                           hide={_getYHide("count")}
                          tickFormatter={(v) =>
                            v.toLocaleString("en-IN", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })
                          }
                          tick={{
                            fontSize: 10,
                            fontWeight: "bold",
                            fill: "#6B7280",
                          }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "No. of Bills",
                            angle: 90,
                            position: "insideRight",
                            offset: 5,
                            style: {
                              fontSize: 10,
                              fontWeight: "bold",
                              fill: "#4B5563",
                            },
                          }}
                          width={50}
                        />
                      )}
                      {activeTypes.includes("sum") && (                         <YAxis                           yAxisId="sum"                           orientation={getYAxisOrientation("sum")}                           hide={_getYHide("sum")}
                          tickFormatter={(v) =>
                            `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 0 })}L`
                          }
                          tick={{
                            fontSize: 10,
                            fontWeight: "bold",
                            fill: "#6B7280",
                          }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "Amount",
                            angle: 90,
                            position: "insideRight",
                            offset: 5,
                            style: {
                              fontSize: 10,
                              fontWeight: "bold",
                              fill: "#4B5563",
                            },
                          }}
                          width={50}
                        />
                      )}
                      <Tooltip wrapperStyle={{ zIndex: 100 }}
                        contentStyle={{
                          fontSize: "11px",
                          borderRadius: "8px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #e5e7eb",
                          boxShadow:
                            "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                        }}
                        /* cursor overridden */
                        itemSorter={(item) => {
                          const getOrder = (mId: string) => {
                            switch (mId) {
                              case "Inward to Payment Cycle Days":
                                return 0;
                              case "Bill Process Days":
                                return 1;
                              case "Site Days":
                                return 2;
                              case "HO Days":
                                return 2;
                              case "Account Days":
                                return 2;
                              case "Bill Amount (Net Payble)":
                                return 3;
                              case "Paid Amount":
                                return 4;
                              case "Balance Payment":
                                return 5;
                              case "count":
                                return 6;
                              default:
                                return 7;
                            }
                          };
                          return getOrder(item.name as string);
                        }}
                        formatter={(value: number, name: string) => {
                          let type = AVAILABLE_METRICS.find(
                            (m) => m.id === name,
                          )?.type;
                          let displayName = getDisplayName(name);
                          if (type === "sum")
                            return [
                              `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                              displayName,
                            ];
                          if (type === "avg")
                            return [
                              value.toLocaleString("en-IN", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }),
                              displayName,
                            ];
                          if (type === "count")
                            return [
                              value.toLocaleString("en-IN", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }),
                              displayName,
                            ];
                          return [
                            value.toLocaleString("en-IN", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }),
                            displayName,
                          ];
                        }}
                      />

                      {renderMetrics.map((mId, i) => {
                        const { stroke, type } = getMetricStyling(
                          mId,
                          i,
                          "line",
                        );
                        const isHidden = hiddenMetrics.includes(mId);
                        return (
                          <Line
                            key={mId}
                            yAxisId={type}
                            type="monotone"
                            dataKey={mId}
                            stroke={stroke}
                            strokeWidth={2}
                            hide={isHidden}
                          />
                        );
                      })}
                    </LineChart>
                  ) : chartType === "area" ? (
                    <AreaChart
                      data={currentLevelData.filter(
                        (child: any) => !hiddenCategories.includes(child.name),
                      )}
                      margin={{ top: 35, right: 60, left: 10, bottom: 45 }}
                      onClick={(state: any) => {
                        if (state && state.activeLabel) {
                          handleChartClick(state.activeLabel);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f3f4f6"
                      />
                      <XAxis
                        dataKey="name"
                        tick={(props) => (
                          <PivotXAxisTick
                            {...props}
                            chartData={currentLevelData.filter(
                              (child: any) =>
                                !hiddenCategories.includes(child.name),
                            )}
                          />
                        )}
                        interval={0}
                      />
                      {activeTypes.includes("avg") && (                         <YAxis                           yAxisId="avg"                           orientation={getYAxisOrientation("avg")}                           hide={_getYHide("avg")}
                          tickFormatter={(v) =>
                            v.toLocaleString("en-IN", {
                              minimumIntegerDigits: 1,
                              maximumFractionDigits: 1,
                            })
                          }
                          tick={{
                            fontSize: 10,
                            fontWeight: "bold",
                            fill: "#6B7280",
                          }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "Days",
                            angle: -90,
                            position: "insideLeft",
                            offset: 5,
                            style: {
                              fontSize: 10,
                              fontWeight: "bold",
                              fill: "#4B5563",
                            },
                          }}
                          width={50}
                        />
                      )}
                      {activeTypes.includes("count") && (                         <YAxis                           yAxisId="count"                           orientation={getYAxisOrientation("count")}                           hide={_getYHide("count")}
                          tickFormatter={(v) =>
                            v.toLocaleString("en-IN", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })
                          }
                          tick={{
                            fontSize: 10,
                            fontWeight: "bold",
                            fill: "#6B7280",
                          }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "No. of Bills",
                            angle: 90,
                            position: "insideRight",
                            offset: 5,
                            style: {
                              fontSize: 10,
                              fontWeight: "bold",
                              fill: "#4B5563",
                            },
                          }}
                          width={50}
                        />
                      )}
                      {activeTypes.includes("sum") && (                         <YAxis                           yAxisId="sum"                           orientation={getYAxisOrientation("sum")}                           hide={_getYHide("sum")}
                          tickFormatter={(v) =>
                            `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 0 })}L`
                          }
                          tick={{
                            fontSize: 10,
                            fontWeight: "bold",
                            fill: "#6B7280",
                          }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "Amount",
                            angle: 90,
                            position: "insideRight",
                            offset: 5,
                            style: {
                              fontSize: 10,
                              fontWeight: "bold",
                              fill: "#4B5563",
                            },
                          }}
                          width={50}
                        />
                      )}
                      <Tooltip wrapperStyle={{ zIndex: 100 }}
                        contentStyle={{
                          fontSize: "11px",
                          borderRadius: "8px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #e5e7eb",
                          boxShadow:
                            "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                        }}
                        /* cursor overridden */
                        itemSorter={(item) => {
                          const getOrder = (mId: string) => {
                            switch (mId) {
                              case "Inward to Payment Cycle Days":
                                return 0;
                              case "Bill Process Days":
                                return 1;
                              case "Site Days":
                                return 2;
                              case "HO Days":
                                return 2;
                              case "Account Days":
                                return 2;
                              case "Bill Amount (Net Payble)":
                                return 3;
                              case "Paid Amount":
                                return 4;
                              case "Balance Payment":
                                return 5;
                              case "count":
                                return 6;
                              default:
                                return 7;
                            }
                          };
                          return getOrder(item.name as string);
                        }}
                        formatter={(value: number, name: string) => {
                          let type = AVAILABLE_METRICS.find(
                            (m) => m.id === name,
                          )?.type;
                          let displayName = getDisplayName(name);
                          if (type === "sum")
                            return [
                              `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                              displayName,
                            ];
                          if (type === "avg")
                            return [
                              value.toLocaleString("en-IN", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }),
                              displayName,
                            ];
                          if (type === "count")
                            return [
                              value.toLocaleString("en-IN", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }),
                              displayName,
                            ];
                          return [
                            value.toLocaleString("en-IN", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }),
                            displayName,
                          ];
                        }}
                      />

                      {renderMetrics.map((mId, i) => {
                        const { fill, stackId, fillOpacity, stroke, type } =
                          getMetricStyling(mId, i, "area");
                        const isHidden = hiddenMetrics.includes(mId);
                        return (
                          <Area
                            key={mId}
                            yAxisId={type}
                            stackId={stackId}
                            type="monotone"
                            dataKey={mId}
                            fill={fill}
                            stroke={stroke}
                            fillOpacity={fillOpacity}
                            hide={isHidden}
                          />
                        );
                      })}
                    </AreaChart>
                  ) : null;
                  };

                  const isCartesian = chartType === "bar" || chartType === "line" || chartType === "area";
                  const hasLeftAxis = activeTypes.length > 0;
                  const hasRightAxis = activeTypes.length > 1;
                  const numItems = currentLevelData.filter((c: any) => !hiddenCategories.includes(c.name)).length;
                  const chartWidth = Math.max(numItems * 40, 800);

                  const legendNode = (
                    <div className="absolute top-2 right-2 z-[100] flex flex-col items-end gap-1.5 pointer-events-none">
                      {isCartesian ? (
                          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 px-0 w-auto pointer-events-auto">
                            {allSelectedMetrics.map((id, index) => {
                              const isHidden = hiddenMetrics.includes(id);
                              const displayName = getDisplayName(id);
                              const styling = getMetricStyling(id, index, "bar");
                              const color = styling.fill;
                              let opacity = styling.fillOpacity || 1;
                              if (id === "Bill Amount (Net Payble)") opacity = 0.3;
                              if (id === "Paid Amount" || id === "Balance Payment") opacity = 0.6;
                              if (id === "Inward to Payment Cycle Days") opacity = 0.4;
                              if (id === "Bill Process Days") opacity = 0.7;

                              return (
                                <div
                                  key={`main-leg-${id}`}
                                  className={cn(
                                    "flex items-center gap-1.5 cursor-pointer transition-all",
                                    isHidden ? "opacity-30 grayscale-[0.5]" : "hover:opacity-80"
                                  )}
                                  onClick={() => toggleMetricVisibility(id)}
                                >
                                  <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: color, opacity: isHidden ? 0.3 : opacity }}
                                  ></div>
                                  <span className={cn("text-[9px] font-bold uppercase tracking-wider", isHidden ? "text-[#9CA3AF] line-through" : "text-[#4B5563]")}>
                                    {displayName}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                      ) : (
                          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 px-0 w-auto pointer-events-auto">
                             {(() => {
                                const itemsToRender: { name: string; color: string }[] = [];
                                if (isPieOfPieVariant) {
                                  fullPrimaryPies.forEach((slice, idx) => {
                                    const color = ["#3b82f6", "#8b5cf6", "#10b981", "#f97316", "#ef4444", "#ca8a04", "#0d9488"][idx % 7];
                                    itemsToRender.push({ name: slice.name, color });
                                  });
                                  fullSecondaryPies.forEach((slice, idx) => {
                                    const color = ["#60a5fa", "#a78bfa", "#34d399", "#f87171", "#fef08a", "#2dd4bf", "#fb923c"][idx % 7];
                                    itemsToRender.push({ name: `${slice.name} (Sub)`, color });
                                  });
                                } else {
                                  sortedFullData.forEach((child: any, index: number) => {
                                    const color = ["#3b82f6", "#8b5cf6", "#10b981", "#f97316", "#ef4444", "#eab308", "#0d9488"][index % 7];
                                    itemsToRender.push({ name: child.name, color });
                                  });
                                }

                                return itemsToRender.map((item, index) => {
                                  const rawName = item.name.replace(" (Sub)", "");
                                  const isHidden = hiddenCategories.includes(rawName);
                                  return (
                                    <div
                                      key={`pie-main-leg-${item.name}-${index}`}
                                      className={cn("flex items-center gap-1.5 cursor-pointer transition-all", isHidden ? "opacity-30 grayscale-[0.5]" : "hover:opacity-80")}
                                      onClick={() => toggleCategoryVisibility(rawName)}
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                                      <span className={cn("text-[9px] font-bold uppercase tracking-wider", isHidden ? "text-[#9CA3AF] line-through" : "text-[#4B5563]")}>
                                        {item.name}
                                      </span>
                                    </div>
                                  );
                                });
                             })()}
                          </div>
                      )}
                   </div>
                  );

                  if (isCartesian) {
                    return (
                      <>
                        {legendNode}
                        <div className="relative h-full w-full flex bg-transparent overflow-hidden pivot-cartesian-container" style={pageId === 'tat' ? { height: '320px' } : undefined}>
                          <div className="flex-1 overflow-x-auto overflow-y-hidden bg-transparent custom-scrollbar-horizontal h-full" style={pageId === 'tat' ? { height: '320px' } : undefined}>
                            <div style={{ minWidth: numItems > 15 ? `${numItems * 40}px` : '100%', height: pageId === 'tat' ? '320px' : '100%', marginBottom: '5px' }}>
                              <ResponsiveContainer width="100%" height={pageId === 'tat' ? 320 : "100%"}>
                                {renderCartesian("center")}
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  }

                  return chartType === "pie" ||
                    chartType === "donut" ||
                    chartType === "pieOfPie" ||
                    chartType === "donutOfDonut" ? (
                    <>
                      {legendNode}
                      {(() => {
                      const R1 = 110;
                      const R2 = 75;
                      let primaryStartAngle = 0;
                      let primaryEndAngle = 360;
                      let dx1 = R1;
                      let dy1 = 0;
                      let dx1Prime = R1;
                      let dy1Prime = 0;

                      if (isPieOfPieVariant && secondaryPies.length > 0) {
                        const secondarySum = secondaryPies.reduce(
                          (acc: number, current: any) =>
                            acc + (Number(current[chartMetric]) || 0),
                          0,
                        );
                        const totalPieSumVal = primaryPies.reduce(
                          (acc: number, current: any) =>
                            acc + (Number(current[chartMetric]) || 0),
                          0,
                        );
                        const othersRatio =
                          totalPieSumVal > 0
                            ? secondarySum / totalPieSumVal
                            : 0;
                        const othersAngle = othersRatio * 360; // in degrees

                        primaryStartAngle = 360 - othersAngle / 2;
                        primaryEndAngle = -othersAngle / 2;

                        const halfAngleRad =
                          ((othersAngle / 2) * Math.PI) / 180;
                        dx1 = R1 * Math.cos(halfAngleRad);
                        dy1 = -R1 * Math.sin(halfAngleRad);
                        dx1Prime = R1 * Math.cos(halfAngleRad);
                        dy1Prime = R1 * Math.sin(halfAngleRad);
                      }

                      return (
                        <ResponsiveContainer width="100%" height={pageId === 'tat' ? 320 : "100%"}>
                        <RePieChart margin={{ top: 40, right: 40, left: 40, bottom: 40 }}>
                          {isPieOfPieVariant ? (
                            <Pie
                              id="primary-pie-element"
                              data={primaryPies}
                              dataKey={chartMetric}
                              nameKey="name"
                              cx="28%"
                              cy="50%"
                              innerRadius={chartType === "donutOfDonut" ? 55 : 0}
                              outerRadius={110}
                              startAngle={primaryStartAngle}
                              endAngle={primaryEndAngle}
                              fill="#3b82f6"
                              label={renderCustomizedLabel}
                              onClick={(data: any) => {
                                if (data && data.name) {
                                  handleChartClick(data.name);
                                }
                              }}
                              className="cursor-pointer"
                            >
                              {primaryPies.map(
                                (entry: any, index: number) => {
                                  const colorIndex = entry.isOthers
                                    ? -1
                                    : fullPrimaryPies.findIndex(
                                        (d) => d.name === entry.name,
                                      );
                                  const color = entry.isOthers
                                    ? "#6b7280"
                                    : [
                                        "#3b82f6",
                                        "#8b5cf6",
                                        "#10b981",
                                        "#f97316",
                                        "#ef4444",
                                        "#ca8a04",
                                        "#0d9488",
                                      ][
                                        colorIndex !== -1
                                          ? colorIndex % 7
                                          : index % 7
                                      ];
                                  return (
                                    <Cell
                                      key={`cell-p-${index}`}
                                      id={`cell-p-${index}`}
                                      fill={color}
                                    />
                                  );
                                },
                              )}
                            </Pie>
                          ) : (
                            /* Standard Pie / Donut (Centered and Smaller) */
                            <Pie
                              id="standard-pie-element"
                              data={pieDataForChart}
                              dataKey={chartMetric}
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={chartType === "donut" ? 55 : 0}
                              outerRadius={110}
                              fill="#f97316"
                              label={renderCustomizedLabel}
                              onClick={(data: any) => {
                                if (data && data.name) {
                                  handleChartClick(data.name);
                                }
                              }}
                              className="cursor-pointer"
                            >
                              {pieDataForChart.map(
                                (entry: any, index: number) => {
                                  const colorIndex = sortedFullData.findIndex(
                                    (d) => d.name === entry.name,
                                  );
                                  const color = [
                                    "#3b82f6",
                                    "#8b5cf6",
                                    "#10b981",
                                    "#f97316",
                                    "#ef4444",
                                    "#eab308",
                                    "#0d9488",
                                  ][
                                    colorIndex !== -1
                                      ? colorIndex % 7
                                      : index % 7
                                  ];
                                  return (
                                    <Cell key={`cell-${index}`} id={`cell-${index}`} fill={color} />
                                  );
                                },
                              )}
                            </Pie>
                          )}

                          {isPieOfPieVariant && secondaryPies.length > 0 && (
                            <Pie
                              id="secondary-pie-element"
                              data={secondaryPies}
                              dataKey={chartMetric}
                              nameKey="name"
                              cx="74%"
                              cy="50%"
                              innerRadius={
                                chartType === "donutOfDonut" ? 55 : 0
                              }
                              outerRadius={78}
                              fill="#10b981"
                              label={renderCustomizedLabel}
                              onClick={(data: any) => {
                                if (data && data.name) {
                                  handleChartClick(data.name);
                                }
                              }}
                              className="cursor-pointer"
                            >
                              {secondaryPies.map(
                                (entry: any, index: number) => {
                                  const colorIndex =
                                    fullSecondaryPies.findIndex(
                                      (d) => d.name === entry.name,
                                    );
                                  const color = [
                                    "#60a5fa",
                                    "#a78bfa",
                                    "#34d399",
                                    "#f87171",
                                    "#fef08a",
                                    "#2dd4bf",
                                    "#fb923c",
                                  ][
                                    colorIndex !== -1
                                      ? colorIndex % 7
                                      : index % 7
                                  ];
                                  return (
                                    <Cell
                                      key={`cell-s-${index}`}
                                      id={`cell-s-${index}`}
                                      fill={color}
                                    />
                                  );
                                },
                              )}
                            </Pie>
                          )}

                          <Tooltip wrapperStyle={{ zIndex: 100 }}
                            contentStyle={{
                              fontSize: "11px",
                              borderRadius: "8px",
                              backgroundColor: "#ffffff",
                              border: "1px solid #e5e7eb",
                              boxShadow:
                                "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                            }}
                            formatter={(value: number, name: string) => {
                              let type = AVAILABLE_METRICS.find(
                                (m) => m.id === chartMetric,
                              )?.type;
                              let displayName = getDisplayName(name);
                              if (type === "sum")
                                return [
                                  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                                  displayName,
                                ];
                              if (type === "avg")
                                return [
                                  value.toLocaleString("en-IN", {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  }),
                                  displayName,
                                ];
                              if (type === "count")
                                return [
                                  value.toLocaleString("en-IN", {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  }),
                                  displayName,
                                ];
                              return [
                                value.toLocaleString("en-IN", {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                }),
                                displayName,
                              ];
                            }}
                          />


                          {isPieOfPieVariant && secondaryPies.length > 0 && (
                            <Customized
                              key="connection-arrow"
                              component={({ width = 1200, height = 420 }: any) => {
                                const cx1 = width * 0.28;
                                const cx2 = width * 0.74;
                                const cy = height * 0.505;

                                // Match pie radii
                                const mainRadius = 110;
                                const childRadius = 78;

                                // Shorter arrow
                                const startX = cx1 + mainRadius + 40;
                                const endX = cx2 - childRadius - 40;

                                const arrowHeight = 32;
                                const headWidth = 28;

                                const topY = cy - arrowHeight / 2;
                                const bottomY = cy + arrowHeight / 2;

                                return (
                                  <g style={{ pointerEvents: "none" }}>
                                    {/* Shadow */}
                                      <polygon
                                        points={`
                                          ${startX},${topY + 4}
                                          ${endX - headWidth},${topY + 4}
                                          ${endX - headWidth},${topY - 14 + 4}
                                          ${endX},${cy + 4}
                                          ${endX - headWidth},${bottomY + 14 + 4}
                                          ${endX - headWidth},${bottomY + 4}
                                          ${startX},${bottomY + 4}
                                        `}
                                        fill="#94a3b8"
                                        opacity={0.18}
                                      />

                                      {/* Arrow */}
                                      <polygon
                                        points={`
                                          ${startX},${topY}
                                          ${endX - headWidth},${topY}
                                          ${endX - headWidth},${topY - 14}
                                          ${endX},${cy}
                                          ${endX - headWidth},${bottomY + 14}
                                          ${endX - headWidth},${bottomY}
                                          ${startX},${bottomY}
                                        `}
                                        fill="#d4d4d8"
                                      />

                                      {/* Text */}
                                      <text
                                        x={(startX + endX) / 2}
                                        y={cy + 5}
                                        textAnchor="middle"
                                        fontSize="14"
                                        fontWeight="700"
                                        fill="#ffffff"
                                        style={{
                                          textShadow: "0px 1px 1px rgba(0,0,0,0.5)",
                                          letterSpacing: "0.2px",
                                        }}
                                      >
                                        OTHERS
                                      </text>
                                  </g>
                                );
                              }}
                            />
                          )}
                        </RePieChart>
                        </ResponsiveContainer>
                      );
                    })()}
                    </>
                  ) : (
                    <div />
                  );
                })()}
              </div>
              {pageId === 'tat' && (
                <div 
                  className="h-3.5 bg-slate-100 hover:bg-slate-200 cursor-ns-resize flex items-center justify-center border-t border-gray-200 select-none transition-all w-full shrink-0 rounded-b-lg"
                  onMouseDown={handleChartResizeMouseDown}
                  title="Drag to resize pivot chart"
                >
                  <div className="w-12 h-1 bg-gray-400 rounded-full" />
                </div>
              )}
            </div>
          )}
          
      {(activeView === 'table' || activeView === 'both') && !isChartLoading && processedData.tree.children &&
        processedData.tree.children.length > 0 &&
        selectedRows.length > 0 && (
          <div 
            className={cn("relative border border-gray-200 rounded-xl bg-white flex flex-col mx-0 mt-0 mb-0 shadow-sm p-px flex-1 min-h-0", activeView === 'both' ? (pageId === 'tat' ? "order-1 mt-0" : "order-1 mt-2") : "")}
            style={pageId === 'tat' ? {
              paddingLeft: '1px',
              paddingRight: '1px',
              paddingTop: '1px',
              paddingBottom: '0px',
              height: `${tableHeight}px`,
              marginBottom: '0px',
              marginTop: '0px'
            } : {
              paddingLeft: '1px',
              paddingRight: '1px',
              paddingTop: '1px',
              paddingBottom: '1px'
            }}
          >
            {/* Top Horizontal Scrollbar (above headers) */}
            <div 
              ref={topScrollRef}
              className="overflow-x-auto overflow-y-hidden custom-scrollbar pivot-scrollbar bg-slate-50 select-none w-full border-b border-gray-200"
              style={{
                height: "10px",
                display: (activeView === 'table' || activeView === 'both') && scrollWidth > clientWidth ? "block" : "none"
              }}
            >
              <div style={{ width: `${scrollWidth}px`, height: "1px" }} />
            </div>

        <div 
          ref={bottomScrollRef}
          className={cn(
            "overflow-auto custom-scrollbar pivot-scrollbar relative flex-1 min-h-0 p-0",
            computedColumnField && processedData.columnKeys.length > 0 ? "scroll-top-double" : "scroll-top-single"
          )}
          style={{
            padding: '0px'
          }}
        >
          {(() => (
            <table id="pivot-table-element" className="w-max min-w-full text-left border-collapse pivot-table table-fixed">
              <thead className={cn("sticky top-0 z-20 shadow-sm shadow-slate-350/55", isTrackingSheet ? (isHoldActive ? 'bg-red-200 text-red-955' : trackingTab === 'site' ? 'bg-amber-100' : trackingTab === 'ho' ? 'bg-blue-200' : trackingTab === 'accounts' ? 'bg-cyan-200' : trackingTab === 'paid' ? 'bg-green-200 text-green-955' : trackingTab === 'all' ? 'bg-slate-300 text-slate-955 border-b-2 border-slate-300' : 'bg-slate-200') : 'bg-slate-200')}>
            {computedColumnField && processedData.columnKeys.length > 0 && (
              <tr className="border-b border-gray-300 text-center">
                <th rowSpan={2} className={cn("py-0.5 px-3 align-bottom sticky left-0 z-30 border-r border-b-0 border-gray-300 shadow-[inset_0_-1px_0_0_#cbd5e1] w-[280px] min-w-[280px] max-w-[280px] box-border overflow-hidden", getTrackingHeaderBg('corner'))} style={{ left: 0, width: '280px', minWidth: '280px', maxWidth: '280px', boxSizing: 'border-box' }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-slate-300 text-slate-900 absolute top-2 right-2 z-40"
                    title="Expand/Collapse All Columns"
                    onClick={() => {
                      const allCollapsed = processedData.columnKeys.every(ck => collapsedCols[ck]);
                      const newCollapsedCols: Record<string, boolean> = {};
                      processedData.columnKeys.forEach(ck => newCollapsedCols[ck] = !allCollapsed);
                      setCollapsedCols(newCollapsedCols);
                    }}
                  >
                     {processedData.columnKeys.every(ck => collapsedCols[ck]) ? <ChevronRight className="w-4 h-4 text-slate-955" /> : <ChevronDown className="w-4 h-4 text-slate-955" />}
                  </Button>
                  <div className="w-[256px] max-w-[256px] overflow-hidden flex flex-col h-full justify-between gap-1">
                    <div className="flex justify-start pt-0.5">
                      <Popover open={isExportOpen1} onOpenChange={setIsExportOpen1}>
                        <PopoverTrigger className="h-6 text-[10px] px-2 py-0 border border-slate-305 bg-white hover:bg-gray-100 text-gray-750 flex items-center gap-1 shadow-sm font-semibold rounded-lg cursor-pointer transition-all">
                           <FileDown className="w-3.5 h-3.5 text-gray-650" /> Export / Print <ChevronDown className="w-3 h-3 text-gray-500" />
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-36 p-1 bg-white border border-gray-200 rounded-lg shadow-md z-[110] flex flex-col gap-1">
                           <button 
                            onClick={() => {
                              exportToExcel();
                              setIsExportOpen1(false);
                            }}
                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                          </button>
                          <button 
                            onClick={() => {
                              exportToPDF();
                              setIsExportOpen1(false);
                            }}
                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5 text-red-600" /> Export PDF
                          </button>
                          <button 
                            onClick={() => {
                              printTable();
                              setIsExportOpen1(false);
                            }}
                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-blue-600" /> Print Table
                          </button>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center justify-between group mt-1">
                       <span className="text-xs font-bold text-slate-800 uppercase tracking-widest whitespace-nowrap">
                        Expanded At
                      </span>
                      <Select
                        value={String(expansionLevel)}
                        onValueChange={(v) => {
                          setExpansionLevel(Number(v));
                          setExpandedNodes({});
                        }}
                      >
                        <SelectTrigger className="h-6 w-auto min-w-[60px] text-xs bg-transparent border-none shadow-none font-bold uppercase tracking-widest text-slate-900 px-1 focus:ring-0">
                          <SelectValue>
                            {expansionLevel === 0
                              ? "None"
                              : expansionLevel === 10
                                ? "All"
                                : rowsToUse[expansionLevel - 1] || "Select Level"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="text-xs">None</SelectItem>
                          {rowsToUse.map((rowName, idx) => (
                            <SelectItem key={rowName} value={String(idx + 1)} className="text-xs">{rowName}</SelectItem>
                          ))}
                          <SelectItem value="10" className="text-xs">All</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-slate-200 text-slate-950 ml-1"
                        title="Expand/Collapse All Rows"
                        onClick={() => {
                          const allCollapsed = expansionLevel === 0;
                          setExpansionLevel(allCollapsed ? 10 : 0);
                          setExpandedNodes({});
                        }}
                      >
                        {expansionLevel === 10 ? <ChevronDown className="w-4 h-4 text-slate-955" /> : <ChevronRight className="w-4 h-4 text-slate-955" />}
                      </Button>
                    </div>
                  </div>
                </th>
                {selectedExtraColumns.map((col) => {
                  const isCompact = isCompactColumn(col);
                  const compactW = isCompact ? getCompactWidth(col) : "w-[140px] max-w-[140px]";
                  return (
                    <th 
                      key={col} 
                      rowSpan={2} 
                      className={cn(
                        "group py-0.5 text-[10px] font-bold uppercase tracking-tighter border-r border-gray-300 shadow-[inset_0_-1px_0_0_#cbd5e1] text-left whitespace-normal break-words leading-tight align-middle relative", 
                        isCompact ? "px-1" : "px-3",
                        compactW,
                        getTrackingHeaderBg('extra')
                      )}
                      title={col}
                    >
                      <div className="flex items-center justify-between gap-1 w-full relative h-full">
                        <span className={cn("flex-1 break-words leading-tight", isCompact ? "pr-1" : "pr-4")}>{col}</span>
                        <PivotInlineFilter 
                          field={col} 
                          allData={allData} 
                          data={data}
                          selected={pivotInlineFilters[col] || []}
                          onChange={(vals) => handleInlineFilterChange(col, vals)}
                          constraints={effectiveConstraints}
                        />
                      </div>
                    </th>
                  );
                })}
                {processedData.columnKeys.map((ck) => (
                  <th
                    key={ck}
                    colSpan={collapsedCols[ck] ? 1 : allSelectedMetrics.length}
                    className={cn("group relative py-0.5 px-2 text-[12px] font-bold border-l border-gray-300 cursor-pointer transition-colors", getTrackingHeaderBg('column'))}
                    onClick={() => {
                      setCollapsedCols(prev => ({ ...prev, [ck]: !prev[ck] }));
                    }}
                  >
                    <div className="absolute top-1 right-1" onClick={(e) => e.stopPropagation()}>
                      {computedColumnField && (
                        <PivotInlineFilter 
                          field={computedColumnField} 
                          allData={allData} 
                          data={data}
                          selected={pivotInlineFilters[computedColumnField] || []}
                          onChange={(vals) => handleInlineFilterChange(computedColumnField, vals)}
                          constraints={effectiveConstraints}
                        />
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1 p-0.5 min-h-0">
                      <span className="p-0.5 hover:bg-black/5 rounded leading-none">
                        {collapsedCols[ck] ? <ChevronRight className="w-3.5 h-3.5 text-blue-900" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-900" />}
                      </span>
                      <span className="text-[11px] font-bold whitespace-normal break-words tracking-tight text-center block w-full leading-tight pr-2">
                        {ck}
                      </span>
                    </div>
                  </th>
                ))}
                <th
                  colSpan={allSelectedMetrics.length}
                  className={cn("py-0.5 px-3 text-[12px] font-bold uppercase tracking-widest border-l border-gray-300 cursor-pointer", getTrackingHeaderBg('total'))}
                  onClick={() => {
                    const allCollapsed = processedData.columnKeys.every(ck => collapsedCols[ck]);
                    const newCollapsedCols: Record<string, boolean> = {};
                    processedData.columnKeys.forEach(ck => newCollapsedCols[ck] = !allCollapsed);
                    setCollapsedCols(newCollapsedCols);
                  }}
                >
                  <div className="flex items-center gap-1 justify-center">
                     {processedData.columnKeys.every(ck => collapsedCols[ck]) ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                     Total
                  </div>
                </th>
              </tr>
            )}
            <tr className={cn("border-b border-gray-300 border-t-0", 
               isTrackingSheet ? (
                isHoldActive ? 'bg-red-200 text-red-955' : 
                trackingTab === 'site' ? 'bg-[#f4ebd0] font-bold' : 
                trackingTab === 'ho' ? 'bg-blue-105 font-bold' : 
                trackingTab === 'accounts' ? 'bg-cyan-105 font-bold' : 
                trackingTab === 'paid' ? 'bg-green-200 text-green-955' :
                trackingTab === 'all' ? 'bg-slate-200 text-slate-900 border-t-2 border-slate-300 font-bold' :
                'bg-slate-200 font-bold'
              ) : 'bg-slate-200'
            )}>
              {!computedColumnField && (
                <th className={cn("py-0.5 px-3 align-bottom sticky left-0 z-30 border-r border-gray-300 w-[280px] min-w-[280px] max-w-[280px] box-border overflow-hidden", getTrackingHeaderBg('corner'))} style={{ left: 0, width: '280px', minWidth: '280px', maxWidth: '280px', minHeight: '60px', boxSizing: 'border-box' }}>
                  <div className="w-[256px] max-w-[256px] overflow-hidden flex flex-col h-full justify-end gap-1">
                    <div className="flex justify-start pt-0.5">
                      <Popover open={isExportOpen2} onOpenChange={setIsExportOpen2}>
                        <PopoverTrigger className="h-6 text-[10px] px-2 py-0 border border-slate-305 bg-white hover:bg-gray-100 text-gray-750 flex items-center gap-1 shadow-sm font-semibold rounded-lg cursor-pointer transition-all">
                          <FileDown className="w-3.5 h-3.5 text-gray-650" /> Export / Print <ChevronDown className="w-3 h-3 text-gray-500" />
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-36 p-1 bg-white border border-gray-200 rounded-lg shadow-md z-[110] flex flex-col gap-1">
                          <button 
                            onClick={() => {
                              exportToExcel();
                              setIsExportOpen2(false);
                            }}
                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                          </button>
                          <button 
                            onClick={() => {
                              exportToPDF();
                              setIsExportOpen2(false);
                            }}
                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5 text-red-600" /> Export PDF
                          </button>
                          <button 
                            onClick={() => {
                              printTable();
                              setIsExportOpen2(false);
                            }}
                            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-blue-600" /> Print Table
                          </button>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center justify-between group mt-1">
                       <span className="text-xs font-bold text-slate-850 uppercase tracking-widest whitespace-nowrap">
                        Expanded At
                      </span>
                      <Select
                        value={String(expansionLevel)}
                        onValueChange={(v) => {
                          setExpansionLevel(Number(v));
                          setExpandedNodes({});
                        }}
                      >
                        <SelectTrigger className="h-6 w-auto min-w-[60px] text-xs bg-transparent border-none shadow-none font-bold uppercase tracking-widest text-slate-900 px-1 focus:ring-0">
                          <SelectValue>
                            {expansionLevel === 0
                              ? "None"
                              : expansionLevel === 10
                                ? "All"
                                : rowsToUse[expansionLevel - 1] || "Select Level"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0" className="text-xs">None</SelectItem>
                          {rowsToUse.map((rowName, idx) => (
                            <SelectItem key={rowName} value={String(idx + 1)} className="text-xs">{rowName}</SelectItem>
                          ))}
                          <SelectItem value="10" className="text-xs">All</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-slate-200 text-slate-950 ml-1"
                        title="Expand/Collapse All Rows"
                        onClick={() => {
                          const allCollapsed = expansionLevel === 0;
                          setExpansionLevel(allCollapsed ? 10 : 0);
                          setExpandedNodes({});
                        }}
                      >
                        {expansionLevel === 10 ? <ChevronDown className="w-4 h-4 text-slate-955" /> : <ChevronRight className="w-4 h-4 text-slate-955" />}
                      </Button>
                    </div>
                  </div>
                </th>
              )}
              {!computedColumnField && selectedExtraColumns.map((col) => {
                const isCompact = isCompactColumn(col);
                const compactW = isCompact ? getCompactWidth(col) : "w-[140px] max-w-[140px]";
                return (
                  <th 
                    key={col} 
                    className={cn(
                      "group py-0.5 text-[10px] font-bold uppercase tracking-tighter border-r border-gray-300 shadow-[inset_0_-1px_0_0_#cbd5e1] text-left whitespace-normal break-words leading-tight align-middle relative", 
                      isCompact ? "px-1" : "px-3",
                      compactW,
                      getTrackingHeaderBg('extra')
                    )}
                    title={col}
                  >
                    <div className="flex items-center justify-between gap-1 w-full relative h-full">
                      <span className={cn("flex-1 break-words leading-tight", isCompact ? "pr-1" : "pr-4")}>{col}</span>
                      <PivotInlineFilter 
                        field={col} 
                        allData={allData} 
                        data={data}
                        selected={pivotInlineFilters[col] || []}
                        onChange={(vals) => handleInlineFilterChange(col, vals)}
                        constraints={effectiveConstraints}
                      />
                    </div>
                  </th>
                );
              })}
              {computedColumnField && processedData.columnKeys.map((ck) => {
                if (collapsedCols[ck]) {
                  return (
                    <th
                      key={`${ck}-empty`}
                      className={cn("py-0.5 px-3 border-l border-gray-300", getTrackingHeaderBg('metric'))}
                    ></th>
                  );
                }
                return allSelectedMetrics.map((mId) => (
                  <th
                    key={`${ck}-${mId}`}
                    className={cn("py-0.5 px-2 text-[11px] text-right font-bold uppercase tracking-wider whitespace-normal leading-tight w-[90px] max-w-[90px] border-l border-gray-250 first:border-l-0", getTrackingHeaderBg('metric'))}
                  >
                    {getDisplayName(mId)}
                  </th>
                ));
              })}
              {allSelectedMetrics.map((mId) => {
                const mDef = AVAILABLE_METRICS.find((m) => m.id === mId) || { id: mId, type: "sum", label: mId };
                return (
                  <th
                    key={`total-${mId}`}
                    className={cn("py-0.5 px-2 text-[11px] text-right font-bold uppercase tracking-wider whitespace-normal leading-tight w-[100px] max-w-[100px] border-l border-gray-300", computedColumnField ? (getTrackingHeaderBg('total') + " border-b border-gray-300") : getTrackingHeaderBg('corner'))}
                  >
                    {getDisplayName(mId)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {processedData.tree.children && processedData.tree.children.length > 0 ? (
              processedData.tree.children.map((child: any) => renderTree(child, 0))
            ) : (
              <tr>
                <td
                  colSpan={allSelectedMetrics.length + 1 + selectedExtraColumns.length}
                  className="py-8 text-center text-xs text-gray-400 font-medium"
                >
                  No rows selected or no data available.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className={cn("sticky bottom-0 z-20 border-t-2 border-gray-400 font-bold", getTrackingRowBg(0, false, true))}>
            <tr className={cn("border-b border-gray-100 hover:bg-black/5 transition-colors group", getTrackingRowBg(0, false, true))}>
              <td 
                className={cn("py-0.5 px-3 text-[13px] sticky bottom-0 left-0 z-35 border-r border-gray-200 font-bold whitespace-nowrap w-[280px] min-w-[280px] max-w-[280px] truncate box-border overflow-hidden text-gray-900", getTrackingRowBg(0, false, true))} 
                style={{ bottom: 0, left: 0, width: '280px', minWidth: '280px', maxWidth: '280px', paddingLeft: '10px', boxSizing: 'border-box' }}
              >
                Grand Total
              </td>
              {selectedExtraColumns.map((col) => {
                const isCompact = isCompactColumn(col);
                const compactW = isCompact ? getCompactWidth(col) : "w-[140px] max-w-[140px]";
                return (
                  <td 
                    key={`footer-extra-${col}`} 
                    className={cn(
                      "py-0.5 border-r border-gray-150 whitespace-nowrap overflow-hidden sticky bottom-0 z-20", 
                      isCompact ? "px-1" : "px-3",
                      compactW,
                      getTrackingRowBg(0, false, true)
                    )}
                    style={{ bottom: 0 }}
                  ></td>
                );
              })}
              {computedColumnField && processedData.columnKeys.map((ck) => {
                if (collapsedCols[ck]) return <td key={`${ck}-empty`} className={cn("py-0.5 px-3 border-l border-gray-200 sticky bottom-0 z-20", getTrackingRowBg(0, false, true))} style={{ bottom: 0 }}></td>;
                return allSelectedMetrics.map((mId) => {
                  const mDef = AVAILABLE_METRICS.find((m) => m.id === mId) || { id: mId, type: "sum", label: mId };
                  const val = processedData.tree.cols && processedData.tree.cols[ck] ? processedData.tree.cols[ck][mId] : 0;
                  return (
                    <td 
                      key={`footer-${ck}-${mId}`} 
                      className={cn("py-0.5 px-2 text-right text-[12px] font-mono whitespace-nowrap border-l border-gray-200 text-gray-900 w-[90px] max-w-[90px] overflow-hidden sticky bottom-0 z-20", getTrackingRowBg(0, false, true))}
                      style={{ bottom: 0 }}
                    >
                      {formatVal(val, mDef)}
                    </td>
                  );
                });
              })}
              {allSelectedMetrics.map((mId) => {
                const mDef = AVAILABLE_METRICS.find((m) => m.id === mId) || { id: mId, type: "sum", label: mId };
                const val = mId === "count" ? processedData.tree.count : processedData.tree[mId];
                return (
                  <td 
                    key={`footer-total-${mId}`} 
                    className={cn("py-0.5 px-2 text-right text-[12px] font-mono whitespace-nowrap border-l border-gray-300 text-gray-900 w-[100px] max-w-[100px] overflow-hidden sticky bottom-0 z-20", getTrackingRowBg(0, false, true))}
                    style={{ bottom: 0 }}
                  >
                    {formatVal(val, mDef)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      ))()}
            </div>
            {pageId === 'tat' && (
              <div 
                className="h-3.5 bg-slate-100 hover:bg-slate-200 cursor-ns-resize flex items-center justify-center border-t border-gray-200 select-none transition-all w-full shrink-0 rounded-b-xl"
                onMouseDown={handleTableResizeMouseDown}
                title="Drag to resize pivot table"
              >
                <div className="w-12 h-1 bg-gray-400 rounded-full" />
              </div>
            )}
          </div>
      )}
      
      {/* Detail Timeline Overlay Tooltip */}
      {selectedDetailRecords && (
        <DetailTimelineModal
          records={selectedDetailRecords}
          title={detailTitle}
          onClose={() => setSelectedDetailRecords(null)}
        />
      )}

      {isChartLoading && (
        <div className="absolute inset-0 z-[500] bg-white/60 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl shadow-2xl border border-blue-50">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-900">Processing Data</span>
              <span className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-widest">Recalculating Views...</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Control & Scroll Window */}
      <div 
        className="w-full shrink-0 border-t border-gray-200 bg-slate-50 flex flex-col relative z-[45] rounded-b mt-auto"
      >
         {/* Bottom Resizer for the entire Card container */}
         <div 
           className="h-3.5 bg-slate-100 hover:bg-slate-200 cursor-ns-resize flex items-center justify-center border-t border-gray-200 select-none transition-all w-full rounded-b"
           onMouseDown={handleCardResizeMouseDown}
           title="Drag to resize entire report"
         >
           <div className="w-16 h-1 bg-gray-400 rounded-full" />
         </div>
      </div>
    </Card>
  );
})


