import { InvoiceRecord } from '../types';

export const isValMissing = (val: any): boolean => {
    if (val === undefined || val === null) return true;
    const s = String(val).trim();
    return s === "" || s.toLowerCase() === "n/a" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined";
};

export const isBillingPeriodExempt = (r: any): boolean => {
    const status = String(r['Status'] || '').toLowerCase().trim();
    const billType = String(r['Bill Type'] || '').toLowerCase().trim();
    return status.includes('in process') || 
           status.includes('hold at site') || 
           billType.includes('sd release') || 
           billType.includes('quality release') || 
           billType.includes('advance');
};

export const parseDateStr = (str: any): Date | null => {
    if (!str) return null;
    let d;
    if (typeof str === 'number') {
        d = new Date((str - 25569) * 86400 * 1000);
    } else {
        d = new Date(str);
    }
    return isNaN(d.getTime()) ? null : d;
};

export const checkChronologyViolations = (r: any) => {
    const d1 = parseDateStr(r._rawInwardDate);
    const d2_ex = parseDateStr(r._rawEXCELDate);
    const d2_hi = parseDateStr(r._rawHighriseRADate);
    const d3 = parseDateStr(r._rawHOSubmissionDate);
    const d4 = parseDateStr(r._rawReceivedHODate);
    const d5 = parseDateStr(r._rawCertifiedDate);
    const d6 = parseDateStr(r._rawChequeRecdHoDate);
    const d7 = parseDateStr(r._rawChequeRecdSiteDate);

    const violations = {
        inward: false,
        excel: false,
        highrise: false,
        excelOrHi: false,
        submission: false,
        received: false,
        certified: false,
        chequeHo: false,
        chequeSite: false,
    };

    const violators = {
        inward: false,
        excel: false,
        highrise: false,
        excelOrHi: false,
        submission: false,
        received: false,
        certified: false,
        chequeHo: false,
        chequeSite: false,
    };

    const status = String(r['Status'] || '').trim().toLowerCase();
    const billType = String(r['Bill Type'] || '').trim().toLowerCase();

    if (status.includes('hold')) return { violations, violators };

    const isSameDay = (a: Date | null, b: Date | null) => {
        if (!a || !b) return false;
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth() === b.getMonth() &&
               a.getDate() === b.getDate();
    };

    const isFinancialYearEndGrace = (d: Date | null) => {
        if (!d) return false;
        return d.getMonth() === 2 && d.getDate() >= 25 && d.getDate() <= 31;
    };

    const hiGrace = isFinancialYearEndGrace(d2_hi);
    const exGrace = isFinancialYearEndGrace(d2_ex);

    const EXEMPT_HI_TYPES = ['advance', 'retention', 'quality', 'sd release', 'sd-release'];
    const EXEMPT_EXCEL_TYPES = ['acs', 'advance', 'retention', 'quality', 'sd release'];

    const hiExempt = hiGrace || EXEMPT_HI_TYPES.some(t => billType.includes(t));
    const exExempt = exGrace || EXEMPT_EXCEL_TYPES.some(t => billType.includes(t));

    if (d1 && d2_ex && !exExempt && d2_ex < d1 && !isSameDay(d2_ex, d1)) {
        violations.excel = true;
        violations.inward = true;
        violators.excel = true;
    }

    if (d2_hi && !hiExempt) {
        if (d1 && d2_hi < d1 && !isSameDay(d2_hi, d1)) {
            violations.highrise = true;
            violations.inward = true;
            violators.highrise = true;
        }
    }

    if (d3) {
        if (d2_ex && d3 < d2_ex && !isSameDay(d3, d2_ex)) {
            violations.submission = true;
            violations.excel = true;
            violators.submission = true;
        } else if (d1 && d3 < d1 && !isSameDay(d3, d1)) {
            violations.submission = true;
            violations.inward = true;
            violators.submission = true;
        }
    }

    if (d4) {
        if (d3 && d4 < d3 && !isSameDay(d4, d3)) {
            violations.received = true;
            violations.submission = true;
            violators.received = true;
        } else if (d2_ex && d4 < d2_ex && !isSameDay(d4, d2_ex)) {
            violations.received = true;
            violations.excel = true;
            violators.received = true;
        } else if (d1 && d4 < d1 && !isSameDay(d4, d1)) {
            violations.received = true;
            violations.inward = true;
            violators.received = true;
        }
    }

    if (d5 && d4 && d5 < d4 && !isSameDay(d5, d4)) {
        violations.certified = true;
        violations.received = true;
        violators.certified = true;
    }

    if (d6) {
        if (d4 && d6 < d4 && !isSameDay(d6, d4)) {
            violations.chequeHo = true;
            violations.received = true;
            violators.chequeHo = true;
        } else if (d2_hi && !hiGrace && d6 < d2_hi && !isSameDay(d6, d2_hi)) {
            violations.chequeHo = true;
            violations.highrise = true;
            violators.chequeHo = true;
        }
    }

    if (d7) {
        if (d6 && d7 < d6 && !isSameDay(d7, d6)) {
            violations.chequeSite = true;
            violations.chequeHo = true;
            violators.chequeSite = true;
        }
    }

    violations.excelOrHi = violations.excel || violations.highrise;
    violators.excelOrHi = violators.excel || violators.highrise;

    return { violations, violators };
};

