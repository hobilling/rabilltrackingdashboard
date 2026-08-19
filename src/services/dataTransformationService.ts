import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { differenceInDays, parse, isValid, format } from 'date-fns';
import { InvoiceRecord } from '../types';
import { SiteDiscoveryService } from './siteDiscoveryService';

export interface FetchMetadata {
  siteName: string;
  spreadsheetId: string;
  sheetName: string;
  sheetId: number | null;
  rowCount: number;
  processedRows: number;
  blankRows: number;
}

export class DataTransformationService {
  public static lastFetchMetadata: FetchMetadata[] = [];
  public static siteDataCache: Record<string, { records: any[], siteMetadata: FetchMetadata[], timestamp: number, cachedTypes?: string[] }> = {};
  public static spreadsheetCache: Record<string, { sheets: any[], timestamp: number }> = {};

  private static async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Wrapper with retry to handle Sheets API 429 quota errors
  public static async withRetry<T>(operation: () => Promise<T>, maxRetries = 6): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        const status = error?.status || error?.code || error?.response?.status || error?.response?.data?.error?.code;
        const msg = (error?.message || "").toLowerCase();
        const isQuotaError = 
          status === 429 || 
          msg.includes('quota') || 
          msg.includes('rate limit') || 
          msg.includes('too many requests') || 
          msg.includes('resource exhausted') ||
          msg.includes('limit exceeded');
          
