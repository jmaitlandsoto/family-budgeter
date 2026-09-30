import { google, type drive_v3, type sheets_v4 } from "googleapis";
import { config } from "../config.js";
import { PipelineError } from "../errors.js";
import type { AggregateResult, CategorizedTransaction } from "../types.js";

const TRANSACTIONS_SHEET = "Transactions";
const BREAKDOWN_SHEET = "Category Breakdown";

export interface DriveTarget {
  folderId: string;
  accessToken: string;
}

async function getServiceAccountSheetsClient(): Promise<sheets_v4.Sheets> {
  const auth = new google.auth.GoogleAuth({
    credentials: config.googleServiceAccountKeyRaw ? JSON.parse(config.googleServiceAccountKeyRaw) : undefined,
    keyFile: config.googleServiceAccountKeyRaw ? undefined : config.googleServiceAccountKeyPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function getUserAuthClients(accessToken: string): { sheets: sheets_v4.Sheets; drive: drive_v3.Drive } {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

async function ensureTabsExist(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  opts?: { deleteSheetIds?: number[] },
): Promise<void> {
  const { data } = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set((data.sheets ?? []).map((s) => s.properties?.title));

  const requests = [
    ...[TRANSACTIONS_SHEET, BREAKDOWN_SHEET]
      .filter((title) => !existingTitles.has(title))
      .map((title) => ({ addSheet: { properties: { title } } })),
    ...(opts?.deleteSheetIds ?? []).map((sheetId) => ({ deleteSheet: { sheetId } })),
  ];

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}

async function createNewSpreadsheet(
  sheets: sheets_v4.Sheets,
  title: string,
): Promise<{ spreadsheetId: string; defaultSheetId: number }> {
  const { data } = await sheets.spreadsheets.create({ requestBody: { properties: { title } } });
  const spreadsheetId = data.spreadsheetId;
  const defaultSheetId = data.sheets?.[0]?.properties?.sheetId;
  if (!spreadsheetId || defaultSheetId === undefined || defaultSheetId === null) {
    throw new Error("Google Sheets API did not return a spreadsheet/sheet id on create");
  }
  return { spreadsheetId, defaultSheetId };
}

async function moveToFolder(drive: drive_v3.Drive, fileId: string, folderId: string): Promise<void> {
  const { data } = await drive.files.get({ fileId, fields: "parents" });
  const existingParents = (data.parents ?? []).join(",");
  await drive.files.update({
    fileId,
    addParents: folderId,
    removeParents: existingParents || undefined,
    fields: "id, parents",
  });
}

function buildTransactionRows(transactions: CategorizedTransaction[]): (string | number)[][] {
  return [
    ["Date", "Description", "Amount", "Category", "Account", "Source File"],
    ...transactions.map((t) => [t.date, t.description, t.amount, t.category, t.account ?? "", t.sourceFile ?? ""]),
  ];
}

function buildBreakdownRows(result: AggregateResult): (string | number)[][] {
  // Category rows start at row 2 (row 1 is the header).
  const categoryRows = result.categoryTotals.map((c, i) => {
    const row = i + 2;
    return [
      c.category,
      `=SUMIF('${TRANSACTIONS_SHEET}'!D:D,A${row},'${TRANSACTIONS_SHEET}'!C:C)`,
      `=COUNTIF('${TRANSACTIONS_SHEET}'!D:D,A${row})`,
    ];
  });
  const incomeRow = categoryRows.length + 3;
  const expensesRow = incomeRow + 1;

  return [
    ["Category", "Total Amount", "Transaction Count"],
    ...categoryRows,
    [],
    ["Total Income", `=SUMIF('${TRANSACTIONS_SHEET}'!C:C,">0")`, ""],
    ["Total Expenses", `=SUMIF('${TRANSACTIONS_SHEET}'!C:C,"<0")`, ""],
    ["Net", `=B${incomeRow}+B${expensesRow}`, ""],
  ];
}

async function writeRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  transactionRows: (string | number)[][],
  breakdownRows: (string | number)[][],
): Promise<void> {
  // Each upload session regenerates the sheet fresh — clear both tabs before writing.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${TRANSACTIONS_SHEET}'` });
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${BREAKDOWN_SHEET}'` });

  // Different valueInputOption per tab (formulas need USER_ENTERED), so these can't share one batchUpdate.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${TRANSACTIONS_SHEET}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: transactionRows },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${BREAKDOWN_SHEET}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: breakdownRows },
  });
}

export async function writeSheet(
  transactions: CategorizedTransaction[],
  result: AggregateResult,
  driveTarget?: DriveTarget,
): Promise<string> {
  try {
    const transactionRows = buildTransactionRows(transactions);
    const breakdownRows = buildBreakdownRows(result);

    let sheets: sheets_v4.Sheets;
    let spreadsheetId: string;

    if (driveTarget) {
      const userClients = getUserAuthClients(driveTarget.accessToken);
      const created = await createNewSpreadsheet(
        userClients.sheets,
        `Family Budget – ${new Date().toISOString().slice(0, 10)}`,
      );
      await moveToFolder(userClients.drive, created.spreadsheetId, driveTarget.folderId);
      await ensureTabsExist(userClients.sheets, created.spreadsheetId, { deleteSheetIds: [created.defaultSheetId] });
      sheets = userClients.sheets;
      spreadsheetId = created.spreadsheetId;
    } else {
      if (!config.googleSheetId) {
        throw new Error("No Drive folder was selected and no GOOGLE_SHEET_ID is configured as a fallback");
      }
      sheets = await getServiceAccountSheetsClient();
      spreadsheetId = config.googleSheetId;
      await ensureTabsExist(sheets, spreadsheetId);
    }

    await writeRows(sheets, spreadsheetId, transactionRows, breakdownRows);

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  } catch (err) {
    throw new PipelineError("sheet_write", `Failed to write to Google Sheet: ${(err as Error).message}`, { cause: err });
  }
}
