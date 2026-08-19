import React, { useState, useRef } from 'react';
import { LayoutDashboard, BarChart3, PieChart, FileText, RefreshCw, Menu, ChevronLeft, ChevronRight, Search, FilterX, Filter, CheckSquare, Square, X, ChevronDown, ChevronUp, Loader2, ExternalLink, FileSpreadsheet, Printer, RotateCcw, Settings, Calendar, Archive, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AppContext } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FilterPanel } from './FilterPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InteractiveScorecards from './dashboard/InteractiveScorecards';
import { format, isValid } from 'date-fns';
import { DetailTimelineModal } from './dashboard/analytics/DetailTimelineModal';
import { 
  getRecordGroup, 
  parseDateStr, 
  isValMissing, 
  checkChronologyViolations, 
  checkMissingFlowViolations,
  getAuditGroupsData,
  checkFutureDateViolations,
  isExemptFromDuplicates,
  isBillingPeriodExempt,
  isExemptFromMissingExcelNo
} from '../utils/auditUtils';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function Layout({ children, activePage, onPageChange }: LayoutProps) {
  const context = React.useContext(AppContext);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isSiteFilterExpanded, setIsSiteFilterExpanded] = useState(true);
  const [isProjectFilterOpen, setIsProjectFilterOpen] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  
  const [localSiteSelections, setLocalSiteSelections] = useState<typeof context.siteSelections | null>(null);
  
  const isAnyTicked = React.useMemo(() => {
      const currentSelections = localSiteSelections || context?.siteSelections || {};
      return Object.values(currentSelections).some((s: any) => s?.Invoice || s?.History);
  }, [localSiteSelections, context?.siteSelections]);

  const [fetchingTasks, setFetchingTasks] = useState<Record<string, boolean>>({});
  const taskControllers = React.useRef<Record<string, AbortController>>({});

  const activeSelectedProjects = React.useMemo(() => {
      const isInvoiceTab = activePage === 'tracking';
      const selected = (context?.projectMetadata || []).filter(s => {
          const sel = context?.siteSelections?.[s.spreadsheetId];
          return isInvoiceTab ? sel?.Invoice : sel?.History;
      });
      return {
          ids: selected.map(s => s.spreadsheetId),
          names: selected.map(s => s.siteConfigName)
      };
  }, [activePage, context?.projectMetadata, context?.siteSelections]);

  const exactTargetSheets = React.useMemo(() => {
    const list: Array<{
      spreadsheetId: string;
      spreadsheetName: string;
      sheetName: string;
      type: 'Invoice' | 'History';
    }> = [];
    
    if (!context?.projectMetadata || !context?.siteSelections) {
      return list;
    }
    
    context.projectMetadata.forEach(project => {
      const selections = context.siteSelections[project.spreadsheetId];
      if (!selections) return;
      
      const stats = project.sheetStats || [];
      stats.forEach(sheet => {
        const isInvoiceSelected = sheet.type === 'Invoice' && selections.Invoice;
        const isHistorySelected = sheet.type === 'History' && selections.History;
        
        if (isInvoiceSelected || isHistorySelected) {
          list.push({
            spreadsheetId: project.spreadsheetId,
            spreadsheetName: (project.extractedNames && project.extractedNames.length > 0) ? project.extractedNames.join(', ') : (project.siteConfigName || 'Unnamed'),
            sheetName: sheet.sheetName,
            type: sheet.type
          });
        }
      });
    });
    
    return list;
  }, [context?.projectMetadata, context?.siteSelections]);

  const [isCleaning, setIsCleaning] = useState(false);
  const [cleaningAction, setCleaningAction] = useState<'inward' | 'excel' | 'combined' | null>(null);
  const [lastRunAction, setLastRunAction] = useState<'inward' | 'excel' | 'combined' | null>(null);
  const [cleaningProgress, setCleaningProgress] = useState<{
    current: number;
    total: number;
    sheetName: string;
    updatedCount: number;
    resultsLog: Array<{ sheetName: string; updatesCount: number; status: string }>;
  } | null>(null);

  const [cleaningStatusMessage, setCleaningStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    text: string;
    description?: string;
  } | null>(null);

  const [cleaningConfirmTarget, setCleaningConfirmTarget] = useState<'inward' | 'excel' | 'combined' | null>(null);
  const [showLogDetails, setShowLogDetails] = useState(false);

  // --- Make History (Archive) State ---
  const [showHistoryWizard, setShowHistoryWizard] = useState(false);
  const [historyWizardProjects, setHistoryWizardProjects] = useState<Array<{
    spreadsheetId: string;
    siteConfigName: string;
    invoiceSheetName: string;
    historySheetName: string;
    records: any[];
  }>>([]);
  const [historyWizardIdx, setHistoryWizardIdx] = useState(0);
  const [historySelectedRows, setHistorySelectedRows] = useState<Record<number, boolean>>({}); // Sr no -> boolean
  const [historyWizardTab, setHistoryWizardTab] = useState<'grp1' | 'grp2' | 'grp3' | 'grp4' | 'grp5' | 'grp6' | 'grp7'>('grp7');
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveResultMsg, setArchiveResultMsg] = useState<{ type: 'success' | 'error' | 'warning', text: string; description?: string } | null>(null);
  const [historyArchiveErrorMsg, setHistoryArchiveErrorMsg] = useState<string | null>(null);
  const [transformedRows, setTransformedRows] = useState<Record<string, Array<{ oldSrNo: number; newSrNo: number; contractorName: string; billAmount: any; siteDate: string }>>>({});
  const [historyConfirmDetails, setHistoryConfirmDetails] = useState<{
    isOpen: boolean;
    projectName: string;
    sourceSheet: string;
    destSheet: string;
    numRows: number;
    lastNonBlankRow: number | null;
    insertStartRow: number | null;
    insertEndRow: number | null;
    loadingCheck: boolean;
    errorCheck: string | null;
  } | null>(null);

  // Ageing States for Wizard
  const [selectedDetailRecords, setSelectedDetailRecords] = useState<any[] | null>(null);
  const [detailTitle, setDetailTitle] = useState<string>("");
  const [ageingType, setAgeingType] = useState<'none' | 'custom'>('custom');
  const [ageingValue, setAgeingValue] = useState<number>(0);
  const [ageingUnit, setAgeingUnit] = useState<'months' | 'days'>('days');
  const [customAgeingDate, setCustomAgeingDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const dateInputRef = useRef<HTMLInputElement>(null);

  const calculatedAgeingDate = React.useMemo(() => {
    if (ageingType === 'none') return null;
    return new Date(customAgeingDate);
  }, [ageingType, customAgeingDate]);

  // Recalculate wizard items automatically when ageing selection changes
  React.useEffect(() => {
    if (showHistoryWizard) {
      startMakeHistoryWizard();
    }
  }, [calculatedAgeingDate]);

  // Keep wizard projects in sync with context.data when it updates
  React.useEffect(() => {
    if (showHistoryWizard && context?.data && context?.projectMetadata && context?.siteSelections) {
      const qualified = context.projectMetadata.filter(p => {
        const sel = context.siteSelections[p.spreadsheetId];
        return !!sel?.Invoice;
      });

      const targetDate = calculatedAgeingDate;
      const wizProjects: any[] = [];

      qualified.forEach(p => {
        const invoiceSheet = p.sheetStats?.find(s => s.type === 'Invoice');
        const historySheet = p.sheetStats?.find(s => s.type === 'History');
        if (!invoiceSheet || !historySheet) return;

        const pRecords = context.data.filter(r => {
          if (r.siteConfigName !== p.spreadsheetId) return false;
          
          const isTracking = r.Source?.toLowerCase().includes('invoice') || r.Source?.toLowerCase().includes('tracking');
          if (!isTracking) return false;
          
          const isCleared = r['Payment Status']?.toLowerCase().includes('cleared') || r['Status']?.toLowerCase().includes('cleared');
          if (!isCleared) return false;
          
          const pDate = parseDateStr(r._rawChequeRecdSiteDate ?? r['Cheque Recd. At Site Date']);
          if (!pDate) return false;
          
          if (!targetDate) return true;
          return pDate.getTime() < targetDate.getTime();
        });

        if (pRecords.length > 0) {
          wizProjects.push({
            spreadsheetId: p.spreadsheetId,
            siteConfigName: p.siteConfigName,
            invoiceSheetName: invoiceSheet.sheetName,
            historySheetName: historySheet.sheetName,
            records: pRecords
          });
        }
      });

      setHistoryWizardProjects(wizProjects);
    }
  }, [context?.data, showHistoryWizard]);

  const parseDateForHistory = (val: any): Date | null => {
    if (!val) return null;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    
    const mmmMatch = val.toString().match(/(\d{1,2})-(\w{3})-(\d{2,4})/);
    if (mmmMatch) {
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const day = parseInt(mmmMatch[1]);
      const monthStr = mmmMatch[2].toLowerCase();
      let year = parseInt(mmmMatch[3]);
      if (year < 100) year += 2000;
      if (months[monthStr] !== undefined) {
        const parsedDate = new Date(year, months[monthStr], day);
        if (!isNaN(parsedDate.getTime())) return parsedDate;
      }
    }
    return null;
  };

  const duplicateSubGroup = (records: any[]) => {
    const results: { project: string; source: string; items: any[] }[] = [];
    const visited = new Set<string>();

    const isValInvalid = (val: string) => {
      const v = val.toLowerCase().trim();
      return !v || v === "" || v === "0" || v === "na" || v === "n/a" || v.includes("advance") || v.includes("retention") || v.includes("quality release") || v.includes("sd release") || v.includes("sd-release");
    };

    records.forEach(r => {
      if (isExemptFromDuplicates(r)) return;
      const rUID = `${r.Project || 'N/A'}|||${r['Sr no']}`;
      if (visited.has(rUID)) return;

      const currentGroup: any[] = [];
      const queue: any[] = [r];
      visited.add(rUID);

      while (queue.length > 0) {
        const node = queue.shift()!;
        currentGroup.push(node);

        const hiWo = String(node['Highrise WO No'] || '').trim().toLowerCase();
        const hiRa = String(node['Highrise RA No'] || '').trim().toLowerCase();
        const excelNo = String(node['Excel RA Bill NO'] || '').trim().toLowerCase();

        const isHiValid = !isValInvalid(hiWo) && !isValInvalid(hiRa);
        const isExValid = !isValInvalid(hiWo) && !isValInvalid(excelNo);

        records.forEach(r2 => {
          const rUID2 = `${r2.Project || 'N/A'}|||${r2['Sr no']}`;
          if (visited.has(rUID2)) return;

          const hiWo2 = String(r2['Highrise WO No'] || '').trim().toLowerCase();
          const hiRa2 = String(r2['Highrise RA No'] || '').trim().toLowerCase();
          const excelNo2 = String(r2['Excel RA Bill NO'] || '').trim().toLowerCase();

          let match = false;
          if (isHiValid && hiWo === hiWo2 && hiRa === hiRa2) match = true;
          if (isExValid && hiWo === hiWo2 && excelNo === excelNo2) match = true;

          if (match) {
            visited.add(rUID2);
            queue.push(r2);
          }
        });
      }

      if (currentGroup.length > 0) {
        results.push({
          project: currentGroup[0].Project || 'N/A',
          source: currentGroup[0].Source || 'N/A',
          items: currentGroup
        });
      }
    });
    return results;
  };

  const startMakeHistoryWizard = () => {
    setHistoryArchiveErrorMsg(null);
    setArchiveResultMsg(null);
    
    if (!context?.projectMetadata || !context?.siteSelections) {
      setHistoryArchiveErrorMsg("No project details loaded.");
      return;
    }

    const qualified = context.projectMetadata.filter(p => {
      const sel = context.siteSelections[p.spreadsheetId];
      return !!sel?.Invoice;
    });

    if (qualified.length === 0) {
      setHistoryArchiveErrorMsg("The active tracking sheet ('Invoice' column) must be selected in the Projects filter for the projects you want to make history of.");
      return;
    }

    const targetDate = calculatedAgeingDate;
    const wizProjects: any[] = [];

    qualified.forEach(p => {
      const invoiceSheet = p.sheetStats?.find(s => s.type === 'Invoice');
      const historySheet = p.sheetStats?.find(s => s.type === 'History');
      if (!invoiceSheet || !historySheet) return;

      const pRecords = (context.data || []).filter(r => {
        if (r.siteConfigName !== p.spreadsheetId) return false;
        
        const isTracking = r.Source?.toLowerCase().includes('invoice') || r.Source?.toLowerCase().includes('tracking');
        if (!isTracking) return false;
        
        const isCleared = r['Payment Status']?.toLowerCase().includes('cleared') || r['Status']?.toLowerCase().includes('cleared');
        if (!isCleared) return false;
        
        const pDate = parseDateStr(r._rawChequeRecdSiteDate ?? r['Cheque Recd. At Site Date']);
        if (!pDate) return false;
        
        if (!targetDate) return true; // 'none' ageing, show all cleared
        return pDate.getTime() < targetDate.getTime();
      });

      if (pRecords.length > 0) {
        wizProjects.push({
          spreadsheetId: p.spreadsheetId,
          siteConfigName: p.siteConfigName,
          invoiceSheetName: invoiceSheet.sheetName,
          historySheetName: historySheet.sheetName,
          records: pRecords
        });
      }
    });

    if (wizProjects.length === 0) {
      setHistoryArchiveErrorMsg("No cleared tracking records older than 1 month were found in the selected projects.");
      return;
    }

    setHistoryWizardProjects(wizProjects);
    setHistoryWizardIdx(0);
    
    // Auto select all rows of first project - default to false (unticked)
    const firstProj = wizProjects[0];
    const initialSelection: Record<number, boolean> = {};
    firstProj.records.forEach(r => {
      initialSelection[r['Sr no']] = false;
    });
    setHistorySelectedRows(initialSelection);
    setTransformedRows({}); // Reset transformed rows when starting a new session
    setShowHistoryWizard(true);
  };

  const handlePreviousProject = () => {
    const prevIdx = historyWizardIdx - 1;
    if (prevIdx >= 0) {
      setHistoryWizardIdx(prevIdx);
      const prevProj = historyWizardProjects[prevIdx];
      const prevSelection: Record<number, boolean> = {};
      prevProj.records.forEach(r => {
        prevSelection[r['Sr no']] = false;
      });
      setHistorySelectedRows(prevSelection);
      setArchiveResultMsg(null);
    }
  };

  const handleNextProjectOrFinish = () => {
    const nextIdx = historyWizardIdx + 1;
    if (nextIdx < historyWizardProjects.length) {
      setHistoryWizardIdx(nextIdx);
      const nextProj = historyWizardProjects[nextIdx];
      const nextSelection: Record<number, boolean> = {};
      nextProj.records.forEach(r => {
        nextSelection[r['Sr no']] = false;
      });
      setHistorySelectedRows(nextSelection);
      setArchiveResultMsg(null);
    } else {
      // Completed last project!
      setShowHistoryWizard(false);
      setHistoryWizardProjects([]);
      setHistorySelectedRows({});
      setTransformedRows({});
      setHistoryWizardIdx(0);
      context?.refreshData?.();
    }
  };

  const triggerArchiveConfirmation = async () => {
    const currentProj = historyWizardProjects[historyWizardIdx];
    const selectedSrNos = currentProj.records
      .filter(r => {
        const alreadyMoved = (transformedRows[currentProj.spreadsheetId] || []).some(tr => tr.oldSrNo === r['Sr no']);
        return !alreadyMoved && !!historySelectedRows[r['Sr no']];
      })
      .map(r => r['Sr no']);

    if (selectedSrNos.length === 0) {
      setArchiveResultMsg({
        type: 'warning',
        text: "No rows selected",
        description: "Please select at least one row to archive, or click 'Skip' if you do not want to archive this project."
      });
      return;
    }

    const projectName = currentProj.records[0]?.['Project'] || currentProj.siteConfigName;
    const sourceSheet = currentProj.records[0]?.['Source'] || currentProj.invoiceSheetName;
    const destSheet = currentProj.historySheetName;

    setHistoryConfirmDetails({
      isOpen: true,
      projectName,
      sourceSheet,
      destSheet,
      numRows: selectedSrNos.length,
      lastNonBlankRow: null,
      insertStartRow: null,
      insertEndRow: null,
      loadingCheck: true,
      errorCheck: null
    });

    try {
      const checkRes = await fetch('/api/admin/history-row-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: currentProj.spreadsheetId,
          historySheetName: currentProj.historySheetName,
          numRows: selectedSrNos.length
        })
      });
      const checkData = await checkRes.json();
      if (checkData.success && checkData.check) {
        setHistoryConfirmDetails(prev => prev ? {
          ...prev,
          lastNonBlankRow: checkData.check.lastNonBlankRow,
          insertStartRow: checkData.check.insertStartRow,
          insertEndRow: checkData.check.insertEndRow,
          loadingCheck: false
        } : null);
      } else {
        setHistoryConfirmDetails(prev => prev ? {
          ...prev,
          loadingCheck: false,
          errorCheck: checkData.error || "Failed to fetch live row counts."
        } : null);
      }
    } catch (err: any) {
      setHistoryConfirmDetails(prev => prev ? {
        ...prev,
        loadingCheck: false,
        errorCheck: err.message || "Network error fetching sheet counts."
      } : null);
    }
  };

  const executeArchiveForCurrentProject = async () => {
    setHistoryConfirmDetails(null); // close confirmation dialog

    const currentProj = historyWizardProjects[historyWizardIdx];
    const selectedSrNos = currentProj.records
      .filter(r => {
        // filter out already moved rows
        const alreadyMoved = (transformedRows[currentProj.spreadsheetId] || []).some(tr => tr.oldSrNo === r['Sr no']);
        return !alreadyMoved && !!historySelectedRows[r['Sr no']];
      })
      .map(r => r['Sr no']);

    if (selectedSrNos.length === 0) {
      setArchiveResultMsg({
        type: 'warning',
        text: "No rows selected",
        description: "Please select at least one row to archive, or click 'Skip' if you do not want to archive this project."
      });
      return;
    }

    setIsArchiving(true);
    setArchiveResultMsg(null);

    try {
      const response = await fetch('/api/admin/make-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: currentProj.spreadsheetId,
          invoiceSheetName: currentProj.invoiceSheetName,
          historySheetName: currentProj.historySheetName,
          srNos: selectedSrNos
        })
      });

      const data = await response.json();
      if (data.success && data.result) {
        setArchiveResultMsg({
          type: 'success',
          text: "Archived successfully!",
          description: `${data.result.movedCount} records processed using make history.`
        });

        // Add to transformedRows tracking list
        if (data.result.movedRows && Array.isArray(data.result.movedRows)) {
          setTransformedRows(prev => ({
            ...prev,
            [currentProj.spreadsheetId]: [
              ...(prev[currentProj.spreadsheetId] || []),
              ...data.result.movedRows
            ]
          }));
        }

        // Untick moved items
        setHistorySelectedRows(prev => {
          const nextSel = { ...prev };
          selectedSrNos.forEach(sr => {
            nextSel[sr] = false;
          });
          return nextSel;
        });

        // Trigger our main refresh data button action code
        context?.refreshData?.();

      } else {
        setArchiveResultMsg({
          type: 'error',
          text: "Error during move operation",
          description: data.error || "Please verify spreadsheet cell formulas and try again."
        });
      }
    } catch (e: any) {
      setArchiveResultMsg({
        type: 'error',
        text: "Network or Server Error",
        description: e.message || "Could not complete transaction."
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const runSheetCleaning = (action: 'inward' | 'excel' | 'combined') => {
    setCleaningStatusMessage(null);
    setLastRunAction(null);
    const targets = exactTargetSheets;
    if (targets.length === 0) {
      setCleaningStatusMessage({
        type: 'warning',
        text: "No projects/sheets selected",
        description: "Please select at least one project column (Invoice or History) in the 'Projects' filter above first."
      });
      return;
    }
    // Set confirm state instead of calling browser confirm()
    setCleaningConfirmTarget(action);
  };

  const runSheetCleaningConfirmation = async (action: 'inward' | 'excel' | 'combined') => {
    const targets = exactTargetSheets;
    if (targets.length === 0) {
      setCleaningStatusMessage({
        type: 'warning',
        text: "No projects/sheets selected",
        description: "Please select at least one project column (Invoice or History) in the 'Projects' filter above first."
      });
      return;
    }

    setLastRunAction(action);
    let actionLabel = 'Date Correction';
    if (action === 'combined') {
      actionLabel = 'Inward & Excel RA Date Correction';
    } else if (action === 'inward') {
      actionLabel = 'Correct Inward Dates';
    } else if (action === 'excel') {
      actionLabel = 'Correct Excel RA Dates';
    }

    setIsCleaning(true);
    setCleaningAction(action);
    setCleaningStatusMessage(null);
    setCleaningProgress({
      current: 0,
      total: targets.length,
      sheetName: `${targets[0].spreadsheetName} (${targets[0].type})`,
      updatedCount: 0,
      resultsLog: []
    });

    let cumulativeCorrections = 0;
    const log: Array<{ sheetName: string; updatesCount: number; status: string }> = [];

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const projectWithSource = `${target.spreadsheetName} (${target.type})`;
      
      setCleaningProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        sheetName: projectWithSource,
        updatedCount: cumulativeCorrections
      } : null);

      try {
        let backendAction = 'inward_sync';
        if (action === 'combined') {
          backendAction = 'combined';
        } else if (action === 'excel') {
          backendAction = 'excel_violation';
        }

        const payload = {
          spreadsheetId: target.spreadsheetId,
          sheetName: target.sheetName,
          action: backendAction
        };

        const res = await fetch('/api/admin/cleanup-single-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success && data.result) {
          const count = data.result.updatesCount || 0;
          cumulativeCorrections += count;
          log.push({
            sheetName: projectWithSource,
            updatesCount: count,
            status: 'Success'
          });
        } else {
          log.push({
            sheetName: projectWithSource,
            updatesCount: 0,
            status: `Error: ${data.error || 'Unknown error'}`
          });
        }
      } catch (err: any) {
        log.push({
          sheetName: projectWithSource,
          updatesCount: 0,
          status: `Failed: ${err.message}`
        });
      }

      setCleaningProgress(prev => prev ? {
        ...prev,
        updatedCount: cumulativeCorrections,
        resultsLog: [...log]
      } : null);
    }

    // Refresh context data
    context?.refreshData();

    const successCount = log.filter(l => l.status === 'Success').length;
    const failedCount = log.filter(l => l.status !== 'Success').length;

    let messageType: 'success' | 'warning' | 'error' = 'success';
    let text = `${actionLabel} Completed!`;
    let desc = `Successfully processed ${successCount} of ${targets.length} sheet(s) with ${cumulativeCorrections} corrected dates.`;

    if (failedCount > 0) {
      if (successCount === 0) {
        messageType = 'error';
        text = `${actionLabel} Failed!`;
        desc = `All ${targets.length} selected sheet(s) failed with errors. Please expand 'Show Log Details' below to diagnose.`;
      } else {
        messageType = 'warning';
        desc = `Completed ${successCount} sheet(s) successfully (${cumulativeCorrections} corrected dates), but ${failedCount} sheet(s) returned errors. Check logs below.`;
      }
    }

    setCleaningStatusMessage({
      type: messageType,
      text: text,
      description: desc
    });

    setIsCleaning(false);
    setCleaningAction(null);
  };

  const handleSelectionToggle = React.useCallback(async (spreadsheetId: string, type: 'Invoice' | 'History', checked: boolean) => {
      setLocalSiteSelections(prev => {
          const next = { ...(prev || {}) };
          next[spreadsheetId] = { ...(next[spreadsheetId] || {Invoice: false, History: false}), [type]: checked };
          return next;
      });

      const taskKey = `${spreadsheetId}_${type}`;

      if (checked) {
          const controller = new AbortController();
          taskControllers.current[taskKey] = controller;
          setFetchingTasks(prev => ({ ...prev, [taskKey]: true }));

          try {
              const queryParams = new URLSearchParams();
              queryParams.set('selections', JSON.stringify({ [spreadsheetId]: { [type]: true } }));
              queryParams.set('refresh', 'true');
              await fetch(`/api/data?${queryParams.toString()}`, { signal: controller.signal });

              // Immediately fetch updated metadata to show row count immediately on the UI next to checkbox
              const metadataRes = await fetch(`/api/projects/metadata?refresh=true`, { signal: controller.signal });
              if (metadataRes.ok) {
                  const metaData = await metadataRes.json();
                  if (Array.isArray(metaData)) {
                      metaData.sort((a,b) => (a.siteConfigName || '').localeCompare(b.siteConfigName || ''));
                      context?.setProjectMetadata(metaData);
                  }
              }
          } catch (e: any) {
              if (e.name !== 'AbortError') console.error("Prefetch failed:", e);
          } finally {
              setFetchingTasks(prev => {
                  const next = { ...prev };
                  delete next[taskKey];
                  return next;
              });
          }
      } else {
          if (taskControllers.current[taskKey]) {
              taskControllers.current[taskKey].abort();
              delete taskControllers.current[taskKey];
          }
          setFetchingTasks(prev => {
              const next = { ...prev };
              delete next[taskKey];
              return next;
          });
      }
  }, []);

  const handleBulkSelection = React.useCallback(async (targetSelections: Record<string, { Invoice: boolean; History: boolean }>) => {
      const current = { ...(localSiteSelections || context?.siteSelections || {}) };
      
      setLocalSiteSelections(targetSelections);

      const tasksToStart: { spreadsheetId: string; type: 'Invoice' | 'History' }[] = [];
      const tasksToAbort: { spreadsheetId: string; type: 'Invoice' | 'History' }[] = [];

      const allSpreadsheetIds = new Set([
        ...(context?.projectMetadata || []).map(s => s.spreadsheetId),
        ...Object.keys(current),
        ...Object.keys(targetSelections)
      ]);

      allSpreadsheetIds.forEach(spreadsheetId => {
          ['Invoice', 'History'].forEach((typeStr) => {
              const type = typeStr as 'Invoice' | 'History';
              const oldVal = !!(current[spreadsheetId]?.[type]);
              const newVal = !!(targetSelections[spreadsheetId]?.[type]);
              if (oldVal !== newVal) {
                  if (newVal) {
                      tasksToStart.push({ spreadsheetId, type });
                  } else {
                      tasksToAbort.push({ spreadsheetId, type });
                  }
              }
          });
      });

      // 1. Abort deselected tasks
      tasksToAbort.forEach(({ spreadsheetId, type }) => {
          const taskKey = `${spreadsheetId}_${type}`;
          if (taskControllers.current[taskKey]) {
              taskControllers.current[taskKey].abort();
              delete taskControllers.current[taskKey];
          }
          setFetchingTasks(prev => {
              const next = { ...prev };
              delete next[taskKey];
              return next;
          });
      });

      // 2. Start prefetching checked tasks
      if (tasksToStart.length > 0) {
          setFetchingTasks(prev => {
              const next = { ...prev };
              tasksToStart.forEach(({ spreadsheetId, type }) => {
                  next[`${spreadsheetId}_${type}`] = true;
              });
              return next;
          });

          await Promise.all(tasksToStart.map(async ({ spreadsheetId, type }) => {
              const taskKey = `${spreadsheetId}_${type}`;
              const controller = new AbortController();
              taskControllers.current[taskKey] = controller;

              try {
                  const queryParams = new URLSearchParams();
                  queryParams.set('selections', JSON.stringify({ [spreadsheetId]: { [type]: true } }));
                  queryParams.set('refresh', 'true');
                  await fetch(`/api/data?${queryParams.toString()}`, { signal: controller.signal });
              } catch (e: any) {
                  if (e.name !== 'AbortError') console.error("Bulk prefetch failed:", e);
              } finally {
                  if (taskControllers.current[taskKey] === controller) {
                      delete taskControllers.current[taskKey];
                  }
                  setFetchingTasks(prev => {
                      const next = { ...prev };
                      delete next[taskKey];
                      return next;
                  });
              }
          }));

          try {
              const metadataRes = await fetch(`/api/projects/metadata?refresh=true`);
              if (metadataRes.ok) {
                  const metaData = await metadataRes.json();
                  if (Array.isArray(metaData)) {
                      metaData.sort((a,b) => (a.siteConfigName || '').localeCompare(b.siteConfigName || ''));
                      context?.setProjectMetadata(metaData);
                  }
              }
          } catch (err) {
              console.error("Bulk metadata refresh failed:", err);
          }
      }
  }, [localSiteSelections, context?.siteSelections, context?.projectMetadata, context?.setProjectMetadata]);

  const [isPageSelectorOpen, setIsPageSelectorOpen] = useState(false);
  const [showSettingsInline, setShowSettingsInline] = useState(false);
  const [showVisualConfigInline, setShowVisualConfigInline] = useState(false);
  const [showSheetMaintenanceInline, setShowSheetMaintenanceInline] = useState(false);

  const getNonEmptyStatusCount = React.useCallback((spreadsheetId: string, sourceType: 'Invoice' | 'History') => {
    if (!context?.data) return 0;
    const projectRecords = context.data.filter(item => {
      const isConfigMatch = item.siteConfigName === spreadsheetId;
      const belongsToSource = sourceType === 'Invoice'
        ? (item.Source || '').includes('Invoice Tracking')
        : (item.Source || '').includes('History Data');
      return isConfigMatch && belongsToSource;
    });
    return projectRecords.filter(item => item.Status && String(item.Status).trim() !== "").length;
  }, [context?.data]);

  React.useEffect(() => {
    if (isProjectFilterOpen && context?.siteSelections) {
      setLocalSiteSelections(context.siteSelections);
    }
  }, [isProjectFilterOpen, context?.siteSelections]);

  const sidebarVisible = isHovered;
  
  // Calculate manual filters (excluding auto-applied constraints)
  const manualFiltersList = React.useMemo(() => {
    if (!context) return [];
    
    const list: any[] = [];
    
    // Search is always manual
    if (context.globalSearch) {
      list.push({
        id: 'search',
        label: `Search: "${context.globalSearch}"`,
        clear: () => context.setGlobalSearch('')
      });
    }

    // Process column filters
    if (context.columnFilters) {
      Object.entries(context.columnFilters).forEach(([key, val]) => {
        const constraint = context.filterConstraints?.[key];
        
        // Helper to check if selection matches constraint exactly
        const isAutoFilter = () => {
          if (!constraint || constraint.length === 0) return false;
          if (!Array.isArray(val) || val.length === 0) return false;
          
          const s1 = [...val].sort().join(',').toLowerCase();
          const s2 = [...constraint].sort().join(',').toLowerCase();
          return s1 === s2;
        };

        if (isAutoFilter()) return;

        if (Array.isArray(val) && val.length > 0) {
          list.push({
            id: `col-${key}`,
            label: `${key}: ${val.join(', ')}`,
            clear: () => {
              context.setColumnFilters(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }
          });
        } else if (typeof val === 'string' && val) {
          list.push({
            id: `col-${key}`,
            label: `${key}: ${val}`,
            clear: () => {
              context.setColumnFilters(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }
          });
        }
      });
    }

    if (context.ageingDateRange && (context.ageingDateRange.from || context.ageingDateRange.to)) {
      const fromStr = context.ageingDateRange.from ? format(new Date(context.ageingDateRange.from), "dd MMM yy") : "Start";
      const toStr = context.ageingDateRange.to ? format(new Date(context.ageingDateRange.to), "dd MMM yy") : "End";
      const basisLabel = context.ageingBasis === "Inward Date" ? "Site Inward Date"
                       : context.ageingBasis === "Received at HO" ? "Received at HO Date"
                       : context.ageingBasis === "Certified at HO & Sent to Accounts on" ? "Send to account date"
                       : context.ageingBasis === "Cheque Recd. At Site Date" ? "Payment Date"
                       : context.ageingBasis;

      list.push({
        id: 'ageing-dates',
        label: `${basisLabel}: ${fromStr} - ${toStr}`,
        clear: () => {
          context.setAgeingDateRange({ from: null, to: null });
        }
      });
    }

    return list;
  }, [context?.globalSearch, context?.columnFilters, context?.filterConstraints, context?.ageingDateRange, context?.ageingBasis]);

  // Calculate if there are any active manual filters
  const hasActiveFilters = context && (
    manualFiltersList.length > 0 ||
    context.sortConfig !== null
  );

  // Calculate unique columns for filtering once
  const allAvailableColumns = React.useMemo(() => {
    if (!context?.data || context.data.length === 0) return [];
    // Just sample to be fast
    const keys = new Set<string>();
    const sampleSize = Math.min(100, context.data.length);
    for (let i = 0; i < sampleSize; i++) {
        Object.keys(context.data[i]).forEach(k => {
            if (!k.startsWith('_')) keys.add(k);
        });
    }
    return Array.from(keys).sort();
  }, [context?.data]);

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden">
      {/* Main Content (Full Width, Sidebar Removed) */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {context?.loading && (
          <div className="absolute inset-x-0 bottom-0 top-16 z-[30] flex items-center justify-center bg-white/10 backdrop-blur-[1px] pointer-events-auto">
            <div className="flex flex-col items-center">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4 shadow-xl rounded-full bg-white p-3 border border-blue-100" />
              <div className="flex flex-col gap-3 items-center bg-white px-6 py-4 rounded-2xl shadow-xl border border-blue-100">
                <span className="text-[11px] font-black uppercase text-blue-800 tracking-widest">Refreshing Data...</span>
                <button 
                  onClick={() => context.cancelFetch?.()}
                  className="text-[10px] uppercase font-black tracking-widest text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-1.5 rounded-full transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <header className="h-12 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 z-40 shadow-sm whitespace-nowrap" style={{ height: '40px', borderWidth: '1px' }}>
          <div className="flex items-center gap-3">
            {/* App Icon before Dropdown */}
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0 select-none">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>

            <Popover open={isPageSelectorOpen} onOpenChange={setIsPageSelectorOpen}>
              <PopoverTrigger className="flex items-center gap-2 px-3 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-gray-800">
                 {activePage === 'tat' && <BarChart3 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                {activePage === 'tracking' && <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                {activePage === 'detail' && <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                {activePage === 'verification' && <RefreshCw className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                {activePage === 'insights' && <PieChart className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                {activePage === 'today' && <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                <span className="text-xs font-black uppercase tracking-widest">
                  {activePage === 'tat' ? 'TAT Performance' : 
                   activePage === 'tracking' ? 'Tracking Sheet' :
                   activePage === 'verification' ? 'Data Verification' : 
                   activePage === 'insights' ? 'Insight Report' : 
                   activePage === 'today' ? 'Daily Dashboard' : 'Detailed Records'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-2 bg-white border border-gray-200 shadow-xl rounded-lg z-[80] max-h-[90vh] overflow-y-auto" align="start">
                <div className="flex flex-col gap-0.5">
                  {[
                    { id: 'tat', label: 'TAT Performance', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                    { id: 'tracking', label: 'Tracking Sheet', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
                    { id: 'detail', label: 'Detailed Records', icon: <FileText className="w-3.5 h-3.5" /> },
                    { id: 'verification', label: 'Data Verification', icon: <RefreshCw className="w-3.5 h-3.5" /> },
                    { id: 'insights', label: 'Insight Report', icon: <PieChart className="w-3.5 h-3.5" /> },
                    { id: 'today', label: 'Daily Dashboard', icon: <Calendar className="w-3.5 h-3.5" /> }
                  ].map((page) => (
                    <button
                      key={page.id}
                      onClick={() => {
                        onPageChange(page.id);
                        setIsPageSelectorOpen(false); // On selection collapse list
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-[10.5px] font-black uppercase tracking-widest rounded-md transition-colors cursor-pointer text-left",
                        activePage === page.id 
                          ? "bg-blue-50 text-blue-700 font-bold" 
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <span>{page.label}</span>
                      <span className={cn("shrink-0 ml-2", activePage === page.id ? "text-blue-600" : "text-gray-400")}>
                        {page.icon}
                      </span>
                    </button>
                  ))}

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const user = context?.user;
                      const isRealUser = user && !user.isServiceAccount;
                      
                      if (!isRealUser) {
                        context?.login();
                        return;
                      }

                      if (user.email === 'rb.hobilling@gmail.com') {
                        setShowSettingsInline(!showSettingsInline);
                      } else {
                        alert(`Access restricted to rb.hobilling@gmail.com. Current user: ${user.email}`);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-[10.5px] font-black uppercase tracking-widest rounded-md transition-colors cursor-pointer text-left",
                      showSettingsInline 
                        ? "bg-slate-50 text-slate-800 font-bold" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span>Settings</span>
                      {context?.user && !context.user.isServiceAccount && context.user.email !== 'rb.hobilling@gmail.com' && (
                        <span className="text-[8px] bg-red-100 text-red-600 px-1 rounded lowercase font-normal">Restricted</span>
                      )}
                    </div>
                    {showSettingsInline ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-600" />
                    ) : (
                      <Settings className="w-3.5 h-3.5 text-gray-500" />
                    )}
                  </button>

                  <AnimatePresence initial={false}>
                    {showSettingsInline && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-gray-50/70 rounded-md border border-gray-150 p-2.5 mt-1 text-left space-y-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Section 1: Visual Config accordion */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setShowVisualConfigInline(!showVisualConfigInline)}
                            className={cn(
                              "w-full pb-1 text-[9.5px] font-black uppercase tracking-wider text-left border-b-2 transition-all cursor-pointer flex justify-between items-center",
                              showVisualConfigInline
                                ? "border-amber-600 text-amber-800 font-black"
                                : "border-gray-200 text-gray-500 hover:text-gray-700 font-bold"
                            )}
                          >
                            <span>Visual Configuration</span>
                            {showVisualConfigInline ? (
                              <ChevronUp className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                            )}
                          </button>

                          <AnimatePresence initial={false}>
                            {showVisualConfigInline && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden space-y-3 pt-1"
                              >
                                <div className="space-y-1">
                                  <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-tighter block">Target Values</span>
                                  <div className="grid gap-1.5">
                                    <div className="grid grid-cols-2 items-center gap-2">
                                      <Label htmlFor="site-inline" className="text-[9px] font-bold uppercase text-gray-600">Site Target</Label>
                                      <Input
                                        id="site-inline"
                                        type="number"
                                        step="0.1"
                                        value={context?.targets?.site || 5}
                                        onChange={(e) => context?.updateTargets({ ...context.targets, site: parseFloat(e.target.value) || 0 })}
                                        className="h-7 text-[10px] font-bold px-2 py-0"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-2">
                                      <Label htmlFor="ho-inline" className="text-[9px] font-bold uppercase text-gray-600">HO Target</Label>
                                      <Input
                                        id="ho-inline"
                                        type="number"
                                        step="0.1"
                                        value={context?.targets?.ho || 1.5}
                                        onChange={(e) => context?.updateTargets({ ...context.targets, ho: parseFloat(e.target.value) || 0 })}
                                        className="h-7 text-[10px] font-bold px-2 py-0"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 items-center gap-2">
                                      <Label htmlFor="accounts-inline" className="text-[9px] font-bold uppercase text-gray-600">Accounts Target</Label>
                                      <Input
                                        id="accounts-inline"
                                        type="number"
                                        step="0.1"
                                        value={context?.targets?.accounts || 6}
                                        onChange={(e) => context?.updateTargets({ ...context.targets, accounts: parseFloat(e.target.value) || 0 })}
                                        className="h-7 text-[10px] font-bold px-2 py-0"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1 border-t border-gray-200 pt-2">
                                  <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-tighter block">Threshold %</span>
                                  <div className="grid gap-1.5">
                                    {[
                                      { id: 'needsImprovement', label: 'Needs Imp. %' },
                                      { id: 'satisfactory', label: 'Satisfactory %' },
                                      { id: 'good', label: 'Good %' },
                                      { id: 'veryGood', label: 'Very Good %' },
                                      { id: 'maximum', label: 'Maximum %' }
                                    ].map((item) => (
                                      <div key={item.id} className="grid grid-cols-2 items-center gap-2">
                                        <Label htmlFor={`${item.id}-inline`} className="text-[9px] font-bold uppercase text-gray-600">{item.label}</Label>
                                        <Input
                                          id={`${item.id}-inline`}
                                          type="number"
                                          value={context?.thresholds?.[item.id as keyof typeof context.thresholds] || 0}
                                          onChange={(e) => context?.updateThresholds({ 
                                            ...context.thresholds, 
                                            [item.id]: parseInt(e.target.value) || 0 
                                          })}
                                          className="h-7 text-[10px] font-bold px-2 py-0"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Section 2: Sheet Maintenance accordion */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setShowSheetMaintenanceInline(!showSheetMaintenanceInline)}
                            className={cn(
                              "w-full pb-1 text-[9.5px] font-black uppercase tracking-wider text-left border-b-2 transition-all cursor-pointer flex justify-between items-center",
                              showSheetMaintenanceInline
                                ? "border-orange-600 text-orange-800 font-black"
                                : "border-gray-200 text-gray-500 hover:text-gray-700 font-bold"
                            )}
                          >
                            <span>Sheet Maintenance</span>
                            {showSheetMaintenanceInline ? (
                              <ChevronUp className="w-3.5 h-3.5 text-orange-600" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                            )}
                          </button>

                          <AnimatePresence initial={false}>
                            {showSheetMaintenanceInline && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden space-y-3 pt-1"
                              >
                                <div className="text-[8.5px] bg-slate-50 border border-slate-100 rounded-lg p-2 font-bold text-gray-600 leading-normal select-none">
                                  <span className="text-orange-600">Selected Target: </span>
                                  {exactTargetSheets.length} sheet{exactTargetSheets.length === 1 ? '' : 's'} / tab{exactTargetSheets.length === 1 ? '' : 's'} config 
                                  ({context?.projectMetadata?.reduce((sum, p) => {
                                    const sel = context?.siteSelections?.[p.spreadsheetId];
                                    let types = [];
                                    if (sel?.Invoice) types.push('Inv');
                                    if (sel?.History) types.push('Hist');
                                    if (types.length > 0) sum++;
                                    return sum;
                                  }, 0)} active projects)
                                </div>

                                <div className="space-y-4 pt-1">
                                  {/* Unified Inward & Excel RA Date Correction Action Group */}
                                  <div className="space-y-2">
                                    <Button 
                                      variant="default" 
                                      size="sm" 
                                      disabled={isCleaning}
                                      className="h-8 text-[9.5px] font-extrabold uppercase tracking-widest bg-orange-600 hover:bg-orange-700 text-white border-0 transition-all text-left flex justify-between items-center w-full shadow-md cursor-pointer animate-none"
                                      title="Inward & Excel RA Date Correction: Standardizes formats to dd-MMM-yy and corrects inward dates to min of subsequent milestone dates, and corrects Excel RA dates to min of sequence dates (excluding inward and excel original dates). Exempts 25 to 30 March dates automatically."
                                      onClick={() => runSheetCleaning('combined')}
                                    >
                                      <span className={cn(isCleaning && "opacity-50")}>Inward & Excel RA Date Correction</span>
                                      <RotateCcw className="w-3.5 h-3.5 ml-1 text-white animate-none" />
                                    </Button>

                                    {cleaningConfirmTarget === 'combined' && (
                                      <div className="bg-orange-50/75 border border-orange-200 rounded-lg p-2.5 space-y-2 mt-1 shadow-sm">
                                        <div className="text-[9.5px] text-orange-950 font-bold leading-normal">
                                          Confirm Action: Run Inward & Excel RA Date Correction on {exactTargetSheets.length} sheet(s) configuration?
                                          <p className="text-[8.5px] font-medium mt-1 text-orange-850">
                                            This checks and corrects Inward Dates and Excel RA Dates line-by-line across selected projects. 25–30 March dates of Highrise RA and Excel RA are automatically exempted to preserve financial year-end rules.
                                          </p>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 text-[9px] hover:bg-orange-100/60 text-orange-900 px-2 font-black uppercase cursor-pointer"
                                            onClick={() => setCleaningConfirmTarget(null)}
                                          >
                                            Cancel
                                          </Button>
                                          <Button 
                                            variant="default" 
                                            size="sm" 
                                            className="h-6 text-[9px] bg-orange-600 hover:bg-orange-700 text-white px-3 font-black uppercase cursor-pointer"
                                            onClick={() => {
                                              setCleaningConfirmTarget(null);
                                              runSheetCleaningConfirmation('combined');
                                            }}
                                          >
                                            Proceed
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                    {isCleaning && cleaningAction === 'combined' && cleaningProgress && (
                                      <div className="p-2 bg-orange-50/60 border border-orange-100 rounded-lg space-y-1.5 shadow-inner">
                                        <div className="flex justify-between items-center">
                                          <span className="text-[8.5px] font-black text-orange-850 uppercase tracking-wider animate-pulse flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-ping" />
                                            Correcting...
                                          </span>
                                          <span className="text-[9px] font-mono font-black text-orange-900 bg-orange-100 px-1 rounded">
                                            {cleaningProgress.current} / {cleaningProgress.total}
                                          </span>
                                        </div>

                                        <div className="h-1.5 w-full bg-orange-100 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-orange-600 transition-all duration-300"
                                            style={{ width: `${(cleaningProgress.current / cleaningProgress.total) * 100}%` }}
                                          />
                                        </div>

                                        <div className="text-[8px] text-gray-700 space-y-0.5">
                                          <div className="font-bold truncate text-gray-800 bg-white/60 p-1 rounded border border-gray-100">
                                            {cleaningProgress.sheetName}
                                          </div>
                                          <div className="flex justify-between items-center font-bold px-0.5 pt-0.5">
                                            <span>Total corrected edits:</span>
                                            <span className="text-orange-700 bg-orange-50 px-1 rounded border border-orange-100">
                                              {cleaningProgress.updatedCount} items
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {!isCleaning && lastRunAction === 'combined' && cleaningProgress && (
                                      <div className="space-y-2">
                                        {cleaningStatusMessage && (
                                          <div className={cn(
                                            "p-2 rounded-lg border text-[9.5px] font-bold relative group space-y-1 transition-all",
                                            cleaningStatusMessage.type === 'success' && "bg-green-50/80 border-green-200 text-green-950",
                                            cleaningStatusMessage.type === 'warning' && "bg-orange-50/85 border-orange-200 text-orange-950",
                                            cleaningStatusMessage.type === 'error' && "bg-red-50 border-red-200 text-red-955",
                                            cleaningStatusMessage.type === 'info' && "bg-blue-50 border-blue-200 text-blue-900"
                                          )}>
                                            <div className="flex items-start justify-between">
                                              <span>{cleaningStatusMessage.text}</span>
                                              <button 
                                                onClick={() => setCleaningStatusMessage(null)}
                                                className="text-[9px] text-gray-400 hover:text-gray-600 cursor-pointer p-0.5 bg-transparent border-0"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                            {cleaningStatusMessage.description && (
                                              <p className="text-[8.5px] font-medium opacity-90 leading-relaxed font-sans">
                                                {cleaningStatusMessage.description}
                                              </p>
                                            )}
                                          </div>
                                        )}

                                        {cleaningProgress.resultsLog.length > 0 && (
                                          <div className="space-y-1">
                                            <button 
                                              onClick={() => setShowLogDetails(!showLogDetails)}
                                              className="text-[8.5px] font-black text-slate-500 uppercase hover:text-slate-800 flex items-center gap-1 bg-transparent border-0 py-1"
                                            >
                                              {showLogDetails ? "Hide Log Details ▴" : "Show Log Details (" + cleaningProgress.resultsLog.length + ") ▾"}
                                            </button>
                                            
                                            {showLogDetails && (
                                              <div className="max-h-24 overflow-y-auto border border-gray-100 rounded bg-white p-1.5 text-[7.5px] font-mono space-y-1 custom-scrollbar">
                                                {cleaningProgress.resultsLog.map((l, idx) => (
                                                  <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-0.5 last:border-0 truncate">
                                                    <span className="text-gray-700 truncate max-w-[140px]" title={l.sheetName}>{l.sheetName}</span>
                                                    <span className={cn(
                                                      "px-1 rounded font-bold",
                                                      l.status === 'Success' ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"
                                                    )}>
                                                      {l.status === 'Success' ? `+${l.updatesCount} corrected` : 'Error'}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Make History Archive Action Group */}
                                  <div className="space-y-2 border-t border-gray-150 pt-3 mt-3">
                                    <Button 
                                      variant="default" 
                                      size="sm" 
                                      className="h-8 text-[9.5px] font-extrabold uppercase tracking-widest bg-orange-600 hover:bg-orange-700 text-white border-0 transition-all text-left flex justify-between items-center w-full shadow-md cursor-pointer animate-none"
                                      title="Make History: Archive cleared payment records older than 1 month from Tracking to History sheet."
                                      onClick={startMakeHistoryWizard}
                                    >
                                      <span>Make History</span>
                                      <Archive className="w-3.5 h-3.5 ml-1 text-white animate-none" />
                                    </Button>

                                    {historyArchiveErrorMsg && (
                                      <div className="p-2 rounded bg-orange-50 border border-orange-200 text-orange-950 font-bold text-[8.5px] leading-normal flex justify-between items-start">
                                        <span className="flex-1">{historyArchiveErrorMsg}</span>
                                        <button 
                                          onClick={() => setHistoryArchiveErrorMsg(null)} 
                                          className="text-[9px] text-orange-400 hover:text-orange-600 bg-transparent border-0 cursor-pointer p-0.5 ml-1"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </PopoverContent>
            </Popover>

            <motion.button
              onClick={() => onPageChange(activePage === 'today' ? 'tracking' : 'today')}
              className="w-[11.2px] h-[11.2px] bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer relative border border-white/50 shrink-0"
              title={activePage === 'today' ? "Back to Tracking" : "Open Daily Dashboard"}
              whileHover={{ 
                scale: 1.35, 
                rotate: 15,
                boxShadow: "0 0 8px 2.4px rgba(16, 185, 129, 0.6)"
              }}
              whileTap={{ scale: 0.75, rotate: -15 }}
              animate={{
                scale: [1, 1.2, 0.88, 1.2, 1],
                boxShadow: [
                  "0 1.6px 2.4px -0.4px rgba(16, 185, 129, 0.2), 0 0.8px 1.6px -0.4px rgba(16, 185, 129, 0.1)",
                  "0 0 6.4px 3.2px rgba(16, 185, 129, 0.4)",
                  "0 0.8px 1.6px -0.4px rgba(16, 185, 129, 0.1)",
                  "0 0 6.4px 3.2px rgba(16, 185, 129, 0.4)",
                  "0 1.6px 2.4px -0.4px rgba(16, 185, 129, 0.2), 0 0.8px 1.6px -0.4px rgba(16, 185, 129, 0.1)"
                ]
              }}
              transition={{
                scale: { repeat: Infinity, duration: 3, ease: "easeInOut" },
                boxShadow: { repeat: Infinity, duration: 3, ease: "easeInOut" }
              }}
            >
              {/* Spinning and pulsing outer blur halo */}
              <motion.div
                animate={{ 
                  rotate: -360,
                  scale: [1, 1.25, 1],
                  opacity: [0.4, 0.8, 0.4]
                }}
                transition={{ 
                  rotate: { repeat: Infinity, duration: 6, ease: "linear" },
                  scale: { repeat: Infinity, duration: 3, ease: "easeInOut" },
                  opacity: { repeat: Infinity, duration: 3, ease: "easeInOut" }
                }}
                className="absolute inset-0 bg-emerald-400 rounded-full blur-[1px]"
              />

              {/* Inner content */}
              <div className="relative z-10 flex items-center justify-center">
                {activePage === 'today' ? (
                  <FileSpreadsheet className="w-1.5 h-1.5 text-white" />
                ) : (
                  <span className="text-white text-[4.8px] font-black italic leading-none select-none">D</span>
                )}
              </div>
              
              {/* Spinning orbiting ring 1 (Clockwise, dotted) */}
              <motion.div 
                className="absolute inset-[-1.6px] rounded-full border border-dotted border-emerald-300/60"
                animate={{ rotate: 360, scale: [0.95, 1.15, 0.95] }}
                transition={{ 
                  rotate: { repeat: Infinity, duration: 4, ease: "linear" },
                  scale: { repeat: Infinity, duration: 2, ease: "easeInOut" }
                }}
              />

              {/* Spinning orbiting ring 2 (Counter-clockwise, dashed) */}
              <motion.div 
                className="absolute inset-[-3.2px] rounded-full border border-dashed border-cyan-400/40"
                animate={{ rotate: -360, scale: [1.1, 0.9, 1.1] }}
                transition={{ 
                  rotate: { repeat: Infinity, duration: 5, ease: "linear" },
                  scale: { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
                }}
              />
            </motion.button>

            <motion.button
              onClick={() => onPageChange(activePage === 'insights' ? 'tracking' : 'insights')}
              className="w-[11.2px] h-[11.2px] bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer relative border border-white/50 shrink-0"
              title={activePage === 'insights' ? "Back to Tracking" : "Generate Insight Report"}
              whileHover={{ 
                scale: 1.35, 
                rotate: -15,
                boxShadow: "0 0 8px 2.4px rgba(99, 102, 241, 0.6)"
              }}
              whileTap={{ scale: 0.75, rotate: 15 }}
              animate={{
                scale: [1, 1.2, 0.88, 1.2, 1],
                boxShadow: [
                  "0 1.6px 2.4px -0.4px rgba(99, 102, 241, 0.2), 0 0.8px 1.6px -0.4px rgba(99, 102, 241, 0.1)",
                  "0 0 6.4px 3.2px rgba(99, 102, 241, 0.4)",
                  "0 0.8px 1.6px -0.4px rgba(99, 102, 241, 0.1)",
                  "0 0 6.4px 3.2px rgba(99, 102, 241, 0.4)",
                  "0 1.6px 2.4px -0.4px rgba(99, 102, 241, 0.2), 0 0.8px 1.6px -0.4px rgba(99, 102, 241, 0.1)"
                ]
              }}
              transition={{
                scale: { repeat: Infinity, duration: 3.4, ease: "easeInOut" },
                boxShadow: { repeat: Infinity, duration: 3.4, ease: "easeInOut" }
              }}
            >
              {/* Spinning and pulsing outer blur halo */}
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.25, 1],
                  opacity: [0.4, 0.8, 0.4]
                }}
                transition={{ 
                  rotate: { repeat: Infinity, duration: 6.8, ease: "linear" },
                  scale: { repeat: Infinity, duration: 3.4, ease: "easeInOut" },
                  opacity: { repeat: Infinity, duration: 3.4, ease: "easeInOut" }
                }}
                className="absolute inset-0 bg-blue-400 rounded-full blur-[1px]"
              />

              {/* Inner content */}
              <div className="relative z-10 flex items-center justify-center">
                {activePage === 'insights' ? (
                  <FileSpreadsheet className="w-1.5 h-1.5 text-white" />
                ) : (
                  <span className="text-white text-[4.8px] font-black italic leading-none select-none">i</span>
                )}
              </div>
              
              {/* Spinning orbiting ring 1 (Clockwise, dotted) */}
              <motion.div 
                className="absolute inset-[-1.6px] rounded-full border border-dotted border-indigo-300/60"
                animate={{ rotate: 360, scale: [0.95, 1.15, 0.95] }}
                transition={{ 
                  rotate: { repeat: Infinity, duration: 4.5, ease: "linear" },
                  scale: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
                }}
              />

              {/* Spinning orbiting ring 2 (Counter-clockwise, dashed) */}
              <motion.div 
                className="absolute inset-[-3.2px] rounded-full border border-dashed border-purple-400/40"
                animate={{ rotate: -360, scale: [1.1, 0.9, 1.1] }}
                transition={{ 
                  rotate: { repeat: Infinity, duration: 5.5, ease: "linear" },
                  scale: { repeat: Infinity, duration: 2.8, ease: "easeInOut" }
                }}
              />
            </motion.button>
          </div>
            <div className="flex items-center gap-4 h-full" style={{ height: '40px' }}>
            <div className={`relative w-72 h-8 hidden md:block group transition-all duration-300 ${context?.loading ? 'blur-[1px] opacity-70 pointer-events-none' : ''}`}>
                  <input 
                    placeholder="Universal search..."
                    className="w-full pl-4 pr-16 h-8 rounded-lg border border-gray-200 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all group-hover:border-blue-200 shadow-sm"
                    value={context?.globalSearch || ''}
                    onChange={(e) => context?.setGlobalSearch(e.target.value)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {context?.globalSearch && (
                        <button 
                          onClick={() => context?.onResetPivot?.()}
                          className="bg-transparent text-red-500 hover:text-red-700 rounded px-1 py-0.5 text-[8px] font-normal uppercase tracking-tighter transition-colors"
                        >
                          RESET
                        </button>
                    )}
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                  </div>
            </div>
            {hasActiveFilters && (
               <Button 
                 variant="ghost" 
                 size="sm" 
                 className={`h-8 text-[10px] font-bold uppercase text-red-500 hover:text-red-700 hover:bg-red-50 transition-all duration-300 ${context?.loading ? 'blur-[1px] opacity-70 pointer-events-none' : ''}`}
                 onClick={() => {
                   context?.onResetPivot?.();
                 }}
               >
                 Clear Filters <FilterX className="w-3 h-3 ml-1" />
               </Button>
            )}
            <Popover open={isProjectFilterOpen} onOpenChange={setIsProjectFilterOpen}>
              <PopoverTrigger 
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-[10px] font-bold uppercase tracking-widest relative cursor-pointer flex items-center bg-white rounded-lg")}
              >
                  Projects 
                  <span className="mx-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[9px]">
                    {(() => {
                        const source = isProjectFilterOpen && localSiteSelections ? localSiteSelections : context?.siteSelections;
                        return source ? Object.keys(source).filter(k => source[k].Invoice || source[k].History).length : 0;
                    })()}
                  </span>
                  <LayoutDashboard className="w-3 h-3 text-blue-600 ml-1" />
              </PopoverTrigger>
              <PopoverContent 
                className="w-[500px] max-w-[calc(100vw-32px)] h-[calc(100vh-80px)] p-0 shadow-2xl border border-gray-100 rounded-xl flex flex-col overflow-hidden z-[80]" 
                align="end"
                sideOffset={8}
              >
                {/* Pulse Trigger replaced the overlay here */}
                <div className="p-4 border-b border-gray-100 bg-white rounded-t-xl shrink-0 flex items-center justify-between">
                  <div>
                    <h4 className="text-[11.5px] font-black text-gray-800 uppercase tracking-widest">Project Filter</h4>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[10.5px] px-3 uppercase font-normal text-blue-600 hover:bg-blue-50 relative z-40"
                      onClick={() => {
                          setSiteSearch('');
                          const target = (context?.projectMetadata || []).reduce((acc, site) => {
                            if (!site.isCompleted) {
                              acc[site.spreadsheetId] = { Invoice: true, History: true };
                            } else {
                              acc[site.spreadsheetId] = (localSiteSelections || context?.siteSelections || {})[site.spreadsheetId] || { Invoice: false, History: false };
                            }
                            return acc;
                          }, {} as typeof context.siteSelections);
                          handleBulkSelection(target);
                      }}
                    >
                      SELECT ALL
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[10.5px] px-3 uppercase font-normal text-red-500 hover:bg-red-50 relative z-40"
                      onClick={() => {
                        setSiteSearch('');
                        handleBulkSelection({});
                      }}
                    >
                      RESET
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-[1fr_125px_125px] gap-0 border-b border-gray-100 bg-gray-50 pr-4">
                   <div className="relative p-3 z-40 flex items-center">
                     <div className="relative w-full">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                       <input 
                         placeholder="Filter Projects..."
                         value={siteSearch}
                         onChange={e => setSiteSearch(e.target.value)}
                         className="w-full pl-9 pr-8 h-9 rounded-lg border border-gray-200 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all shadow-sm"
                       />
                       {siteSearch && (
                         <button 
                           onClick={() => setSiteSearch('')} 
                           className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent text-red-500 hover:text-red-700 rounded px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-tighter"
                         >
                           RESET
                         </button>
                       )}
                     </div>
                   </div>
 
                   <div className="flex flex-col items-center justify-center py-2 z-40 relative border-l border-gray-200/50">
                      <span className="text-[9px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-1 text-center leading-[1.3]">Invoice<br/>Tracking</span>
                      <div className="flex gap-2">
                         <button onClick={() => {
                           setSiteSearch('');
                           const next = { ...(localSiteSelections || context?.siteSelections || {}) };
                           (context?.projectMetadata || []).forEach(s => {
                             if (!s.isCompleted) {
                               const exist = next[s.spreadsheetId] || { Invoice: false, History: false };
                               next[s.spreadsheetId] = { ...exist, Invoice: true };
                             }
                           });
                           handleBulkSelection(next);
                         }} className="text-[10px] font-normal uppercase text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors">ALL</button>
                         <button onClick={() => {
                           setSiteSearch('');
                           const next = { ...(localSiteSelections || context?.siteSelections || {}) };
                           (context?.projectMetadata || []).forEach(s => {
                             const exist = next[s.spreadsheetId] || { Invoice: false, History: false };
                             next[s.spreadsheetId] = { ...exist, Invoice: false };
                           });
                           handleBulkSelection(next);
                         }} className="text-[10px] font-normal uppercase text-red-500 hover:bg-red-50 px-2 py-0.5 rounded transition-colors">RESET</button>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center py-2 z-40 relative border-l border-gray-200/50">
                      <span className="text-[9px] font-medium text-gray-400 uppercase tracking-[0.2em] mb-1 text-center leading-[1.3]">History<br/>Data</span>
                      <div className="flex gap-2">
                         <button onClick={() => {
                           setSiteSearch('');
                           const next = { ...(localSiteSelections || context?.siteSelections || {}) };
                           (context?.projectMetadata || []).forEach(s => {
                             if (!s.isCompleted) {
                               const exist = next[s.spreadsheetId] || { Invoice: false, History: false };
                               next[s.spreadsheetId] = { ...exist, History: true };
                             }
                           });
                           handleBulkSelection(next);
                         }} className="text-[10px] font-normal uppercase text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors">ALL</button>
                         <button onClick={() => {
                           setSiteSearch('');
                           const next = { ...(localSiteSelections || context?.siteSelections || {}) };
                           (context?.projectMetadata || []).forEach(s => {
                             const exist = next[s.spreadsheetId] || { Invoice: false, History: false };
                             next[s.spreadsheetId] = { ...exist, History: false };
                           });
                           handleBulkSelection(next);
                         }} className="text-[10px] font-normal uppercase text-red-500 hover:bg-red-50 px-2 py-0.5 rounded transition-colors">RESET</button>
                      </div>
                   </div>
                </div>
 
                <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar pt-0 px-2 pb-2 relative z-40">
                  {(() => {
                    const filtered = (context?.projectMetadata || []).filter(site => {
                       const displayName = site.extractedNames.length > 0 ? site.extractedNames.join(', ') : 'Unnamed';
                       return displayName.toLowerCase().includes(siteSearch.toLowerCase());
                    }).sort((a, b) => {
                       const displayNameA = (a.extractedNames && a.extractedNames.length > 0) ? a.extractedNames.join(', ') : 'Unnamed';
                       const displayNameB = (b.extractedNames && b.extractedNames.length > 0) ? b.extractedNames.join(', ') : 'Unnamed';
                       return displayNameA.localeCompare(displayNameB);
                    });

                    const ongoing = filtered.filter(s => !s.isCompleted);
                    const completed = filtered.filter(s => s.isCompleted);

                    const renderSite = (site: any) => {
                      const displayName = site.extractedNames.length > 0 ? site.extractedNames.join(', ') : 'Unnamed';
                      const selection = (localSiteSelections || context?.siteSelections || {})[site.spreadsheetId] || { Invoice: false, History: false };
                      const isSelected = selection.Invoice || selection.History;
                      const isCompleted = !!site.isCompleted;
  
                      // Stats
                      const invStats = site.sheetStats?.find(s => s.type === 'Invoice');
                      const histStats = site.sheetStats?.find(s => s.type === 'History');
                      
                      const invoiceCount = invStats?.rowCount;
                      const historyCount = histStats?.rowCount;
  
                      return (
                        <div 
                          key={site.spreadsheetId}
                          className={cn(
                            "grid grid-cols-[1fr_125px_125px] gap-0 px-3 py-1.5 rounded-lg transition-all border-b border-gray-50 last:border-0 items-center",
                            isSelected ? (isCompleted ? "bg-amber-50/40" : "bg-blue-50/40") : "hover:bg-gray-50"
                          )}
                        >
                           <div className="truncate min-w-0 pr-2">
                              <span className={cn("text-[13px] font-black truncate tracking-tight", isSelected ? (isCompleted ? "text-amber-900" : "text-blue-900") : "text-gray-500")} title={displayName}>{displayName}</span>
                           </div>
                           
                           <div className="flex items-center gap-3 w-full justify-end px-3 border-l border-gray-100/50">
                                <div className="w-12 text-right flex justify-end items-center h-6">
                                  {fetchingTasks[`${site.spreadsheetId}_Invoice`] ? (
                                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                                  ) : invStats ? (
                                    <span className="text-[10.5px] text-gray-400 tabular-nums">
                                      {invoiceCount != null && invoiceCount > 0 ? invoiceCount : '-'}
                                    </span>
                                  ) : (
                                    <span className="text-[10.5px] text-gray-400 tabular-nums">-</span>
                                  )}
                               </div>
                               <input 
                                 type="checkbox" 
                                 checked={selection.Invoice}
                                 onChange={(e) => handleSelectionToggle(site.spreadsheetId, 'Invoice', e.target.checked)}
                                 className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer shrink-0"
                               />
                               <div className="w-6 flex justify-center">
                                  {invStats && (
                                     <a 
                                       href={`https://docs.google.com/spreadsheets/d/${site.spreadsheetId}${invStats.sheetId ? `/edit#gid=${invStats.sheetId}` : ''}`} 
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       className="text-emerald-500 hover:text-emerald-700 transition-colors flex-shrink-0 flex items-center justify-center"
                                     >
                                       <FileSpreadsheet className="w-3.5 h-3.5" />
                                     </a>
                                  )}
                               </div>
                           </div>
    
                           <div className="flex items-center gap-3 w-full justify-end px-3 border-l border-gray-100/50">
                               <div className="w-12 text-right flex justify-end items-center h-6">
                                 {fetchingTasks[`${site.spreadsheetId}_History`] ? (
                                   <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                                 ) : histStats ? (
                                   <span className="text-[10.5px] text-gray-400 tabular-nums">
                                     {historyCount != null && historyCount > 0 ? historyCount : '-'}
                                   </span>
                                 ) : (
                                   <span className="text-[10.5px] text-gray-400 tabular-nums">-</span>
                                  )}
                               </div>
                               <input 
                                 type="checkbox" 
                                 checked={selection.History}
                                 onChange={(e) => handleSelectionToggle(site.spreadsheetId, 'History', e.target.checked)}
                                 className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer shrink-0"
                               />
                               <div className="w-6 flex justify-center">
                                 {histStats && (
                                    <a 
                                      href={`https://docs.google.com/spreadsheets/d/${site.spreadsheetId}${histStats.sheetId ? `/edit#gid=${histStats.sheetId}` : ''}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-emerald-500 hover:text-emerald-700 transition-colors flex-shrink-0 flex items-center justify-center"
                                    >
                                      <FileSpreadsheet className="w-3.5 h-3.5" />
                                    </a>
                                 )}
                               </div>
                           </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        {ongoing.length > 0 && (
                          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pt-2 pb-1 mb-1 border-b border-blue-50">
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50/50 rounded-md">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              <span className="text-[10px] font-black uppercase text-blue-700 tracking-[0.15em]">Ongoing Projects ({ongoing.length})</span>
                            </div>
                          </div>
                        )}
                        {ongoing.map(renderSite)}

                        {completed.length > 0 && (
                          <div className={cn("sticky top-0 z-10 bg-white/95 backdrop-blur-sm pt-6 pb-1 mb-1 border-b border-amber-50", ongoing.length === 0 && "pt-2")}>
                            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50/50 rounded-md">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span className="text-[10px] font-black uppercase text-amber-700 tracking-[0.15em]">Completed Projects ({completed.length})</span>
                            </div>
                          </div>
                        )}
                        {completed.map(renderSite)}
                        
                        {filtered.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-400 italic">
                            <Search className="w-8 h-8 mb-2 opacity-20" />
                            <span className="text-xs">No projects found for "{siteSearch}"</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-700"
                    onClick={() => {
                        setLocalSiteSelections(null);
                        setIsProjectFilterOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    disabled={!isAnyTicked || Object.keys(fetchingTasks).length > 0}
                    className="h-8 w-[125px] text-[11px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                        if (localSiteSelections) {
                            context?.setSiteSelections(localSiteSelections);
                            setLocalSiteSelections(null);
                        }
                        setIsProjectFilterOpen(false);
                    }}
                  >
                    {Object.keys(fetchingTasks).length > 0 ? (
                        <>
                           <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                           Waiting...
                        </>
                    ) : 'Apply'}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
               <PopoverTrigger 
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 flex items-center text-[10px] font-bold uppercase tracking-widest relative transition-all duration-300 rounded-lg", context?.loading ? 'blur-[1px] opacity-70 pointer-events-none' : '')}
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              >
                  Filters {manualFiltersList.filter(f => f.id.startsWith('col-') || f.id === 'ageing-dates').length > 0 && (
                    <span className="ml-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[9px]">
                      {manualFiltersList.filter(f => f.id.startsWith('col-') || f.id === 'ageing-dates').length}
                    </span>
                  )}
                  <Filter className="w-3 h-3 text-blue-600 ml-1" />
              </PopoverTrigger>
              <PopoverContent 
                className="w-[700px] h-[calc(100vh-80px)] p-0 shadow-2xl border border-gray-100 rounded-xl flex flex-col overflow-hidden" 
                align="end"
                sideOffset={0}
              >
                  <FilterPanel 
                    data={context?.data || []}
                    filters={context?.columnFilters || {}}
                    setFilters={(f) => context?.setColumnFilters(f)}
                    onClear={() => {
                        setIsFiltersOpen(false);
                        context?.onResetPivot?.();
                    }}
                    onCancel={() => setIsFiltersOpen(false)}
                    onApply={(appliedFilters) => {
                        setIsFiltersOpen(false);
                        context?.setColumnFilters(appliedFilters);
                    }}
                  />
              </PopoverContent>
            </Popover>
            <Button 
              variant="outline" 
              size="sm" 
              className={`h-8 flex items-center text-xs font-semibold transition-all duration-300 ${context?.loading ? 'blur-[1px] opacity-70 pointer-events-none' : ''}`}
              onClick={() => context?.refreshData()}
              disabled={context?.loading}
            >
              Refresh Data
              <RefreshCw className="w-3 h-3 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-8 flex items-center text-xs font-semibold transition-all duration-300 ${context?.loading ? 'blur-[1px] opacity-70 pointer-events-none' : ''}`}
              onClick={() => window.print()}
            >
              Print
              <Printer className="w-3 h-3 ml-2" />
            </Button>
            {context?.pivotChanged && (
              <Button
                variant="outline"
                size="sm"
                className={`h-8 flex items-center text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-150 hover:text-red-700 border border-red-200 transition-all duration-300 animate-in fade-in zoom-in-95 ${context?.loading ? 'blur-[1px] opacity-70 pointer-events-none' : ''}`}
                onClick={() => context?.onResetPivot?.()}
              >
                Reset All
                <RotateCcw className="w-3 h-3 ml-2 text-red-500" />
              </Button>
            )}
          </div>
        </header>

        {/* Applied Filters Bar */}
        {(() => {
          const activeFiltersList = [...manualFiltersList];

          if (context?.siteSelections) {
            const invoiceSelected = (context?.projectMetadata || []).filter(s => context.siteSelections[s.spreadsheetId]?.Invoice);
            const historySelected = (context?.projectMetadata || []).filter(s => context.siteSelections[s.spreadsheetId]?.History);

            if (invoiceSelected.length > 0) {
              const namesStr = invoiceSelected.map(s => {
                return s.extractedNames.length > 0 ? s.extractedNames.join(', ') : 'Unnamed';
              }).join(', ');
              activeFiltersList.push({
                id: 'invoice-selections',
                label: `Invoice Tracking: ${namesStr}`,
                clear: () => {
                  context.setSiteSelections(prev => {
                    const next = { ...prev };
                    (context?.projectMetadata || []).forEach(s => {
                      if (!next[s.spreadsheetId]) next[s.spreadsheetId] = { Invoice: false, History: false };
                      next[s.spreadsheetId] = { ...next[s.spreadsheetId], Invoice: false };
                    });
                    return next;
                  });
                }
              });
            }

            if (historySelected.length > 0) {
              const namesStr = historySelected.map(s => {
                return s.extractedNames.length > 0 ? s.extractedNames.join(', ') : 'Unnamed';
              }).join(', ');
              activeFiltersList.push({
                id: 'history-selections',
                label: `History Tracking: ${namesStr}`,
                clear: () => {
                  context.setSiteSelections(prev => {
                    const next = { ...prev };
                    (context?.projectMetadata || []).forEach(s => {
                      if (!next[s.spreadsheetId]) next[s.spreadsheetId] = { Invoice: false, History: false };
                      next[s.spreadsheetId] = { ...next[s.spreadsheetId], History: false };
                    });
                    return next;
                  });
                }
              });
            }
          }

          if (activeFiltersList.length === 0) return null;

          const handleClearAllFilters = () => {
            context?.onResetPivot?.();
            context?.setSiteSelections((context?.projectMetadata || []).reduce((acc, s) => {
              acc[s.spreadsheetId] = { Invoice: true, History: false };
              return acc;
            }, {} as Record<string, { Invoice: boolean, History: boolean }>));
          };

          return (
            <div 
              style={{ backgroundColor: '#ffffff', borderWidth: '1px', borderRadius: '15px', borderStyle: 'solid', paddingTop: '0px', paddingBottom: '0px', marginBottom: '0px' }}
              className="px-8 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 animate-in fade-in duration-200"
            >
              <div className="flex items-center gap-1.5 font-normal text-gray-450 text-[11px]">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <span>Applied Filters:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeFiltersList.map((f) => (
                  <span 
                    key={f.id} 
                    style={{ backgroundColor: '#ffffff', borderStyle: 'none' }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-gray-750 text-[11px] font-normal leading-tight transition-all shadow-3xs hover:bg-gray-50 max-w-[40vw]"
                  >
                    <span className="truncate font-medium">{f.label}</span>
                    <button 
                      onClick={f.clear}
                      className="p-0.5 hover:bg-gray-150 rounded-full text-gray-550 hover:text-red-500 transition-colors cursor-pointer flex items-center justify-center font-normal shrink-0"
                      title="Remove filter"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <button 
                onClick={handleClearAllFilters}
                className="ml-auto shrink-0 text-[11px] text-[#EF4444] hover:text-red-650 cursor-pointer font-normal border-0 bg-transparent p-0 transition-colors hover:underline"
              >
                Clear All
              </button>
            </div>
          );
        })()}

        <div className="flex-1 relative overflow-hidden">
          <div 
            style={{ paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px' }}
            className={cn(
              "absolute inset-0 overflow-y-auto custom-scrollbar",
              activePage === 'tat' && "p-2"
            )}
          >
            <div className="shrink-0 mb-0 px-1 md:px-0">
              <InteractiveScorecards data={context?.filteredData || []} />
            </div>
            {children}
          </div>
        </div>
      </main>

      {/* Make History Archive Wizard Modal */}
      {showHistoryWizard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999] flex items-start justify-center p-4 pt-[5vh]">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-xl shadow-2xl border border-gray-150 w-[98vw] max-w-[98vw] flex flex-col overflow-hidden text-left h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading Overlay inside the Wizard */}
            {(isArchiving || context?.loading) && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-xs z-[1000] flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-[#c24f17] animate-spin mb-4" />
                <span className="text-xs font-black uppercase text-[#c24f17] tracking-wider animate-pulse">
                  {isArchiving ? "Archiving & Processing..." : "Refreshing Table Data..."}
                </span>
              </div>
            )}

            {/* Header */}
            {(() => {
              const currentProj = historyWizardProjects[historyWizardIdx];
              if (!currentProj) return null;

              const projectTransformed = transformedRows[currentProj.spreadsheetId] || [];
              const remainingRecords = currentProj.records.filter(r => {
                const isExcluded = r['Contractor'] === 'test' || r['Sr no'] === 1 || String(r['Sr no']) === '1';
                return !isExcluded;
              });

              const toggleRowSelection = (srNo: number) => {
                setHistorySelectedRows(prev => ({ ...prev, [srNo]: !prev[srNo] }));
              };

              const groups = getAuditGroupsData(remainingRecords);
              const groupedRecords: Record<string, any[]> = {
                'grp1': groups.grp1,
                'grp2': groups.grp2,
                'grp3': groups.grp3,
                'grp4': groups.grp4,
                'grp5': groups.grp5,
                'grp6': groups.grp6,
                'grp7': groups.grp7,
              };

              const wizardTabs = [
                { key: 'grp7' as const, title: 'No Auditing Discrepancies', count: groups.grp7.length },
                { key: 'grp1' as const, title: 'Check Balance Payment Amount -ve', count: groups.grp1.length },
                { key: 'grp2' as const, title: 'Payment Fields Missing', count: groups.grp2.length },
                { key: 'grp3' as const, title: 'Basic Fields missing', count: groups.grp3.length },
                { key: 'grp4' as const, title: 'Wo/BIll Numbers Missing', count: groups.grp4.length },
                { key: 'grp5' as const, title: 'Date flow violations', count: groups.grp5.length },
                { key: 'grp6' as const, title: 'probable Duplication of bill nos', count: groups.grp6.length },
              ];

              const activeTabRecords = groupedRecords[historyWizardTab] || [];
              const isAllSelected = activeTabRecords.length > 0 && activeTabRecords.every(r => !!historySelectedRows[r['Sr no']]);
              
              const toggleSelectAll = () => {
                const updated = { ...historySelectedRows };
                if (isAllSelected) {
                  activeTabRecords.forEach(r => { updated[r['Sr no']] = false; });
                } else {
                  activeTabRecords.forEach(r => { updated[r['Sr no']] = true; });
                }
                setHistorySelectedRows(updated);
              };

              const renderWizardHeaders = () => {
                return (
                  <tr className="bg-slate-100 text-slate-800 font-extrabold uppercase text-[10px] h-[25px]">
                    <th className="px-1 py-0 border-r border-slate-200 bg-slate-50 w-[40px] sticky left-0 z-30 text-center">
                      <input 
                        type="checkbox" 
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-3 h-3 text-blue-600 border-gray-300 rounded cursor-pointer"
                      />
                    </th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[50px] truncate" title="Sr No">Sr No</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[150px] truncate" title="Contractor">Contractor</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[80px] truncate" title="Status">Status</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[100px] truncate" title="Payment Status">Pay Status</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[65px] truncate" title="Billing Eng">Billing Eng</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[185px] truncate" title="Bill Info">Bill Info</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[90px] truncate" title="Excel RA No">Excel RA</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[100px] truncate" title="Highrise WO No">HR WO</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[90px] truncate" title="Highrise RA No">HR RA</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[90px] text-right truncate" title="Bill Amt">Bill Amt</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[90px] text-right truncate" title="Paid Amt">Paid Amt</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[90px] text-right truncate" title="Balance">Balance</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[80px] truncate" title="Chq No">Chq No</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[80px] truncate" title="Inward">Inward</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[80px] truncate" title="Excel">Excel</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[80px] truncate" title="HR RA Date">HR RA Dt</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[80px] truncate" title="HO Sub">HO Sub</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[80px] truncate" title="Recd HO">Recd HO</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[80px] truncate" title="Certified">Certified</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[90px] truncate" title="Chq Recd HO">Chq HO</th>
                    <th className="px-1 py-0 border-r border-slate-200 w-[90px] truncate" title="Chq Recd Site">Chq Site</th>
                  </tr>
                );
              };

              const renderWizardRow = (r: any, idx: number) => {
                if (!r) return null;
                const srNo = r['Sr no'];
                const isTransformed = projectTransformed.some(tr => tr.oldSrNo === srNo);
                const isSelected = !!historySelectedRows[srNo] && !isTransformed;
                
                const formatVal = (val: any) => {
                  if (isValMissing(val)) return '-';
                  const parsed = parseDateStr(val);
                  return parsed && isValid(parsed) ? format(parsed, 'dd-MMM-yy') : String(val);
                };

                const inwardFormatted = formatVal(r._rawInwardDate ?? r['Inward Date']);
                const excelFormatted = formatVal(r._rawEXCELDate ?? r['EXCEL Date']);
                const hrRaDateFormatted = formatVal(r._rawHighriseRADate ?? r['Highrise RA Date']);
                const hoSubFormatted = formatVal(r._rawHOSubmissionDate ?? r['HO Submission Date']);
                const recdHoFormatted = formatVal(r._rawReceivedHODate ?? r['Received at HO']);
                const certifiedFormatted = formatVal(r._rawCertifiedDate ?? r['Certified at HO & Sent to Accounts on']);
                const chqHoFormatted = formatVal(r._rawChequeRecdHoDate ?? r['Cheque Recd. At HO Date']);
                
                const chqSiteRaw = r._rawChequeRecdSiteDate;
                const chqSiteFormatted = chqSiteRaw !== undefined && chqSiteRaw !== null && chqSiteRaw !== '' ? String(chqSiteRaw) : '-';

                const billAmt = r['Bill Amount (Net Payble)'] ? Number(String(r['Bill Amount (Net Payble)']).replace(/[₹\s,]/g, '')).toLocaleString('en-IN') : '-';
                const paidAmt = r['Paid Amount'] ? Number(String(r['Paid Amount']).replace(/[₹\s,]/g, '')).toLocaleString('en-IN') : '-';
                const balanceAmt = r['Balance Payment'] ? Number(String(r['Balance Payment']).replace(/[₹\s,]/g, '')).toLocaleString('en-IN') : '-';

                const { violations: chrono } = checkChronologyViolations(r);
                const flow = checkMissingFlowViolations(r);
                const future = checkFutureDateViolations(r);

                const billType = r['Bill Type'] || '-';
                const workHead = r['Work Head'] || '-';
                const bldg = r['LOCATION/Bldg.'] || r['LOCATION / Bldg.'] || r['LOCATION/Bldg'] || r['LOCATION / Bldg'] || '-';
                const billingPeriod = r['Billing Period'] || '-';
                const billInfo = `${billType} / ${workHead} / ${billingPeriod} / ${bldg}`;

                const isPink = (fieldName: string) => {
                  if (isTransformed) return false;
                  
                  if (historyWizardTab === 'grp2') {
                    const paymentKeys = ['Paid Amount', 'Balance Payment', 'Cheque No', 'Cheque Recd. At HO Date', 'Cheque Recd. At Site Date'];
                    if (paymentKeys.includes(fieldName)) {
                      let actualKey = fieldName;
                      if (fieldName === 'Cheque Recd. At HO Date') actualKey = '_rawChequeRecdHoDate';
                      if (fieldName === 'Cheque Recd. At Site Date') actualKey = '_rawChequeRecdSiteDate';
                      
                      const val = (actualKey === '_rawChequeRecdHoDate' || actualKey === '_rawChequeRecdSiteDate') ? r[actualKey] : r[fieldName];
                      return isValMissing(val);
                    }
                  }
                  
                  if (historyWizardTab === 'grp3') {
                    const basicKeys = ['Sr no', 'Contractor Name', 'Status', 'Billing Eng Name', 'Bill Type', 'Work Head', 'LOCATION/Bldg.', 'LOCATION / Bldg.', 'LOCATION/Bldg', 'LOCATION / Bldg', 'Billing Period', 'Inward Date'];
                    if (basicKeys.includes(fieldName) || fieldName === 'Inward Date' || fieldName === 'LOCATION/Bldg.' || fieldName === 'Bill Info') {
                      if (fieldName === 'Inward Date') {
                        return isValMissing(r._rawInwardDate ?? r['Inward Date']);
                      }
                      if (fieldName === 'LOCATION/Bldg.') {
                        const locKey = r['LOCATION/Bldg.'] !== undefined ? 'LOCATION/Bldg.' : (r['LOCATION / Bldg.'] !== undefined ? 'LOCATION / Bldg.' : (r['LOCATION/Bldg'] !== undefined ? 'LOCATION/Bldg' : 'LOCATION / Bldg'));
                        return isValMissing(r[locKey]);
                      }
                      if (fieldName === 'Billing Period') {
                        return isValMissing(r['Billing Period']) && !isBillingPeriodExempt(r);
                      }
                      if (fieldName === 'Bill Info') {
                        const isPeriodMissing = isValMissing(r['Billing Period']) && !isBillingPeriodExempt(r);
                        const locKey = r['LOCATION/Bldg.'] !== undefined ? 'LOCATION/Bldg.' : (r['LOCATION / Bldg.'] !== undefined ? 'LOCATION / Bldg.' : (r['LOCATION/Bldg'] !== undefined ? 'LOCATION/Bldg' : 'LOCATION / Bldg'));
                        return isValMissing(r['Bill Type']) || isValMissing(r['Work Head']) || isValMissing(r[locKey]) || isPeriodMissing;
                      }
                      if (fieldName === 'Billing Eng Name') {
                        const isOtherSites = String(r.Project || '').trim().toLowerCase() === 'other sites';
                        if (isOtherSites) return false;
                        return isValMissing(r[fieldName]);
                      }
                      return isValMissing(r[fieldName]);
                    }
                  }
                  
                  if (historyWizardTab === 'grp4') {
                    const woKeys = ['Highrise WO No', 'Excel RA Bill NO', 'Highrise RA No'];
                    if (woKeys.includes(fieldName)) {
                      const val = r[fieldName];
                      if (fieldName === 'Excel RA Bill NO') {
                        return isValMissing(val) && !isExemptFromMissingExcelNo(r);
                      }
                      const billTypeLower = String(r['Bill Type'] || '').trim().toLowerCase();
                      const ignoreRA = billTypeLower.includes('advance') || 
                                       billTypeLower.includes('quality release') || 
                                       billTypeLower.includes('sd release') ||
                                       billTypeLower.includes('sd-release');
                      if (fieldName === 'Highrise RA No' && ignoreRA) {
                        return false;
                      }
                      return isValMissing(val);
                    }
                  }
                  
                  if (historyWizardTab === 'grp5') {
                    const dateFields = ['Inward Date', 'EXCEL Date', 'Highrise RA Date', 'HO Submission Date', 'Received at HO', 'Certified at HO & Sent to Accounts on', 'Cheque Recd. At HO Date', 'Cheque Recd. At Site Date'];
                    if (dateFields.includes(fieldName)) {
                      let flowKey: keyof typeof flow = 'inward';
                      if (fieldName === 'Inward Date') flowKey = 'inward';
                      else if (fieldName === 'EXCEL Date') flowKey = 'excel';
                      else if (fieldName === 'Highrise RA Date') flowKey = 'highrise';
                      else if (fieldName === 'HO Submission Date') flowKey = 'submission';
                      else if (fieldName === 'Received at HO') flowKey = 'received';
                      else if (fieldName === 'Certified at HO & Sent to Accounts on') flowKey = 'certified';
                      else if (fieldName === 'Cheque Recd. At HO Date') flowKey = 'chequeHo';
                      else if (fieldName === 'Cheque Recd. At Site Date') flowKey = 'chequeSite';
                      
                      return flow[flowKey] === true;
                    }
                  }
                  
                  if (historyWizardTab === 'grp6') {
                    const dupKeys = ['Highrise WO No', 'Excel RA Bill NO', 'Highrise RA No'];
                    return dupKeys.includes(fieldName);
                  }
                  
                  return false;
                };

                const renderUnifiedDateCell = (formatted: string, isMissing: boolean, isChrono: boolean, isFuture: boolean) => {
                  if (isMissing) {
                    return <span className="text-[7.5px] bg-pink-100 text-pink-850 font-black px-1 rounded uppercase">MISSING</span>;
                  }
                  return (
                    <span className={cn(
                      isChrono && "text-orange-600 font-black bg-orange-50 px-1 rounded",
                      isFuture && "text-red-600 font-extrabold underline bg-red-50 px-1"
                    )}>
                      {formatted}
                    </span>
                  );
                };

                return (
                  <tr 
                    key={r['Sr no'] || idx} 
                    className={cn(
                      isTransformed 
                        ? "bg-slate-100 text-slate-400 font-normal pointer-events-none select-none cursor-not-allowed" 
                        : "hover:bg-slate-50 transition-colors border-b border-slate-100 text-[10px] cursor-pointer",
                      isSelected && !isTransformed && "bg-blue-50/40 hover:bg-blue-50/60"
                    )}
                    onClick={() => {
                      if (isTransformed) return;
                      setSelectedDetailRecords([r]);
                      setDetailTitle(`Row Details: Sr No ${r['Sr no'] || 'N/A'}`);
                    }}
                  >
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 text-center sticky left-0 z-10", isTransformed ? "bg-slate-100 text-slate-400" : "bg-white")} onClick={(e) => e.stopPropagation()}>
                      {!isTransformed && (
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleRowSelection(r['Sr no'])}
                          className="w-3 h-3 text-blue-600 border-gray-300 rounded cursor-pointer"
                        />
                      )}
                    </td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-bold text-slate-400", isPink('Sr no') && "bg-pink-100 text-pink-900 border-pink-200")}>{r['Sr no'] || 'N/A'}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 truncate max-w-[150px]", isTransformed ? "font-normal text-slate-400" : "font-extrabold uppercase text-slate-800", isPink('Contractor Name') && "bg-pink-100 text-pink-900 border-pink-200")} title={r['Contractor Name']}>{r['Contractor Name'] || 'N/A'}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 truncate max-w-[80px]", isTransformed ? "font-normal text-slate-400" : "font-semibold text-slate-600", isPink('Status') && "bg-pink-100 text-pink-900 border-pink-200")}>{r['Status'] || '-'}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 truncate max-w-[100px]", isTransformed ? "font-normal text-slate-400" : "font-extrabold text-slate-700", isPink('Payment Status') && "bg-pink-100 text-pink-900 border-pink-200")}>{r['Payment Status'] || '-'}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 truncate max-w-[65px]", isTransformed ? "text-slate-400 font-normal" : "text-slate-600", isPink('Billing Eng Name') && "bg-pink-100 text-pink-900 border-pink-200")}>{r['Billing Eng Name'] || '-'}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 truncate max-w-[185px]", isTransformed ? "text-slate-400 font-normal" : "text-slate-600", isPink('Bill Info') && "bg-pink-100 text-pink-900 border-pink-200")} title={billInfo}>{billInfo}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('Excel RA Bill NO') && "bg-pink-100 text-pink-900 border-pink-200")}>{r['Excel RA Bill NO'] || '-'}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('Highrise WO No') && "bg-pink-100 text-pink-900 border-pink-200")}>{r['Highrise WO No'] || '-'}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('Highrise RA No') && "bg-pink-100 text-pink-900 border-pink-200")}>{r['Highrise RA No'] || '-'}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 text-right truncate", isTransformed ? "font-normal text-slate-400" : "font-bold text-slate-900", isPink('Bill Amount (Net Payble)') && "bg-pink-100 text-pink-900 border-pink-200")}>{billAmt}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 text-right truncate", isTransformed ? "font-normal text-slate-400" : "font-bold text-slate-900", isPink('Paid Amount') && "bg-pink-100 text-pink-900 border-pink-200")}>{paidAmt}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 text-right truncate", isTransformed ? "font-normal text-slate-400" : "font-bold text-slate-900", isPink('Balance Payment') && "bg-pink-100 text-pink-900 border-pink-200")}>{balanceAmt}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('Cheque No') && "bg-pink-100 text-pink-900 border-pink-200")}>{r['Cheque No'] || '-'}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('Inward Date') && "bg-pink-100 text-pink-900 border-pink-200")}>{isTransformed ? inwardFormatted : renderUnifiedDateCell(inwardFormatted, flow.inward, chrono.inward, future.inward)}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('EXCEL Date') && "bg-pink-100 text-pink-900 border-pink-200")}>{isTransformed ? excelFormatted : renderUnifiedDateCell(excelFormatted, flow.excel, chrono.excel, future.excel)}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('Highrise RA Date') && "bg-pink-100 text-pink-900 border-pink-200")}>{isTransformed ? hrRaDateFormatted : renderUnifiedDateCell(hrRaDateFormatted, flow.highrise, chrono.highrise, future.highrise)}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('HO Submission Date') && "bg-pink-100 text-pink-900 border-pink-200")}>{isTransformed ? hoSubFormatted : renderUnifiedDateCell(hoSubFormatted, flow.submission, chrono.submission, future.submission)}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('Received at HO') && "bg-pink-100 text-pink-900 border-pink-200")}>{isTransformed ? recdHoFormatted : renderUnifiedDateCell(recdHoFormatted, flow.received, chrono.received, future.received)}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('Certified at HO & Sent to Accounts on') && "bg-pink-100 text-pink-900 border-pink-200")}>{isTransformed ? certifiedFormatted : renderUnifiedDateCell(certifiedFormatted, flow.certified, chrono.certified, future.certified)}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono truncate text-slate-400", isPink('Cheque Recd. At HO Date') && "bg-pink-100 text-pink-900 border-pink-200")}>{isTransformed ? chqHoFormatted : renderUnifiedDateCell(chqHoFormatted, flow.chequeHo, chrono.chequeHo, future.chequeHo)}</td>
                    <td className={cn("px-1 py-0 h-[25px] border-r border-slate-150 font-mono text-slate-400 truncate", isPink('Cheque Recd. At Site Date') && "bg-pink-100 text-pink-900 border-pink-200")}>{isTransformed ? chqSiteFormatted : renderUnifiedDateCell(chqSiteFormatted, flow.chequeSite, chrono.chequeSite, future.chequeSite)}</td>
                  </tr>
                );
              };

              const selectedCount = remainingRecords.filter(r => !!historySelectedRows[r['Sr no']]).length;

              return (
                <>
                  <div className="bg-orange-50/90 border-b border-orange-200/60 px-4 py-2 flex items-center justify-between text-slate-800 shrink-0 shadow-sm">
                    {/* Left: Title */}
                    <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-orange-950">
                      <Archive className="w-3.5 h-3.5 text-[#c24f17]" />
                      Make History ({historyWizardIdx + 1}/{historyWizardProjects.length})
                    </h3>

                    {/* Center: Previous / Next */}
                    <div className="flex items-center gap-3 justify-center flex-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={isArchiving || context?.loading || historyWizardIdx === 0}
                        className="h-[24px] px-2.5 text-[9px] font-black uppercase text-slate-600 border-slate-300 hover:bg-slate-100"
                        onClick={handlePreviousProject}
                      >
                        Prev
                      </Button>
                      
                      <div className="flex flex-col items-center">
                         <div className="flex items-center gap-2 text-[9px] font-bold text-slate-600 uppercase tracking-tight">
                            <span>Project: <span className="underline text-slate-900">{currentProj.records[0]?.['Project'] || currentProj.siteConfigName}</span></span>
                            <span className="text-slate-300">|</span>
                            <span>Source: <span className="underline text-slate-900">{currentProj.records[0]?.['Source'] || currentProj.invoiceSheetName}</span></span>
                         </div>
                      </div>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={isArchiving || context?.loading}
                        className="h-[24px] px-2.5 text-[9px] font-black uppercase text-slate-600 border-slate-300 hover:bg-slate-100"
                        onClick={handleNextProjectOrFinish}
                      >
                        Next
                      </Button>
                    </div>

                    {/* Right: Make History + Refresh + Close */}
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="default" 
                        size="sm" 
                        disabled={isArchiving || selectedCount === 0 || context?.loading}
                        className="h-[24px] px-3.5 text-[9px] font-black uppercase bg-[#c24f17] hover:bg-[#a64313] text-white shadow-sm flex items-center gap-1"
                        onClick={triggerArchiveConfirmation}
                      >
                        {isArchiving ? (
                          <>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Archiving...
                          </>
                        ) : (
                          "Make history"
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={isArchiving || context?.loading}
                        className="h-[24px] px-2.5 text-[9px] font-black uppercase text-slate-600 border-slate-300 hover:bg-slate-100 flex items-center gap-1"
                        onClick={() => context?.refreshData?.()}
                      >
                        <RefreshCw className={cn("w-2.5 h-2.5", context?.loading && "animate-spin")} />
                        Refresh
                      </Button>
                      <button 
                        onClick={() => setShowHistoryWizard(false)}
                        className="text-slate-500 hover:text-slate-800 font-black text-[11px] uppercase cursor-pointer bg-transparent border-0 pl-2 flex items-center gap-1"
                      >
                        ✕ CLOSE
                      </button>
                    </div>
                  </div>

                  <div className="p-[2px] flex-1 flex flex-col min-h-0 space-y-2">
                    {/* Ageing Control */}
                    <div className="bg-slate-50 rounded-lg p-2 mb-0 flex flex-wrap items-center justify-between text-[11px] border border-slate-200/60 w-full">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1">
                          <span className="font-bold uppercase text-slate-500 mr-1">Ageing: before</span>
                          
                          <select
                            value={ageingValue} 
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAgeingValue(val);
                              
                              const d = new Date();
                              if (ageingUnit === 'months') {
                                d.setMonth(d.getMonth() - val);
                              } else {
                                d.setDate(d.getDate() - val);
                              }
                              setCustomAgeingDate(format(d, "yyyy-MM-dd"));
                              setAgeingType(val === 0 ? 'none' : 'custom');
                            }}
                            className="bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:outline-none font-black text-blue-600 cursor-pointer p-0 text-[11px] h-auto w-auto"
                          >
                            {(() => {
                              const options = Array.from({ length: 13 }, (_, i) => i);
                              if (ageingValue > 12 || ageingValue < 0) {
                                options.push(ageingValue);
                              }
                              const uniqueOptions = Array.from(new Set(options)).sort((a, b) => a - b);
                              return uniqueOptions.map(val => (
                                <option key={val} value={val} className="text-slate-800 bg-white font-bold">{val}</option>
                              ));
                            })()}
                          </select>

                          <select
                            value={ageingUnit}
                            onChange={(e) => {
                              const unit = e.target.value as 'months' | 'days';
                              setAgeingUnit(unit);
                              
                              const d = new Date();
                              if (unit === 'months') {
                                d.setMonth(d.getMonth() - ageingValue);
                              } else {
                                d.setDate(d.getDate() - ageingValue);
                              }
                              setCustomAgeingDate(format(d, "yyyy-MM-dd"));
                              setAgeingType(ageingValue === 0 ? 'none' : 'custom');
                            }}
                            className="bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:outline-none font-black text-blue-600 cursor-pointer p-0 text-[11px] h-auto w-auto"
                          >
                            <option value="months" className="text-slate-800 bg-white font-bold">months</option>
                            <option value="days" className="text-slate-800 bg-white font-bold">days</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-bold">i.e.</span>
                          <div 
                            className="relative flex items-center gap-1 px-1 py-[2px] bg-transparent hover:text-blue-700 transition-all border-0 cursor-pointer select-none"
                            onClick={() => {
                              if (dateInputRef.current) {
                                try {
                                  dateInputRef.current.showPicker();
                                } catch (err) {
                                  dateInputRef.current.click();
                                }
                              }
                            }}
                          >
                            <Calendar className="w-3.5 h-3.5 text-blue-500 pointer-events-none mr-1" />
                            <input 
                              type="date" 
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                              ref={dateInputRef} 
                              value={customAgeingDate}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onChange={(e) => { 
                                const val = e.target.value;
                                if (!val) return;
                                setCustomAgeingDate(val); 
                                const d = new Date(val);
                                const today = new Date();
                                today.setHours(0,0,0,0);
                                d.setHours(0,0,0,0);
                                const diffTime = today.getTime() - d.getTime();
                                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                
                                let chosenUnit = ageingUnit;
                                if (diffDays >= 30 && diffDays % 30 === 0) {
                                  chosenUnit = 'months';
                                }
                                
                                if (chosenUnit === 'months') {
                                  let monthsDiff = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
                                  if (today.getDate() < d.getDate()) {
                                    monthsDiff--;
                                  }
                                  setAgeingUnit('months');
                                  setAgeingValue(monthsDiff > 0 ? monthsDiff : 0);
                                } else {
                                  setAgeingUnit('days');
                                  setAgeingValue(diffDays > 0 ? diffDays : 0);
                                }
                                setAgeingType('custom');
                              }}
                            />
                            <span className="font-mono font-black text-slate-900 pointer-events-none">
                              {calculatedAgeingDate ? format(calculatedAgeingDate, "dd-MMM-yyyy") : 'Pick Date'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 pr-2 font-black uppercase text-[10px] tracking-tight">
                        {archiveResultMsg && archiveResultMsg.type === 'success' && (
                          <span className="text-emerald-600 font-bold flex items-center gap-1 select-none animate-pulse">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{archiveResultMsg.description}</span>
                          </span>
                        )}
                        <span className="text-slate-500">
                          Move Selection: <span className="text-[#c24f17]">{selectedCount}</span> / {remainingRecords.length} Rows
                        </span>
                      </div>
                    </div>

                    {/* Discrepancy Tab Selector */}
                    <div className="flex flex-nowrap border-b border-slate-200 bg-white select-none shrink-0 overflow-x-auto no-scrollbar min-h-0 w-full">
                      {wizardTabs.map((tab, idx) => {
                        const isActive = historyWizardTab === tab.key;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setHistoryWizardTab(tab.key as any)}
                            className={cn(
                              "font-extrabold text-[9px] uppercase transition-all relative border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer py-2 px-2.5",
                              isActive
                                ? "border-blue-600 text-blue-700 bg-blue-50/40"
                                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
                            )}
                          >
                            <span>{tab.title}</span>
                            <span className={cn(
                              "text-[8px] font-black px-1.5 py-0.5 rounded-full select-none",
                              isActive
                                ? "bg-blue-200/60 text-blue-800"
                                : "bg-slate-200 text-slate-600"
                            )}>
                              {tab.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Compact Bento Table */}
                    <div className="overflow-x-auto flex-1 border border-slate-200 rounded-lg custom-scrollbar min-h-0 bg-white">
                      {activeTabRecords.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 font-bold uppercase text-[11px]">
                          No records found in this group.
                        </div>
                      ) : (
                        <table className="w-full border-collapse text-[10px] text-left table-fixed">
                          <thead className="bg-slate-100 sticky top-0 z-20 border-b border-slate-200 shadow-sm">
                            {renderWizardHeaders()}
                          </thead>
                            <tbody className="divide-y divide-gray-150 bg-white">
                            {historyWizardTab === 'grp6' ? (() => {
                              const clusters = duplicateSubGroup(activeTabRecords);
                              if (clusters.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={20} className="p-8 text-center text-slate-400 font-bold uppercase text-[11px]">
                                      No duplication clusters found.
                                    </td>
                                  </tr>
                                );
                              }
                              return clusters.map((cluster, clusterIdx) => (
                                <React.Fragment key={clusterIdx}>
                                  <tr className="bg-amber-50/50 border-y border-amber-200/50 font-bold text-slate-800 select-none">
                                    <td colSpan={20} className="py-1.5 px-3 bg-amber-50/70 text-[9px] font-extrabold uppercase tracking-wider text-amber-900 border-b border-amber-200/40">
                                      🔗 Duplicate Cluster {clusterIdx + 1} ({cluster.items.length} Records)
                                    </td>
                                  </tr>
                                  {cluster.items.map((r, idx) => renderWizardRow(r, idx))}
                                </React.Fragment>
                              ));
                            })() : (
                              activeTabRecords.map((r, idx) => renderWizardRow(r, idx))
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {selectedDetailRecords && (
                      <DetailTimelineModal
                        records={selectedDetailRecords}
                        title={detailTitle}
                        onClose={() => setSelectedDetailRecords(null)}
                      />
                    )}
                  </div>
                </>
              );
            })()}
          </motion.div>

          {/* Archive Confirmation Overlay Modal */}
          {historyConfirmDetails && historyConfirmDetails.isOpen && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[1050] flex items-center justify-center p-4 animate-fade-in">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden text-left"
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Confirm Make History (Archive)
                  </h3>
                  <button 
                    onClick={() => setHistoryConfirmDetails(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 text-xs text-slate-600 font-sans">
                  {/* Records to Move counter (prominent) */}
                  <div className="text-center py-1">
                    <span className="font-extrabold uppercase tracking-widest text-[10px] text-slate-400 block mb-1">Records to Move</span>
                    <span className="text-4xl font-black text-[#c24f17]">{historyConfirmDetails.numRows}</span>
                  </div>

                  {/* Visual Source to Destination with Arrow and Row Mapping */}
                  <div className="flex items-stretch justify-between gap-4">
                    {/* Left: Source Side */}
                    <div className="flex-1 bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col justify-between shadow-xs">
                      <div>
                        <span className="font-extrabold uppercase tracking-widest text-[9px] text-slate-400 block mb-1.5">Source Tab</span>
                        <div className="font-black text-slate-800 text-[11px] leading-snug truncate">{historyConfirmDetails.projectName}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1 font-bold truncate">{historyConfirmDetails.sourceSheet}</div>
                      </div>
                      <div className="mt-4 border-t border-slate-200/60 pt-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        Status: <span className="text-emerald-600">Selected</span>
                      </div>
                    </div>

                    {/* Arrow in middle */}
                    <div className="flex flex-col items-center justify-center text-slate-300 shrink-0">
                      <div className="p-1.5 bg-orange-50 border border-orange-100 rounded-full shadow-sm">
                        <ArrowRight className="w-4 h-4 text-[#c24f17]" />
                      </div>
                    </div>

                    {/* Right: Destination Side */}
                    <div className="flex-1 bg-slate-50 p-4 border border-slate-200 rounded-xl flex flex-col justify-between shadow-xs">
                      <div>
                        <span className="font-extrabold uppercase tracking-widest text-[9px] text-[#c24f17] block mb-1.5">Destination Tab</span>
                        <div className="font-black text-slate-800 text-[11px] leading-snug truncate">{historyConfirmDetails.projectName}</div>
                        <div className="text-[10px] text-[#c24f17] font-mono mt-1 font-bold truncate">{historyConfirmDetails.destSheet}</div>
                      </div>
                      <div className="mt-4 border-t border-slate-200/60 pt-2 text-[10px]">
                        {historyConfirmDetails.loadingCheck ? (
                          <div className="flex items-center gap-1.5 text-slate-500 font-bold font-mono">
                            <Loader2 className="w-3 h-3 animate-spin text-[#c24f17]" />
                            <span>Checking...</span>
                          </div>
                        ) : historyConfirmDetails.errorCheck ? (
                          <span className="text-rose-600 font-bold font-mono">Check Failed</span>
                        ) : (
                          <div className="font-bold text-slate-700 font-mono text-[10px] flex justify-between items-center w-full">
                            <span>Row Range:</span>
                            <span className="text-[#c24f17] font-black bg-[#c24f17]/10 px-1 py-0.5 rounded">
                              {historyConfirmDetails.insertStartRow} to {historyConfirmDetails.insertEndRow}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {historyConfirmDetails.errorCheck && (
                    <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-[11px] font-mono">
                      ⚠️ Live check error: {historyConfirmDetails.errorCheck}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-[30px] px-4 text-[10px] font-black uppercase text-slate-500"
                    onClick={() => setHistoryConfirmDetails(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={historyConfirmDetails.loadingCheck}
                    className="h-[30px] px-5 text-[10px] font-black uppercase bg-[#c24f17] hover:bg-[#a64313] text-white shadow-lg"
                    onClick={executeArchiveForCurrentProject}
                  >
                    Yes, Make History
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, collapsed: boolean }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative ${
        active 
          ? 'bg-blue-50 text-blue-700 font-bold' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      <span className={`${active ? 'text-blue-600' : 'text-gray-400'} flex-shrink-0`}>{icon}</span>
      {!collapsed && (
        <motion.span 
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-sm text-left truncate whitespace-nowrap"
        >
          {label}
        </motion.span>
      )}
      {!collapsed && active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
      
      {collapsed && active && (
        <div className="absolute right-1 w-1 h-3 bg-blue-600 rounded-full" />
      )}
    </button>
  );
}