        if (isQuotaError && attempt < maxRetries - 1) {
          attempt++;
          const delay = Math.pow(2.2, attempt) * 2000 + Math.random() * 1500;
          console.warn(`[Quota] Rate limited. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries}). Error details: ${error?.message}`);
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }
    throw new Error("Max retries reached");
  }

  static async fetchAndTransformAll(
    auth: any, 
    selections?: Record<string, {Invoice: boolean, History: boolean}>,
    forceRefresh = false
  ): Promise<InvoiceRecord[]> {
    const allRecords: any[] = [];
    const metadata: FetchMetadata[] = [];

    const sheets = google.sheets({ version: 'v4', auth });

    const discoveredSites = await SiteDiscoveryService.discoverSites(forceRefresh);

    const targetSites = selections 
      ? discoveredSites.filter(s => selections[s.spreadsheetId] && (selections[s.spreadsheetId].Invoice || selections[s.spreadsheetId].History))
      : discoveredSites;

    const CACHE_TTL = 60 * 60 * 1000; // 60 minutes TTL
    const now = Date.now();

    // Parallel fetch with small staggered delay to avoid burst quota hit
    const siteDataPromises = targetSites.map(async (site, index) => {
        try {
            const cacheKey = site.spreadsheetId;
            let cached = this.siteDataCache[cacheKey];

            let siteResult: { records: any[], siteMetadata: FetchMetadata[] } = { records: [], siteMetadata: [] };
            const siteSelections = selections ? selections[site.spreadsheetId] : { Invoice: true, History: true };
            const requestedTypes: string[] = [];
            if (siteSelections.Invoice) requestedTypes.push('Invoice');
            if (siteSelections.History) requestedTypes.push('History');

            // Determine if we have everything cached or if we need to fetch missing types
            cached = cached || { records: [], siteMetadata: [], timestamp: 0, cachedTypes: [] };
            const isFresh = !forceRefresh && (now - cached.timestamp < CACHE_TTL);
            const missingTypes = requestedTypes.filter(type => !isFresh || !cached.cachedTypes.includes(type));

            if (missingTypes.length > 0) {
                await this.sleep(index * 250); 
                console.log(`[API-Data] Fetching spreadsheets values for site: ${site.spreadsheetId}, types: ${missingTypes.join(',')}`);
                
                const newFetch = await this.fetchSiteData(sheets, site, missingTypes);
                
                // Merge with existing valid cache
                const validRecords = isFresh ? cached.records.filter(r => !missingTypes.some(mt => r['Source']?.includes(mt) || r['Source']?.startsWith(mt))) : [];
                const validMetadata = isFresh ? cached.siteMetadata.filter(m => !missingTypes.some(mt => m.sheetName.toLowerCase().includes(mt.toLowerCase()))) : [];
                
                // Store in cache
                const newCachedTypes = Array.from(new Set([...(isFresh ? cached.cachedTypes : []), ...missingTypes]));
                this.siteDataCache[cacheKey] = {
                    records: [...validRecords, ...newFetch.records],
                    siteMetadata: [...validMetadata, ...newFetch.siteMetadata],
                    timestamp: now,
                    cachedTypes: newCachedTypes
                };
                cached = this.siteDataCache[cacheKey];
            } else {
                console.log(`[Cache-Data] Serving cached dataset for site: ${site.spreadsheetId}, types: ${requestedTypes.join(',')}`);
            }

            siteResult = {
                records: cached.records,
                siteMetadata: cached.siteMetadata
            };

            // In-memory filter based on current selections
            
            const filteredRecords = siteResult.records.filter(r => {
                const source = r['Source'] || '';
                const isInvoice = source.includes('Invoice') || source === 'Invoice Tracking';
                const isHistory = source.includes('History') || source === 'History Data';
                
                if (isInvoice && siteSelections.Invoice) return true;
                if (isHistory && siteSelections.History) return true;
                return false;
            });

            const filteredMetadata = siteResult.siteMetadata.filter(m => {
                const isInvoice = m.sheetName.toLowerCase().includes('invoice');
                const isHistory = m.sheetName.toLowerCase().includes('history');
                
                if (isInvoice && siteSelections.Invoice) return true;
                if (isHistory && siteSelections.History) return true;
                return false;
            });

            return { records: filteredRecords, siteMetadata: filteredMetadata };

        } catch (error) {
            console.error(`Error fetching data for site ${site.spreadsheetId}:`, error);
            return { records: [], siteMetadata: [] };
        }
    });

    const results = await Promise.all(siteDataPromises);
    
    results.forEach(res => {
        allRecords.push(...res.records);
        metadata.push(...res.siteMetadata);
    });

    const mergedMetadata = [...(this.lastFetchMetadata || [])];
    metadata.forEach(newMeta => {
        const idx = mergedMetadata.findIndex(m => m.spreadsheetId === newMeta.spreadsheetId && m.sheetName === newMeta.sheetName);
        if (idx !== -1) {
            mergedMetadata[idx] = newMeta;
        } else {
            mergedMetadata.push(newMeta);
        }
    });
    this.lastFetchMetadata = mergedMetadata;
    // Apply "All Sites" Master Transformation
    return this.applyMasterTransformation(allRecords);
  }

  private static async fetchSiteData(sheets: any, site: { spreadsheetId: string }, sheetTypes?: string[]): Promise<{ records: any[], siteMetadata: FetchMetadata[] }> {
    const siteMetadata: FetchMetadata[] = [];
    
    let spreadsheetSheets: any[] = [];
    const cacheKey = site.spreadsheetId;
    const now = Date.now();
    const CACHE_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours retention for spreadsheet structure

    // Cache spreadsheet structure configuration to save API metadata reads
    if (this.spreadsheetCache[cacheKey] && (now - this.spreadsheetCache[cacheKey].timestamp < CACHE_MAX_AGE)) {
      spreadsheetSheets = this.spreadsheetCache[cacheKey].sheets;
      console.log(`[Cache-Metadata] Reusing cached structure for site: ${site.spreadsheetId}`);
    } else {
      // 1. Get spreadsheet metadata to find relevant sheets
      const response = await this.withRetry<any>(() => sheets.spreadsheets.get({
        spreadsheetId: site.spreadsheetId,
      }));
      spreadsheetSheets = response.data.sheets || [];
      this.spreadsheetCache[cacheKey] = {
        sheets: spreadsheetSheets,
        timestamp: now
      };
      console.log(`[API-Metadata] Queried spreadsheet structure from Google Sheets for site: ${site.spreadsheetId}`);
    }

    const typesToMatch = sheetTypes && sheetTypes.length > 0 ? sheetTypes : ['Invoice', 'History'];
    const filteredSheets = spreadsheetSheets.filter((s: any) => {
      const name = s.properties?.title || '';
      return typesToMatch.some(t => name.includes(t));
    });

    const siteRecords: any[] = [];
    const sheetNames = filteredSheets.map((s: any) => s.properties?.title!);

    if (sheetNames.length === 0) return { records: [], siteMetadata: [] };

    // Use batchGet to fetch all sheets in ONE request per site
    const dataResponse = await this.withRetry<any>(() => sheets.spreadsheets.values.batchGet({
      spreadsheetId: site.spreadsheetId,
      ranges: sheetNames.map((name: string) => `'${name}'!A:AZ`),
    }));

    const valueRanges = dataResponse.data.valueRanges || [];

    for (let i = 0; i < valueRanges.length; i++) {
      const sheetName = sheetNames[i];
      const rows = valueRanges[i].values || [];

      // Project names to be fetched from sheet name
      let projectName = sheetName;
      if (sheetName.includes(' - ')) {
        projectName = sheetName.split(' - ')[0].trim();
      } else if (sheetName.includes('-')) {
        projectName = sheetName.split('-')[0].trim();
      }

      const matchingSheet = filteredSheets.find((s: any) => s.properties?.title === sheetName);
      const sheetId = matchingSheet?.properties?.sheetId ?? null;

      siteMetadata.push({
        siteName: projectName,
        spreadsheetId: site.spreadsheetId,
        sheetName: sheetName,
        sheetId: sheetId,
        rowCount: rows.length,
        processedRows: 0, // Will update later
        blankRows: 0      // Will update later
      });

      if (rows.length < 2) continue;

      // M Logic: Skip 1, Promote Headers
      const headers = rows[1].map((h: string) => {
        const header = (h || '').trim();
        const upper = header.toUpperCase();
        
        // Handle variations of Location / Bldg columns to map consistently to "LOCATION/Bldg."
        if (
          upper === "LOCATION/BLDG." ||
          upper === "LOCATION/BLDG" ||
          upper === "LOCATION / BLDG." ||
          upper === "LOCATION / BLDG" ||
          upper === "LOCATION /BLDG." ||
          upper === "LOCATION /BLDG" ||
          upper === "LOCATION / BLG." ||
          upper === "LOCATION / BLG" ||
          upper === "LOCATION/BLG" ||
          upper === "LOCATION/BLG." ||
          upper === "LOCATION" ||
          (upper.includes("LOCATION") && upper.includes("BLDG"))
        ) {
          return "LOCATION/Bldg.";
        }
        return header;
      });
      const dataRows = rows.slice(2);

      const cleanedRows = dataRows
        .map((row: any) => {
          const record: any = {};
          headers.forEach((header: string, index: number) => {
            let value = row[index];
            if (typeof value === 'string') {
              // Clean and Trim as per M script
              value = value.trim().replace(/\s+/g, ' ');
            }
            record[header] = (value === '' || value === undefined || value === null) ? null : value;
          });
          
          // Add Source and Project/Site
          if (sheetName.toLowerCase().includes('invoice')) {
            record['Source'] = 'Invoice Tracking';
          } else if (sheetName.toLowerCase().includes('history')) {
            record['Source'] = 'History Data';
          } else {
            record['Source'] = sheetName;
          }
          record['Project'] = projectName;
          record['siteConfigName'] = site.spreadsheetId;
          
          return record;
        })
        .filter((record: any) => record['Status'] !== null && String(record['Status']).trim() !== '');

      // Update metadata with actual processed count
      siteMetadata[siteMetadata.length - 1].processedRows = cleanedRows.length;
      siteMetadata[siteMetadata.length - 1].blankRows = dataRows.length - cleanedRows.length;

      siteRecords.push(...cleanedRows);
    }

    return { records: siteRecords, siteMetadata };
  }

  private static applyMasterTransformation(records: any[]): InvoiceRecord[] {
    return records.map((record, index) => {
      const row = { ...record };

      // Helper for safe blank check
      const isBlank = (v: any) => v === null || v === undefined || v === '' || v === 0;

      // Preserve Raw Dates before auto-rolling/transformation for auditing purposes
      row['_rawInwardDate'] = row['Inward Date'];
      row['_rawEXCELDate'] = row['EXCEL Date'];
      row['_rawHighriseRADate'] = row['Highrise RA Date'];
      row['_rawHOSubmissionDate'] = row['HO Submission Date'];
      row['_rawReceivedHODate'] = row['Received at HO'];
      row['_rawCertifiedDate'] = row['Certified at HO & Sent to Accounts on'];
      row['_rawChequeRecdHoDate'] = row['Cheque Recd. At HO Date'];
      row['_rawChequeRecdSiteDate'] = row['Cheque Recd. At Site Date'];

      // Ensure numeric fields are numbers
      const toNum = (v: any) => {
        if (v === null || v === undefined || v === '') return 0;
        if (typeof v === 'number') return v;
        const cleaned = String(v).replace(/,/g, '').trim();
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      };

      // Applying Cascading Conditions 1-5 from M Script
      // Condition 1: Cheque HO Date exists, Site Date is blank -> Site = HO
      if (!isBlank(row['Cheque Recd. At HO Date']) && isBlank(row['Cheque Recd. At Site Date'])) {
        row['Cheque Recd. At Site Date'] = row['Cheque Recd. At HO Date'];
        row['Status'] = '10 Cheque Recd. At Site';
      }
      // Condition 2: Cheque HO exists, Certified exists -> Certified = HO if blank
      if (!isBlank(row['Cheque Recd. At HO Date']) && isBlank(row['Certified at HO & Sent to Accounts on'])) {
        row['Certified at HO & Sent to Accounts on'] = row['Cheque Recd. At HO Date'];
      }
      // Condition 3: Certified exists, Received HO exists -> Received HO = Certified if blank
      if (!isBlank(row['Certified at HO & Sent to Accounts on']) && isBlank(row['Received at HO'])) {
        row['Received at HO'] = row['Certified at HO & Sent to Accounts on'];
      }
      // Condition 4: Received HO exists, HO Submission exists -> HO Submission = Received HO if blank
      if (!isBlank(row['Received at HO']) && isBlank(row['HO Submission Date'])) {
        row['HO Submission Date'] = row['Received at HO'];
      }
      // Condition 5: HO Submission exists, Inward exists -> Inward = HO Submission if blank
      if (!isBlank(row['HO Submission Date']) && isBlank(row['Inward Date'])) {
        row['Inward Date'] = row['HO Submission Date'];
      }

      // Calculations for Days
      const parseDate = (d: any) => {
        if (!d) return null;
        let dateObj;
        if (typeof d === 'number') {
          // Excel serial date conversion
          dateObj = new Date((d - 25569) * 86400 * 1000);
        } else {
          dateObj = new Date(d);
        }
        return isValid(dateObj) ? dateObj : null;
      };

      const dInward = parseDate(row['Inward Date']);
      const dReceivedHO = parseDate(row['Received at HO']);
      const dCertified = parseDate(row['Certified at HO & Sent to Accounts on']);
      const dChequeHO = parseDate(row['Cheque Recd. At HO Date']);

      // Site Days = Abs(Received HO - Inward) + 1
      row['Site Days'] = (dReceivedHO && dInward) ? Math.abs(differenceInDays(dReceivedHO, dInward)) + 1 : null;
      // HO Days = Abs(Certified - Received HO)
      row['HO Days'] = (dCertified && dReceivedHO) ? Math.abs(differenceInDays(dCertified, dReceivedHO)) : null;
      // Account Days = Abs(Cheque HO - Certified)
      row['Account Days'] = (dChequeHO && dCertified) ? Math.abs(differenceInDays(dChequeHO, dCertified)) : null;
      // Bill Process Days = Site + HO
      row['Bill Process Days'] = (row['Site Days'] !== null && row['HO Days'] !== null) ? row['Site Days'] + row['HO Days'] : null;
      // Inward to Payment Cycle Days = Account + Bill Process
      row['Inward to Payment Cycle Days'] = (row['Account Days'] !== null && row['Bill Process Days'] !== null) ? row['Account Days'] + row['Bill Process Days'] : null;

      // Financials
      const billAmount = toNum(row['Bill Amount (Net Payble)']);
      const paidAmount = toNum(row['Cheque Amount'] !== undefined ? row['Cheque Amount'] : row['Paid Amount']);
      row['Bill Amount (Net Payble)'] = billAmount;
      row['Paid Amount'] = paidAmount;
      row['Balance Payment'] = billAmount - paidAmount;

      // Date parts for faster frontend filtering/grouping
      if (dInward && isValid(dInward)) {
          const monthIndex = dInward.getMonth();
          row['_year'] = dInward.getFullYear().toString();
          row['_quarter'] = `Qtr ${Math.floor(monthIndex / 3) + 1}`;
          row['_month'] = format(dInward, 'MMMM');
          row['_monthNum'] = monthIndex;
      } else {
          row['_year'] = 'N/A';
          row['_quarter'] = 'N/A';
          row['_month'] = 'N/A';
          row['_monthNum'] = 99;
      }

      // Payment Status Logic
      if (billAmount === 0 && paidAmount === 0) {
        row['Payment Status'] = 'Payment Balance';
      } else if (row['Balance Payment'] === billAmount && billAmount !== 0) {
        row['Payment Status'] = 'Payment Balance';
      } else if (row['Balance Payment'] < -0.02 * billAmount && billAmount !== 0) {
        row['Payment Status'] = 'Check Amounts as -Ve';
      } else if (row['Balance Payment'] <= 0.02 * billAmount && billAmount !== 0) {
        row['Payment Status'] = 'Payment Cleared';
      } else {
        row['Payment Status'] = 'Partial Payment Balance';
      }

      // Helper for search optimization
      row['_searchStr'] = Object.values(row).filter(v => v !== null && v !== undefined).join(' ').toLowerCase();

      return row as InvoiceRecord;
    });
  }
}
