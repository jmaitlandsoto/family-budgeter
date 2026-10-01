function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadServiceAccountKey(): string {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (inline && inline.trim() !== "") return inline;

  const path = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (path && path.trim() !== "") {
    // Read lazily by the caller (writeSheet.ts uses keyFile directly); here we
    // just confirm one of the two was provided.
    return path;
  }

  throw new Error(
    "Missing Google service account credentials: set either GOOGLE_SERVICE_ACCOUNT_KEY (JSON string) or GOOGLE_SERVICE_ACCOUNT_KEY_PATH (file path)",
  );
}

export const config = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  typesafeApiKey: required("TYPESAFE_API_KEY"),
  // Fallback only — used when a request doesn't supply its own Drive folder + OAuth token.
  googleSheetId: process.env.GOOGLE_SHEET_ID?.trim() || undefined,
  googleServiceAccountKeyRaw: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  googleServiceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  backendApiKey: required("BACKEND_API_KEY"),
  documentAiProcessorName: required("DOCUMENT_AI_PROCESSOR_NAME"),
  port: Number(process.env.PORT ?? 8080),
};

// Fail fast at boot rather than mid-upload.
loadServiceAccountKey();
