import React, { useMemo, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AppContext } from '../../../App';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChevronDown, Loader2 } from 'lucide-react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CustomXAxisTick = (props: any) => {
  const { x, y, payload, chartData } = props;
  const index = chartData.findIndex((d: any) => d.name === payload.value);
  if (index === -1) return null;
  
  const current = chartData[index];
  const prev = index > 0 ? chartData[index - 1] : null;
  
  const isFirstOfQtr = !prev || prev.qtr !== current.qtr || prev.year !== current.year;
  const isFirstOfYear = !prev || prev.year !== current.year;
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={8} textAnchor="end" fill="#6B7280" fontSize={9} fontWeight="bold" transform="rotate(-90)">
        {current.month}
      </text>
      
      {isFirstOfQtr && (
        <g>
          <line x1={-12} y1={40} x2={-12} y2={55} stroke="#D1D5DB" strokeDasharray="2 2" />
          <text x={0} y={50} textAnchor="start" fill="#6B7280" fontSize={9}>
            {current.qtr}
          </text>
        </g>
      )}
      
      {isFirstOfYear && (
        <g>
          <line x1={-12} y1={55} x2={-12} y2={75} stroke="#9CA3AF" />
          <text x={0} y={69} textAnchor="start" fill="#374151" fontSize={10} fontWeight="900">
            {current.year}
          </text>
        </g>
      )}
    </g>
  );
};

