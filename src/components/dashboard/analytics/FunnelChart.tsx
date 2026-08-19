import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, Cell, LabelList, PieChart, Pie } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function FunnelChart({ data, dataKey, title }: { data: any[], dataKey: string, title?: string }) {
  const [metric, setMetric] = useState<'count' | 'amount'>('count');

  const { chartData, pieData } = useMemo(() => {
    let holdCount = 0;
    let noHoldCount = 0;
    let holdAmount = 0;
    let noHoldAmount = 0;
    
    const aggregates = new Map<string, number>();
    
    data.forEach(item => {
      const val = item[dataKey];
      const amount = Number(item['Bill Amount (Net Payble)']) || 0;
      
      if (val && val !== 'None' && val !== 'N/A' && val.trim() !== '') {
        const current = aggregates.get(val) || 0;
        aggregates.set(val, current + (metric === 'count' ? 1 : amount));
        
        holdCount += 1;
        holdAmount += amount;
      } else {
        noHoldCount += 1;
        noHoldAmount += amount;
      }
    });

    let result = Array.from(aggregates.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Keep top 12 to avoid clutter
    if (result.length > 12) result = result.slice(0, 12);

    const max = Math.max(...result.map(d => d.value), 1);

    const funnelData = result.map(d => ({
      ...d,
      spacer: (max - d.value) / 2
    }));
    
    const holdTotal = metric === 'count' ? holdCount : holdAmount;
    const noHoldTotal = metric === 'count' ? noHoldCount : noHoldAmount;
    
    const finalPieData = [
       { name: 'Hold', value: holdTotal },
       { name: 'No Hold', value: noHoldTotal }
    ];

    return { chartData: funnelData, pieData: finalPieData };
  }, [data, dataKey, metric]);

    const formatter = (value: number) => {
      if (metric === 'count') return value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

  return (
    <Card className="border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
      <CardHeader className="p-0 px-2 flex-shrink-0 flex flex-row items-center justify-between z-10 relative min-h-0 py-0.5">
        <div className="flex flex-col">
           <div className="flex items-center gap-2">
               <CardTitle className="text-[11px] font-black text-gray-800 uppercase tracking-widest leading-none">{title || `No. of Bills by ${dataKey}`}</CardTitle>
               
               <div className="w-[75px] h-[75px] relative">
                   <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                           <Pie 
                             data={pieData} 
                             cx="50%" cy="50%" 
                             innerRadius={22} 
                             outerRadius={34} 
                             dataKey="value" 
                             nameKey="name"
                             stroke="none"
                           >
                               <Cell fill="#3B82F6" />
                               <Cell fill="#E5E7EB" />
                           </Pie>
                           <ReTooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }} formatter={(val: number) => formatter(val)} />
                       </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {pieData[0].value > 0 && (
                          <span className="text-[10px] font-black text-blue-600">
                              {((pieData[0].value / (pieData[0].value + pieData[1].value)) * 100).toFixed(1)}%
                          </span>
                      )}
                   </div>
               </div>
           </div>
           <CardDescription className="text-[10px] uppercase font-bold -mt-1">Top Reasons</CardDescription>
        </div>
        
        <div className="flex items-center gap-3 bg-gray-50 p-1 px-2 rounded-md border border-gray-100 z-10">
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setMetric('count')}>
                <div className={`w-3 h-3 rounded-full border ${metric === 'count' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`} />
                <span className="text-[10px] font-bold text-gray-600">No. of Bills</span>
            </div>
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setMetric('amount')}>
                <div className={`w-3 h-3 rounded-full border ${metric === 'amount' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`} />
                <span className="text-[10px] font-bold text-gray-600">Amount</span>
            </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 w-full p-2 pb-4 overflow-hidden relative z-0">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }} barCategoryGap="15%">
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#000000', fontWeight: '900', dy: 4 }} 
                width={180}
              />
              <ReTooltip cursor={{ fill: '#F3F4F6' }}
                contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                 formatter={(value: number, name: string) => [name === 'spacer' ? null : formatter(value), metric === 'count' ? 'No. of Bills' : 'Amount']}
              />
              <Bar dataKey="spacer" stackId="a" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="a" fill="#1e90ff" radius={2}>
                 <LabelList dataKey="value" position="center" fill="#ffffff" fontSize={10} fontWeight="bold" formatter={(v: number) => formatter(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-medium">No hold data</div>
        )}
      </CardContent>
    </Card>
  );
}
