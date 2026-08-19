import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface GaugeCardProps {
  title: string;
  value: number | string;
  icon?: any;
  color: string;
  max?: number;
  target?: number;
}

export default function GaugeCard({ title, value, icon: Icon, color, max = 30, target }: GaugeCardProps) {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const data = [
    { value: numericValue },
    { value: Math.max(0, max - numericValue) }
  ];

  // Calculate target marker data
  const targetData = target ? [
    { value: target - 0.2 },
    { value: 0.4 }, // Target notch
    { value: max - target - 0.2 }
  ] : [];

  const isOverTarget = target ? numericValue > target : false;

  return (
    <Card className={`overflow-hidden border-none shadow-sm h-full flex flex-col bg-white rounded-sm border ${isOverTarget ? 'border-red-200' : 'border-gray-100'} transition-colors`}>
      <CardContent className="p-4 flex-1 flex flex-col items-center justify-center relative">
        <div className="absolute top-3 left-4 flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</span>
            {target && (
              <div className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded-full">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-tighter leading-none">Target: {target}</p>
              </div>
            )}
        </div>

        <div className="w-full h-36 mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={75}
                outerRadius={100}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                <Cell key="value-cell" fill={isOverTarget ? '#EF4444' : color} />
                <Cell key="background-cell" fill="#F3F4F6" />
              </Pie>
              {target && (
                <Pie
                  data={targetData}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell key="target-left" fill="transparent" />
                  <Cell key="target-notch" fill="#000" />
                  <Cell key="target-right" fill="transparent" />
                </Pie>
              )}
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
            <div className="flex flex-col items-center">
              <span className={`text-xl font-black ${isOverTarget ? 'text-red-600' : 'text-gray-900'}`}>{value}</span>
              <p className={`text-[9px] font-black uppercase tracking-widest leading-none ${isOverTarget ? 'text-red-400' : 'text-gray-400'}`}>Days</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
