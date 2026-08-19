export interface InvoiceRecord {
  Source: string;
  'Project': string;
  'Sr no': number;
  'Billing Eng Name': string;
  'Contractor Name': string;
  'Bill Type': string;
  'Inward Date': string | null;
  'Work Head': string;
  'LOCATION/Bldg.': string;
  'Bill Amount (Net Payble)': number;
  'Status': string;
  'Hold at Site': string;
  'Reason For Hold at Site': string;
  'Remark Site': string;
  'Excel RA Bill NO': string;
  'EXCEL Date': string | null;
  'Billing Period': string;
  'Highrise WO No': string;
  'Highrise RA No': string;
  'Highrise RA Date': string | null;
  'HO Submission Date': string | null;
  'Received at HO': string | null;
  'Certified at HO & Sent to Accounts on': string | null;
  'Hold at HO': string;
  'Reason For Hold at HO': string;
  'Remark HO': string;
  'Cheque Recd. At HO Date': string | null;
  'Cheque Recd. At Site Date': string | null;
  'Cheque No': string;
  'Paid Amount': number;
  'Remark': string;
  
  // RAW Data Fields (for auditing)
  '_rawInwardDate'?: string | null;
  '_rawEXCELDate'?: string | null;
  '_rawHighriseRADate'?: string | null;
  '_rawHOSubmissionDate'?: string | null;
  '_rawReceivedHODate'?: string | null;
  '_rawCertifiedDate'?: string | null;
  '_rawChequeRecdHoDate'?: string | null;
  '_rawChequeRecdSiteDate'?: string | null;
  
  // Calculated Fields
  'Site Days': number | null;
  'HO Days': number | null;
  'Account Days': number | null;
  'Bill Process Days': number | null;
  'Inward to Payment Cycle Days': number | null;
  'Balance Payment': number;
  'Payment Status': string;
  siteConfigName?: string;
  _searchStr?: string;
}
