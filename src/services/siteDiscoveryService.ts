import { google } from 'googleapis';
import { GoogleAuthService } from './googleAuthService';

export interface DiscoveredSite {
  spreadsheetId: string;
  name: string;
}

export class SiteDiscoveryService {
  private static cachedSites: DiscoveredSite[] | null = null;
  private static cacheTimestamp = 0;
  private static CACHE_TTL = 15 * 60 * 1000; // 15 minutes TTL

  /**
   * Helper to sleep/stagger during retries
   */
  private static sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Discover and list all Google Sheets matching user's requirements:
   * 1. Residing within shared folder named 'Invoice Tracking'
   * 2. Name containing the word 'tracking' (case-insensitive)
   */
  public static async discoverSites(forceRefresh = false): Promise<DiscoveredSite[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedSites && (now - this.cacheTimestamp < this.CACHE_TTL)) {
      console.log(`[Discovery] Serving discovered sites from cache (count: ${this.cachedSites.length})`);
      return this.cachedSites;
    }

    const auth = GoogleAuthService.getServiceAccountAuth();
    if (!auth) {
      console.error("[Discovery] Service Account is not configured");
      return [];
    }

    try {
      const drive = google.drive({ version: 'v3', auth });

      console.log("[Discovery] Searching for folder named 'Invoice Tracking'...");
      
      // 1. Search for a folder named "Invoice Tracking"
      // Service Account needs to have access to this folder (either shared directly or inside a shared drive)
      const folderRes = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.folder' and name = 'Invoice Tracking' and trashed = false",
        fields: 'files(id, name)',
        pageSize: 10,
      });

      const folders = folderRes.data.files || [];
      console.log(`[Discovery] Found folder count: ${folders.length}`);

      let query = "mimeType = 'application/vnd.google-apps.spreadsheet' and name contains 'tracking' and trashed = false";

      if (folders.length > 0) {
        // Build queries to look inside parent folders matching 'Invoice Tracking'
        const parentFolderQueries = folders.map(f => `'${f.id}' in parents`).join(' or ');
        query = `(${parentFolderQueries}) and mimeType = 'application/vnd.google-apps.spreadsheet' and name contains 'tracking' and trashed = false`;
        console.log(`[Discovery] Querying spreadsheets in 'Invoice Tracking' folder(s)...`);
      } else {
        console.log(`[Discovery] Folder 'Invoice Tracking' not found. Falling back to global search for files containing 'tracking'...`);
      }

      console.log(`[Discovery] Drive search query: ${query}`);

      const filesRes = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = filesRes.data.files || [];
      console.log(`[Discovery] Search complete. Found ${files.length} matching spreadsheets.`);

      // Format as SiteConfig items
      const discovered: DiscoveredSite[] = files.map(file => {
        console.log(`[Discovery] - Match: '${file.name}' (ID: ${file.id})`);
        return {
          spreadsheetId: file.id || '',
          name: file.name || '',
        };
      }).filter(site => site.spreadsheetId !== '');

      if (discovered.length === 0) {
        console.warn("[Discovery] No spreadsheets containing 'tracking' were found in folder 'Invoice Tracking' (or globally as fallback).");
      }

      this.cachedSites = discovered;
      this.cacheTimestamp = Date.now();
      return discovered;
    } catch (e: any) {
      console.error("[Discovery] Error during Google Drive discovery:", e);
      // Return cached if available, otherwise empty
      return this.cachedSites || [];
    }
  }

  /**
   * Reset cache to force next request to scan Drive
   */
  public static clearCache() {
    this.cachedSites = null;
    this.cacheTimestamp = 0;
  }
}