export const checkMissingFlowViolations = (r: any) => {
    const m1 = r._rawInwardDate;
    const m2_ex = r._rawEXCELDate;
    const m2_hi = r._rawHighriseRADate;
    const m3 = r._rawHOSubmissionDate;
    const m4 = r._rawReceivedHODate;
    const m5 = r._rawCertifiedDate;
    const m6 = r._rawChequeRecdHoDate;
    const m7 = r._rawChequeRecdSiteDate;

    const isPresent = (val: any) => {
        if (val === null || val === undefined) return false;
        const s = String(val).trim().toLowerCase();
        return s !== "" && s !== "0" && s !== "na" && s !== "n/a" && s !== "0.00" && s !== "invalid date";
    };

    const p1 = isPresent(m1);
    const p2_ex = isPresent(m2_ex);
    const p2_hi = isPresent(m2_hi);
    const p3 = isPresent(m3);
    const p4 = isPresent(m4);
    const p5 = isPresent(m5);
    const p6 = isPresent(m6);
    const p7 = isPresent(m7);

    let lastExistIdx = -1;
    if (p7) lastExistIdx = 7;
    else if (p6) lastExistIdx = 6;
    else if (p5) lastExistIdx = 5;
    else if (p4) lastExistIdx = 4;
    else if (p3) lastExistIdx = 3;
    else if (p2_hi) lastExistIdx = 2;
    else if (p2_ex) lastExistIdx = 1;
    else if (p1) lastExistIdx = 0;

    const billType = String(r['Bill Type'] || '').trim().toLowerCase();
    const EXEMPT_HI_TYPES = ['advance', 'retention', 'quality', 'sd release', 'sd-release'];
    const EXEMPT_EXCEL_TYPES = ['acs', 'advance', 'retention', 'quality', 'sd release'];

    const hiExempt = EXEMPT_HI_TYPES.some(t => billType.includes(t));
    const exExempt = EXEMPT_EXCEL_TYPES.some(t => billType.includes(t));

    const statusLower = String(r['Status'] || '').trim().toLowerCase();
    if (statusLower.includes('hold')) {
        return {
            inward: false, excel: false, highrise: false, excelOrHi: false,
            submission: false, received: false, certified: false, chequeHo: false, chequeSite: false
        };
    }

    return {
        inward: lastExistIdx > 0 && !p1,
        excel: lastExistIdx > 1 && !p2_ex && !exExempt,
        highrise: lastExistIdx > 2 && !p2_hi && !hiExempt,
        excelOrHi: (lastExistIdx > 1 && !p2_ex && !exExempt) || (lastExistIdx > 2 && !p2_hi && !hiExempt),
        submission: lastExistIdx > 3 && !p3,
        received: lastExistIdx > 4 && !p4,
        certified: lastExistIdx > 5 && !p5,
        chequeHo: lastExistIdx > 6 && !p6,
        chequeSite: false,
    };
};

export const isExemptFromMissingExcelNo = (r: any) => {
    const status = String(r['Status'] || '').trim().toLowerCase();
    const billType = String(r['Bill Type'] || '').trim().toLowerCase();
    const exemptBillTypes = ['advance', 'sd release', 'sd-release', 'acs'];
    return status.includes('in process') ||
           status.includes('hold at site') ||
           exemptBillTypes.some(t => billType.includes(t));
};

