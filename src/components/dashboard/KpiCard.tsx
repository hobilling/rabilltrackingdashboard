import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: {
    value: string | number;
    label: string;
    isUp: boolean;
  };
}

export default function KpiCard({ title, value, icon: Icon, color, trend }: KpiCardProps) {
  return (
    <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex h-32">
          <div className={`w-2 h-full ${color}`} />
          <div className="flex-1 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</span>
              <div className={`p-2 rounded-lg opacity-80 ${color.replace('bg-', 'bg-opacity-10 text-')}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black text-gray-900 tracking-tight">{value}</h3>
              {trend && (
                <div className={`flex items-center text-[10px] font-bold ${trend.isUp ? 'text-green-500' : 'text-red-500'}`}>
                    {trend.isUp ? '↑' : '↓'} {trend.value}
                    <span className="text-gray-400 ml-1 font-normal uppercase">{trend.label}</span>
                </div>
              )}
            </div>

            {/* Micro bar indicator */}
            <div className="w-full bg-gray-100 h-1 rounded-full mt-2 overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: '70%' }}
                 className={`h-full ${color}`}
               />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
