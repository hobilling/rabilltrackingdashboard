import React, { useMemo, useState, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '../../../App';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, Cell, LabelList, PieChart, Pie } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ReasonForHold({ data }: { data: any[] }) {
  const context = useContext(AppContext);
  const [metric, setMetric] = useState<'count' | 'amount'>('count');

  const handleReset = useCallback(() => {
    setMetric('count');
  }, []);

  const isChanged = useMemo(() => {
    return metric !== 'count';
  }, [metric]);

  useEffect(() => {
    if (context?.registerResetPivot) {
      context.registerResetPivot('reasonForHold', handleReset);
    }
    return () => {
      if (context?.unregisterResetPivot) {
        context.unregisterResetPivot('reasonForHold');
      }
    };
  }, [context?.registerResetPivot, context?.unregisterResetPivot, handleReset]);

  useEffect(() => {
    if (context?.setModuleChanged) {
      context.setModuleChanged('reasonForHold', isChanged);
    }
  }, [context?.setModuleChanged, isChanged]);

  const { siteData, hoData, sitePieData, hoPieData } = useMemo(() => {
    let siteHoldCount = 0;
    let siteNoHoldCount = 0;
    let siteHoldAmount = 0;
    let siteNoHoldAmount = 0;
    
    let hoHoldCount = 0;
    let hoNoHoldCount = 0;
    let hoHoldAmount = 0;
    let hoNoHoldAmount = 0;
    
    const siteAgg = new Map<string, number>();
    const hoAgg = new Map<string, number>();
    
    data.forEach(item => {
      const siteVal = item['Reason For Hold at Site'];
      const hoVal = item['Reason For Hold at HO'];
      const amount = Number(item['Bill Amount (Net Payble)']) || 0;
      
      let isSiteHold = false;
      let isHoHold = false;

      if (siteVal && siteVal !== 'None' && siteVal !== 'N/A' && siteVal.trim() !== '') {
        const current = siteAgg.get(siteVal) || 0;
        siteAgg.set(siteVal, current + (metric === 'count' ? 1 : amount));
        isSiteHold = true;
      }
      if (hoVal && hoVal !== 'None' && hoVal !== 'N/A' && hoVal.trim() !== '') {
        const current = hoAgg.get(hoVal) || 0;
        hoAgg.set(hoVal, current + (metric === 'count' ? 1 : amount));
        isHoHold = true;
      }

      if (isSiteHold) {
        siteHoldCount += 1;
        siteHoldAmount += amount;
      } else {
        siteNoHoldCount += 1;
        siteNoHoldAmount += amount;
      }

      if (isHoHold) {
        hoHoldCount += 1;
        hoHoldAmount += amount;
      } else {
        hoNoHoldCount += 1;
        hoNoHoldAmount += amount;
      }
    });

    const processAgg = (agg: Map<string, number>) => {
        let result = Array.from(agg.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        if (result.length > 12) result = result.slice(0, 12);
        const max = Math.max(...result.map(d => d.value), 1);
        return result.map(d => ({ ...d, spacer: (max - d.value) / 2 }));
    };

    const siteHoldTotal = metric === 'count' ? siteHoldCount : siteHoldAmount;
    const siteNoHoldTotal = metric === 'count' ? siteNoHoldCount : siteNoHoldAmount;
    
    const hoHoldTotal = metric === 'count' ? hoHoldCount : hoHoldAmount;
    const hoNoHoldTotal = metric === 'count' ? hoNoHoldCount : hoNoHoldAmount;
    
    return { 
        siteData: processAgg(siteAgg), 
        hoData: processAgg(hoAgg), 
        sitePieData: [
            { name: 'Hold', value: siteHoldTotal },
            { name: 'No Hold', value: siteNoHoldTotal }
        ],
        hoPieData: [
            { name: 'Hold', value: hoHoldTotal },
            { name: 'No Hold', value: hoNoHoldTotal }
        ]
    };
  }, [data, metric]);

  const formatter = (value: number) => {
      if (metric === 'count') return value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const renderLabel = (props: any) => {
    const { x, y, width, height, value, index } = props;
    const formatted = formatter(value);
    
    // Simple heuristic to hide if bar width is too small for text
    const textWidthEstimate = formatted.length * 6;
    if (width < textWidthEstimate + 10) return null;

    return (
      <text x={x + width / 2} y={y + height / 2} fill="#ffffff" fontSize={10} fontWeight="bold" textAnchor="middle" dominantBaseline="central">
        {formatted}
      </text>
    );
  };

  return (
    <Card className="border border-gray-200 shadow-sm h-[450px] flex flex-col overflow-hidden pt-[5px] pb-[5px]" style={{ paddingTop: '5px', paddingBottom: '5px', height: '450px' }}>
      <CardHeader className="p-0 px-2 flex-shrink-0 flex flex-row items-center justify-between z-10 border-b border-gray-100 bg-gray-50/50 min-h-0 py-0 pt-0 pb-0" style={{ paddingTop: '0px', paddingBottom: '0px' }}>
        <div className="flex items-center gap-2">
          <CardTitle className="text-[11px] font-black text-gray-900 uppercase tracking-widest leading-none">Reason For Hold</CardTitle>
          {isChanged && (
            <span
              className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer uppercase tracking-wider ml-1"
              onClick={handleReset}
            >
              Reset
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-full border border-gray-200">
            <button 
                onClick={() => setMetric('count')}
                className={`px-4 py-1 rounded-full text-[11px] font-black transition-all ${metric === 'count' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-700 hover:text-gray-900'}`}
            >
                No. of Bills
            </button>
            <button 
                onClick={() => setMetric('amount')}
                className={`px-4 py-1 rounded-full text-[11px] font-black transition-all ${metric === 'amount' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-700 hover:text-gray-900'}`}
            >
                Bill Amount
            </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 w-full grid grid-cols-2 gap-0 p-0 relative items-stretch bg-white">
        <div className="flex-1 flex flex-col relative pr-2">
            <div className="flex flex-col items-center mb-0" style={{ paddingLeft: '240px', paddingRight: '10px' }}>
                <div className="text-[10px] font-black text-gray-900 uppercase tracking-widest mt-0 mb-0" style={{ marginTop: '0px', marginBottom: '0px' }}>Site</div>
                <div className="w-[60px] h-[60px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={sitePieData} 
                                cx="50%" cy="50%" 
                                innerRadius={18} 
                                outerRadius={27} 
                                dataKey="value" 
                                nameKey="name"
                                stroke="none"
                            >
                                <Cell fill="#3B82F6" />
                                <Cell fill="#E5E7EB" />
                            </Pie>
                            <ReTooltip 
                                wrapperStyle={{ zIndex: 100 }}
                                contentStyle={{ fontSize: '10px', padding: '4px 8px' }} 
                                formatter={(val: number) => formatter(val)} 
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {sitePieData[0].value > 0 && (
                            <span className="text-[10px] font-black text-blue-600">
                                {((sitePieData[0].value / (sitePieData[0].value + sitePieData[1].value)) * 100).toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {siteData.length > 0 ? (
                <div className="w-full h-[310px]" style={{ height: '310px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={siteData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barCategoryGap="2%">
                            <XAxis type="number" hide />
                            <YAxis 
                                type="category" 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 11, fill: '#000000', fontWeight: '900' }} 
                                width={240}
                            />
                            <ReTooltip cursor={{ fill: '#F3F4F6' }}
                                wrapperStyle={{ zIndex: 100 }}
                                contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number, name: string) => [name === 'spacer' ? null : formatter(value), metric === 'count' ? 'No. of Bills' : 'Amount']}
                            />
                            <Bar dataKey="spacer" stackId="a" fill="transparent" isAnimationActive={false} />
                            <Bar dataKey="value" stackId="a" fill="#3B82F6" radius={2}>
                                <LabelList content={renderLabel} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-medium">No site hold data</div>
            )}
        </div>

        <div className="flex-1 flex flex-col relative border-l border-gray-100 pl-2">
            <div className="flex flex-col items-center mb-0" style={{ paddingRight: '240px' }}>
                <div className="text-[10px] font-black text-gray-900 uppercase tracking-widest mt-0 mb-0" style={{ marginTop: '0px', marginBottom: '0px' }}>HO</div>
                <div className="w-[60px] h-[60px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={hoPieData} 
                                cx="50%" cy="50%" 
                                innerRadius={18} 
                                outerRadius={27} 
                                dataKey="value" 
                                nameKey="name"
                                stroke="none"
                            >
                                <Cell fill="#3B82F6" />
                                <Cell fill="#E5E7EB" />
                            </Pie>
                            <ReTooltip 
                                wrapperStyle={{ zIndex: 100 }}
                                contentStyle={{ fontSize: '10px', padding: '4px 8px' }} 
                                formatter={(val: number) => formatter(val)} 
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {hoPieData[0].value > 0 && (
                            <span className="text-[10px] font-black text-blue-600">
                                {((hoPieData[0].value / (hoPieData[0].value + hoPieData[1].value)) * 100).toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {hoData.length > 0 ? (
                <div className="w-full h-[310px]" style={{ height: '310px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hoData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="2%">
                            <XAxis type="number" hide />
                            <YAxis 
                                orientation="right"
                                type="category" 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 11, fill: '#000000', fontWeight: '900' }} 
                                width={240}
                            />
                            <ReTooltip cursor={{ fill: '#F3F4F6' }}
                                wrapperStyle={{ zIndex: 100 }}
                                contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number, name: string) => [name === 'spacer' ? null : formatter(value), metric === 'count' ? 'No. of Bills' : 'Amount']}
                            />
                            <Bar dataKey="spacer" stackId="a" fill="transparent" isAnimationActive={false} />
                            <Bar dataKey="value" stackId="a" fill="#3B82F6" radius={2}>
                                <LabelList content={renderLabel} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-medium">No HO hold data</div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