export const isExemptFromDuplicates = (r: any) => {
    const contractor = String(r['Contractor Name'] || '').trim().toLowerCase();
    const srNo = String(r['Sr no'] || '').trim();
    return contractor === 'test' || srNo === '1';
};

export const getRecordDiscrepancies = (r: any, allRecords?: any[]): string[] => {
    const problems: string[] = [];

    const contractorName = String(r['Contractor Name'] || '').trim();
    const isTestContractor = contractorName.toUpperCase() === 'TEST';

    // 1. Balance Payment Negative
    const billAmt = parseFloat(String(r['Bill Amount (Net Payble)'] || '').replace(/[₹\s,]/g, '')) || 0;
    const paidAmt = parseFloat(String(r['Paid Amount'] || r['Cheque Amount'] || '').replace(/[₹\s,]/g, '')) || 0;
    if (billAmt - paidAmt < -1) { // Small buffer for rounding
        problems.push("Balance Payment Negative");
    }

    // 2. Payment Fields Missing
    const statusLower = String(r['Status'] || '').trim().toLowerCase();
    const payStatusLower = String(r['Payment Status'] || '').trim().toLowerCase();
    const hasClearedStatus = payStatusLower.includes('cleared') || statusLower.includes('cleared');
    
    if (hasClearedStatus) {
        if (!r['Cheque No'] || String(r['Cheque No']).trim() === '') {
            problems.push("Cleared Payment, but Cheque No is Blank");
        }
        if (isValMissing(r._rawChequeRecdSiteDate) && isValMissing(r._rawChequeRecdHoDate)) {
            problems.push("Cleared Payment, but Cheque Receipt Date is Blank");
        }
    }

    // 3. Basic Fields Missing
    const missingBasic: string[] = [];
    if (!r['Billing Eng Name'] || String(r['Billing Eng Name']).trim() === '') missingBasic.push("Billing Engineer Name");
    if (!r['Contractor Name'] || String(r['Contractor Name']).trim() === '') missingBasic.push("Contractor Name");
    if (!r['Bill Type'] || String(r['Bill Type']).trim() === '') missingBasic.push("Bill Type");
    
    const isBillingPeriodExemptVal = isBillingPeriodExempt(r);

    if ((!r['Billing Period'] || String(r['Billing Period']).trim() === '') && !isBillingPeriodExemptVal) {
        missingBasic.push("Billing Period");
    }
    
    if (isValMissing(r._rawInwardDate)) missingBasic.push("Inward Date");
    
    const locationVal = r['LOCATION/Bldg.'] || r['LOCATION / Bldg.'] || r['LOCATION/Bldg'] || r['LOCATION / Bldg'];
    if (isValMissing(locationVal)) missingBasic.push("Location");
    
    if (missingBasic.length > 0) {
        problems.push(`Basic Fields Missing: ${missingBasic.join(', ')}`);
    }

    // 4. WO/Bill Numbers Missing
    const missingWO: string[] = [];
    if (!r['Highrise WO No'] || String(r['Highrise WO No']).trim() === '') missingWO.push("WO No");
    if (!isExemptFromMissingExcelNo(r) && (!r['Excel RA Bill NO'] || String(r['Excel RA Bill NO']).trim() === '')) missingWO.push("Excel RA Bill No");
    if (!r['Highrise RA No'] || String(r['Highrise RA No']).trim() === '') missingWO.push("Highrise RA No");
    if (missingWO.length > 0) {
        problems.push(`WO/Bill Numbers Missing: ${missingWO.join(', ')}`);
    }

    // 5. Flow Violations
    const chrono = checkChronologyViolations(r);
    if (Object.values(chrono.violators).some(v => v)) {
        problems.push("Date Chronology Flow Violations");
    }

    // 6. Sequence Gaps
    const flow = checkMissingFlowViolations(r);
    if (Object.values(flow).some(v => v)) {
        problems.push("Sequence Dates Missing (Gaps in Flow)");
    }

    // 7. Duplication Check (Excluding TEST)
    if (allRecords && !isTestContractor) {
        const raNo = String(r['Highrise RA No'] || '').trim();
        const woNo = String(r['Highrise WO No'] || '').trim();
        const billAmtStr = String(r['Bill Amount (Net Payble)'] || '').trim();

        if (raNo && woNo) {
            const matches = allRecords.filter(other => {
                if (other === r) return false;
                const oRa = String(other['Highrise RA No'] || '').trim();
                const oWo = String(other['Highrise WO No'] || '').trim();
                const oAmt = String(other['Bill Amount (Net Payble)'] || '').trim();
                const oContractor = String(other['Contractor Name'] || '').trim();
                
                return oRa === raNo && oWo === woNo && oAmt === billAmtStr && oContractor === contractorName;
            });
            if (matches.length > 0) {
                problems.push("Duplicate Bill Entry Detected");
            }
        }
    }

    return problems;
};

