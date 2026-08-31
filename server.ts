import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleAuthService } from "./src/services/googleAuthService";
import { DataTransformationService } from "./src/services/dataTransformationService";
import { SiteDiscoveryService } from "./src/services/siteDiscoveryService";
import { google } from "googleapis";
import * as dotenv from "dotenv";
import { SheetCleanupService } from "./src/services/sheetCleanupService";
import cookieParser from "cookie-parser";

// Load environment variables - prioritize process.env which is set by Netlify
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
    // Silent logging for production-like feel
    if (req.url.startsWith('/api/')) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
});

declare global {
    var dataCaches: Record<string, { data: any[], timestamp: number }>;
    var isFetchingMap: Record<string, boolean>;
}

const CACHE_TTL = 60 * 60 * 1000; // 60 minutes cache
const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours stale limit

// Debug environment variables on startup
const debugEnv = () => {
    const hasEmail = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const hasKey = !!process.env.GOOGLE_PRIVATE_KEY;
    const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
    const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.APP_URL;

    console.log(`[Server] Environment Check:`);
    console.log(`  - GOOGLE_SERVICE_ACCOUNT_EMAIL: ${hasEmail ? '✓ Set' : '✗ Missing'}`);
    console.log(`  - GOOGLE_PRIVATE_KEY: ${hasKey ? '✓ Set' : '✗ Missing'}`);
    console.log(`  - GOOGLE_CLIENT_ID: ${hasClientId ? '✓ Set' : '✗ Missing'}`);
    console.log(`  - GOOGLE_CLIENT_SECRET: ${hasClientSecret ? '✓ Set' : '✗ Missing'}`);
    console.log(`  - APP_URL: ${appUrl || '✗ Missing (using default)'}`);
};

debugEnv();

