// Narrow, hand-written types for the slice of Google Identity Services (GIS)
// used by components/upload-form.tsx to obtain an OAuth access token for the
// Drive folder picker. Loaded at runtime via a <Script> tag
// (accounts.google.com/gsi/client), not installed as an npm package.

interface GoogleTokenResponse {
  access_token: string;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken(overrideConfig?: { prompt?: string }): void;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient;
      };
    };
  };
}