export const getRecordGroup = (r: any, allRecords?: any[]): string => {
    const problems = getRecordDiscrepancies(r, allRecords);
    if (problems.length === 0) return "No Auditing Discrepancies";
    
    const first = problems[0];
    if (first.includes("Balance Payment")) return "Balance Payment Negative";
    if (first.includes("Cleared Payment")) return "Payment Fields Missing";
    if (first.includes("Basic Fields")) return "Basic Fields Missing";
    if (first.includes("WO/Bill")) return "WO/Bill Numbers Missing";
    if (first.includes("Sequence Dates Missing")) return "Sequence Dates Missing (Gaps in Flow)";
    if (first.includes("Duplicate Bill")) return "Duplicate Bill Entry Detected";
    
    return "Date Chronology Flow Violations";
};

export const checkFutureDateViolations = (r: any) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const dates: Record<string, string | null | undefined> = {
        inward: r._rawInwardDate ?? r['Inward Date'],
        excel: r._rawEXCELDate ?? r['EXCEL Date'],
        highrise: r._rawHighriseRADate ?? r['Highrise RA Date'],
        submission: r._rawHOSubmissionDate ?? r['HO Submission Date'],
        received: r._rawReceivedHODate ?? r['Received at HO'],
        certified: r._rawCertifiedDate ?? r['Certified at HO & Sent to Accounts on'],
        chequeHo: r._rawChequeRecdHoDate ?? r['Cheque Recd. At HO Date'],
        chequeSite: r._rawChequeRecdSiteDate ?? r['Cheque Recd. At Site Date'],
    };

    const violations: Record<string, boolean> = {};
    Object.entries(dates).forEach(([key, val]) => {
        const dateObj = val ? new Date(val as string) : null;
        violations[key] = !!(dateObj && !isNaN(dateObj.getTime()) && dateObj > today);
    });

    return violations;
};

