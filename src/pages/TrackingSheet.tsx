import React, { useMemo, useContext, useState, useEffect } from 'react';
import { AppContext } from '../App';
import { PivotAnalyzer } from '../components/dashboard/analytics/PivotAnalyzer';
import { format } from 'date-fns';
import { Table as TableIcon, BarChart3, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TrackingSheet() {
  const context = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('accounts');
  const [holdOnly, setHoldOnly] = useState(false);
  const [activeView, setActiveView] = useState<'table' | 'chart' | 'calendar'>('table');

  const isHoldToggleDisabled = activeTab === 'accounts' || activeTab === 'paid';

  const getTabColorStyles = (key: string, isActive: boolean) => {
    if (!isActive) {
      if (key === 'site') return 'text-slate-650 hover:text-amber-800 hover:bg-amber-100/30';
      if (key === 'ho') return 'text-slate-600 hover:text-blue-700 hover:bg-blue-100';
      if (key === 'accounts') return 'text-slate-600 hover:text-cyan-700 hover:bg-cyan-100';
      if (key === 'paid') return 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-100';
      return 'text-slate-600 hover:text-slate-800 hover:bg-slate-100';
    }

    if (key === 'site') {
      return 'bg-amber-500 text-white shadow-md ring-2 ring-amber-500/25 font-black';
    }
    if (key === 'ho') {
      return 'bg-blue-500 text-white shadow-md ring-2 ring-blue-505/20 font-black';
    }
    if (key === 'accounts') {
      return 'bg-cyan-600 text-white shadow-md ring-2 ring-cyan-600/20 font-black';
    }
    if (key === 'paid') {
      return 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-600/20 font-black';
    }
    return 'bg-slate-600 text-white shadow-md ring-2 ring-slate-600/20 font-black';
  };

  // Force toggle OFF when switching to disabled tabs
  useEffect(() => {
    if (isHoldToggleDisabled) {
      setHoldOnly(false);
    }
  }, [activeTab, isHoldToggleDisabled]);

  // Define status and payment status constraints based on tab
  const tabConstraints = useMemo(() => {
    const siteStatuses = ["05 Send To HO", "04 Hold At Site", "03 Site - High Rise Done", "02 Site - Excel Done", "01 Site - In Process"];
    const hoStatuses = ["07 Hold At Ho", "06 Received At HO"];
    const accStatuses = ["10 Cheque Recd. At Site", "08 Send To Accounts"];
    const paidStatuses = ["10 Cheque Recd. At Site"];
    
    const accPayment = ["Payment Balance", "Partial Payment Balance"];
    const paidPayment = ["Payment Cleared", "Partial Payment Balance"];

    if (activeTab === 'site') {
      return {
        Status: holdOnly ? ["04 Hold At Site"] : siteStatuses,
        'Payment Status': []
      };
    }
    if (activeTab === 'ho') {
      return {
        Status: holdOnly ? ["07 Hold At Ho"] : hoStatuses,
        'Payment Status': []
      };
    }
    if (activeTab === 'accounts') {
      return {
        Status: accStatuses,
        'Payment Status': accPayment
      };
    }
    if (activeTab === 'paid') {
      return {
        Status: paidStatuses,
        'Payment Status': paidPayment
      };
    }
    if (activeTab === 'all' && holdOnly) {
      return {
        Status: ["04 Hold At Site", "07 Hold At Ho"],
        'Payment Status': []
      };
    }
    return {
      Status: [],
      'Payment Status': []
    };
  }, [activeTab, holdOnly]);

  // Update global filters when tab or hold changes
  useEffect(() => {
    if (!context) return;
    
    // Sync constraints to global context
    context.setFilterConstraints(tabConstraints);

    context.setColumnFilters(prev => {
        const next = { ...prev };
        
        // When switching tabs, we should strictly apply the tab constraints
        // For Status:
        if (tabConstraints.Status.length > 0) {
            next.Status = tabConstraints.Status;
        } else {
            delete next.Status;
        }

        // For Payment Status:
        if (tabConstraints['Payment Status'].length > 0) {
            next['Payment Status'] = tabConstraints['Payment Status'];
        } else {
            delete next['Payment Status'];
        }

        return next;
    });
  }, [activeTab, holdOnly]);

  // Handle cross-context reset (re-applying tab constraints on reset)
  useEffect(() => {
    const resetHandler = () => {
        // Force the tab constraints back
        context?.setColumnFilters(prev => ({
            ...prev,
            Status: tabConstraints.Status.length > 0 ? tabConstraints.Status : undefined,
            'Payment Status': tabConstraints['Payment Status'].length > 0 ? tabConstraints['Payment Status'] : undefined
        }));
    };

    // Register this reset extra logic
    context?.registerResetPivot?.('tracking-tab-sync', resetHandler);
    return () => context?.unregisterResetPivot?.('tracking-tab-sync');
  }, [tabConstraints, context]);

  // Cleanup filters when leaving the TrackingSheet page
  const contextRef = React.useRef(context);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    return () => {
      const ctx = contextRef.current;
      if (ctx) {
        ctx.setFilterConstraints({ Status: [], 'Payment Status': [] });
        ctx.setColumnFilters(prev => {
          const next = { ...prev };
          delete next.Status;
          delete next['Payment Status'];
          return next;
        });
      }
    };
  }, []);

  const processedData = useMemo(() => {
    // We let the global context do the heavy lifting now that we sync columnFilters
    return context?.filteredData || [];
  }, [context?.filteredData]);

  // Pivot Analyzer configurations depending on active tab
  const defaultSummaries = useMemo(() => {
    if (activeTab === 'site' || activeTab === 'ho') {
      return ["count", "Bill Amount (Net Payble)"];
    }
    return undefined;
  }, [activeTab]);

  const defaultAvg = useMemo(() => {
    return [];
  }, []);

  const defaultExtraColumns = useMemo(() => {
    if (holdOnly) {
      return [
        "Bill Type",
        "Work Head",
        "LOCATION / Bldg.",
        "Billing Period",
        "Billing Eng Name",
        "Inward Date",
        "EXCEL Date",
        "Highrise RA Date",
        "Reason For Hold at Site",
        "Remark Site",
        "HO Submission Date",
        "Received at HO",
        "Reason For Hold at HO",
        "Remark HO",
      ];
    }

    if (activeTab === 'all') {
      return [
        "Bill Type",
        "Work Head",
        "LOCATION / Bldg.",
        "Billing Period",
        "Billing Eng Name",
        "Inward Date",
        "EXCEL Date",
        "Highrise RA Date",
        "HO Submission Date",
        "Received at HO",
        "Certified at HO & Sent to Accounts on",
        "Cheque No",
        "Cheque Recd. At Site Date",
      ];
    }
    if (activeTab === 'site') {
      return [
        "Bill Type",
        "Work Head",
        "LOCATION / Bldg.",
        "Billing Period",
        "Billing Eng Name",
        "Inward Date",
        "EXCEL Date",
        "Highrise RA Date",
        "HO Submission Date",
      ];
    }
    if (activeTab === 'ho') {
      return [
        "Bill Type",
        "Work Head",
        "LOCATION / Bldg.",
        "Billing Period",
        "Billing Eng Name",
        "Received at HO",
      ];
    }
    if (activeTab === 'accounts') {
      return [
        "Bill Type",
        "Work Head",
        "LOCATION / Bldg.",
        "Billing Period",
        "Billing Eng Name",
        "Certified at HO & Sent to Accounts on",
      ];
    }
    if (activeTab === 'paid') {
      return [
        "Bill Type",
        "Work Head",
        "LOCATION / Bldg.",
        "Billing Period",
        "Billing Eng Name",
        "Certified at HO & Sent to Accounts on",
        "Cheque No",
        "Cheque Recd. At Site Date",
        "Remark",
      ];
    }
    return undefined;
  }, [activeTab, holdOnly]);

  const tabsBefore = [
    { label: 'All Bills', key: 'all' },
    { label: 'Bills at Site', key: 'site' },
    { label: 'Bills at HO', key: 'ho' },
  ];

  const tabsAfter = [
    { label: 'Bills at Accounts', key: 'accounts' },
    { label: 'Paid Bills', key: 'paid' }
  ];

  return (
    <div className="bg-gray-50/50 animate-in fade-in duration-500 text-gray-800 font-sans">
      <div 
        className="max-w-[1700px] mx-auto space-y-3 p-1"
        style={{ paddingTop: '0px', paddingBottom: '0px' }}
      >
        
        {/* Combined Row: Bill Level Tabs (Left) and View Selector (Right) */}
        <div 
          className="flex flex-col xl:flex-row items-center gap-2 bg-white border border-gray-250 rounded-xl p-1 shadow-sm w-full relative"
          style={{ marginBottom: '2px', paddingBottom: '0px', paddingTop: '0px' }}
        >
          {/* Tabs Bar section - Full Width & Evenly Spread */}
          <div 
            className="flex flex-1 items-center gap-1 min-w-0"
            style={{ height: '32px', marginBottom: '0px', paddingBottom: '5px', paddingTop: '5px', paddingLeft: '5px', paddingRight: '5px', lineHeight: '16px', width: '1108.19px' }}
          >
            {tabsBefore.map((tab, idx) => (
              <React.Fragment key={tab.key}>
                <button
                  onClick={() => {
                    setActiveTab(tab.key);
                  }}
                  className={`
                    flex-1 h-full px-5 text-[11px] uppercase tracking-widest rounded-lg transition-all duration-200
                    ${getTabColorStyles(tab.key, activeTab === tab.key)}
                  `}
                  style={{ lineHeight: '11px' }}
                >
                  {tab.label}
                </button>
                {/* Vertical separator after "All Bills" (index 0) */}
                {idx === 0 && <div className="h-6 w-[2px] bg-gray-200 mx-1 self-center rounded-full" />}
              </React.Fragment>
            ))}

            {/* Toggle: Hold Bills Only - Separator removed between HO tab and toggle */}
            <div className={`min-w-max h-full flex items-center justify-center gap-2 px-3 transition-opacity duration-200 ${isHoldToggleDisabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex-shrink-0 ${holdOnly ? 'text-red-500 font-extrabold' : 'text-gray-400'}`}>
                Hold Bills Only
              </span>
              <button 
                disabled={isHoldToggleDisabled}
                onClick={() => {
                  setHoldOnly(!holdOnly);
                }}
                className={`relative inline-flex h-4 w-9 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 focus:outline-none 
                  ${holdOnly ? 'bg-red-500' : 'bg-gray-200'}
                  ${isHoldToggleDisabled ? 'cursor-not-allowed' : 'hover:ring-2 hover:ring-red-100'}`}
              >
                <span className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-md transition duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${holdOnly ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="h-6 w-[2px] bg-gray-200 mx-1 self-center rounded-full" />

            {tabsAfter.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                }}
                className={`
                  flex-1 h-full px-5 text-[11px] uppercase tracking-widest rounded-lg transition-all duration-200
                  ${getTabColorStyles(tab.key, activeTab === tab.key)}
                `}
                style={{ 
                  lineHeight: '11px',
                  ...(tab.key === 'accounts' ? { paddingTop: '0px', height: '22px' } : {}) 
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hidden xl:block h-6 w-[2px] bg-gray-200 mx-1 self-center rounded-full" />

          {/* Table, Chart & Calendar selection tab - Seperated on the right of the same row */}
          <div 
            className="flex bg-gray-100 rounded-lg items-center shrink-0 self-end xl:self-center bg-gray-150-custom xl:ml-auto"
            style={{ paddingBottom: '0px', paddingTop: '0px', paddingLeft: '0px', paddingRight: '0px', height: '22px', backgroundColor: '#f1f5f9' }}
          >
            { [
              { id: 'table', icon: <TableIcon className="w-3.5 h-3.5" />, label: 'Table' },
              { id: 'chart', icon: <BarChart3 className="w-3.5 h-3.5" />, label: 'Chart' },
              { id: 'calendar', icon: <CalendarIcon className="w-3.5 h-3.5" />, label: 'Calendar' }
            ].map(v => (
              <button
                key={v.id}
                onClick={() => {
                  setActiveView(v.id as any);
                }}
                className={cn(
                  "px-4 rounded-md text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 cursor-pointer",
                  activeView === v.id ? "bg-white text-blue-600 shadow-sm font-black" : "text-gray-400 hover:text-gray-650"
                )}
                style={{ height: '18px' }}
              >
                {v.icon}
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Pivot Analyzer */}
        <div 
          className="pt-0 pb-6 animate-in fade-in duration-300 relative min-h-[400px]"
          style={{ paddingBottom: '0px', marginBottom: '0px' }}
        >
          <PivotAnalyzer 
              key={`${activeTab}-${holdOnly}`}
              data={processedData} 
              allData={context?.data || []}
              tableFirst={false} 
              defaultRows={["Project", "Status", "Contractor Name"]} 
              enableExtraColumns={true}
              pageId={`tracking-${activeTab}`}
              constraints={tabConstraints}
              defaultSummaries={defaultSummaries}
              defaultAvg={defaultAvg}
              defaultExtraColumns={defaultExtraColumns}
              activeView={activeView}
              setActiveView={setActiveView}
          />
        </div>

        {/* Bottom Status Bar */}
        <div 
          className="pt-4 flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest border-t border-gray-100"
          style={{ paddingTop: '0px' }}
        >
            <div>Data Last Updated: {format(new Date(), 'dd-MM-yyyy HH:mm')}</div>
        </div>
      </div>
    </div>
  );
}