export default function TATTrendChart({ data }: { data: any[] }) {
  const context = useContext(AppContext);
  const [showDays, setShowDays] = useState(true);
  const [showCount, setShowCount] = useState(true);
  const [showAmount, setShowAmount] = useState(true);
  const [trendBasis, setTrendBasis] = useState('Inward Date');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [yDomains, setYDomains] = useState<{ days: any[], count: any[], amount: any[] }>({
    days: [0, 'auto'],
    count: [0, 'auto'],
    amount: [0, 'auto']
  });
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleReset = useCallback(() => {
    setShowDays(true);
    setShowCount(true);
    setShowAmount(true);
    setHiddenFields([]);
    setTrendBasis('Inward Date');
  }, []);

  const isChanged = useMemo(() => {
    return !showDays || !showCount || !showAmount || hiddenFields.length > 0 || trendBasis !== 'Inward Date';
  }, [showDays, showCount, showAmount, hiddenFields, trendBasis]);

  useEffect(() => {
    if (context?.registerResetPivot) {
      context.registerResetPivot('tatTrend', handleReset);
    }
    return () => {
      if (context?.unregisterResetPivot) {
        context.unregisterResetPivot('tatTrend');
      }
    };
  }, [context?.registerResetPivot, context?.unregisterResetPivot, handleReset]);

  useEffect(() => {
    if (context?.setModuleChanged) {
      context.setModuleChanged('tatTrend', isChanged);
    }
  }, [context?.setModuleChanged, isChanged]);

  const TREND_BASIS_OPTIONS = [
    { label: 'Site Inward Date', value: 'Inward Date' },
    { label: 'Received at HO Date', value: 'Received at HO' },
    { label: 'Send to account date', value: 'Certified at HO & Sent to Accounts on' },
    { label: 'Payment Date', value: 'Cheque Recd. At HO Date' },
  ];

  const updateVisibleDomains = () => {
    if (!scrollContainerRef.current || chartData.length === 0) return;

    const { scrollLeft, clientWidth, scrollWidth } = scrollContainerRef.current;
    
    // Estimate visible range based on scroll position
    const totalItems = chartData.length;
    if (totalItems === 0) return;
    
    const itemWidth = scrollWidth / totalItems;
    
    const startIndex = Math.max(0, Math.floor(scrollLeft / itemWidth));
    const endIndex = Math.min(totalItems, Math.ceil((scrollLeft + clientWidth) / itemWidth));
    
    const visibleData = chartData.slice(startIndex, endIndex);
    
    if (visibleData.length === 0) return;

    let maxDays = 0;
    let maxCount = 0;
    let maxAmount = 0;

    visibleData.forEach(d => {
      // Days logic: Stacked (Site + HO + Account)
      const daysTotal = (Number(d['Average of Site Days']) || 0) + 
                        (Number(d['Average of HO Days']) || 0) + 
                        (Number(d['Average of Account Days']) || 0);
      if (daysTotal > maxDays) maxDays = daysTotal;

      // Count logic
      const countVal = Number(d['No. of Bills']) || 0;
      if (countVal > maxCount) maxCount = countVal;

      // Amount logic: max of (Bill Amount) or (Cheque + Balance stacked)
      const billAmt = Number(d['Sum of Bill Amount']) || 0;
      const paidAmt = (Number(d['Sum of Paid Amount']) || 0) + (Number(d['Sum of Balance Payment']) || 0);
      const amtTotal = Math.max(billAmt, paidAmt);
      if (amtTotal > maxAmount) maxAmount = amtTotal;
    });

    // Add 10% padding for better visuals
    setYDomains({
      days: [0, maxDays > 0 ? Math.ceil(maxDays * 1.1) : 'auto'],
      count: [0, maxCount > 0 ? Math.ceil(maxCount * 1.1) : 'auto'],
      amount: [0, maxAmount > 0 ? Math.ceil(maxAmount * 1.1) : 'auto']
    });
  };

  const toggleLegendItem = (itemKey: string) => {
    setHiddenFields(prev => prev.includes(itemKey) ? prev.filter(k => k !== itemKey) : [...prev, itemKey]);
  };

  const getLegendStyle = (itemKey: string) => {
      return hiddenFields.includes(itemKey) 
          ? 'opacity-40 line-through cursor-pointer' 
          : 'cursor-pointer hover:opacity-80';
  };

  const handleTrendBasisChange = (value: string) => {
    setIsRefreshing(true);
    setTrendBasis(value);
    setIsDropdownOpen(false);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  const chartData = useMemo(() => {
    const grouped = new Map<string, any>();
    
    data.forEach(item => {
      let dateObj: Date | null = null;
      const rawDate = item[trendBasis];
      
      if (rawDate) {
        if (typeof rawDate === 'number') {
          // Excel serial date conversion
          dateObj = new Date((rawDate - 25569) * 86400 * 1000);
        } else {
          dateObj = new Date(rawDate);
        }
      }

      const isValidDate = dateObj && !isNaN(dateObj.getTime());
      
      if (!isValidDate) return;
      
      const year = dateObj!.getFullYear().toString();
      const monthIndex = dateObj!.getMonth();
      const qtr = `Qtr ${Math.floor(monthIndex / 3) + 1}`;
      const month = dateObj!.toLocaleString('default', { month: 'long' });
      
      const key = `${year}-${qtr}-${month}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, { 
          key, 
          year, 
          qtr, 
          month, 
          siteSum: 0, 
          hoSum: 0, 
          actSum: 0, 
          amountSum: 0, 
          chequeSum: 0, 
          balanceSum: 0, 
          count: 0,
          time: dateObj!.getTime()
        });
      }
      const g = grouped.get(key);
      g.siteSum += Number(item['Site Days']) || 0;
      g.hoSum += Number(item['HO Days']) || 0;
      g.actSum += Number(item['Account Days']) || 0;
      g.amountSum += Number(item['Bill Amount (Net Payble)']) || 0;
      g.chequeSum += Number(item['Paid Amount']) || 0;
      g.balanceSum += Number(item['Balance Payment']) || 0;
      g.count += 1;
    });

    const sortedGroups = Array.from(grouped.values()).sort((a, b) => a.time - b.time);

    return sortedGroups.map(g => ({
      name: `${g.year}-${g.qtr}-${g.month}`,
      month: g.month,
      qtr: g.qtr,
      year: g.year,
      'Average of Site Days': +(g.siteSum / g.count).toFixed(1),
      'Average of HO Days': +(g.hoSum / g.count).toFixed(1),
      'Average of Account Days': +(g.actSum / g.count).toFixed(1),
      'No. of Bills': g.count,
      'Sum of Bill Amount': g.amountSum,
      'Sum of Paid Amount': g.chequeSum,
      'Sum of Balance Payment': g.balanceSum,
    }));
  }, [data, trendBasis]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
      // Initial domain update after scroll sets to end
      setTimeout(updateVisibleDomains, 100);
    }
  }, [chartData]);

  const formatDays = (v: number) => v.toLocaleString('en-IN', { minimumIntegerDigits: 1, maximumFractionDigits: 1 });
  const formatAmount = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatAmountAxis = (v: number) => `₹${(v / 100000).toLocaleString('en-IN', { maximumFractionDigits: 0 })}L`;
  const formatCount = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const tooltipFormatter = (value: number, name: string) => {
    let displayName = name;
    if (displayName.startsWith('Average of ')) {
      displayName = displayName.replace('Average of ', '');
    }
    if (displayName.startsWith('Sum of ')) {
      displayName = displayName.replace('Sum of ', '');
    }
    if (displayName.includes('Amount') || displayName.includes('Balance') || displayName.includes('Paid')) return [formatAmount(value), displayName];
    if (displayName.includes('Days')) return [formatDays(value), displayName];
    return [formatCount(value), displayName];
  };

  return (
    <Card className="border-none shadow-sm pt-[5px] pb-0 flex flex-col h-[350px]">
      <CardHeader className="p-0 px-2 flex-shrink-0 flex flex-row items-center justify-between min-h-0 h-[25px] py-0.5">
        <div className="flex items-center gap-4 pt-0">
           <div 
             className="flex items-center gap-1 group relative"
             onMouseLeave={() => setIsDropdownOpen(false)}
           >
             <CardTitle className="text-[11px] font-black text-gray-800 shrink-0 uppercase tracking-widest whitespace-nowrap">TAT Trend By</CardTitle>
             
             <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
               <PopoverTrigger 
                 className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-blue-600 outline-none focus:ring-0 cursor-pointer px-1 rounded transition-colors group"
                 onClick={() => setIsDropdownOpen(!isDropdownOpen)}
               >
                  {TREND_BASIS_OPTIONS.find(opt => opt.value === trendBasis)?.label}
                  <ChevronDown className={cn("w-3 h-3 text-blue-600 transition-transform", isDropdownOpen ? "rotate-180" : "")} />
               </PopoverTrigger>
               <PopoverContent 
                 className="w-64 p-0 bg-white border border-gray-100 shadow-xl rounded-md z-[110]" 
                 align="start"
                 sideOffset={0}
                 onMouseEnter={() => setIsDropdownOpen(true)}
                 onMouseLeave={() => setIsDropdownOpen(false)}
               >
                 <div className="flex flex-col gap-0.5 p-1">
                   {TREND_BASIS_OPTIONS.map((opt) => (
                     <button
                       key={opt.value}
                       onClick={() => handleTrendBasisChange(opt.value)}
                       className={cn(
                         "w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded",
                         trendBasis === opt.value 
                           ? "bg-blue-50 text-blue-600" 
                           : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                       )}
                     >
                       {opt.label}
                     </button>
                   ))}
                 </div>
               </PopoverContent>
             </Popover>
           </div>
           <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
             {showDays && (
                <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
                   <div className={cn("flex items-center gap-1.5 transition-all text-[9px] font-bold text-[#4B5563] uppercase tracking-wider", getLegendStyle('Average of Site Days'))} onClick={() => toggleLegendItem('Average of Site Days')}><div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></div><span>Site Days</span></div>
                   <div className={cn("flex items-center gap-1.5 transition-all text-[9px] font-bold text-[#4B5563] uppercase tracking-wider", getLegendStyle('Average of HO Days'))} onClick={() => toggleLegendItem('Average of HO Days')}><div className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]"></div><span>HO Days</span></div>
                   <div className={cn("flex items-center gap-1.5 transition-all text-[9px] font-bold text-[#4B5563] uppercase tracking-wider", getLegendStyle('Average of Account Days'))} onClick={() => toggleLegendItem('Average of Account Days')}><div className="w-1.5 h-1.5 rounded-full bg-[#F97316]"></div><span>Account Days</span></div>
                </div>
             )}
             {showCount && (
                <div className={cn("flex items-center gap-1.5 transition-all text-[9px] font-bold text-[#4B5563] uppercase tracking-wider", getLegendStyle('No. of Bills'))} onClick={() => toggleLegendItem('No. of Bills')}><div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"></div><span>No. of Bills</span></div>
             )}
             {showAmount && (
                <div className="flex items-center gap-3">
                   <div className={cn("flex items-center gap-1.5 transition-all text-[9px] font-bold text-[#4B5563] uppercase tracking-wider", getLegendStyle('Sum of Bill Amount'))} onClick={() => toggleLegendItem('Sum of Bill Amount')}><div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] opacity-30"></div><span>Bill Amount</span></div>
                   <div className={cn("flex items-center gap-1.5 transition-all text-[9px] font-bold text-[#4B5563] uppercase tracking-wider", getLegendStyle('Sum of Paid Amount'))} onClick={() => toggleLegendItem('Sum of Paid Amount')}><div className="w-1.5 h-1.5 rounded-full bg-[#10B981] opacity-60"></div><span>Paid Amount</span></div>
                   <div className={cn("flex items-center gap-1.5 transition-all text-[9px] font-bold text-[#4B5563] uppercase tracking-wider", getLegendStyle('Sum of Balance Payment'))} onClick={() => toggleLegendItem('Sum of Balance Payment')}><div className="w-1.5 h-1.5 rounded-full bg-[#EF4444] opacity-60"></div><span>Balance Payment</span></div>
                </div>
             )}
           </div>
        </div>
        <div className="flex items-center gap-4">
            {isChanged && (
              <span
                className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer uppercase tracking-wider"
                onClick={handleReset}
              >
                Reset
              </span>
            )}
            <div className="flex items-center gap-1.5">
                <Checkbox id="showDays" checked={showDays} onCheckedChange={(v) => setShowDays(!!v)} />
                <Label htmlFor="showDays" className="text-[10px] font-bold uppercase tracking-wider text-gray-600 cursor-pointer">Days</Label>
            </div>
            <div className="flex items-center gap-1.5">
                <Checkbox id="showCount" checked={showCount} onCheckedChange={(v) => setShowCount(!!v)} />
                <Label id="showCount-label" htmlFor="showCount" className="text-[10px] font-bold uppercase tracking-wider text-gray-600 cursor-pointer w-[70px]" style={{ width: '70px' }}>No. of Bills</Label>
            </div>
            <div className="flex items-center gap-1.5">
                <Checkbox id="showAmount" checked={showAmount} onCheckedChange={(v) => setShowAmount(!!v)} />
                <Label htmlFor="showAmount" className="text-[10px] font-bold uppercase tracking-wider text-gray-600 cursor-pointer">Amount</Label>
            </div>
        </div>
      </CardHeader>
      <CardContent className="h-[295px] flex-shrink-0 flex flex-col overflow-hidden p-0 relative">
        {isRefreshing && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/10 backdrop-blur-[1px] pointer-events-auto">
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-3 shadow-xl rounded-full bg-white p-2 border border-blue-100" />
              <div className="flex flex-col gap-2 items-center bg-white px-5 py-3 rounded-2xl shadow-xl border border-blue-100">
                <span className="text-[10px] font-black uppercase text-blue-800 tracking-widest animate-pulse">Refreshing chart</span>
              </div>
            </div>
          </div>
        )}
        {chartData.length > 0 ? (
          <div className="w-full flex items-stretch bg-white relative rounded-b-xl overflow-hidden" style={{ height: '295px' }}>
            {/* Left Fixed Y-Axis */}
            {(showDays || showCount || showAmount) && (
              <div className="w-[50px] shrink-0 z-10 bg-white drop-shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-gray-100">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 70 }}>
                    {showDays ? (
                        <>
                          <YAxis 
                            yAxisId="days"
                            domain={yDomains.days}
                            tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 'bold' }} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={formatDays}
                            label={{ value: 'Days', angle: -90, position: 'insideLeft', offset: 5, style: { fontSize: 10, fontWeight: 'bold', fill: '#4B5563' } }}
                            width={50}
                          />
                          <Bar yAxisId="days" dataKey="Average of Site Days" fill="transparent" isAnimationActive={false} />
                          <Bar yAxisId="days" dataKey="Average of HO Days" fill="transparent" isAnimationActive={false} />
                          <Bar yAxisId="days" dataKey="Average of Account Days" fill="transparent" isAnimationActive={false} />
                        </>
                    ) : showCount ? (
                        <>
                          <YAxis 
                            yAxisId="count"
                            domain={yDomains.count}
                            tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 'bold' }} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={formatCount}
                            label={{ value: 'No. of Bills', angle: -90, position: 'insideLeft', offset: 5, style: { fontSize: 10, fontWeight: 'bold', fill: '#4B5563' } }}
                            width={50}
                          />
                          <Line yAxisId="count" type="monotone" dataKey="No. of Bills" stroke="transparent" isAnimationActive={false} dot={false} />
                        </>
                    ) : (
                        <>
                          <YAxis 
                            yAxisId="amount"
                            domain={yDomains.amount}
                            tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 'bold' }} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={formatAmountAxis}
                            label={{ value: 'Amount', angle: -90, position: 'insideLeft', offset: 5, style: { fontSize: 10, fontWeight: 'bold', fill: '#4B5563' } }}
                            width={50}
                          />
                          <Area yAxisId="amount" type="monotone" dataKey="Sum of Bill Amount" fill="transparent" stroke="transparent" isAnimationActive={false} />
                          <Area yAxisId="amount" type="monotone" dataKey="Sum of Paid Amount" fill="transparent" stroke="transparent" isAnimationActive={false} stackId="paid" />
                          <Area yAxisId="amount" type="monotone" dataKey="Sum of Balance Payment" fill="transparent" stroke="transparent" isAnimationActive={false} stackId="paid" />
                        </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Scrollable Center Chart */}
            <div 
              ref={scrollContainerRef}
              onScroll={updateVisibleDomains}
              className="flex-1 overflow-x-auto overflow-y-hidden rounded-md border border-gray-100 bg-white [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-gray-50" 
              style={{ scrollbarWidth: 'thin' }}
            >
              <div style={{ minWidth: `${Math.max(chartData.length * 35, 800)}px`, height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="name" 
                      tick={(props) => <CustomXAxisTick {...props} chartData={chartData} />}
                      tickLine={false} 
                      axisLine={{ stroke: '#E5E7EB' }} 
                      interval={0}
                    />
                    <YAxis yAxisId="days" domain={yDomains.days} hide />
                    <YAxis yAxisId="count" orientation="right" domain={yDomains.count} hide />
                    <YAxis yAxisId="amount" orientation="right" domain={yDomains.amount} hide />
                    
                    <Tooltip 
                      wrapperStyle={{ zIndex: 100 }}
                      contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#F3F4F6' }}
                      itemSorter={(item) => {
                        const name = item.name as string;
                        switch (name) {
                          case 'Average of Site Days': return 0;
                          case 'Average of HO Days': return 1;
                          case 'Average of Account Days': return 2;
                          case 'Sum of Bill Amount': return 3;
                          case 'Sum of Paid Amount': return 4;
                          case 'Sum of Balance Payment': return 5;
                          case 'No. of Bills': return 6;
                          default: return 7;
                        }
                      }}
                      formatter={tooltipFormatter}
                    />
                    
                    {showDays && <Bar yAxisId="days" dataKey="Average of Site Days" stackId="a" fill="#3B82F6" hide={hiddenFields.includes('Average of Site Days')} />}
                    {showDays && <Bar yAxisId="days" dataKey="Average of HO Days" stackId="a" fill="#1D4ED8" hide={hiddenFields.includes('Average of HO Days')} />}
                    {showDays && <Bar yAxisId="days" dataKey="Average of Account Days" stackId="a" fill="#F97316" hide={hiddenFields.includes('Average of Account Days')} />}
                    
                    {showAmount && <Area yAxisId="amount" type="monotone" dataKey="Sum of Bill Amount" fill="#3B82F6" stroke="none" fillOpacity={0.15} hide={hiddenFields.includes('Sum of Bill Amount')} />}
                    {showAmount && <Area yAxisId="amount" type="monotone" dataKey="Sum of Paid Amount" fill="#10B981" stroke="none" fillOpacity={0.4} stackId="paid" hide={hiddenFields.includes('Sum of Paid Amount')} />}
                    {showAmount && <Area yAxisId="amount" type="monotone" dataKey="Sum of Balance Payment" fill="#EF4444" stroke="none" fillOpacity={0.4} stackId="paid" hide={hiddenFields.includes('Sum of Balance Payment')} />}
                    
                    {showCount && <Line yAxisId="count" type="monotone" dataKey="No. of Bills" stroke="#8B5CF6" strokeWidth={2} dot={false} hide={hiddenFields.includes('No. of Bills')} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Fixed Y-Axes */}
            {((showDays && (showCount || showAmount)) || (!showDays && showCount && showAmount)) && (
              <div className={`shrink-0 z-10 bg-white drop-shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l border-gray-100 ${(showDays && showCount && showAmount) ? 'w-[100px]' : 'w-[50px]'}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 70 }}>
                    {showCount && showDays && (
                      <YAxis 
                        yAxisId="count" 
                        orientation="right" 
                        domain={yDomains.count}
                        tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 'bold' }} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={formatCount}
                        label={{ value: 'No. of Bills', angle: 90, position: 'insideRight', offset: 5, style: { fontSize: 10, fontWeight: 'bold', fill: '#4B5563' } }}
                        width={50}
                      />
                    )}
                    {showAmount && (showDays || showCount) && (
                      <YAxis 
                        yAxisId="amount" 
                        orientation="right" 
                        domain={yDomains.amount}
                        tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 'bold' }} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={formatAmountAxis}
                        label={{ value: 'Amount', angle: 90, position: 'insideRight', offset: 5, style: { fontSize: 10, fontWeight: 'bold', fill: '#4B5563' } }}
                        width={50}
                      />
                    )}
                    {showCount && showDays && <Line yAxisId="count" type="monotone" dataKey="No. of Bills" stroke="transparent" isAnimationActive={false} dot={false} />}
                    {showAmount && (showDays || showCount) && <Area yAxisId="amount" type="monotone" dataKey="Sum of Bill Amount" fill="transparent" stroke="transparent" isAnimationActive={false} />}
                    {showAmount && (showDays || showCount) && <Area yAxisId="amount" type="monotone" dataKey="Sum of Paid Amount" fill="transparent" stroke="transparent" isAnimationActive={false} stackId="paid" />}
                    {showAmount && (showDays || showCount) && <Area yAxisId="amount" type="monotone" dataKey="Sum of Balance Payment" fill="transparent" stroke="transparent" isAnimationActive={false} stackId="paid" />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-medium">No data available for trend</div>
        )}
      </CardContent>
    </Card>
  );
}
