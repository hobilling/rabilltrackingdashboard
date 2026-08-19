import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';

interface BulletGraphProps {
  title: string;
  value: number;
  target: number;
  max: number;
  units?: string;
  thresholds?: {
    needsImprovement: number;
    satisfactory: number;
    good: number;
    veryGood: number;
    maximum: number;
  };
}

export default function BulletGraph({ 
  title, 
  value, 
  target, 
  max, 
  units = 'Days',
  thresholds = {
    needsImprovement: 100,
    satisfactory: 125,
    good: 150,
    veryGood: 175,
    maximum: 200
  }
}: BulletGraphProps) {
  // Use thresholds to define ranges (all percentages of target)
  const rangeMax = (target * (thresholds?.maximum || 100)) / 100 || 1;
  
  const valPos = (value / rangeMax) * 100;
  const targetPos = (target / rangeMax) * 100; 
  
  // Threshold points in percentage of total width
  const maxThreshold = thresholds?.maximum || 200;
  const p1 = ((thresholds?.needsImprovement || 0) / maxThreshold) * 100 || 0;
  const p2 = ((thresholds?.satisfactory || 0) / maxThreshold) * 100 || 0;
  const p3 = ((thresholds?.good || 0) / maxThreshold) * 100 || 0;
  const p4 = ((thresholds?.veryGood || 0) / maxThreshold) * 100 || 0;

  return (
    <div className="w-full flex flex-col gap-0 pt-0 pb-0 px-2.5">
      <div className="flex justify-between items-baseline mb-0">
        <span className="text-[11px] font-bold text-gray-800 border-b border-gray-400 pb-0">{title}</span>
      </div>
      
      <div 
        className="h-10 w-full relative group cursor-pointer mt-2"
      >
        {/* Custom Tooltip */}
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-[100] invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-[#E5E7EB] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] rounded-[8px] p-2 pointer-events-none whitespace-nowrap">
          <div className="text-[10px] text-gray-500 flex justify-between gap-4">
            <span className="font-bold text-blue-600">Current</span> 
            <span>{value.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {units}</span>
          </div>
          <div className="text-[10px] text-gray-500 flex justify-between gap-4 mt-0.5">
            <span className="font-bold text-gray-700">Target</span> 
            <span>{target.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {units}</span>
          </div>
        </div>

        {/* Background Ranges (Segmented) */}
        <div className="absolute inset-0 h-6 top-1 flex rounded-[1px] overflow-hidden border border-gray-100">
            {/* Green (0 - 100%) */}
            <div style={{ width: `${p1}%` }} className="h-full bg-[#92D050]" />
            {/* Light Yellow (100% - 125%) */}
            <div style={{ width: `${p2 - p1}%` }} className="h-full bg-[#E8D06F]" />
            {/* Gold (125% - 150%) */}
            <div style={{ width: `${p3 - p2}%` }} className="h-full bg-[#E5C141]" />
            {/* Peach (150% - 175%) */}
            <div style={{ width: `${p4 - p3}%` }} className="h-full bg-[#EFAD8E]" />
            {/* Red (175% - 200%) */}
            <div className="flex-1 h-full bg-[#D9555C]" />
        </div>

        {/* Value Marker (Thick vertical line for current value) */}
        <div 
          className="absolute top-[0px] w-[5px] h-[36px] bg-black z-0 group-hover:bg-blue-600 transition-colors"
          style={{ left: `${Math.min(valPos, 100)}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute -top-4 w-10 text-center -left-[18px] text-[9px] font-black font-mono">
            {value.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </div>
        </div>

        {/* Target Marker (Vertical tick crossing the bar at 100%) */}
        <div 
          className="absolute top-[0px] h-[36px] w-[2px] bg-black z-0"
          style={{ left: `${targetPos}%`, transform: 'translateX(-50%)' }}
        />

        {/* Scale Ticks & Labels */}
        <div className="absolute -bottom-1 w-full h-4">
           {/* Tick marks */}
           <div className="relative w-full h-1">
             {(() => {
               const steps = 5; // number of segments (4 intervals)
               const stepSize = rangeMax / (steps - 1);
               return Array.from({ length: steps }).map((_, i) => (
                 <div 
                   key={i}
                   style={{ left: `${(i * stepSize / rangeMax) * 100}%` }} 
                   className="absolute w-[1px] h-[4px] bg-gray-400" 
                 />
               ));
             })()}
           </div>
           
           {/* Labels */}
            <div className="w-full relative h-3 mt-0.5">
              {(() => {
                const steps = 5;
                const stepSize = rangeMax / (steps - 1);
                return Array.from({ length: steps }).map((_, i) => {
                  const val = i * stepSize;
                  const pos = (val / rangeMax) * 100;
                  return (
                    <span 
                      key={i}
                      style={{ 
                        position: 'absolute', 
                        left: `${pos}%`, 
                        transform: 'translateX(-50%)',
                        fontSize: '9px'
                      }} 
                      className="font-bold text-gray-400 font-mono"
                    >
                      {val.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  );
                });
              })()}
            </div>
        </div>
      </div>
    </div>
  );
}
