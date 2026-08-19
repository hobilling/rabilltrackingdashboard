import React, { useState, useMemo, useContext } from 'react';
import { Search, ChevronDown, ChevronUp, X, Check, Calendar, ChevronRight, Filter, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceRecord } from '../types';
import { format, parseISO, getQuarter, getMonth, getYear } from 'date-fns';
import { AppContext } from '../App';
import { Button } from '@/components/ui/button';

export interface FilterGroup {
  name: string;
  fields: (keyof InvoiceRecord)[];
}

const DATE_FIELDS: (keyof InvoiceRecord)[] = [
  'Inward Date', 'EXCEL Date', 'Highrise RA Date', 'HO Submission Date',
  'Received at HO', 'Certified at HO & Sent to Accounts on',
  'Cheque Recd. At HO Date', 'Cheque Recd. At Site Date'
];

const AMOUNT_FIELDS: (keyof InvoiceRecord)[] = ['Bill Amount (Net Payble)', 'Paid Amount', 'Balance Payment'];

const formatAmount = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    if (isNaN(num)) return val;
    return `₹${new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0,
    }).format(num)}`;
};

export const FILTER_GROUPS: FilterGroup[] = [
  { 
    name: 'Bill Details Fields', 
    fields: [
      'Project', 'Source',
      'Billing Eng Name', 'Work Head', 'LOCATION/Bldg.', 
      'Highrise WO No', 'Highrise RA No', 'Highrise RA Date', 
      'Excel RA Bill NO', 'EXCEL Date', 'Billing Period', 
      'Bill Amount (Net Payble)'
    ] 
  },
  { 
    name: 'Payment Fields', 
    fields: ['Cheque Recd. At HO Date', 'Cheque Recd. At Site Date', 'Paid Amount', 'Cheque No', 'Remark'] 
  },
  { 
    name: 'Site Process Fields', 
    fields: ['Inward Date', 'HO Submission Date'] 
  },
  { 
    name: 'Site Holds Fields', 
    fields: ['Hold at Site', 'Reason For Hold at Site', 'Remark Site'] 
  },
  { 
    name: 'HO Process Fields', 
    fields: ['Received at HO', 'Certified at HO & Sent to Accounts on'] 
  },
  { 
    name: 'HO Holds Fields', 
    fields: ['Hold at HO', 'Reason For Hold at HO', 'Remark HO'] 
  },
];

interface FilterPanelProps {
  data: InvoiceRecord[];
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;
  onClear: () => void;
  onApply?: (filters: Record<string, any>) => void;
  onCancel?: () => void;
}

interface MultiSelectFieldProps {
  key?: string | number;
  field: keyof InvoiceRecord;
  data: InvoiceRecord[];
  selected: string[];
  onChange: (val: string[]) => void;
}

