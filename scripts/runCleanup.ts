import { SheetCleanupService } from '../src/services/sheetCleanupService';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log("Starting sheet maintenance for ALL projects...");
  try {
    console.log("1. Running Inward Date Sync...");
    const inwardResults = await SheetCleanupService.performInwardDateSync();
    const totalInwardUpdates = inwardResults.reduce((sum, r) => sum + r.updatesCount, 0);
    console.log(`Inward Date Sync complete. Updates applied: ${totalInwardUpdates}\n`);

    console.log("2. Running Excel Date Violation Cleanup...");
    const excelResults = await SheetCleanupService.performExcelDateViolationCleanup();
    const totalExcelUpdates = excelResults.reduce((sum, r) => sum + r.updatesCount, 0);
    console.log(`Excel Date Violation Cleanup complete. Updates applied: ${totalExcelUpdates}\n`);

    console.log("Maintenance execution complete.");
  } catch (error) {
    console.error("Maintenance failed:", error);
    process.exit(1);
  }
}

run();