export const getAuditGroupsData = (records: any[]) => {
    // Group 1
    const grp1 = records.filter(r => r['Payment Status'] === 'Check Amounts as -Ve');

    // Group 2
    const grp2 = records.filter(r => {
        const statusRaw = String(r['Payment Status'] || '').trim().toLowerCase();
        const isPartialOrCleared = statusRaw === 'partial payment balance' || statusRaw === 'payment cleared';
        const isPaymentBalance = statusRaw === 'payment balance' || statusRaw === 'payment blance';
        
        const paymentKeys = [
            'Paid Amount', 'Balance Payment', 'Cheque Recd. At HO Date', 
            'Cheque Recd. At Site Date', 'Cheque No'
        ];

        const isMissingVal = (k: string) => {
            if (k === 'Billing Eng Name') {
                const isOtherSites = String(r.Project || '').trim().toLowerCase() === 'other sites';
                if (isOtherSites) return false;
            }
            return isValMissing(r[k]);
        };

        if (isPartialOrCleared) {
            return paymentKeys.some(k => isMissingVal(k));
        }

        if (isPaymentBalance) {
            const specificPaymentKeys = [
                'Cheque Recd. At HO Date', 'Cheque Recd. At Site Date', 'Cheque No'
            ];
            const hasAnySpecificPaymentData = specificPaymentKeys.some(k => !isValMissing(r[k]));
            if (hasAnySpecificPaymentData) {
                return paymentKeys.some(k => isMissingVal(k));
            }
        }

        return false;
    });

    // Group 3
    const grp3 = records.filter(r => {
        const checkKeys = [
            'Sr no', 'Contractor Name', 'Status', 'Billing Eng Name', 
            'Bill Type', 'Work Head', 'LOCATION/Bldg.'
        ];
        const isMissingBasic = checkKeys.some(k => {
            if (k === 'Billing Eng Name') {
                const isOtherSites = String(r.Project || '').trim().toLowerCase() === 'other sites';
                if (isOtherSites) return false;
            }
            return isValMissing(r[k]);
        });
        
        const isPeriodMissing = isValMissing(r['Billing Period']) && !isBillingPeriodExempt(r);
        
        return isMissingBasic || isPeriodMissing;
    });

    // Group 4: WO / Bill number missing
    const grp4 = records.filter(r => {
        const statusLower = String(r['Status'] || '').trim().toLowerCase();
        const billTypeLower = String(r['Bill Type'] || '').trim().toLowerCase();
        
        const excelNoMissing = isValMissing(r['Excel RA Bill NO']);
        const hiWoMissing = isValMissing(r['Highrise WO No']);
        const hiRaMissing = isValMissing(r['Highrise RA No']);

        const containsExcelDone = statusLower.includes('excel done');
        const containsInProcess = statusLower.includes('in process');
        const containsHoldAtSite = statusLower.includes('hold at site');
        
        if (containsExcelDone && excelNoMissing && !isExemptFromMissingExcelNo(r)) return true;

        if (!containsInProcess && !containsHoldAtSite && !containsExcelDone) {
            const ignoreRA = billTypeLower.includes('advance') || 
                             billTypeLower.includes('quality release') || 
                             billTypeLower.includes('sd release') ||
                             billTypeLower.includes('sd-release');
            
            const woMissing = hiWoMissing;
            const raMissing = !ignoreRA && hiRaMissing;
            const excelMissing = !isExemptFromMissingExcelNo(r) && excelNoMissing;
            
            if (woMissing || raMissing || excelMissing) return true;
        }

        return false;
    });

    // Group 5: Date Sequence Violation
    const grp5 = records.filter(r => {
        const { violations: chrono } = checkChronologyViolations(r);
        const flow = checkMissingFlowViolations(r);
        const future = checkFutureDateViolations(r);
        
        const isChrono = Object.values(chrono).some(v => v === true);
        const isFlow = Object.values(flow).some(v => v === true);
        const isFuture = Object.values(future).some(v => v === true);
        
        return isChrono || isFlow || isFuture;
    });

    // Group 6: Probable Duplication
    const grp6 = records.filter((r, idx) => {
        if (isExemptFromDuplicates(r)) return false;
        
        const hiWo = String(r['Highrise WO No'] || '').trim().toLowerCase();
        const hiRa = String(r['Highrise RA No'] || '').trim().toLowerCase();
        const excelNo = String(r['Excel RA Bill NO'] || '').trim().toLowerCase();

        const isValInvalid = (val: string) => {
            const v = val.toLowerCase();
            return !v || v === "" || v === "0" || v === "na" || v === "n/a" || v.includes("advance") || v.includes("retention") || v.includes("quality release") || v.includes("sd release") || v.includes("sd-release");
        };

        const isHiValid = !isValInvalid(hiWo) && !isValInvalid(hiRa);
        const isExValid = !isValInvalid(hiWo) && !isValInvalid(excelNo);

        if (!isHiValid && !isExValid) return false;

        return records.some((r2, idx2) => {
            if (idx === idx2) return false;
            
            const hiWo2 = String(r2['Highrise WO No'] || '').trim().toLowerCase();
            const hiRa2 = String(r2['Highrise RA No'] || '').trim().toLowerCase();
            const excelNo2 = String(r2['Excel RA Bill NO'] || '').trim().toLowerCase();

            if (isHiValid) {
                if (hiWo === hiWo2 && hiRa === hiRa2) return true;
            }

            if (isExValid) {
                if (hiWo === hiWo2 && excelNo === excelNo2) return true;
            }

            return false;
        });
    });

    // Group 7: No Auditing Discrepancies
    const grp7 = records.filter(r => 
        !grp1.some(x => x['Sr no'] === r['Sr no']) &&
        !grp2.some(x => x['Sr no'] === r['Sr no']) &&
        !grp3.some(x => x['Sr no'] === r['Sr no']) &&
        !grp4.some(x => x['Sr no'] === r['Sr no']) &&
        !grp5.some(x => x['Sr no'] === r['Sr no']) &&
        !grp6.some(x => x['Sr no'] === r['Sr no'])
    );

    return { grp1, grp2, grp3, grp4, grp5, grp6, grp7 };
};
