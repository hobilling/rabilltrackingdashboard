import React, { useMemo, useContext } from 'react';
import { AppContext } from '../App';
import BulletGraph from '../components/dashboard/BulletGraph';
import ParetoChart from '../components/dashboard/ParetoChart';
import TATTrendChart from '../components/dashboard/analytics/TATTrendChart';
import ReasonForHold from '../components/dashboard/analytics/ReasonForHold';
import { PivotAnalyzer } from '../components/dashboard/analytics/PivotAnalyzer';
import InteractiveScorecards from '../components/dashboard/InteractiveScorecards';
import { ArrowLeft, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export default function TATDashboard() {
  const context = useContext(AppContext);

  const processedData = useMemo(() => {
    return context?.filteredData || [];
  }, [context?.filteredData]);

  const defaultRows = useMemo(() => ["Project", "Billing Eng Name"], []);

  const kpis = useMemo(() => {
    const avg = (arr: (number | null | undefined)[]) => {
      const valid = arr.filter(n => n !== null && n !== undefined && !isNaN(n)) as number[];
      return valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) : 0;
    };

    const targets = context?.targets || { site: 5, ho: 1.5, accounts: 6 };
    const totalTarget = targets.site + targets.ho + targets.accounts;

    return [
      { id: 'site', title: 'Average of Site TAT Days', value: avg(processedData.map(i => i['Site Days'])), color: '#3B82F6', max: 15, target: targets.site }, 
      { id: 'ho', title: 'Average of HO TAT Days', value: avg(processedData.map(i => i['HO Days'])), color: '#3B82F6', max: 5, target: targets.ho }, 
      { id: 'accounts', title: 'Average of Account TAT Days', value: avg(processedData.map(i => i['Account Days'])), color: '#3B82F6', max: 12, target: targets.accounts }, 
      { id: 'total', title: 'Average of Inward To Payment TAT Days', value: avg(processedData.map(i => i['Inward to Payment Cycle Days'])), color: '#3B82F6', max: 25, target: totalTarget }, 
    ];
  }, [processedData, context?.targets]);

  return (
    <div className="bg-gray-50/50 animate-in fade-in duration-500 text-gray-800 font-sans flex flex-col min-h-full">
      <div className="max-w-[1700px] mx-auto w-full flex flex-col gap-1.5 p-1 flex-1 min-h-fit">
        {/* Dashboard Grid - KPI and Pareto combined vertically in one column */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-1 pb-1">
            {kpis.map((kpi) => (
                <Card key={kpi.id} className="border border-gray-200 shadow-sm flex flex-col h-[188px] overflow-hidden pt-[5px] pb-0">
                    <CardContent className="px-1 py-0 flex-1 flex flex-col gap-0 font-sans">
                        <div className="flex-shrink-0 pt-0 pb-1 border-b border-gray-100">
                            <BulletGraph 
                                title={kpi.title}
                                value={kpi.value}
                                target={kpi.target}
                                max={kpi.max}
                                thresholds={context?.thresholds}
                            />
                        </div>
                        <div className="flex-1 min-h-[0] pt-0 pb-0">
                            <div className="w-full h-full relative">
                                <div className="absolute inset-0">
                                    <ParetoChart 
                                        data={processedData}
                                        dataKey={kpi.id === 'total' ? 'Inward to Payment Cycle Days' : kpi.id === 'site' ? 'Site Days' : kpi.id === 'ho' ? 'HO Days' : 'Account Days'}
                                        yLabel={`No. of Bills by ${kpi.id === 'total' ? 'Inward to Pay...' : kpi.id.charAt(0).toUpperCase() + kpi.id.slice(1) + ' Days'}`}
                                        xLabel={kpi.id === 'total' ? 'Inward to Payment Cycle Days' : kpi.id.charAt(0).toUpperCase() + kpi.id.slice(1) + ' Days'}
                                        maxDays={kpi.max * 2}
                                        color="#4E9EF3"
                                        target={kpi.target}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
<div className="flex flex-col gap-4 min-h-fit w-full">
   {/* Trend Chart */}
   <div className="w-full h-[350px]">
       <TATTrendChart data={processedData} />
   </div>
   {/* Funnel Charts Row (Reason for Hold) */}
   <div className="w-full h-fit">
       <ReasonForHold data={processedData} />
   </div>
   {/* Dynamic Pivot Analyzer */}
   <div className="pb-2">
       <PivotAnalyzer 
           data={processedData}   
           allData={context?.data || []}  
           pageId="tat"   
           defaultRows={defaultRows}  
       />
   </div>
</div>

        {/* Bottom Status Bar (Optional) */}
        <div className="pt-2 mt-auto flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest border-t border-gray-100">
            <div>Data Last Updated: {format(new Date(), 'dd-MM-yyyy HH:mm')}</div>
        </div>
      </div>
    </div>
  );
}