// Google OAuth Configuration
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/callback`
);

// Auth Middleware (Simplified for Service Account only)
const requireAuth = (req: any, res: any, next: any) => {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        return next();
    }
    console.warn(`[Auth] Service Account not configured. Email: ${!!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}, Key: ${!!process.env.GOOGLE_PRIVATE_KEY}`);
    res.status(401).json({ error: "Service Account not configured" });
};

async function startServer() {
    // API: Connectivity Check
    app.get("/api/health", (req, res) => {
        const hasSA = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
        console.log(`[Health] Service Account Status: ${hasSA ? 'OK' : 'MISSING'}`);
        
        res.json({ 
            ok: true, 
            serviceAccount: hasSA,
            envAppUrl: process.env.APP_URL || null,
            configuredRedirectUri: `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/callback`,
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        });
    });

    // --- Google OAuth Routes ---
    app.get("/api/auth/url", (req, res) => {
        try {
            const url = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
                prompt: 'select_account'
            });
            res.json({ url });
        } catch (error: any) {
            console.error("[Auth URL] Error:", error);
            res.status(500).json({ error: "Failed to generate auth URL" });
        }
    });

    app.get("/api/auth/callback", async (req, res) => {
        const { code } = req.query;
        if (!code) {
            return res.status(400).send("Missing code");
        }

        try {
            const { tokens } = await oauth2Client.getToken(code as string);
            oauth2Client.setCredentials(tokens);

            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();

            // Set user info in cookie
            res.cookie('user', JSON.stringify({
                email: userInfo.data.email,
                name: userInfo.data.name,
                picture: userInfo.data.picture
            }), {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
            });

            res.send(`
                <html>
                  <body>
                    <script>
                      if (window.opener) {
                        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                        window.close();
                      } else {
                        window.location.href = '/';
                      }
                    </script>
                    <p>Authentication successful. This window should close automatically.</p>
                  </body>
                </html>
            `);
        } catch (error) {
            console.error("Auth callback error:", error);
            res.status(500).send("Authentication failed");
        }
    });

    app.post("/api/auth/logout", (req, res) => {
        res.clearCookie('user');
        res.json({ success: true });
    });

    // API: System Info (Replaces User Info)
    app.get("/api/user", async (req: any, res) => {
        // First check if there's a user in the cookie
        if (req.cookies.user) {
            try {
                const user = JSON.parse(req.cookies.user);
                return res.json(user);
            } catch (e) {
                console.error("Failed to parse user cookie", e);
            }
        }

        const hasSA = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY;
        
        if (hasSA) {
            return res.json({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                name: "Service Account",
                role: "System Administrator",
                isServiceAccount: true
            });
        }
        
        res.status(401).json({ error: "No system auth configured" });
    });

    app.get("/api/verification", (req, res) => {
        res.json(DataTransformationService.lastFetchMetadata || []);
    });

    /* Global cache to prevent quota exceed */
    let _cachedProjectsMetadata: any = null;
    let _cachedProjectsMetadataTime = 0;

    app.get("/api/projects/metadata", requireAuth, async (req: any, res) => {
        try {
            const forceRefresh = req.query.refresh === 'true';
            const now = Date.now();
            
            console.log(`[Metadata] Request - forceRefresh: ${forceRefresh}, cached: ${!!_cachedProjectsMetadata}`);
            
            // If not forcing refresh, or if we have a cache younger than 1 hour, try to return it
            if (!forceRefresh && _cachedProjectsMetadata && now - _cachedProjectsMetadataTime < 1000 * 60 * 60) {
                console.log(`[Metadata] Returning cached metadata (${_cachedProjectsMetadata.length} sites)`);
                // Dynamically update sheetStats from the latest data fetch before returning cache
                const updatedCache = _cachedProjectsMetadata.map((site: any) => {
                    const sheetStats = site.sheetStats?.map((stat: any) => {
                        const latestStat = DataTransformationService.lastFetchMetadata?.find(m => 
                            m.spreadsheetId === stat.spreadsheetId && m.sheetName === stat.sheetName
                        );
                        return { ...stat, rowCount: latestStat?.processedRows || stat.rowCount };
                    }) || [];
                    return { ...site, sheetStats };
                });
                return res.json(updatedCache);
            }
            
            // Check if we can build it instantly from DataTransformationService.lastFetchMetadata
            const lastMeta = DataTransformationService.lastFetchMetadata || [];
            
            const authClient = GoogleAuthService.getServiceAccountAuth();

            if (!authClient) {
                console.error(`[Metadata] Service Account auth failed`);
                return res.status(401).json({ error: "Unauthorized - Service Account not configured" });
            }

            const sheetsAuth = google.sheets({ version: 'v4', auth: authClient });
            
            console.log(`[Metadata] Discovering sites from Google Drive...`);
            const discoveredSites = await SiteDiscoveryService.discoverSites(forceRefresh);
            console.log(`[Metadata] Found ${discoveredSites.length} sites`);
            
            const results = await Promise.all(discoveredSites.map(async (site, idx) => {
                try {
                    const cacheKey = site.spreadsheetId;
                    let sheets: any[] = [];
                    
                    // 1. Try structure cache
                    if (DataTransformationService.spreadsheetCache[cacheKey]) {
                        sheets = DataTransformationService.spreadsheetCache[cacheKey].sheets;
                        console.log(`[Metadata] Using structure cache for: ${site.spreadsheetId}`);
                    } else {
                        // Stagger calls slightly to avoid burst hits on boot
                        await new Promise(resolve => setTimeout(resolve, idx * 100));
                        const response = await DataTransformationService.withRetry<any>(() => sheetsAuth.spreadsheets.get({
                            spreadsheetId: site.spreadsheetId
                        }));
                        sheets = response.data.sheets || [];
                        DataTransformationService.spreadsheetCache[cacheKey] = {
                            sheets,
                            timestamp: Date.now()
                        };
                        console.log(`[Metadata] Loaded live structure for: ${site.spreadsheetId}`);
                    }
                    
                    const typesToMatch = ['Invoice', 'History'];
                    const filteredSheets = sheets.filter((s: any) => {
                        const name = s.properties?.title || '';
                        return typesToMatch.some(t => name.includes(t));
                    });
                    
                    const extractedNames = new Set<string>();
                    const sheetStats: any[] = [];

                    filteredSheets.forEach((s: any) => {
                        const sheetName = s.properties?.title || '';
                        let projectName = sheetName;
                        if (sheetName.includes(' - ')) {
                            projectName = sheetName.split(' - ')[0].trim();
                        } else if (sheetName.includes('-')) {
                            projectName = sheetName.split('-')[0].trim();
                        }
                        extractedNames.add(projectName);

                        // Find stats from last fetch if available
                        const stats = lastMeta.find(m => 
                            m.spreadsheetId === site.spreadsheetId && m.sheetName === sheetName
                        );

                        // Fallback to previous cached count if not found in lastMeta
                        const existingSite = _cachedProjectsMetadata?.find((ex: any) => ex.spreadsheetId === site.spreadsheetId);
                        const existingStat = existingSite?.sheetStats?.find((st: any) => st.sheetName === sheetName);
                        const existingCount = existingStat ? existingStat.rowCount : 0;

                        sheetStats.push({
                            sheetName,
                            sheetId: s.properties?.sheetId,
                            spreadsheetId: site.spreadsheetId,
                            rowCount: stats !== undefined ? stats.processedRows : existingCount,
                            type: sheetName.includes('Invoice') ? 'Invoice' : 'History'
                        });
                    });
                    
                    return {
                        siteConfigName: site.spreadsheetId,
                        spreadsheetId: site.spreadsheetId,
                        extractedNames: Array.from(extractedNames),
                        isCompleted: site.name.includes('(Completed)'),
                        sheetStats
                    };
                } catch (e) {
                    console.error("Error fetching site metadata:", site.spreadsheetId, e);
                    return { siteConfigName: site.spreadsheetId, extractedNames: [site.spreadsheetId] , isCompleted: false, sheetStats: [] };
                }
            }));
            
            _cachedProjectsMetadata = results;
            _cachedProjectsMetadataTime = Date.now();
            console.log(`[Metadata] Returning ${results.length} sites`);
            res.json(results);
        } catch (e: any) {
            console.error("api/projects/metadata Error:", e);
            res.status(500).json({ error: e.message });
        }
    });

    // API: Get Data
    app.get("/api/data", requireAuth, async (req: any, res) => {
        const forceRefresh = req.query.refresh === 'true';
        const selectionsStr = req.query.selections as string;
        
        let selections: Record<string, {Invoice: boolean, History: boolean}> | undefined = undefined;
        if (selectionsStr) {
            try {
                selections = JSON.parse(selectionsStr);
            } catch (e) {
                console.warn("[Data] Failed to parse selections query string.", e);
            }
        }

        const now = Date.now();
        // Generate a deterministic cache key based on selections
        const cacheKey = selections 
            ? 'data_' + Buffer.from(JSON.stringify(selections)).toString('base64')
            : 'data_all';

        // 1. Return fresh cache if available and not forcing refresh
        // For simplicity, we can still use global cache OR separate cache. Let's use separate cache keys to preserve performance.
        if (!global.dataCaches) {
            global.dataCaches = {};
        }

        const dataCache = global.dataCaches[cacheKey];

        if (dataCache && !forceRefresh && (now - dataCache.timestamp < CACHE_TTL)) {
            console.log(`[Data] Returning cached data (${dataCache.data.length} records)`);
            return res.json(dataCache.data);
        }

        // 2. Prevent multiple simultaneous fetches for the same request
        if (!global.isFetchingMap) global.isFetchingMap = {};
        if (global.isFetchingMap[cacheKey] && dataCache) {
            console.log(`[Data] Fetch already in progress for ${cacheKey}, returning current cache.`);
            return res.json(dataCache.data);
        }

        // 3. Perform Fetch
        global.isFetchingMap[cacheKey] = true;
        try {
            console.log(`[Data] Starting full refresh for selections: ${selectionsStr || 'ALL'}...`);
            
            const authClient = GoogleAuthService.getServiceAccountAuth();

            if (!authClient) {
                throw new Error("Service Account not configured");
            }

            const data = await DataTransformationService.fetchAndTransformAll(authClient, selections, forceRefresh);
            
            console.log(`[Data] Fetch complete: ${data.length} records`);
            // Validate data before caching
            if (data && data.length > 0) {
                global.dataCaches[cacheKey] = { data, timestamp: Date.now() };
                res.json(data);
            } else if (dataCache) {
                console.warn(`[Data] Fetch returned empty but we have cache for ${cacheKey}. Returning stale cache.`);
                res.json(dataCache.data);
            } else {
                res.json([]);
            }
        } catch (error: any) {
            console.error(`[Data] Fetch Error for ${cacheKey}:`, error.message || error);
            
            // Check for Quota or Rate Limit errors
            const isQuotaError = error.message?.includes('Quota exceeded') || error.status === 429;
            
            if (dataCache && (isQuotaError || (now - dataCache.timestamp < STALE_THRESHOLD))) {
                console.warn(`[Data] Serving stale cache due to context: ${isQuotaError ? 'Quota Exceeded' : 'General Error'}`);
                return res.json(dataCache.data);
            }
            
            res.status(500).json({ error: error.message || "Failed to fetch data and no fallback available" });
        } finally {
            global.isFetchingMap[cacheKey] = false;
        }
    });

    app.post("/api/admin/cleanup-inward-dates", requireAuth, async (req: any, res) => {
        try {
            const action = req.query.action as string;
            const idsParam = req.query.spreadsheetIds as string | undefined;
            const spreadsheetIds = idsParam ? idsParam.split(',').filter(Boolean) : undefined;
            
            let results;
            if (action === 'combined') {
                results = await SheetCleanupService.performCombinedDateCorrection(spreadsheetIds);
            } else if (action === 'excel_violation') {
                results = await SheetCleanupService.performExcelDateViolationCleanup(spreadsheetIds);
            } else {
                // Default to inward date sync
                results = await SheetCleanupService.performInwardDateSync(spreadsheetIds);
            }
            
            res.json({ success: true, results });
        } catch (error: any) {
            console.error("[Cleanup API] Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post("/api/admin/cleanup-single-sheet", requireAuth, async (req: any, res) => {
        try {
            const spreadsheetId = (req.body?.spreadsheetId || req.query?.spreadsheetId) as string;
            const sheetName = (req.body?.sheetName || req.query?.sheetName) as string;
            const action = (req.body?.action || req.query?.action) as string;

            if (!spreadsheetId || !sheetName || !action) {
                return res.status(400).json({ success: false, error: "Missing spreadsheetId, sheetName, or action" });
            }

            let result;
            if (action === 'combined') {
                result = await SheetCleanupService.cleanSingleSheetCombined(spreadsheetId, sheetName);
            } else if (action === 'excel_violation') {
                result = await SheetCleanupService.cleanSingleSheetExcelViolation(spreadsheetId, sheetName);
            } else {
                result = await SheetCleanupService.cleanSingleSheetInwardSync(spreadsheetId, sheetName);
            }

            res.json({ success: true, result });
        } catch (error: any) {
            console.error("[Cleanup API single sheet] Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post("/api/admin/make-history", requireAuth, async (req: any, res) => {
        try {
            const { spreadsheetId, invoiceSheetName, historySheetName, srNos } = req.body;

            if (!spreadsheetId || !invoiceSheetName || !historySheetName || !Array.isArray(srNos) || srNos.length === 0) {
                return res.status(400).json({ success: false, error: "Missing spreadsheetId, invoiceSheetName, historySheetName, or valid srNos array" });
            }

            const result = await SheetCleanupService.moveRowsToHistory(
                spreadsheetId,
                invoiceSheetName,
                historySheetName,
                srNos.map(Number)
            );

            res.json({ success: true, result });
        } catch (error: any) {
            console.error("[Make History API] Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post("/api/admin/history-row-check", requireAuth, async (req: any, res) => {
        try {
            const { spreadsheetId, historySheetName, numRows } = req.body;
            if (!spreadsheetId || !historySheetName || typeof numRows !== 'number') {
                return res.status(400).json({ success: false, error: "Missing spreadsheetId, historySheetName, or valid numRows" });
            }

            const check = await SheetCleanupService.getHistoryRowCheck(spreadsheetId, historySheetName, numRows);
            res.json({ success: true, check });
        } catch (error: any) {
            console.error("[History Row Check API] Error:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 404 for unknown API routes - prevent falling through to SPA HTML
    app.all("/api/*", (req, res) => {
        res.status(404).json({ error: "API route not found" });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`[Server] Running on port ${PORT} - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('[Server] SIGTERM received, shutting down gracefully');
        server.close(() => {
            console.log('[Server] Server closed');
            process.exit(0);
        });
    });
}

startServer().catch(err => {
    console.error('[Server] Fatal error:', err);
    process.exit(1);
});
