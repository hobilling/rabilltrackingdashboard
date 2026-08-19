/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import Layout from './components/Layout';
import TATDashboard from './pages/TATDashboard';
import TrackingSheet from './pages/TrackingSheet';
import DetailView from './pages/DetailView';
import Verification from './pages/Verification';
import { InvoiceRecord } from './types';
import { InsightReport } from './components/InsightReport';
import { DailyDashboard } from './components/DailyDashboard';
import { format, startOfDay, endOfDay } from 'date-fns';
import { parseRecordDate } from './utils/recordUtils';

interface KPITargets {
  site: number;
  ho: number;
  accounts: number;
}

interface Thresholds {
  needsImprovement: number;
  satisfactory: number;
  good: number;
  veryGood: number;
  maximum: number;
}

export type SiteSelection = Record<string, { Invoice: boolean, History: boolean }>;

export type ProjectMetadataInfo = { 
  siteConfigName: string; 
  spreadsheetId: string;
  extractedNames: string[]; 
  isCompleted?: boolean;
  sheetStats: Array<{
    sheetName: string;
    sheetId: number;
    spreadsheetId: string;
    rowCount: number;
    type: 'Invoice' | 'History';
  }>;
};

interface AppContextType {
  data: InvoiceRecord[];
  filteredData: InvoiceRecord[];
  loading: boolean;
  user: any;
  refreshData: () => void;
  login: () => void;
  logout: () => void;
  targets: KPITargets;
  updateTargets: (newTargets: KPITargets) => void;
  thresholds: Thresholds;
  updateThresholds: (newThresholds: Thresholds) => void;
  globalSearch: string;
  setGlobalSearch: (s: string) => void;
  columnFilters: Record<string, any>;
  setColumnFilters: (f: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  filterConstraints: Record<string, string[]>;
  setFilterConstraints: (c: Record<string, string[]>) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  setSortConfig: (s: { key: string; direction: 'asc' | 'desc' } | null) => void;
  siteSelections: SiteSelection;
  setSiteSelections: React.Dispatch<React.SetStateAction<SiteSelection>>;
  projectMetadata: ProjectMetadataInfo[];
  setProjectMetadata?: React.Dispatch<React.SetStateAction<ProjectMetadataInfo[]>>;
  lastUpdated: number;
  cancelFetch?: () => void;
  pivotChanged?: boolean;
  setModuleChanged?: (id: string, changed: boolean) => void;
  onResetPivot?: () => void;
  registerResetPivot?: (id: string, cb: () => void) => void;
  unregisterResetPivot?: (id: string) => void;
  resettingVisuals?: boolean;
  ageingDateRange: { from: Date | null; to: Date | null };
  setAgeingDateRange: React.Dispatch<React.SetStateAction<{ from: Date | null; to: Date | null }>>;
  ageingBasis: string;
  setAgeingBasis: React.Dispatch<React.SetStateAction<string>>;
}

export const AppContext = createContext<AppContextType | null>(null);

export default function App() {
  const [currentPage, setCurrentPage] = useState('tracking');
  const [data, setData] = useState<InvoiceRecord[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, any>>({});
  const [filterConstraints, setFilterConstraints] = useState<Record<string, string[]>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const [ageingDateRange, setAgeingDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [ageingBasis, setAgeingBasis] = useState<string>("Inward Date");

  const [siteSelections, setSiteSelections] = useState<SiteSelection>({});
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [changedStates, setChangedStates] = useState<Record<string, boolean>>({});
  const resetCallbacksRef = React.useRef<Map<string, () => void>>(new Map());

  const registerResetPivot = React.useCallback((id: string, cb: () => void) => {
    resetCallbacksRef.current.set(id, cb);
  }, []);

  const unregisterResetPivot = React.useCallback((id: string) => {
    resetCallbacksRef.current.delete(id);
  }, []);

  const setModuleChanged = React.useCallback((id: string, changed: boolean) => {
    setChangedStates(prev => {
      if (prev[id] === changed) return prev;
      return { ...prev, [id]: changed };
    });
  }, []);

  const pivotChanged = useMemo(() => {
    return Object.values(changedStates).some(v => v);
  }, [changedStates]);

  const onResetPivot = React.useCallback(() => {
    // Clear global search and filters
    setGlobalSearch('');
    setColumnFilters(prev => {
        const next = {};
        // Re-apply constraints if they exist
        Object.entries(filterConstraints).forEach(([key, values]) => {
            if (Array.isArray(values) && values.length > 0) {
                (next as any)[key] = values;
            }
        });
        return next;
    });
    setSortConfig(null);
    setAgeingDateRange({ from: null, to: null });
    setAgeingBasis("Inward Date");

    resetCallbacksRef.current.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error("Error executing reset callback", err);
      }
    });
  }, [filterConstraints]);

