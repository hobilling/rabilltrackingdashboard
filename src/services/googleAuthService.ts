import { google } from "googleapis";

/**
 * Handles communication with Google APIs using Service Account authentication.
 */
export class GoogleAuthService {
  /**
   * Creates an authenticated client using a Google Service Account.
   * This is used for backend-to-backend data fetching without user login.
   */
  static getServiceAccountAuth() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !key) {
      console.warn("Service Account credentials missing.");
      return null;
    }

    // Clean the private key - sometimes env vars lose newlines
    const formattedKey = key.replace(/\\n/g, '\n');

    return new google.auth.JWT({
      email,
      key: formattedKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    });
  }
}
