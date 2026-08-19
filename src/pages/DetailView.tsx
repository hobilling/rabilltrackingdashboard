import React, { useState, useMemo, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { 
    TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { format } from 'date-fns';
import { 
  Search, Info, Download, ArrowUpDown, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, Filter, SortAsc, SortDesc, Printer, ChevronDown, FileDown 
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from "xlsx-js-style";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Popover, PopoverContent, PopoverTrigger 
} from '@/components/ui/popover';
import { DetailTimelineModal } from '../components/dashboard/analytics/DetailTimelineModal';
import { InvoiceRecord } from '../types';

// Sub-component for individual column multi-select dropdown filter
function ColumnFilterDropdown({ col }: { col: string }) {
  const context = useContext(AppContext);
  const [localSearch, setLocalSearch] = useState('');
  
  // Calculate unique values and their occurrence counts
  const valueCounts = useMemo(() => {
    if (!context?.data) return {};
    const counts: Record<string, number> = {};
    context.data.forEach(item => {
      const val = item[col];
      const strVal = val === null || val === undefined ? '(Blank)' : String(val).trim();
      counts[strVal] = (counts[strVal] || 0) + 1;
    });
    return counts;
  }, [context?.data, col]);

  const uniqueValues = useMemo(() => {
    return Object.keys(valueCounts).sort((a, b) => {
      if (a === '(Blank)') return 1;
      if (b === '(Blank)') return -1;
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [valueCounts]);

  const currentFilter = context?.columnFilters?.[col];

  // Map selection status (stored as array, or single string)
  const selectedValues = useMemo(() => {
    if (!currentFilter) return [];
    if (Array.isArray(currentFilter)) return currentFilter;
    return [currentFilter];
  }, [currentFilter]);

  const searchedValues = useMemo(() => {
    if (!localSearch) return uniqueValues;
    const searchLower = localSearch.toLowerCase();
    return uniqueValues.filter(val => val.toLowerCase().includes(searchLower));
  }, [uniqueValues, localSearch]);

  const handleToggleValue = (val: string) => {
    if (!context) return;
    const normVal = val === '(Blank)' ? '' : val;
    let nextSelection: string[];
    
    if (selectedValues.includes(normVal)) {
      nextSelection = selectedValues.filter(v => v !== normVal);
    } else {
      nextSelection = [...selectedValues, normVal];
    }

    context.setColumnFilters(prev => {
      const copy = { ...prev };
      if (nextSelection.length === 0) {
        delete copy[col];
      } else {
        copy[col] = nextSelection;
      }
      return copy;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (!context) return;
    context.setColumnFilters(prev => {
      const copy = { ...prev };
      if (checked) {
        copy[col] = uniqueValues.map(v => v === '(Blank)' ? '' : v);
      } else {
        delete copy[col];
      }
      return copy;
    });
  };

  const handleSelectSearchedOnly = () => {
    if (!context) return;
    context.setColumnFilters(prev => {
      const copy = { ...prev };
      copy[col] = searchedValues.map(v => v === '(Blank)' ? '' : v);
      return copy;
    });
  };

  const handleClear = () => {
    if (!context) return;
    context.setColumnFilters(prev => {
      const copy = { ...prev };
      delete copy[col];
      return copy;
    });
    setLocalSearch('');
  };

  const isAllSelected = uniqueValues.length > 0 && selectedValues.length === uniqueValues.length;
  const isSomeSelected = selectedValues.length > 0 && !isAllSelected;

  return (
    <Popover>
      <PopoverTrigger 
        className="h-5 w-5 p-0 rounded hover:bg-white/25 flex items-center justify-center bg-transparent shrink-0 cursor-pointer border-none outline-none"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Filter className={`w-3.5 h-3.5 transition-colors ${currentFilter ? 'text-yellow-300 fill-yellow-300/30' : 'text-white/70 group-hover:text-white'}`} />
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-64 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-[120] flex flex-col gap-2"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
          <span className="text-[10px] font-black uppercase text-gray-700 tracking-wider">Filter: {col}</span>
          {selectedValues.length > 0 && (
            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              {selectedValues.length} Selected
            </span>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <Input 
            placeholder="Search values..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-7 text-[10px] pl-7 pr-2 font-medium rounded-md border-gray-200 bg-slate-50 w-full"
          />
        </div>

        <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-700 select-none">
            <input 
              type="checkbox"
              checked={isAllSelected}
              ref={el => {
                if (el) el.indeterminate = isSomeSelected;
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
            />
            Select All
          </label>
          <div className="flex items-center gap-2">
            {localSearch && searchedValues.length > 0 && (
              <button onClick={handleSelectSearchedOnly} className="text-blue-600 hover:underline cursor-pointer">
                Searched Only
              </button>
            )}
            <button onClick={handleClear} className="text-red-500 hover:underline cursor-pointer">
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-44 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 border border-slate-100 rounded-md p-1 bg-slate-50/50">
          {searchedValues.length > 0 ? (
            searchedValues.map((val) => {
              const normVal = val === '(Blank)' ? '' : val;
              const isChecked = selectedValues.includes(normVal);
              return (
                <label key={val} className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-slate-100 text-[10px] text-gray-700 font-medium cursor-pointer select-none">
                  <div className="flex items-center gap-1.5 truncate">
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleValue(val)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3 shrink-0"
                    />
                    <span className="truncate max-w-[150px]">{val}</span>
                  </div>
                  <span className="font-mono text-[9px] text-gray-400 bg-white border border-gray-100 px-1 rounded">
                    {valueCounts[val]}
                  </span>
                </label>
              );
            })
          ) : (
            <div className="text-center py-4 text-[9px] font-bold text-gray-400 uppercase tracking-widest">No matching values</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DetailView() {
  const context = useContext(AppContext);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [selectedRecordForJourney, setSelectedRecordForJourney] = useState<InvoiceRecord | null>(null);
  const [tableHeight, setTableHeight] = useState<number | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [verticalScrollbarWidth, setVerticalScrollbarWidth] = useState(0);

  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (tableContainerRef.current && topScrollRef.current) {
      if (tableContainerRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
        tableContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    }
  };

  const handleTableResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const cardEl = e.currentTarget.closest('.resize-card') as HTMLDivElement;
    if (!cardEl) return;
    const startHeight = cardEl.offsetHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentY = moveEvent.clientY;
      const deltaY = currentY - startY;
      const newHeight = Math.max(350, startHeight + deltaY);
      setTableHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Get all unique keys from data sample to ensure we show everything
  const allColumns = useMemo(() => {
    if (!context?.data || context.data.length === 0) return [];
    
    const keys = new Set<string>();
    const sampleSize = 100;
    const sampleIndices = new Set<number>();
    for (let i = 0; i < Math.min(sampleSize, context.data.length); i++) sampleIndices.add(i);
    for (let i = Math.max(0, context.data.length - sampleSize); i < context.data.length; i++) sampleIndices.add(i);
    
    sampleIndices.forEach(idx => {
      const item = context.data[idx];
      if (item) Object.keys(item).forEach(key => keys.add(key));
    });

    const allKeys = Array.from(keys);

    // Categories
    const core = ['Project', 'Source'];
    const transformed = [
      'Site Days', 'HO Days', 'Account Days', 'Bill Process Days', 
      'Inward to Payment Cycle Days', 'Balance Payment', 'Payment Status'
    ];
    const hidden = ['_year', '_quarter', '_month', '_monthNum', '_searchStr'];

    const sheetColumns = allKeys.filter(k => 
      !core.includes(k) && 
      !transformed.includes(k) && 
      !hidden.includes(k) &&
      !k.startsWith('_')
    );

    const initialColumns = [...core, ...sheetColumns, ...transformed];

    // Rearrange columns per user request:
    // Before status add paid amount (keep cheque amount column as it is) and balance amount columns
    // After status need payment status column.
    const targetStatus = 'Status';
    const targetPaidAmount = 'Paid Amount';
    const targetBalancePayment = 'Balance Payment';
    const targetPaymentStatus = 'Payment Status';

    const movingKeys = [targetPaidAmount, targetBalancePayment, targetStatus, targetPaymentStatus];
    const baseColumns = initialColumns.filter(c => !movingKeys.includes(c));

    let insertIndex = baseColumns.indexOf('Bill Amount (Net Payble)');
    if (insertIndex === -1) {
      const origStatusIndex = initialColumns.indexOf('Status');
      insertIndex = Math.max(0, origStatusIndex - 1);
    } else {
      insertIndex = insertIndex + 1;
    }

    const rearranged = [
      ...baseColumns.slice(0, insertIndex),
      targetPaidAmount,
      targetBalancePayment,
      targetStatus,
      targetPaymentStatus,
      ...baseColumns.slice(insertIndex)
    ];

    return rearranged;
  }, [context?.data]);

  const toggleSort = (key: string) => {
    if (!context) return;
    let direction: 'asc' | 'desc' = 'asc';
    if (context.sortConfig && context.sortConfig.key === key && context.sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    context.setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...(context?.filteredData || [])];
    if (context?.sortConfig) {
      const { key, direction } = context.sortConfig;
      result.sort((a, b) => {
        const valA = (a as any)[key];
        const valB = (b as any)[key];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        const comparison = valA < valB ? -1 : 1;
        return direction === 'asc' ? comparison : -comparison;
      });
    }
    return result;
  }, [context?.filteredData, context?.sortConfig]);

  const currentData = useMemo(() => {
    return filteredAndSortedData.slice(0, rowsPerPage);
  }, [filteredAndSortedData, rowsPerPage]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
    if (bottom && currentData.length < filteredAndSortedData.length) {
      setRowsPerPage(prev => prev + 100);
    }
    if (topScrollRef.current && tableContainerRef.current) {
      if (topScrollRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
        topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    }
  };

  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    if (!tableContainer) return;

    const updateWidth = () => {
      setTableScrollWidth(tableContainer.scrollWidth);
      const sbWidth = tableContainer.offsetWidth - tableContainer.clientWidth;
      setVerticalScrollbarWidth(sbWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(tableContainer);

    const tableEl = tableContainer.querySelector('table');
    if (tableEl) {
      observer.observe(tableEl);
    }

    return () => {
      observer.disconnect();
    };
  }, [currentData, allColumns]);

  const hasActiveFilters = useMemo(() => {
    if (!context?.columnFilters) return false;
    return Object.values(context.columnFilters).some(v => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : v !== ''));
  }, [context?.columnFilters]);

  // Premium styled excel export via xlsx-js-style
  const exportToExcel = () => {
    try {
      const headers = allColumns;
      const dataRows = filteredAndSortedData.map(row => {
        return allColumns.map(col => {
          const v = row[col];
          return v === null || v === undefined ? '' : v;
        });
      });

      const wsData = [headers, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      const numRows = range.e.r + 1;
      const numCols = range.e.c + 1;

      let colWidths: Record<number, number> = {};

      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          const cell = ws[ref];
          if (!cell) continue;

          const isHeader = r === 0;
          const val = cell.v;

          let fillColor = "FFFFFF";
          let textColor = "1E293B"; // Slate-800
          let isBold = false;
          let alignment: any = { vertical: "center", horizontal: "left" };

          if (isHeader) {
            fillColor = "1E293B"; // Dark slate
            textColor = "FFFFFF";
            isBold = true;
            alignment.horizontal = "center";
          } else {
            if (r % 2 === 0) fillColor = "F8FAFC"; // alternating
            if (typeof val === 'number') alignment.horizontal = "right";
          }

          cell.s = {
            fill: { fgColor: { rgb: fillColor } },
            font: {
              name: "Segoe UI",
              sz: isHeader ? 10 : 9.5,
              bold: isBold,
              color: { rgb: textColor }
            },
            alignment: alignment,
            border: {
              top: { style: "thin", color: { rgb: "E2E8F0" } },
              bottom: { style: "thin", color: { rgb: "E2E8F0" } },
              left: { style: "thin", color: { rgb: "E2E8F0" } },
              right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
          };

          const colName = headers[c] || "";
          if (!isHeader && typeof val === 'number') {
            if (colName.toLowerCase().includes('amount') || colName.toLowerCase().includes('balance')) {
              cell.t = 'n';
              cell.z = '"\u20B9"#,##0;("\u20B9"#,##0);"-"';
            } else {
              cell.t = 'n';
              cell.z = '#,##0';
            }
          }

          const charLen = String(val).length || 5;
          colWidths[c] = Math.max(colWidths[c] || 10, charLen + 3);
        }
      }

      ws["!cols"] = Object.keys(colWidths).map((colIdx) => ({
        wch: Math.min(55, colWidths[Number(colIdx)])
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Detailed Report");
      XLSX.writeFile(wb, `invoice_detailed_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (err) {
      console.error("Excel export error", err);
    }
  };

  // Styled landscape A4 PDF export
  const exportToPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Invoice Detailed Registry", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleString()} • Total Records: ${filteredAndSortedData.length}`, 14, 21);

      const tableHeaders = [["#", ...allColumns]];
      const tableRows = filteredAndSortedData.map((row, idx) => {
        return [
          idx + 1,
          ...allColumns.map(col => {
            const v = row[col];
            if (v === null || v === undefined) return '-';
            if (typeof v === 'number') {
              if (col.toLowerCase().includes('amount') || col.toLowerCase().includes('balance')) {
                return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
              }
              return v.toString();
            }
            if (typeof v === 'string' && v.includes('T') && !isNaN(Date.parse(v))) {
              try {
                return format(new Date(v), 'dd-MMM-yyyy');
              } catch (e) {
                return v.split('T')[0];
              }
            }
            return String(v);
          })
        ];
      });

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 25,
        styles: {
          fontSize: 6,
          cellPadding: 1,
          valign: "middle",
          font: "helvetica",
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 6,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        theme: "grid",
        margin: { top: 22, bottom: 15, left: 10, right: 10 },
      });

      doc.save(`Invoice_Detailed_Registry_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error("PDF Export error", err);
    }
  };

  // Styled printing using native window
  const printTable = () => {
    try {
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        console.error("Print window could not be opened.");
        return;
      }

      const doc = printWindow.document;
      const style = `
        <style>
          @media print {
            @page { size: auto; margin: 10mm; }
          }
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 20px; }
          table { width: 100%; max-width: 100%; border-collapse: collapse; font-size: 8.5px; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; overflow: hidden; word-wrap: break-word; }
          th { background-color: #f1f5f9; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .text-right { text-align: right; }
          .whitespace-nowrap { white-space: nowrap; }
        </style>
      `;

      const headerHtml = `
        <tr>
          <th>#</th>
          ${allColumns.map(col => `<th>${col}</th>`).join('')}
        </tr>
      `;

      const bodyHtml = filteredAndSortedData.map((row, idx) => {
        return `
          <tr>
            <td>${idx + 1}</td>
            ${allColumns.map(col => {
              const v = row[col];
              if (v === null || v === undefined) return '<td>-</td>';
              if (typeof v === 'number') {
                if (col.toLowerCase().includes('amount') || col.toLowerCase().includes('balance')) {
                  return `<td class="text-right whitespace-nowrap">₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>`;
                }
                return `<td class="text-right">${v}</td>`;
              }
              if (typeof v === 'string' && v.includes('T') && !isNaN(Date.parse(v))) {
                try {
                  return `<td class="whitespace-nowrap">${format(new Date(v), 'dd-MMM-yyyy')}</td>`;
                } catch (e) {
                  return `<td class="whitespace-nowrap">${v.split('T')[0]}</td>`;
                }
              }
              return `<td>${String(v)}</td>`;
            }).join('')}
          </tr>
        `;
      }).join('');

      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Invoice Detailed Registry - Print</title>
            ${style}
          </head>
          <body>
            <h2 style="margin: 0 0 4px 0; font-size: 16px;">Invoice Detailed Registry Report</h2>
            <div style="margin-bottom: 12px; font-size: 10px; color: #64748b;">
              Generated on: ${new Date().toLocaleString()} • Active Records: ${filteredAndSortedData.length}
            </div>
            <table>
              <thead>
                ${headerHtml}
              </thead>
              <tbody>
                ${bodyHtml}
              </tbody>
            </table>
          </body>
        </html>
      `);
      doc.close();

      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    } catch (error) {
      console.error("Print error", error);
    }
  };

  const renderCell = (key: string, value: any) => {
    if (value === null || value === undefined) return <span className="text-gray-300">-</span>;
    
    // Numeric rendering
    if (typeof value === 'number') {
      if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance')) {
        return (
          <div className="flex justify-end w-full">
            <span className="text-[13px] font-normal text-gray-700 flex items-center gap-0.5">
              ₹{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        );
      }
      return <span className="text-[13px] font-normal text-gray-600">{value}</span>;
    }

    // Status rendering
    if (key === 'Status' || key === 'Payment Status') {
      const sVal = String(value || "");
      const sValLower = sVal.toLowerCase();
      
      let textColor = 'text-gray-750'; // default
      
      if (key === 'Status') {
        if (sValLower.includes('send to account') || sValLower.includes('sent to account') || sValLower.includes('08')) {
          // send to account is cyan here dark due to cyan is also banded rows
          textColor = 'text-[#006f7b]'; // Dark Cyan/Teal (safe on both white and light-cyan rows)
        } else if (
          (sValLower.includes('site') && !sValLower.includes('cheque') && !sValLower.includes('cheqe')) || 
          sValLower.includes('send to ho') || 
          sValLower.includes('sent to ho') || 
          sValLower.includes('05')
        ) {
          // status contains site (exclude cheque) and send to ho are amber colour
          textColor = 'text-amber-600';
        } else if (sValLower.includes('hold') || sValLower.includes('04') || sValLower.includes('07')) {
          textColor = 'text-red-500';
        } else if (sValLower.includes('cleared') || sValLower.includes('cheque') || sValLower.includes('10') || sValLower.includes('09')) {
          textColor = 'text-emerald-600';
        } else {
          textColor = 'text-blue-600';
        }
      } else if (key === 'Payment Status') {
        if (sValLower.includes('cleared')) {
          textColor = 'text-emerald-600';
        } else if (sValLower.includes('partial')) {
          textColor = 'text-amber-600';
        } else {
          textColor = 'text-red-500';
        }
      }
      
      return (
        <span className={`text-[13px] font-normal tracking-tight whitespace-nowrap ${textColor}`}>
          {value}
        </span>
      );
    }

    // Date rendering check
    if (typeof value === 'string' && value.includes('T') && !isNaN(Date.parse(value))) {
        try {
            return <span className="text-gray-600 whitespace-nowrap">{format(new Date(value), 'dd-MMM-yyyy')}</span>;
        } catch (e) {
            return <span className="text-gray-600 whitespace-nowrap">{value.split('T')[0]}</span>;
        }
    }

    return <span className="text-gray-700 truncate max-w-[200px] inline-block">{String(value)}</span>;
  };

  return (
    <div 
      className="flex-none w-full flex flex-col animate-in fade-in duration-700 px-2 pb-2"
      style={{ height: '630px' }}
    >
      <Card 
        className="border border-gray-100 shadow-xl rounded-2xl flex flex-col overflow-hidden bg-white pt-0 pb-0 resize-card relative h-full"
        style={{ minHeight: '350px' }}
      >
        <CardHeader 
          className="flex flex-row items-center justify-end p-0 pb-[2px] bg-white shrink-0 border-b border-gray-100 h-[30px] space-y-0"
          style={{ marginBottom: '-16px' }}
        >
          <div className="flex items-center gap-3 pt-0 pb-[1px] pl-[1px] pr-[1px]">
              {hasActiveFilters && (
                <Button 
                  onClick={() => {
                      if (context) {
                        context.setColumnFilters({});
                        setCurrentPage(1);
                      }
                  }} 
                  variant="outline" 
                  className="rounded-lg h-[25px] gap-1.5 text-[9px] font-black uppercase tracking-widest border-gray-100 hover:bg-black hover:text-white transition-all px-3 text-red-500 cursor-pointer mt-[15px]"
                >
                    Clear Filters
                </Button>
              )}

              {/* Exact popover dropdown structure like in PivotAnalyzer */}
              <Popover open={isExportDropdownOpen} onOpenChange={setIsExportDropdownOpen}>
                <PopoverTrigger className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-black hover:text-white hover:border-black transition-all h-[25px] gap-1.5 px-3 text-[9px] font-black uppercase tracking-widest outline-none select-none cursor-pointer mt-[15px]">
                  <FileDown className="w-3.5 h-3.5 text-gray-600 group-hover/button:text-white" /> 
                  Export / Print 
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover/button:text-white" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-40 p-1 bg-white border border-gray-200 rounded-lg shadow-md z-[110] flex flex-col gap-1">
                  <button 
                    onClick={() => {
                      exportToExcel();
                      setIsExportDropdownOpen(false);
                    }}
                    className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-emerald-600" /> Export Excel
                  </button>
                  <button 
                    onClick={() => {
                      exportToPDF();
                      setIsExportDropdownOpen(false);
                    }}
                    className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-red-600" /> Export PDF
                  </button>
                  <button 
                    onClick={() => {
                      printTable();
                      setIsExportDropdownOpen(false);
                    }}
                    className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-gray-750 hover:bg-slate-50 font-semibold transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-600" /> Print Table
                  </button>
                </PopoverContent>
              </Popover>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 pt-0 pb-[6px] flex-1 flex flex-col relative overflow-hidden shadow-sm bg-white min-h-0 w-full h-full">
          <div 
            className="flex-1 flex flex-col min-h-0 w-full h-full overflow-hidden"
            style={{ height: '576px', marginTop: '-13px' }}
          >
            {/* Top Scrollbar synchronized with table horizontal scroll */}
            <div className="flex w-full items-center mt-[12px] shrink-0">
              <div 
                ref={topScrollRef}
                className="overflow-x-auto overflow-y-hidden flex-1 custom-scrollbar bg-slate-50/50"
                style={{ height: '9px', minHeight: '9px', marginTop: '0px', marginBottom: '0px' }}
                onScroll={handleTopScroll}
              >
                <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
              </div>
              {/* Dummy spacer to match the vertical scrollbar of the table below */}
              {verticalScrollbarWidth > 0 && (
                <div style={{ width: `${verticalScrollbarWidth}px` }} className="shrink-0 bg-slate-50/50 h-[9px]" />
              )}
            </div>

            <div 
              ref={tableContainerRef}
              className="overflow-auto custom-scrollbar w-full h-full flex-1"
              style={{ height: '509px' }}
              onScroll={handleScroll}
            >
              <table id="pivot-table-element" className="relative min-w-full table-auto border-separate border-spacing-0 w-full caption-bottom text-sm font-sans">
              {/* Google Sheets Styled Table Header */}
              <TableHeader className="sticky top-0 z-20">
                <TableRow className="hover:bg-transparent h-8">
                  {/* Top-Left intersection cell (styled as Sheets corner header) */}
                  <TableHead className="w-12 h-8 px-2 py-1 border-r border-b border-[#cbd5e1] bg-[#f1f3f4] text-center select-none text-[11px] font-bold text-[#5f6368] sticky top-0 left-0 z-40">
                    #
                  </TableHead>
                  {allColumns.map((col) => (
                    <TableHead key={col} className="h-8 px-2 py-1 border-r border-b border-[#006f7b] bg-[#00838f] group sticky top-0 z-30">
                      <div className="flex items-center justify-between gap-2 w-full h-full">
                         <div 
                          className="flex items-center gap-1.5 cursor-pointer select-none flex-1 min-w-0"
                          onClick={() => toggleSort(col)}
                         >
                            <span className="text-[13px] font-bold text-white tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                              {col}
                            </span>
                            {context?.sortConfig?.key === col ? (
                              context.sortConfig.direction === 'asc' ? (
                                <SortAsc className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                              ) : (
                                <SortDesc className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                         </div>
                          <div className="shrink-0 flex items-center">
                            <ColumnFilterDropdown col={col} />
                          </div>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.length > 0 ? (
                  currentData.map((row, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <TableRow 
                        key={idx} 
                        onClick={() => setSelectedRecordForJourney(row)}
                        className={`transition-colors h-[21px] group ${isEven ? 'bg-white' : 'bg-[#e8f7f8]'} hover:bg-[#b2ebf2]/30 cursor-pointer select-none`}
                        title="Click to view centralized application journey"
                      >
                        {/* Sticky Left Gray Row Number index cell */}
                        <TableCell className="px-2 py-[1.5px] h-[21px] text-[11px] font-normal text-[#5f6368] border-r border-b border-[#cbd5e1] text-center whitespace-nowrap bg-[#f1f3f4] sticky left-0 z-10 select-none">
                          {idx + 1}
                        </TableCell>
                        {allColumns.map(col => (
                          <TableCell 
                            key={col} 
                            className="px-2 py-[1.5px] h-[21px] text-[13px] font-normal leading-[14px] border-r border-b border-[#e0e0e0] text-gray-800 whitespace-nowrap"
                          >
                            {renderCell(col, row[col])}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={allColumns.length + 1} className="h-40 text-center bg-white">
                      <div className="flex flex-col items-center justify-center space-y-2">
                         <Search className="w-8 h-8 text-gray-200" />
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No records found matching your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </table>
          </div>
        </div>
      </CardContent>

        {/* Footer / Bottom Resize Bar inside the Card to align with native resize behavior */}
        <div 
          className="flex items-center justify-between px-3 pt-0 pb-0 bg-slate-50 border-t border-slate-150 text-[9px] font-black text-slate-400 uppercase tracking-widest select-none shrink-0 relative"
          style={{ marginBottom: '5px', marginTop: '-16px' }}
        >
          <span>Showing {currentData.length} of {filteredAndSortedData.length} records</span>
          <div className="flex items-center gap-2 tracking-[0.2em] pr-4">
             <Info className="w-2.5 h-2.5 text-slate-400" />
             Enterprise Grade Data Grid • Full Excel Compatibility
          </div>
        </div>

        {/* Table Bottom Resize Handle matching the PivotAnalyzer design */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-100 hover:bg-slate-200 cursor-ns-resize flex items-center justify-center border-t border-gray-250 select-none z-[40] transition-colors"
          onMouseDown={handleTableResizeMouseDown}
        >
          <div className="w-12 h-1 bg-gray-400 rounded-full" />
        </div>
      </Card>

      {/* Centralized Application Journey & Bill Details Drawer */}
      {selectedRecordForJourney && (
        <DetailTimelineModal 
          records={[selectedRecordForJourney]} 
          title="Centralised Application Journey & Bill Details" 
          onClose={() => setSelectedRecordForJourney(null)} 
        />
      )}
    </div>
  );
}