  const filteredData = React.useMemo(() => {
    let result = [...data];

    // Filter by Site Selections
    result = result.filter(item => {
      const siteConfigName = (item as any)['siteConfigName'];
      if (!siteConfigName) return true; // Safe fallback
      
      const selection = siteSelections[siteConfigName];
      if (!selection) return false;
      
      const source = (item as any)['Source'] || '';
      if (source.includes('Invoice Tracking')) return selection.Invoice === true;
      if (source.includes('History Data')) return selection.History === true;
      
      // If it's a different source type not specified, default to including it 
      // if at least one of them is checked for that site.
      return selection.Invoice || selection.History;
    });

    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      result = result.filter(item => 
        (item as any)._searchStr ? (item as any)._searchStr.includes(term) : Object.values(item).some(val => String(val).toLowerCase().includes(term))
      );
    }

    Object.keys(columnFilters).forEach(key => {
      const filterValOrVals = columnFilters[key];
      if (Array.isArray(filterValOrVals)) {
         if (filterValOrVals.length > 0) {
           result = result.filter(item => {
             const itemVal = String((item as any)[key] || '').trim().toLowerCase();
             return filterValOrVals.some(v => String(v).trim().toLowerCase() === itemVal);
           });
         }
      } else {
        const filterVal = filterValOrVals?.toLowerCase();
        if (filterVal) {
          result = result.filter(item => 
            String((item as any)[key] || '').toLowerCase().includes(filterVal)
          );
        }
      }
    });

    // Apply ageing date range filter
    if (ageingDateRange.from || ageingDateRange.to) {
      result = result.filter(item => {
        const dateVal = (item as any)[ageingBasis];
        const parsed = parseRecordDate(dateVal);
        if (!parsed) return false;

        if (ageingDateRange.from && ageingDateRange.to) {
          return parsed >= startOfDay(ageingDateRange.from) && parsed <= endOfDay(ageingDateRange.to);
        } else if (ageingDateRange.from) {
          return parsed >= startOfDay(ageingDateRange.from);
        } else if (ageingDateRange.to) {
          return parsed <= endOfDay(ageingDateRange.to);
        }
        return true;
      });
    }

    return result;
  }, [data, globalSearch, columnFilters, siteSelections, ageingDateRange, ageingBasis]);

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadataInfo[]>([]);

  const [targets, setTargets] = useState<KPITargets>({ site: 5, ho: 1.5, accounts: 6 });

  const [thresholds, setThresholds] = useState<Thresholds>({
    needsImprovement: 100,
    satisfactory: 125,
    good: 150,
    veryGood: 175,
    maximum: 200
  });

  const updateTargets = (newTargets: KPITargets) => {
    setTargets(newTargets);
  };

  const updateThresholds = (newThresholds: Thresholds) => {
    setThresholds(newThresholds);
  };

  const [authError, setAuthError] = useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/user');
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setAuthenticated(true);
      } else {
        setUser(null);
        setAuthenticated(false);
      }
    } catch (e) {
      console.error("Fetch user error:", e);
      setUser(null);
      setAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  };

  const login = async () => {
    try {
      const res = await fetch('/api/auth/url');
      if (!res.ok) throw new Error("Failed to get auth URL");
      const { url } = await res.json();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        url,
        'google_oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (e) {
      console.error("Login error:", e);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setAuthenticated(false);
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const fetchData = React.useCallback(async (forceRefreshData = false, forceRefreshMetadata = false) => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const newController = new AbortController();
    abortControllerRef.current = newController;
    const signal = newController.signal;

    setLoading(true);
    setAuthError(null);
    try {
      const queryParams = new URLSearchParams();
      if (forceRefreshData) queryParams.set('refresh', 'true');
      queryParams.set('selections', JSON.stringify(siteSelections));

      let res, metadataRes;
      const hasSelections = Object.values(siteSelections).some((s: any) => s.Invoice || s.History);

      if (forceRefreshMetadata) {
          // If explicitly refreshing all metadata, do it sequentially to ensure data fetch generates new metadata
          if (hasSelections) {
              res = await fetch(`/api/data?${queryParams.toString()}`, { signal });
          }
          metadataRes = await fetch(`/api/projects/metadata?refresh=true`, { signal });
      } else {
          if (hasSelections) {
              res = await fetch(`/api/data?${queryParams.toString()}`, { signal });
          }
          metadataRes = await fetch(`/api/projects/metadata`, { signal });
      }

      if (metadataRes.ok) {
        const data = await metadataRes.json();
        if (Array.isArray(data)) {
          data.sort((a,b) => (a.siteConfigName || '').localeCompare(b.siteConfigName || ''));
          setProjectMetadata(data);
          
          setSiteSelections(prev => {
            const next = { ...prev };
            let updated = false;
            data.forEach((p: any) => {
              if (!next[p.spreadsheetId]) {
                next[p.spreadsheetId] = { Invoice: false, History: false };
                updated = true;
              }
            });
            return updated ? next : prev;
          });
        }
      }

      if (res && res.ok) {
        const records = await res.json();
        setData(records);
        setLastUpdated(Date.now());
      } else if (res && res.status === 401) {
        setAuthenticated(false);
      } else if (res) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 500 && err.error) {
            setAuthError(err.error);
        }
      } else if (!hasSelections) {
          setData([]);
          setLastUpdated(Date.now());
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
         console.log("Fetch aborted by user.");
      } else {
         console.error("Data fetch catch:", e);
      }
    } finally {
      // Only set loading to false if this wasn't an abort, 
      // or actually we do set it false. BUT if it was aborted, 
      // cancelFetch already set it false. It's safe to set it again.
      setTimeout(() => {
        setLoading(false);
      }, 300);
    }
  }, [siteSelections]);

  const refreshData = React.useCallback(() => fetchData(true, true), [fetchData]);
  const cancelFetch = React.useCallback(() => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    setLoading(false);
  }, []);

  const contextValue = useMemo(() => ({ 
    data, 
    filteredData,
    loading, 
    user, 
    refreshData, 
    cancelFetch,
    login,
    logout, 
    targets, 
    updateTargets,
    thresholds,
    updateThresholds,
    globalSearch,
    setGlobalSearch,
    columnFilters,
    setColumnFilters,
    filterConstraints,
    setFilterConstraints,
    sortConfig,
    setSortConfig,
    siteSelections,
    setSiteSelections,
    projectMetadata,
    setProjectMetadata,
    lastUpdated,
    pivotChanged,
    setModuleChanged,
    onResetPivot,
    registerResetPivot,
    unregisterResetPivot,
    ageingDateRange,
    setAgeingDateRange,
    ageingBasis,
    setAgeingBasis
  }), [
    data, filteredData, loading, user, refreshData, cancelFetch, 
    targets, thresholds, globalSearch, columnFilters, filterConstraints, 
    sortConfig, siteSelections, projectMetadata, setProjectMetadata,
    lastUpdated, pivotChanged, setModuleChanged, onResetPivot, 
    registerResetPivot, unregisterResetPivot, ageingDateRange, ageingBasis
  ]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchUser();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    fetchUser();
  }, []);

  const isInitialMount = React.useRef(true);

  useEffect(() => {
    if (authenticated) {
      if (isInitialMount.current) {
        fetchData(true, true);
        isInitialMount.current = false;
      } else {
        // Fetch immediately and show loader
        setLoading(true);
        fetchData(true, true);
      }
    }
  }, [authenticated, siteSelections, fetchData]);

  // No session events needed
  useEffect(() => {
  }, []);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest font-mono">Initializing System...</p>
      </div>
    );
  }

  // Login screen removed as requested
  /*
  if (!authenticated) {
    return <Login onLoginSuccess={fetchUser} />;
  }
  */

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl max-w-2xl text-center shadow-lg border border-red-100 space-y-4">
          <h2 className="text-xl font-black uppercase">Configuration Error</h2>
          <p className="text-sm font-medium">{authError}</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <Layout activePage={currentPage} onPageChange={setCurrentPage}>
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {currentPage === 'tat' && <TATDashboard />}
          {currentPage === 'tracking' && <TrackingSheet />}
          {currentPage === 'detail' && <DetailView />}
          {currentPage === 'verification' && <Verification />}
          {currentPage === 'insights' && <InsightReport data={filteredData} onClose={() => setCurrentPage('tracking')} />}
          {currentPage === 'today' && <DailyDashboard data={filteredData} onClose={() => setCurrentPage('tracking')} />}
        </div>
      </Layout>
    </AppContext.Provider>
  );
}
