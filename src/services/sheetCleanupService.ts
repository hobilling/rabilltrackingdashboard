import { google } from 'googleapis';
import { GoogleAuthService } from './googleAuthService';
import { SiteDiscoveryService } from './siteDiscoveryService';
import { DataTransformationService } from './dataTransformationService';
import { isValid, parse, format } from 'date-fns';

export interface MaintenanceResult {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetName: string;
  updatesCount: number;
  errors: string[];
}

export class SheetCleanupService {
  /**
   * Syncs Inward Date to be the minimum of (Inward Date, Excel Date, Highrise RA Date).
   * Blanks are ignored. Standardizes format to dd-MMM-yy.
   */
  public static async performInwardDateSync(spreadsheetIds?: string[]): Promise<MaintenanceResult[]> {
    const auth = GoogleAuthService.getServiceAccountAuth();
    if (!auth) throw new Error("Auth failed");

    const sheets = google.sheets({ version: 'v4', auth });
    const discoveredSites = await SiteDiscoveryService.discoverSites(true);
    
    // Filter by specific spreadsheetIds if provided
    const targetSites = spreadsheetIds && spreadsheetIds.length > 0
      ? discoveredSites.filter(s => spreadsheetIds.includes(s.spreadsheetId))
      : discoveredSites;

    console.log(`[Maintenance] Inward Date Sync - target sites count: ${targetSites.length}`);

    const results: MaintenanceResult[] = [];

    for (const site of targetSites) {
      try {
        const spreadsheetRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.get({
          spreadsheetId: site.spreadsheetId
        }));
        
        const spreadsheetSheets = spreadsheetRes.data.sheets || [];
        const invoiceSheets = spreadsheetSheets.filter(s => 
          s.properties?.title?.toLowerCase().includes('invoice')
        );

        for (const sheet of invoiceSheets) {
          const sheetTitle = sheet.properties?.title!;
          const dataRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.values.get({
            spreadsheetId: site.spreadsheetId,
            range: `'${sheetTitle}'!A:AZ`
          }));

          const rows = dataRes.data.values || [];
          if (rows.length < 2) continue;

          const headers = rows[1] || [];
          const findCol = (names: string[]) => headers.findIndex(h => names.some(n => h?.toString().toLowerCase().includes(n.toLowerCase().trim())));

          const inwardIdx = findCol(['Inward Date']);
          const excelIdx = findCol(['EXCEL Date', 'Excel Date']);
          const highriseIdx = findCol(['Highrise RA Date', 'RA Date']);

          if (inwardIdx === -1) continue;

          let updates = 0;
          const valueUpdates: any[] = [];

          for (let i = 2; i < rows.length; i++) {
            const row = rows[i];
            const inwardVal = row[inwardIdx];
            const excelVal = excelIdx !== -1 ? row[excelIdx] : null;
            const highriseVal = highriseIdx !== -1 ? row[highriseIdx] : null;

            const dInward = this.parseSheetDate(inwardVal);
            const dExcel = this.parseSheetDate(excelVal);
            const dHighrise = this.parseSheetDate(highriseVal);

            const dates = [dInward, dExcel, dHighrise]
              .filter(d => d !== null && !isNaN(d.getTime())) as Date[];

            if (dates.length > 0) {
              const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
              
              // Skip if Inward Date is already equal to the minimum of inward, excel, and highrise
              if (dInward && dInward.getTime() === minDate.getTime()) {
                continue;
              }

              const formattedInward = this.formatSheetDate(minDate);
              
              if (inwardVal !== formattedInward) {
                valueUpdates.push({
                  range: `'${sheetTitle}'!${this.columnToLetter(inwardIdx + 1)}${i + 1}`,
                  values: [[formattedInward]]
                });
                updates++;
              }
            }
          }

          if (valueUpdates.length > 0) {
            console.log(`[Maintenance] Applying ${valueUpdates.length} Inward Date updates to ${site.name} / ${sheetTitle}`);
            await DataTransformationService.withRetry(() => sheets.spreadsheets.values.batchUpdate({
              spreadsheetId: site.spreadsheetId,
              requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: valueUpdates
              }
            }));
          }

          results.push({
            spreadsheetId: site.spreadsheetId,
            spreadsheetName: site.name,
            sheetName: sheetTitle,
            updatesCount: updates,
            errors: []
          });
        }
      } catch (err: any) {
        console.error(`[Maintenance] Error in Inward Date Sync for ${site.name}:`, err);
        results.push({
          spreadsheetId: site.spreadsheetId,
          spreadsheetName: site.name,
          sheetName: 'ALL',
          updatesCount: 0,
          errors: [err.message]
        });
      }
    }

    return results;
  }

  /**
   * Cleans Excel Date Violations: if Excel Date > Highrise RA Date (both non-blank), set Excel Date = Highrise RA Date.
   * Format standardized to dd-MMM-yy.
   */
  public static async performExcelDateViolationCleanup(spreadsheetIds?: string[]): Promise<MaintenanceResult[]> {
    const auth = GoogleAuthService.getServiceAccountAuth();
    if (!auth) throw new Error("Auth failed");

    const sheets = google.sheets({ version: 'v4', auth });
    const discoveredSites = await SiteDiscoveryService.discoverSites(true);
    
    const targetSites = spreadsheetIds && spreadsheetIds.length > 0
      ? discoveredSites.filter(s => spreadsheetIds.includes(s.spreadsheetId))
      : discoveredSites;

    console.log(`[Maintenance] Excel Date Violation Cleanup - target sites count: ${targetSites.length}`);

    const results: MaintenanceResult[] = [];

    for (const site of targetSites) {
      try {
        const spreadsheetRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.get({
          spreadsheetId: site.spreadsheetId
        }));
        
        const spreadsheetSheets = spreadsheetRes.data.sheets || [];
        const invoiceSheets = spreadsheetSheets.filter(s => 
          s.properties?.title?.toLowerCase().includes('invoice')
        );

        for (const sheet of invoiceSheets) {
          const sheetTitle = sheet.properties?.title!;
          const dataRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.values.get({
            spreadsheetId: site.spreadsheetId,
            range: `'${sheetTitle}'!A:AZ`
          }));

          const rows = dataRes.data.values || [];
          if (rows.length < 2) continue;

          const headers = rows[1] || [];
          const findCol = (names: string[]) => headers.findIndex(h => names.some(n => h?.toString().toLowerCase().includes(n.toLowerCase().trim())));

          const excelIdx = findCol(['EXCEL Date', 'Excel Date']);
          const highriseIdx = findCol(['Highrise RA Date', 'RA Date']);

          if (excelIdx === -1 || highriseIdx === -1) continue;

          let updates = 0;
          const valueUpdates: any[] = [];

          for (let i = 2; i < rows.length; i++) {
            const row = rows[i];
            const excelVal = row[excelIdx];
            const highriseVal = row[highriseIdx];

            const dExcel = this.parseSheetDate(excelVal);
            const dHighrise = this.parseSheetDate(highriseVal);

            if (dExcel && dHighrise && dHighrise < dExcel) {
              const formattedExcel = this.formatSheetDate(dHighrise);
              if (excelVal !== formattedExcel) {
                valueUpdates.push({
                  range: `'${sheetTitle}'!${this.columnToLetter(excelIdx + 1)}${i + 1}`,
                  values: [[formattedExcel]]
                });
                updates++;
              }
            }
          }

          if (valueUpdates.length > 0) {
            console.log(`[Maintenance] Applying ${valueUpdates.length} Excel Date updates to ${site.name} / ${sheetTitle}`);
            await DataTransformationService.withRetry(() => sheets.spreadsheets.values.batchUpdate({
              spreadsheetId: site.spreadsheetId,
              requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: valueUpdates
              }
            }));
          }

          results.push({
            spreadsheetId: site.spreadsheetId,
            spreadsheetName: site.name,
            sheetName: sheetTitle,
            updatesCount: updates,
            errors: []
          });
        }
      } catch (err: any) {
        console.error(`[Maintenance] Error in Excel Date Cleanup for ${site.name}:`, err);
        results.push({
          spreadsheetId: site.spreadsheetId,
          spreadsheetName: site.name,
          sheetName: 'ALL',
          updatesCount: 0,
          errors: [err.message]
        });
      }
    }

    return results;
  }

  private static parseSheetDate(val: any): Date | null {
    if (!val) return null;
    if (typeof val === 'number') {
      return new Date((val - 25569) * 86400 * 1000);
    }
    
    // Custom check for dd-MMM-yy
    const mmmMatch = val.toString().match(/(\d{1,2})-(\w{3})-(\d{2,4})/);
    if (mmmMatch) {
      try {
        const parsed = parse(val, 'dd-MMM-yy', new Date());
        if (isValid(parsed)) return parsed;
      } catch (e) {}
    }

    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;

    // Try parsing common formats if automatic fails
    const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy'];
    for (const f of formats) {
      try {
        const parsed = parse(val, f, new Date());
        if (isValid(parsed)) return parsed;
      } catch (e) {}
    }
    return null;
  }

  public static async cleanSingleSheetInwardSync(spreadsheetId: string, sheetName: string): Promise<MaintenanceResult> {
    const auth = GoogleAuthService.getServiceAccountAuth();
    if (!auth) throw new Error("Auth failed");
    console.log(`[Cleanup API single sheet] Attempting Inward Sync for Spreadsheet ID: ${spreadsheetId}, Sheet: ${sheetName}, Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);

    const sheets = google.sheets({ version: 'v4', auth });
    
    let spreadsheetName = "Project Sheet";
    try {
      const parentRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.get({
        spreadsheetId
      }));
      spreadsheetName = parentRes.data.properties?.title || spreadsheetName;
    } catch (e) {
      console.error("Error getting spreadsheet name", e);
    }

    const dataRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `'${sheetName}'!A:AZ`
    }));

    const rows = dataRes.data.values || [];
    if (rows.length < 2) {
      return {
        spreadsheetId,
        spreadsheetName,
        sheetName,
        updatesCount: 0,
        errors: ["Sheet contains too few rows"]
      };
    }

    const headers = rows[1] || [];
    const findCol = (names: string[]) => headers.findIndex(h => names.some(n => h?.toString().toLowerCase().includes(n.toLowerCase().trim())));

    const inwardIdx = findCol(['Inward Date']);
    const excelIdx = findCol(['EXCEL Date', 'Excel Date']);
    const highriseIdx = findCol(['Highrise RA Date', 'RA Date']);

    if (inwardIdx === -1) {
      return {
        spreadsheetId,
        spreadsheetName,
        sheetName,
        updatesCount: 0,
        errors: ["Inward Date column not found"]
      };
    }

    let updates = 0;
    const valueUpdates: any[] = [];

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const inwardVal = row[inwardIdx];
      const excelVal = excelIdx !== -1 ? row[excelIdx] : null;
      const highriseVal = highriseIdx !== -1 ? row[highriseIdx] : null;

      const dInward = this.parseSheetDate(inwardVal);
      const dExcel = this.parseSheetDate(excelVal);
      const dHighrise = this.parseSheetDate(highriseVal);

      const dates = [dInward, dExcel, dHighrise]
        .filter(d => d !== null && !isNaN(d.getTime())) as Date[];

      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        
        // Skip if Inward Date is already equal to the minimum of inward, excel, and highrise
        if (dInward && dInward.getTime() === minDate.getTime()) {
          continue;
        }

        const formattedInward = this.formatSheetDate(minDate);
        
        if (inwardVal !== formattedInward) {
          valueUpdates.push({
            range: `'${sheetName}'!${this.columnToLetter(inwardIdx + 1)}${i + 1}`,
            values: [[formattedInward]]
          });
          updates++;
        }
      }
    }

    if (valueUpdates.length > 0) {
      console.log(`[Maintenance] Applying ${valueUpdates.length} Inward Date updates to ${spreadsheetName} / ${sheetName}`);
      await DataTransformationService.withRetry(() => sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: valueUpdates
        }
      }));
    }

    return {
      spreadsheetId,
      spreadsheetName,
      sheetName,
      updatesCount: updates,
      errors: []
    };
  }

  public static async cleanSingleSheetExcelViolation(spreadsheetId: string, sheetName: string): Promise<MaintenanceResult> {
    const auth = GoogleAuthService.getServiceAccountAuth();
    if (!auth) throw new Error("Auth failed");
    console.log(`[Cleanup API single sheet] Attempting Excel Violation Cleanup for Spreadsheet ID: ${spreadsheetId}, Sheet: ${sheetName}, Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);

    const sheets = google.sheets({ version: 'v4', auth });
    
    let spreadsheetName = "Project Sheet";
    try {
      const parentRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.get({
        spreadsheetId
      }));
      spreadsheetName = parentRes.data.properties?.title || spreadsheetName;
    } catch (e) {
      console.error("Error getting spreadsheet name", e);
    }

    const dataRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `'${sheetName}'!A:AZ`
    }));

    const rows = dataRes.data.values || [];
    if (rows.length < 2) {
      return {
        spreadsheetId,
        spreadsheetName,
        sheetName,
        updatesCount: 0,
        errors: ["Sheet contains too few rows"]
      };
    }

    const headers = rows[1] || [];
    const findCol = (names: string[]) => headers.findIndex(h => names.some(n => h?.toString().toLowerCase().includes(n.toLowerCase().trim())));

    const excelIdx = findCol(['EXCEL Date', 'Excel Date']);
    const highriseIdx = findCol(['Highrise RA Date', 'RA Date']);

    if (excelIdx === -1 || highriseIdx === -1) {
      return {
        spreadsheetId,
        spreadsheetName,
        sheetName,
        updatesCount: 0,
        errors: ["Excel Date or Highrise RA Date column not found"]
      };
    }

    let updates = 0;
    const valueUpdates: any[] = [];

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const excelVal = row[excelIdx];
      const highriseVal = row[highriseIdx];

      const dExcel = this.parseSheetDate(excelVal);
      const dHighrise = this.parseSheetDate(highriseVal);

      if (dExcel && dHighrise && dHighrise < dExcel) {
        const formattedExcel = this.formatSheetDate(dHighrise);
        if (excelVal !== formattedExcel) {
          valueUpdates.push({
            range: `'${sheetName}'!${this.columnToLetter(excelIdx + 1)}${i + 1}`,
            values: [[formattedExcel]]
          });
          updates++;
        }
      }
    }

    if (valueUpdates.length > 0) {
      console.log(`[Maintenance] Applying ${valueUpdates.length} Excel Date updates to ${spreadsheetName} / ${sheetName}`);
      await DataTransformationService.withRetry(() => sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: valueUpdates
        }
      }));
    }

    return {
      spreadsheetId,
      spreadsheetName,
      sheetName,
      updatesCount: updates,
      errors: []
    };
  }

  public static async performCombinedDateCorrection(spreadsheetIds?: string[]): Promise<MaintenanceResult[]> {
    const auth = GoogleAuthService.getServiceAccountAuth();
    if (!auth) throw new Error("Auth failed");

    const sheets = google.sheets({ version: 'v4', auth });
    const discoveredSites = await SiteDiscoveryService.discoverSites(true);
    
    const targetSites = spreadsheetIds && spreadsheetIds.length > 0
      ? discoveredSites.filter(s => spreadsheetIds.includes(s.spreadsheetId))
      : discoveredSites;

    console.log(`[Maintenance] Combined Date Correction - target sites count: ${targetSites.length}`);

    const results: MaintenanceResult[] = [];

    for (const site of targetSites) {
      try {
        const spreadsheetRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.get({
          spreadsheetId: site.spreadsheetId
        }));
        
        const spreadsheetSheets = spreadsheetRes.data.sheets || [];
        const invoiceSheets = spreadsheetSheets.filter(s => 
          s.properties?.title?.toLowerCase().includes('invoice')
        );

        for (const sheet of invoiceSheets) {
          const sheetTitle = sheet.properties?.title!;
          const res = await this.cleanSingleSheetCombined(site.spreadsheetId, sheetTitle);
          results.push(res);
        }
      } catch (err: any) {
        console.error(`[Maintenance] Error in Combined Date Correction for ${site.name}:`, err);
        results.push({
          spreadsheetId: site.spreadsheetId,
          spreadsheetName: site.name,
          sheetName: 'ALL',
          updatesCount: 0,
          errors: [err.message]
        });
      }
    }

    return results;
  }

  public static async cleanSingleSheetCombined(spreadsheetId: string, sheetName: string): Promise<MaintenanceResult> {
    const auth = GoogleAuthService.getServiceAccountAuth();
    if (!auth) throw new Error("Auth failed");

    const sheets = google.sheets({ version: 'v4', auth });
    
    let spreadsheetName = "Project Sheet";
    try {
      const parentRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.get({
        spreadsheetId
      }));
      spreadsheetName = parentRes.data.properties?.title || spreadsheetName;
    } catch (e) {
      console.error("Error getting spreadsheet name", e);
    }

    const dataRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `'${sheetName}'!A:AZ`
    }));

    const rows = dataRes.data.values || [];
    if (rows.length < 2) {
      return {
        spreadsheetId,
        spreadsheetName,
        sheetName,
        updatesCount: 0,
        errors: ["Sheet contains too few rows"]
      };
    }

    const headers = rows[1] || [];
    const findCol = (names: string[]) => headers.findIndex(h => names.some(n => h?.toString().toLowerCase().trim().includes(n.toLowerCase().trim())));

    const inwardIdx = findCol(['Inward Date']);
    const excelIdx = findCol(['EXCEL Date', 'Excel Date']);
    const highriseIdx = findCol(['Highrise RA Date', 'RA Date']);
    const hoSubmissionIdx = findCol(['HO Submission Date', 'HO Submission']);
    const receivedHoIdx = findCol(['Received at HO', 'Received at HO Date']);
    const certifiedIdx = findCol(['Certified at HO & Sent to Accounts on', 'Certified at HO', 'Sent to Accounts']);
    const chequeHoIdx = findCol(['Cheque Recd. At HO Date', 'Cheque Recd. At HO']);
    const chequeSiteIdx = findCol(['Cheque Recd. At Site Date', 'Cheque Recd. At Site']);
    const contractorIdx = findCol(['Contractor Name']);
    const srNoIdx = findCol(['Sr no']);

    if (inwardIdx === -1 && excelIdx === -1) {
      return {
        spreadsheetId,
        spreadsheetName,
        sheetName,
        updatesCount: 0,
        errors: ["Neither Inward Date nor Excel Date columns found"]
      };
    }

    let updates = 0;
    const valueUpdates: any[] = [];

    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const contractorName = contractorIdx !== -1 ? String(row[contractorIdx] || '').trim() : '';
      const srNo = srNoIdx !== -1 ? String(row[srNoIdx] || '').trim() : '';
      if (contractorName === 'TEST' || srNo === '1') continue;

      const inwardVal = inwardIdx !== -1 ? row[inwardIdx] : null;
      const excelVal = excelIdx !== -1 ? row[excelIdx] : null;
      const highriseVal = highriseIdx !== -1 ? row[highriseIdx] : null;
      const hoSubVal = hoSubmissionIdx !== -1 ? row[hoSubmissionIdx] : null;
      const receivedHoVal = receivedHoIdx !== -1 ? row[receivedHoIdx] : null;
      const certVal = certifiedIdx !== -1 ? row[certifiedIdx] : null;
      const chequeHoVal = chequeHoIdx !== -1 ? row[chequeHoIdx] : null;
      const chequeSiteVal = chequeSiteIdx !== -1 ? row[chequeSiteIdx] : null;

      const dInward = this.parseSheetDate(inwardVal);
      const dExcel = this.parseSheetDate(excelVal);
      const dHighrise = this.parseSheetDate(highriseVal);
      const dHOSubmission = this.parseSheetDate(hoSubVal);
      const dReceivedHO = this.parseSheetDate(receivedHoVal);
      const dCertified = this.parseSheetDate(certVal);
      const dChequeHO = this.parseSheetDate(chequeHoVal);
      const dChequeSite = this.parseSheetDate(chequeSiteVal);

      // Exception Rule: For March 25th to 30th of any year, do not apply check or change
      const isExemptDate = (d: Date | null) => {
        if (!d) return false;
        const m = d.getMonth(); // 2 is March
        const day = d.getDate();
        return m === 2 && day >= 25 && day <= 30;
      };

      if (isExemptDate(dHighrise) || isExemptDate(dExcel)) {
        continue;
      }

      // Track cell updates for this row to prevent writing same value
      let updatedRowInward = false;
      let updatedRowExcel = false;

      // 1. Inward Correction (if following dates are less than inward date)
      if (inwardIdx !== -1 && dInward && !isNaN(dInward.getTime())) {
        const followingDates = [
          dExcel,
          dHighrise,
          dHOSubmission,
          dReceivedHO,
          dCertified,
          dChequeHO,
          dChequeSite
        ].filter((d): d is Date => d !== null && !isNaN(d.getTime()));

        if (followingDates.length > 0) {
          const hasEarlierDate = followingDates.some(fDate => fDate.getTime() < dInward.getTime());
          if (hasEarlierDate) {
            const minDate = new Date(Math.min(...followingDates.map(d => d.getTime())));
            const formattedInward = this.formatSheetDate(minDate);
            
            if (inwardVal !== formattedInward) {
              valueUpdates.push({
                range: `'${sheetName}'!${this.columnToLetter(inwardIdx + 1)}${i + 1}`,
                values: [[formattedInward]]
              });
              updates++;
              updatedRowInward = true;
            }
          }
        }
      }

      // 2. Excel Correction (if sequence dates excluding inward and excel are less than excel date)
      if (excelIdx !== -1 && dExcel && !isNaN(dExcel.getTime())) {
        const sequenceDates = [
          dHighrise,
          dHOSubmission,
          dReceivedHO,
          dCertified,
          dChequeHO,
          dChequeSite
        ].filter((d): d is Date => d !== null && !isNaN(d.getTime()));

        if (sequenceDates.length > 0) {
          const hasEarlierDate = sequenceDates.some(sDate => sDate.getTime() < dExcel.getTime());
          if (hasEarlierDate) {
            const minDate = new Date(Math.min(...sequenceDates.map(d => d.getTime())));
            const formattedExcel = this.formatSheetDate(minDate);
            
            if (excelVal !== formattedExcel) {
              valueUpdates.push({
                range: `'${sheetName}'!${this.columnToLetter(excelIdx + 1)}${i + 1}`,
                values: [[formattedExcel]]
              });
              updates++;
              updatedRowExcel = true;
            }
          }
        }
      }
    }

    if (valueUpdates.length > 0) {
      console.log(`[Maintenance] Applying ${valueUpdates.length} combined updates to ${spreadsheetName} / ${sheetName}`);
      await DataTransformationService.withRetry(() => sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: valueUpdates
        }
      }));
    }

    return {
      spreadsheetId,
      spreadsheetName,
      sheetName,
      updatesCount: updates,
      errors: []
    };
  }

  private static formatSheetDate(date: Date): string {
    // Return in dd-MMM-yy format
    return format(date, 'dd-MMM-yy');
  }

  private static columnToLetter(column: number): string {
    let temp, letter = '';
    while (column > 0) {
      temp = (column - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      column = (column - temp - 1) / 26;
    }
    return letter;
  }

  /**
   * Retrieves the row metadata of the destination History sheet to show insertion range before archiving.
   */
  public static async getHistoryRowCheck(
    spreadsheetId: string,
    historySheetName: string,
    numRows: number
  ): Promise<{ success: boolean; lastNonBlankRow: number; insertStartRow: number; insertEndRow: number }> {
    const auth = GoogleAuthService.getServiceAccountAuth();
    if (!auth) throw new Error("Auth failed");

    const sheets = google.sheets({ version: 'v4', auth });

    const historyRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${historySheetName}'!A:AZ`
    }));
    const historyRows = historyRes.data.values || [];

    let lastNonBlankRowIdx = -1;
    for (let j = historyRows.length - 1; j >= 0; j--) {
      const row = historyRows[j];
      if (row && row.some((cell: any) => cell !== undefined && cell !== null && cell.toString().trim() !== '')) {
        lastNonBlankRowIdx = j;
        break;
      }
    }

    const insertRowIndex = lastNonBlankRowIdx !== -1 ? lastNonBlankRowIdx : historyRows.length;
    const insertStartRow = insertRowIndex + 1;
    const insertEndRow = insertRowIndex + numRows;

    return {
      success: true,
      lastNonBlankRow: lastNonBlankRowIdx !== -1 ? lastNonBlankRowIdx + 1 : historyRows.length,
      insertStartRow,
      insertEndRow
    };
  }

  /**
   * Moves specified rows (by their Sr no) from the Invoice/Tracking sheet to the History sheet,
   * inserting them before the last non-blank row of the History sheet.
   */
  public static async moveRowsToHistory(
    spreadsheetId: string,
    invoiceSheetName: string,
    historySheetName: string,
    srNos: number[]
  ): Promise<{ success: boolean; movedCount: number; error?: string; movedRows?: any[] }> {
    const auth = GoogleAuthService.getServiceAccountAuth();
    if (!auth) throw new Error("Auth failed");

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Read Invoice tracking sheet to find the matching rows and their raw index
    const invoiceRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${invoiceSheetName}'!A:AZ`
    }));

    const invoiceRows = invoiceRes.data.values || [];
    if (invoiceRows.length < 2) {
      throw new Error("No data found in Tracking sheet");
    }

    const headers = invoiceRows[1] || [];
    const headersLower = headers.map((h: any) => h?.toString().toLowerCase().trim() || '');
    const srNoIdx = headersLower.findIndex(h => h === 'sr no');
    if (srNoIdx === -1) {
      throw new Error(`Could not find 'Sr no' column in Tracking sheet '${invoiceSheetName}'`);
    }

    const statusIdx = headersLower.findIndex(h => h === 'status');
    const billAmountIdx = headersLower.findIndex(h => h === 'bill amount (net payble)');
    const chequeAmountIdx = headersLower.findIndex(h => h === 'cheque amount');
    const paidAmountIdx = headersLower.findIndex(h => h === 'paid amount');
    const chequeRecdSiteIdx = headersLower.findIndex(h => h.includes('cheque recd') && h.includes('site'));
    const chequeRecdHoIdx = headersLower.findIndex(h => h.includes('cheque recd') && h.includes('ho'));
    const contractorNameIdx = headersLower.findIndex(h => h.includes('contractor name'));

    const rowsToMoveInfo: Array<{ rowIndex: number; rowData: any[] }> = [];
    for (let i = 2; i < invoiceRows.length; i++) {
      const row = invoiceRows[i];
      const val = parseInt(row[srNoIdx]);
      if (val && srNos.includes(val)) {
        rowsToMoveInfo.push({ rowIndex: i + 1, rowData: row });
      }
    }

    if (rowsToMoveInfo.length === 0) {
      return { success: true, movedCount: 0 };
    }

    // 2. Read History sheet to find where to insert
    const historyRes = await DataTransformationService.withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${historySheetName}'!A:AZ`
    }));
    const historyRows = historyRes.data.values || [];

    // Find the last non-blank row in historyRows
    let lastNonBlankRowIdx = -1;
    for (let j = historyRows.length - 1; j >= 0; j--) {
      const row = historyRows[j];
      if (row && row.some((cell: any) => cell !== undefined && cell !== null && cell.toString().trim() !== '')) {
        lastNonBlankRowIdx = j;
        break;
      }
    }

    // Get spreadsheet sheets metadata to get correct sheetIds
    const spreadsheetMetadata = await DataTransformationService.withRetry(() => sheets.spreadsheets.get({
      spreadsheetId
    }));

    const hSheet = spreadsheetMetadata.data.sheets?.find((s: any) => s.properties?.title === historySheetName);
    const iSheet = spreadsheetMetadata.data.sheets?.find((s: any) => s.properties?.title === invoiceSheetName);

    if (!hSheet) {
      throw new Error(`Could not find History sheet '${historySheetName}' in spreadsheet`);
    }
    if (!iSheet) {
      throw new Error(`Could not find Tracking sheet '${invoiceSheetName}' in spreadsheet`);
    }

    const historySheetId = hSheet.properties?.sheetId;
    const invoiceSheetId = iSheet.properties?.sheetId;

    const numRowsToInsert = rowsToMoveInfo.length;
    // Insert index: if lastNonBlankRowIdx is valid, we insert before it, else append at end
    const insertRowIndex = lastNonBlankRowIdx !== -1 ? lastNonBlankRowIdx : historyRows.length;

    // 3. Insert blank rows inside History sheet
    await DataTransformationService.withRetry(() => sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: historySheetId,
                dimension: 'ROWS',
                startIndex: insertRowIndex,
                endIndex: insertRowIndex + numRowsToInsert
              },
              inheritFromBefore: true
            }
          }
        ]
      }
    }));

    // 4. Update the values of inserted rows
    const valuesToWrite = rowsToMoveInfo.map(info => {
      // pad row array to ensure equal length to headers or write as-is
      const rowDataCopy = [...info.rowData];

      // Make Sr no and Status blank as they are auto-calculated
      if (srNoIdx !== -1) {
        rowDataCopy[srNoIdx] = "";
      }
      if (statusIdx !== -1) {
        rowDataCopy[statusIdx] = "";
      }

      // Propagate HO Date if Site Date is blank before moving
      if (chequeRecdSiteIdx !== -1 && chequeRecdHoIdx !== -1) {
        const siteVal = rowDataCopy[chequeRecdSiteIdx];
        const hoVal = rowDataCopy[chequeRecdHoIdx];
        if (siteVal === undefined || siteVal === null || siteVal.toString().trim() === '') {
          rowDataCopy[chequeRecdSiteIdx] = hoVal;
        }
      }

      // Handle Bill Amount (Net Payble), Cheque/Paid Amount to remove currency symbol ₹ and commas
      const cleanNumeric = (val: any) => {
        if (val === undefined || val === null || val === '') return "";
        const cleanStr = val.toString().replace(/[₹\s,]/g, "");
        const num = parseFloat(cleanStr);
        return isNaN(num) ? val : num;
      };

      if (billAmountIdx !== -1) {
        rowDataCopy[billAmountIdx] = cleanNumeric(rowDataCopy[billAmountIdx]);
      }
      if (chequeAmountIdx !== -1) {
        rowDataCopy[chequeAmountIdx] = cleanNumeric(rowDataCopy[chequeAmountIdx]);
      }
      if (paidAmountIdx !== -1) {
        rowDataCopy[paidAmountIdx] = cleanNumeric(rowDataCopy[paidAmountIdx]);
      }

      return rowDataCopy;
    });

    const writeRange = `'${historySheetName}'!A${insertRowIndex + 1}`;
    await DataTransformationService.withRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId,
      range: writeRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: valuesToWrite
      }
    }));

    // 5. Delete rows from Tracking sheet in descending order of rowIndex
    const sortedRowsToDelete = [...rowsToMoveInfo].sort((a, b) => b.rowIndex - a.rowIndex);
    const deleteRequests = sortedRowsToDelete.map(info => ({
      deleteDimension: {
        range: {
          sheetId: invoiceSheetId,
          dimension: 'ROWS',
          startIndex: info.rowIndex - 1,
          endIndex: info.rowIndex
        }
      }
    }));

    if (deleteRequests.length > 0) {
      await DataTransformationService.withRetry(() => sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: deleteRequests
        }
      }));
    }

    // Build the moved details metadata to return
    const movedRows = rowsToMoveInfo.map((info, k) => {
      const oldSrNo = parseInt(info.rowData[srNoIdx]) || 0;
      // Index insertRowIndex corresponds to spreadsheet row (insertRowIndex + 1). Sr No starts at index 2 (row 3) = row - 2 => insertRowIndex + k - 1
      const newSrNo = insertRowIndex + k - 1; 
      const contractorName = contractorNameIdx !== -1 ? (info.rowData[contractorNameIdx] || 'N/A') : 'N/A';
      const billAmount = billAmountIdx !== -1 ? (info.rowData[billAmountIdx] || '0') : '0';
      const rawSiteDate = chequeRecdSiteIdx !== -1 ? info.rowData[chequeRecdSiteIdx] : '';
      const rawHoDate = chequeRecdHoIdx !== -1 ? info.rowData[chequeRecdHoIdx] : '';
      const siteDate = (rawSiteDate === undefined || rawSiteDate === null || rawSiteDate === '' || rawSiteDate.toString().trim() === '') ? rawHoDate : rawSiteDate;

      return {
        oldSrNo,
        newSrNo,
        contractorName,
        billAmount,
        siteDate
      };
    });

    return {
      success: true,
      movedCount: numRowsToInsert,
      movedRows
    };
  }
}
