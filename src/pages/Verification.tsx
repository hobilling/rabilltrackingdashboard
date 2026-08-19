import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, FileSpreadsheet, RefreshCw, ExternalLink, Activity, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Verification() {
  const context = useContext(AppContext);
  const [metadata, setMetadata] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      const sid = localStorage.getItem('invoice_sid');
      const res = await fetch('/api/verification', {
        headers: { 'x-session-id': sid || '' }
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setMetadata(data);
        } else {
          const text = await res.text();
          console.error("Metadata fetch returned non-JSON:", text.substring(0, 100));
        }
      }
    } catch (err) {
      console.error("Metadata fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const totalRawRows = metadata.reduce((acc, curr) => acc + curr.rowCount, 0);
  const totalProcessedRows = metadata.reduce((acc, curr) => acc + curr.processedRows, 0);
  const totalBlankRows = metadata.reduce((acc, curr) => acc + (curr.blankRows || 0), 0);
  const totalHeaderRows = metadata.length * 2;
  const uniqueSites = new Set(metadata.map(m => m.siteName)).size;
  const totalSheets = metadata.length;

  const sortedMetadata = [...metadata].sort((a, b) => a.siteName.localeCompare(b.siteName));

  return (
    <div className="space-y-2 p-2 max-w-[1240px] mx-auto animate-in fade-in duration-500">
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-gray-100 divide-y md:divide-y-0">
            <MetricItem label="Source Rows" value={totalRawRows.toLocaleString()} icon={<Activity className="w-3.5 h-3.5 text-gray-400" />} />
            <MetricItem label="Transformed" value={totalProcessedRows.toLocaleString()} icon={<CheckCircle className="w-3.5 h-3.5 text-blue-500" />} />
            <MetricItem label="BlankRows" value={totalBlankRows.toLocaleString()} icon={<XCircle className="w-3.5 h-3.5 text-orange-400" />} />
            <MetricItem label="HeaderRows" value={totalHeaderRows.toLocaleString()} icon={<FileSpreadsheet className="w-3.5 h-3.5 text-gray-500" />} />
            <MetricItem label="Unique Projects" value={uniqueSites} icon={<Database className="w-3.5 h-3.5 text-emerald-500" />} />
            <MetricItem label="Active Sheets" value={totalSheets} icon={<FileSpreadsheet className="w-3.5 h-3.5 text-amber-500" />} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-gray-50 flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-xs font-black text-gray-400 uppercase tracking-widest">Data Source Verification</CardTitle>
            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">Validation of sheet extraction and transformation pipeline</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow className="border-none">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-8">Sheet Name</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-8">Link</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-8 text-right">Source</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-8 text-right">Processed</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-8 text-right">Blank</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-8 text-right">Header</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMetadata.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-xs text-gray-400 font-medium italic">
                      No metadata available. Refresh data to populate logs.
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(
                    sortedMetadata.reduce((acc, item) => {
                      if (!acc[item.siteName]) acc[item.siteName] = [];
                      acc[item.siteName].push(item);
                      return acc;
                    }, {} as Record<string, typeof sortedMetadata>)
                  ).map(([siteName, items]: [string, any], siteIdx) => (
                    <React.Fragment key={siteName}>
                      <TableRow className="bg-gray-100 hover:bg-gray-100 border-none">
                        <TableCell colSpan={6} className="py-2 px-4 shadow-sm z-10 sticky top-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-gray-800 uppercase tracking-wide">{siteIdx + 1}) {siteName}</span>
                            <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-gray-500 font-bold border border-gray-200">{items.length} sheets</span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {items.map((item, idx) => (
                        <TableRow key={`${siteName}-${idx}`} className="hover:bg-gray-50/50 transition-colors border-gray-50 group">
                          <TableCell className="py-1 pl-8 text-[11px] font-medium text-gray-500">{siteIdx + 1}.{idx + 1}) {item.sheetName}</TableCell>
                          <TableCell className="py-1">
                            <a 
                              href={`https://docs.google.com/spreadsheets/d/${item.spreadsheetId}${(item.sheetId !== null && item.sheetId !== undefined) ? `/edit#gid=${item.sheetId}` : ''}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-gray-100 rounded-md inline-block text-emerald-600 hover:text-emerald-700 transition-colors"
                              title="Open Google Sheet"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            </a>
                          </TableCell>
                          <TableCell className="py-1 text-[11px] font-bold text-gray-400 text-right italic">
                            {item.rowCount}
                          </TableCell>
                          <TableCell className="py-1 text-[11px] font-black text-blue-600 text-right">
                            {item.processedRows}
                          </TableCell>
                          <TableCell className="py-1 text-[11px] font-black text-orange-400 text-right">
                            {item.blankRows}
                          </TableCell>
                          <TableCell className="py-1 text-[11px] font-bold text-gray-400 text-right italic">
                            2
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800">
        <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />
        <div className="text-xs">
          <p className="font-bold mb-1 uppercase tracking-widest text-[10px]">Verification Logic</p>
          <p className="leading-relaxed opacity-80">
            This view validates the data pipeline. <strong>Source Rows</strong> represents the raw data fetched from Google Sheets. 
            <strong>Transformed (Valid)</strong> shows the count after skipping header rows (2 rows) and filtering out records 
            with empty 'Status' values. A 100% yield is rare as sheets often contain blank trailing rows.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricItem({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="p-4 flex flex-col gap-1 items-center justify-center text-center">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-xl font-black text-gray-900">{value}</p>
    </div>
  );
}
