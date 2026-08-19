import React, { useMemo } from 'react';
import { 
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Line, Cell, ReferenceLine, Brush
} from 'recharts';

interface ParetoChartProps {
  data: any[];
  dataKey: string;
  xLabel: string;
  yLabel: string;
  color?: string;
  maxDays?: number;
  target?: number;
}

export default function ParetoChart({ data, dataKey, xLabel, yLabel, color = '#3B82F6', maxDays = 30, target }: ParetoChartProps) {
  const { chartData, actualMax, initialEndIndex } = useMemo(() => {
    if (!data.length) return { chartData: [], actualMax: 0, initialEndIndex: 0 };
    
    // Group counts by day - no longer clamping to maxDays
    const counts: Record<number, number> = {};
    const rawValues = data.map(d => d[dataKey]).filter(v => typeof v === 'number' && v >= 0);
    
    let maxVal = 0;
    rawValues.forEach(v => {
      const day = Math.floor(v);
      counts[day] = (counts[day] || 0) + 1;
      if (day > maxVal) maxVal = day;
    });

    const sortedDays = Object.keys(counts).map(Number).sort((a, b) => a - b);
    const total = rawValues.length;
    let cumulative = 0;

    const chartData = sortedDays.map(day => {
      cumulative += counts[day];
      return {
        day,
        count: counts[day],
        cumulative: total > 0 ? +((cumulative / total) * 100).toFixed(1) : 0,
      };
    });

    // Filter chart data to show up to ~90% cumulative
    const indexAt90 = chartData.findIndex(d => d.cumulative >= 90);
    const filteredData = indexAt90 !== -1 ? chartData.slice(0, indexAt90 + 1) : chartData;
    
    // Calculate max value from filtered data for ticks
    const currentMax = filteredData.length > 0 ? filteredData[filteredData.length - 1].day : maxVal;

    return { chartData: filteredData, actualMax: currentMax, initialEndIndex: filteredData.length - 1 };
  }, [data, dataKey]);

  // Determine chart width - scale if there are many days
  const chartWidth = Math.max(100, (actualMax + 1) * 3); // Approximately 3% width per day for visibility

  return (
    <div className="w-full h-full flex flex-col pt-0 pb-0.5 overflow-hidden">
      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 2, right: 30, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
            <XAxis 
              dataKey="day" 
              type="number"
              domain={[0, 'auto']}
              fontSize={8} 
              axisLine={{ stroke: '#E5E7EB' }} 
              tickLine={false} 
              tick={{ fill: '#4B5563', fontWeight: 'bold' }} 
              interval="preserveStartEnd"
              ticks={Array.from({ length: Math.ceil(actualMax / 2) + 1 }, (_, i) => i * 2)}
              tickFormatter={(v) => v.toLocaleString('en-IN', { minimumIntegerDigits: 2 })}
            />
            <YAxis 
              yAxisId="left"
              fontSize={8} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#9CA3AF', fontWeight: 'bold' }}
              tickFormatter={(v) => v.toLocaleString('en-IN')}
              width={25}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              fontSize={8} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6366F1', fontWeight: 'bold' }}
              tickFormatter={(v) => `${v}%`}
              width={30}
            />
            <Tooltip cursor={{ fill: '#F3F4F6', opacity: 0.8 }}
              wrapperStyle={{ zIndex: 100 }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
              labelFormatter={(label) => `Day ${Number(label).toLocaleString('en-IN', { minimumIntegerDigits: 2 })}`}
              formatter={(value: number, name: string) => {
                if (name === 'cumulative') return [`${value.toFixed(1)}%`, 'Cumulative'];
                return [value.toLocaleString('en-IN', { maximumFractionDigits: 0 }), 'No. of Bills'];
              }}
            />
            <Bar 
              yAxisId="left"
              dataKey="count" 
              fill={color} 
              radius={[1, 1, 0, 0]} 
              barSize={12} 
              opacity={0.8}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="cumulative" 
              stroke="#6366F1" 
              strokeWidth={2} 
              dot={false}
              connectNulls
            />
            {target !== undefined && !isNaN(target) && (
                <ReferenceLine 
                    yAxisId="left"
                    x={target} 
                    stroke="#000000" 
                    strokeDasharray="3 3" 
                    strokeWidth={1.5}
                    label={{ 
                        position: 'top', 
                        value: `${target}`, 
                        fill: '#000000', 
                        fontSize: 8, 
                        fontWeight: 'bold',
                        dy: -5
                    }}
                />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="text-center mt-0 h-[18px] flex items-center justify-center">
        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest pb-[2px]">{xLabel}</span>
      </div>
    </div>
  );
}