const DateTreeField = ({ field, data, selected, onChange }: MultiSelectFieldProps) => {
    const context = useContext(AppContext);
    const [isOpen, setIsOpen] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

    const tree = useMemo(() => {
        const root: any = {};
        data.forEach(item => {
            const d = item[field];
            if (!d) return;
            try {
                let date = parseISO(String(d));
                if (isNaN(date.getTime())) {
                    date = new Date(String(d));
                }
                if (isNaN(date.getTime())) return;

                const year = getYear(date);
                const month = format(date, 'MMMM');
                const dateStr = String(d);

                if (!root[year]) root[year] = { children: {}, values: [] };
                if (!root[year].children[month]) root[year].children[month] = { children: {}, values: [] };
                
                if (!root[year].children[month].children) {
                    root[year].children[month].children = {};
                }
                if (!root[year].children[month].children[dateStr]) {
                    root[year].children[month].children[dateStr] = { values: [dateStr] };
                }
                
                root[year].values.push(dateStr);
                root[year].children[month].values.push(dateStr);
            } catch (e) {}
        });
        return root;
    }, [data, field]);

    const toggleNode = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const effectiveSelected = useMemo(() => {
        if (context?.ageingDateRange && (context.ageingDateRange.from || context.ageingDateRange.to) && context.ageingBasis === field) {
            const fromDate = context.ageingDateRange.from ? new Date(context.ageingDateRange.from) : null;
            if (fromDate) fromDate.setHours(0,0,0,0);
            const toDate = context.ageingDateRange.to ? new Date(context.ageingDateRange.to) : null;
            if (toDate) toDate.setHours(23,59,59,999);

            const rangeDates: string[] = [];
            data.forEach(item => {
                const d = item[field];
                if (!d) return;
                try {
                    let date = parseISO(String(d));
                    if (isNaN(date.getTime())) {
                        date = new Date(String(d));
                    }
                    if (isNaN(date.getTime())) return;
                    
                    if (fromDate && toDate) {
                        if (date >= fromDate && date <= toDate) {
                            rangeDates.push(String(d));
                        }
                    } else if (fromDate) {
                        if (date >= fromDate) {
                            rangeDates.push(String(d));
                        }
                    } else if (toDate) {
                        if (date <= toDate) {
                            rangeDates.push(String(d));
                        }
                    }
                } catch (e) {}
            });
            return Array.from(new Set([...selected, ...rangeDates]));
        }
        return selected;
    }, [selected, data, field, context?.ageingDateRange, context?.ageingBasis]);

    const isAllSelected = (values: string[]) => values.length > 0 && values.every(v => effectiveSelected.includes(v));
    const isSomeSelected = (values: string[]) => values.some(v => effectiveSelected.includes(v)) && !isAllSelected(values);

    const handleSelect = (values: string[], e: React.MouseEvent) => {
        e.stopPropagation();
        if (context?.ageingDateRange && (context.ageingDateRange.from || context.ageingDateRange.to) && context.ageingBasis === field) {
            context.setAgeingDateRange({ from: null, to: null });
        }
        if (isAllSelected(values)) {
            onChange(effectiveSelected.filter(s => !values.includes(s)));
        } else {
            const newSelected = Array.from(new Set([...effectiveSelected, ...values]));
            onChange(newSelected);
        }
    };

    const isManualFilter = useMemo(() => {
        if (context?.ageingDateRange && (context.ageingDateRange.from || context.ageingDateRange.to) && context.ageingBasis === field) {
            return true;
        }
        if (!selected || selected.length === 0) return false;
        const constraint = context?.filterConstraints?.[field];
        if (!constraint || constraint.length === 0) return true;
        
        const s1 = [...selected].sort().join(',').toLowerCase();
        const s2 = [...constraint].sort().join(',').toLowerCase();
        return s1 !== s2;
    }, [selected, field, context?.filterConstraints, context?.ageingDateRange, context?.ageingBasis]);

    return (
        <div 
            className="mb-2"
            style={field === 'Certified at HO & Sent to Accounts on' ? { paddingTop: '5px', paddingBottom: '5px' } : undefined}
        >
            <div 
                className={cn(
                    "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border",
                    isOpen ? "bg-blue-50 border-blue-200" : "bg-white border-gray-100 hover:border-gray-200"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-gray-700">{field}</span>
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    {isManualFilter && (
                        <span className="bg-blue-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{effectiveSelected.length}</span>
                    )}
                </div>
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </div>

            {isOpen && (
                <div className="mt-1 ml-2 p-2 bg-gray-50 rounded-lg border border-gray-100 max-h-60 overflow-y-auto custom-scrollbar">
                    {context?.ageingDateRange && (context.ageingDateRange.from || context.ageingDateRange.to) && context.ageingBasis === field && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2.5 flex items-center justify-between text-[11px] text-blue-800 animate-in fade-in duration-200">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-[9px] uppercase tracking-wider text-blue-500">Active Quick Filter Range</span>
                                <span className="font-semibold text-blue-700">
                                    {context.ageingDateRange.from ? format(new Date(context.ageingDateRange.from), "dd MMM yy") : "Start"} - {context.ageingDateRange.to ? format(new Date(context.ageingDateRange.to), "dd MMM yy") : "End"}
                                </span>
                            </div>
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    context.setAgeingDateRange({ from: null, to: null });
                                }}
                                className="p-1 hover:bg-blue-100 rounded-full text-blue-600 hover:text-red-500 transition-all cursor-pointer shrink-0"
                                title="Clear range filter"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 text-[9px] font-normal uppercase tracking-widest mb-2 pb-2 border-b border-gray-200/50 sticky top-0 bg-gray-50 z-10">
                        <button 
                            className="text-blue-600 hover:underline" 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (context?.ageingDateRange && (context.ageingDateRange.from || context.ageingDateRange.to) && context.ageingBasis === field) {
                                    context.setAgeingDateRange({ from: null, to: null });
                                }
                                const allValues: string[] = [];
                                Object.keys(tree).forEach(year => {
                                    allValues.push(...tree[year].values);
                                });
                                onChange(Array.from(new Set(allValues)));
                            }}
                        >
                            All
                        </button>
                        <button 
                            className="text-red-500 hover:underline" 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (context?.ageingDateRange && (context.ageingDateRange.from || context.ageingDateRange.to) && context.ageingBasis === field) {
                                    context.setAgeingDateRange({ from: null, to: null });
                                }
                                onChange([]);
                            }}
                        >
                            Reset
                        </button>
                    </div>
                    {Object.keys(tree).sort((a,b) => b.localeCompare(a)).map(year => (
                        <div 
                            key={year} 
                            className="mb-1"
                        >
                            <div 
                                className="flex items-center gap-1 hover:bg-gray-100 rounded px-1 group"
                            >
                                <button onClick={(e) => toggleNode(year, e)}>
                                    {expandedNodes[year] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                                </button>
                                <div className="flex items-center gap-2 flex-1 py-1 cursor-pointer" onClick={(e) => handleSelect(tree[year].values, e)}>
                                    <div className={cn("w-3 h-3 border rounded flex items-center justify-center", isAllSelected(tree[year].values) ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300")}>
                                        {isAllSelected(tree[year].values) && <Check className="w-2 h-2 text-white" />}
                                        {isSomeSelected(tree[year].values) && <div className="w-1.5 h-0.5 bg-blue-500" />}
                                    </div>
                                    <span className="text-[11px] font-bold text-gray-700">{year}</span>
                                </div>
                            </div>
                            
                            {expandedNodes[year] && (
                                <div className="ml-4">
                                    {Object.keys(tree[year].children).sort((a, b) => {
                                        // Sort months descending
                                        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                        return months.indexOf(b) - months.indexOf(a);
                                    }).map(month => (
                                        <div 
                                            key={`${year}-${month}`} 
                                            className="mb-1"
                                        >
                                            <div 
                                                className="flex items-center gap-1 hover:bg-gray-100 rounded px-1 group"
                                            >
                                                <button onClick={(e) => toggleNode(`${year}-${month}`, e)}>
                                                    {expandedNodes[`${year}-${month}`] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                                                </button>
                                                <div className="flex items-center gap-2 flex-1 py-1 cursor-pointer" onClick={(e) => handleSelect(tree[year].children[month].values, e)}>
                                                    <div className={cn("w-3 h-3 border rounded flex items-center justify-center", isAllSelected(tree[year].children[month].values) ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300")}>
                                                        {isAllSelected(tree[year].children[month].values) && <Check className="w-2 h-2 text-white" />}
                                                        {isSomeSelected(tree[year].children[month].values) && <div className="w-1.5 h-0.5 bg-blue-500" />}
                                                    </div>
                                                    <span className="text-[10px] font-medium text-gray-700">{month}</span>
                                                </div>
                                            </div>

                                            {expandedNodes[`${year}-${month}`] && (
                                                <div className="ml-4">
                                                    {Object.keys(tree[year].children[month].children).sort((a, b) => {
                                                        const dateA = new Date(a).getTime() || 0;
                                                        const dateB = new Date(b).getTime() || 0;
                                                        return dateB - dateA;
                                                    }).map(dateStr => (
                                                        <div 
                                                            key={dateStr} 
                                                            className="flex items-center gap-2 py-1 px-1 hover:bg-gray-100 rounded cursor-pointer"
                                                            onClick={(e) => handleSelect([dateStr], e)}
                                                        >
                                                            <div className={cn("w-3 h-3 border rounded flex items-center justify-center", effectiveSelected.includes(dateStr) ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300")}>
                                                                {effectiveSelected.includes(dateStr) && <Check className="w-2 h-2 text-white" />}
                                                            </div>
                                                            <span className="text-[9px] tabular-nums text-gray-500 truncate" title={dateStr}>
                                                                {(() => {
                                                                    try {
                                                                        return format(new Date(dateStr), 'dd-MMM-yyyy');
                                                                    } catch (e) {
                                                                        return dateStr;
                                                                    }
                                                                })()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const MultiSelectField = ({ field, data, selected, onChange }: MultiSelectFieldProps) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const context = useContext(AppContext);

    const allowedValues = useMemo(() => {
        return context?.filterConstraints?.[field as string] || [];
    }, [context?.filterConstraints, field]);

    const options = useMemo(() => {
        const unique = new Set<string>();
        data.forEach(item => {
            const val = item[field];
            if (val !== undefined && val !== null && val !== '') {
                unique.add(String(val));
            }
        });
        return Array.from(unique)
            .filter(o => {
                // Hide purely numeric options as per request
                if (/^\d+$/.test(o)) return false;
                return o.toLowerCase().includes(search.toLowerCase());
            })
            .sort();
    }, [data, field, search]);

    const isOptionAllowed = (option: string) => {
        if (!allowedValues || allowedValues.length === 0) return true;
        const opt = option.trim().toLowerCase();
        return allowedValues.some(v => String(v).trim().toLowerCase() === opt);
    };

    const isManualFilter = useMemo(() => {
        if (!selected || selected.length === 0) return false;
        const constraint = context?.filterConstraints?.[field];
        if (!constraint || constraint.length === 0) return true;
        
        const s1 = [...selected].sort().join(',').toLowerCase();
        const s2 = [...constraint].sort().join(',').toLowerCase();
        return s1 !== s2;
    }, [selected, field, context?.filterConstraints]);

    return (
        <div 
            className="mb-2"
            style={field === 'Reason For Hold at Site' ? { height: '35px' } : undefined}
        >
            <div 
                className={cn(
                    "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border",
                    isOpen ? "bg-blue-50 border-blue-200" : "bg-white border-gray-100 hover:border-gray-200"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-gray-700">{field}</span>
                    {AMOUNT_FIELDS.includes(field) && <IndianRupee className="w-3.5 h-3.5 text-blue-500" />}
                    {isManualFilter && (
                        <span className="bg-blue-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{selected.length}</span>
                    )}
                </div>
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </div>
            
            {isOpen && (
                <div className="mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-sm z-[60] flex flex-col max-h-60">
                    <div className="shrink-0 space-y-2 mb-2 pb-2 border-b border-gray-50 bg-white sticky top-0">
                        <div className="relative">
                            <input 
                                className="w-full border border-gray-200 rounded-md py-1 pl-2 pr-10 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500" 
                                placeholder="Search..." 
                                value={search} 
                                onChange={e => setSearch(e.target.value)} 
                            />
                            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        </div>
                        {(!allowedValues || allowedValues.length === 0) && (
                            <div className="flex justify-end gap-2 text-[9px] font-normal uppercase tracking-widest">
                                <button 
                                    className="text-blue-600 hover:underline" 
                                    onClick={() => {
                                        onChange(options);
                                    }}
                                >
                                    All
                                </button>
                                <button 
                                    className="text-red-500 hover:underline" 
                                    onClick={() => {
                                        onChange([]);
                                    }}
                                >
                                    Reset
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                        {options.length === 0 ? (
                            <span className="text-[10px] text-gray-400 text-center py-2 italic">No options found</span>
                        ) : (
                            options.map(option => {
                                const allowed = isOptionAllowed(option);
                                return (
                                    <div 
                                        key={option} 
                                        className={cn(
                                            "flex items-center gap-2 p-1 rounded transition-all group",
                                            allowed ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed opacity-40 bg-gray-50/30 grayscale"
                                        )} 
                                        onClick={() => {
                                            if (!allowed) return;
                                            if(selected.includes(option)) onChange(selected.filter(s => s !== option));
                                            else onChange([...selected, option]);
                                        }}
                                    >
                                        <div className={cn(
                                            "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                                            selected.includes(option) 
                                                ? (allowed ? "bg-blue-500 border-blue-500" : "bg-gray-400 border-gray-400") 
                                                : (allowed ? "bg-white border-gray-300 group-hover:border-blue-400" : "bg-gray-100 border-gray-200")
                                        )}>
                                            {selected.includes(option) && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <span className={cn(
                                            "text-[11px] tabular-nums flex items-center gap-0.5", 
                                            selected.includes(option) ? "text-blue-700 font-bold" : "text-gray-600",
                                            !allowed && "text-gray-400 italic",
                                            AMOUNT_FIELDS.includes(field) ? "ml-auto" : ""
                                        )}>
                                            {AMOUNT_FIELDS.includes(field) ? formatAmount(option) : option}
                                            {AMOUNT_FIELDS.includes(field) && <IndianRupee className="w-2.5 h-2.5" />}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ data, filters, setFilters, onClear, onApply, onCancel }) => {
  const context = useContext(AppContext);
  const [localFilters, setLocalFilters] = useState<Record<string, any>>(filters);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Sync state if external filters change
  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const getDependentData = (currentField: string) => {
    return data.filter(item => {
        return Object.entries(localFilters).every(([f, selected]) => {
            if (f === currentField || !selected || (Array.isArray(selected) && selected.length === 0)) return true;
            const itemVal = String(item[f as keyof InvoiceRecord]);
            return (selected as string[]).includes(itemVal);
        });
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
        <div className="p-4 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black text-gray-800 uppercase tracking-widest">Filters Configuration</h4>
            <div className="p-1.5 bg-blue-50 rounded-lg">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="flex flex-col gap-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <MultiSelectField 
                            field="Bill Type"
                            data={getDependentData("Bill Type")}
                            selected={Array.isArray(localFilters['Bill Type']) ? localFilters['Bill Type'] : (localFilters['Bill Type'] ? [localFilters['Bill Type']] : [])}
                            onChange={(val) => setLocalFilters({...localFilters, ['Bill Type']: val})}
                        />
                    </div>
                    <div className="flex flex-col">
                        <MultiSelectField 
                            field="Contractor Name"
                            data={getDependentData("Contractor Name")}
                            selected={Array.isArray(localFilters['Contractor Name']) ? localFilters['Contractor Name'] : (localFilters['Contractor Name'] ? [localFilters['Contractor Name']] : [])}
                            onChange={(val) => setLocalFilters({...localFilters, ['Contractor Name']: val})}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <MultiSelectField 
                            field="Status"
                            data={getDependentData("Status")}
                            selected={Array.isArray(localFilters['Status']) ? localFilters['Status'] : (localFilters['Status'] ? [localFilters['Status']] : [])}
                            onChange={(val) => setLocalFilters({...localFilters, ['Status']: val})}
                        />
                    </div>
                    <div className="flex flex-col">
                        <MultiSelectField 
                            field="Payment Status"
                            data={getDependentData("Payment Status")}
                            selected={Array.isArray(localFilters['Payment Status']) ? localFilters['Payment Status'] : (localFilters['Payment Status'] ? [localFilters['Payment Status']] : [])}
                            onChange={(val) => setLocalFilters({...localFilters, ['Payment Status']: val})}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               {FILTER_GROUPS.map(group => {
                   const activeCount = group.fields.filter(f => {
                       // Count as active if there is an active ageing filter on this field
                       const hasAgeingFilter = context?.ageingDateRange && (context.ageingDateRange.from || context.ageingDateRange.to) && context.ageingBasis === f;
                       if (hasAgeingFilter) return true;

                       const val = localFilters[f];
                       if (!val || (Array.isArray(val) && val.length === 0)) return false;
                       
                       const constraint = context?.filterConstraints?.[f];
                       if (!constraint || constraint.length === 0) return true;
                       
                       const s1 = [...(Array.isArray(val) ? val : [val])].sort().join(',').toLowerCase();
                       const s2 = [...constraint].sort().join(',').toLowerCase();
                       return s1 !== s2;
                   }).length;
                   return (
                       <div key={group.name} className="flex flex-col">
                           <div 
                                className={cn(
                                    "flex items-center justify-between mb-3 px-1 cursor-pointer group",
                                    expandedGroupId === group.name ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
                                )}
                                
                                onClick={() => setExpandedGroupId(expandedGroupId === group.name ? null : group.name)}
                           >
                               <div className="flex items-center gap-2">
                                    <h5 className="text-[12px] font-black uppercase tracking-widest">{group.name}</h5>
                                    {activeCount > 0 && (
                                        <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                                            {activeCount}
                                        </span>
                                    )}
                               </div>
                               {expandedGroupId === group.name ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                           </div>

                           {expandedGroupId === group.name && (
                               <div className="flex flex-col">
                                   {group.fields.map(field => {
                                       const Component = DATE_FIELDS.includes(field) ? DateTreeField : MultiSelectField;
                                       return (
                                           <Component 
                                            key={field} 
                                            field={field} 
                                            data={getDependentData(field as string)}
                                            selected={Array.isArray(localFilters[field]) ? localFilters[field] : (localFilters[field] ? [localFilters[field]] : [])}
                                            onChange={(val) => setLocalFilters({...localFilters, [field]: val})}
                                           />
                                       );
                                   })}
                               </div>
                           )}
                       </div>
                   );
               })}
            </div>
        </div>

        <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button 
            size="sm" 
            className="h-8 w-[125px] text-[11px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onApply && onApply(localFilters)}
          >
            Apply
          </Button>
        </div>
    </div>
  );
};
