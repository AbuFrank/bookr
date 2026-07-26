import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  fsReadFileSync,
  googleAuthCtor,
  driveFactory,
  sheetsFactory,
  filesGet,
  filesCreate,
  filesCopy,
  permissionsCreate,
  spreadsheetsGet,
  spreadsheetsBatchUpdate,
  sheetsCopyTo,
} = vi.hoisted(() => ({
  fsReadFileSync: vi.fn(),
  googleAuthCtor: vi.fn(),
  driveFactory: vi.fn(),
  sheetsFactory: vi.fn(),
  filesGet: vi.fn(),
  filesCreate: vi.fn(),
  filesCopy: vi.fn(),
  permissionsCreate: vi.fn(),
  spreadsheetsGet: vi.fn(),
  spreadsheetsBatchUpdate: vi.fn(),
  sheetsCopyTo: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: googleAuthCtor },
    drive: driveFactory,
    sheets: sheetsFactory,
  },
}));

vi.mock('fs', () => ({
  default: { readFileSync: fsReadFileSync },
}));

let googleAuth;

beforeEach(async () => {
  vi.resetAllMocks();

  fsReadFileSync.mockReturnValue(
    JSON.stringify({ client_email: 'svc@test.iam.gserviceaccount.com', private_key: 'fake-key' })
  );
  googleAuthCtor.mockImplementation(function GoogleAuth() {});
  driveFactory.mockReturnValue({
    files: { get: filesGet, create: filesCreate, copy: filesCopy },
    permissions: { create: permissionsCreate },
  });
  sheetsFactory.mockReturnValue({
    spreadsheets: {
      get: spreadsheetsGet,
      batchUpdate: spreadsheetsBatchUpdate,
      sheets: { copyTo: sheetsCopyTo },
    },
  });

  vi.resetModules();
  googleAuth = await import('./google-auth.js');
});

describe('createFolder', () => {
  it('creates a folder under parentId and grants the user reader access', async () => {
    filesGet.mockResolvedValue({ data: { id: 'shared-folder-id' } });
    filesCreate.mockResolvedValue({
      data: { id: 'new-folder-id', name: 'My Book', webViewLink: 'https://drive/new-folder-id' },
    });
    permissionsCreate.mockResolvedValue({});

    const result = await googleAuth.createFolder('My Book', 'user@example.com', 'shared-folder-id', 'parent-folder-id');

    expect(filesGet).toHaveBeenCalledWith({ fileId: 'shared-folder-id', supportsAllDrives: true });
    expect(filesCreate).toHaveBeenCalledWith({
      requestBody: {
        name: 'My Book',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['parent-folder-id'],
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });
    expect(permissionsCreate).toHaveBeenCalledWith({
      fileId: 'new-folder-id',
      requestBody: { role: 'reader', type: 'user', emailAddress: 'user@example.com' },
      supportsAllDrives: true,
    });
    expect(result).toEqual({ id: 'new-folder-id', name: 'My Book', webViewLink: 'https://drive/new-folder-id' });
  });

  it('creates a top-level folder under the shared folder without granting a permission', async () => {
    filesGet.mockResolvedValue({ data: { id: 'shared-folder-id' } });
    filesCreate.mockResolvedValue({ data: { id: 'top-level-id', name: 'user-uid', webViewLink: 'https://drive/top' } });

    await googleAuth.createFolder('user-uid', 'user@example.com', 'shared-folder-id', undefined);

    expect(filesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ requestBody: expect.objectContaining({ parents: ['shared-folder-id'] }) })
    );
    expect(permissionsCreate).not.toHaveBeenCalled();
  });

  it('throws when the shared folder is not accessible', async () => {
    filesGet.mockRejectedValue(new Error('403 Forbidden'));

    await expect(
      googleAuth.createFolder('name', 'user@example.com', 'bad-shared-id', 'parent')
    ).rejects.toThrow('Shared folder not accessible: bad-shared-id');
    expect(filesCreate).not.toHaveBeenCalled();
  });
});

describe('copyTemplateFile', () => {
  it('copies the template, tags the summary sheet metadata, and grants reader access', async () => {
    filesCopy.mockResolvedValue({ data: { id: 'new-file-id' } });
    spreadsheetsGet.mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 111 } }, { properties: { sheetId: 222 } }] },
    });
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });
    permissionsCreate.mockResolvedValue({});

    const result = await googleAuth.copyTemplateFile(
      'template-id',
      'My Ledger',
      'user@example.com',
      'parent-folder-id',
      'A description'
    );

    expect(filesCopy).toHaveBeenCalledWith({
      fileId: 'template-id',
      requestBody: { name: 'My Ledger', parents: ['parent-folder-id'] },
      supportsAllDrives: true,
      fields: 'id, webViewLink',
    });

    expect(spreadsheetsBatchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'new-file-id',
      requestBody: {
        requests: [
          {
            updateCells: {
              range: { sheetId: 222, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
              rows: [{ values: [{ userEnteredValue: { stringValue: 'MY LEDGER' } }] }],
              fields: 'userEnteredValue',
            },
          },
          {
            updateCells: {
              range: { sheetId: 222, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 8, endColumnIndex: 9 },
              rows: [{ values: [{ userEnteredValue: { stringValue: 'A DESCRIPTION' } }] }],
              fields: 'userEnteredValue',
            },
          },
        ],
      },
    });

    expect(permissionsCreate).toHaveBeenCalledWith({
      fileId: 'new-file-id',
      requestBody: { role: 'reader', type: 'user', emailAddress: 'user@example.com' },
      supportsAllDrives: true,
    });

    expect(result).toEqual({ fileId: 'new-file-id', fileUrl: 'https://docs.google.com/document/d/new-file-id/edit' });
  });

  it('defaults the copied file name to "Copied Report" when no fileName is given', async () => {
    filesCopy.mockResolvedValue({ data: { id: 'new-file-id' } });
    spreadsheetsGet.mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 111 } }, { properties: { sheetId: 222 } }] },
    });
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });
    permissionsCreate.mockResolvedValue({});

    await googleAuth.copyTemplateFile('template-id', '', 'user@example.com', 'parent-folder-id', '');

    expect(filesCopy).toHaveBeenCalledWith(
      expect.objectContaining({ requestBody: expect.objectContaining({ name: 'Copied Report' }) })
    );
  });
});

describe('updateSpreadsheetMetaData', () => {
  it('writes uppercased title/description to the summary sheet', async () => {
    spreadsheetsGet.mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 111 } }, { properties: { sheetId: 222 } }] },
    });
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });

    await googleAuth.updateSpreadsheetMetaData('sheet-id', 'My Ledger', 'Household expenses');

    expect(spreadsheetsBatchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      requestBody: {
        requests: [
          {
            updateCells: {
              range: { sheetId: 222, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
              rows: [{ values: [{ userEnteredValue: { stringValue: 'MY LEDGER' } }] }],
              fields: 'userEnteredValue',
            },
          },
          {
            updateCells: {
              range: { sheetId: 222, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 8, endColumnIndex: 9 },
              rows: [{ values: [{ userEnteredValue: { stringValue: 'HOUSEHOLD EXPENSES' } }] }],
              fields: 'userEnteredValue',
            },
          },
        ],
      },
    });
  });
});

describe('updateSpreadsheet', () => {
  const twoSheets = { data: { sheets: [{ properties: { sheetId: 111 } }, { properties: { sheetId: 222 } }] } };

  it('builds the full batch of cell-update requests, one row per transaction', async () => {
    spreadsheetsGet.mockResolvedValue(twoSheets);
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });

    const transactions = [
      { date: { seconds: Math.floor(new Date(2024, 2, 1).getTime() / 1000) }, checkNumber: '101', paidTo: 'Vendor A', accountNumber: 12, value: 45 },
      { date: { seconds: Math.floor(new Date(2024, 2, 8).getTime() / 1000) }, checkNumber: '', paidTo: 'Vendor B', accountNumber: 34, value: 60 },
    ];

    const allUpdates = {
      lastDTotal: 500,
      lastNDTotal: 20,
      lastTotal: 1000,
      E: [{ accountName: 'Vehicle', accountNumber: 12, value: 45, previousTotal: 100 }],
      NE: [{ accountName: 'Groceries', accountNumber: 75, value: 58, previousTotal: 380 }],
      D: [{ date: { seconds: Math.floor(new Date(2024, 2, 8).getTime() / 1000) }, description: 'Vendor B', amount: 60 }],
      ND: [],
    };

    await googleAuth.updateSpreadsheet('sheet-id', transactions, allUpdates);

    expect(spreadsheetsBatchUpdate).toHaveBeenCalledTimes(1);
    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];

    expect(requestBody.requests).toEqual([
      // running total, on the ledger sheet
      {
        updateCells: {
          range: { sheetId: 111, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 10, endColumnIndex: 11 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 1000 } }] }],
          fields: 'userEnteredValue',
        },
      },
      // one row per transaction, each on its own row
      {
        updateCells: {
          range: { sheetId: 111, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 11 },
          rows: [{
            values: [
              { userEnteredValue: { stringValue: '03/01' } },
              { userEnteredValue: { stringValue: '101' } },
              { userEnteredValue: { stringValue: 'Vendor A' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { numberValue: 12 } },
              { userEnteredValue: { numberValue: 45 } },
            ],
          }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 111, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: 11 },
          rows: [{
            values: [
              { userEnteredValue: { stringValue: '03/08' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: 'Vendor B' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { stringValue: '' } },
              { userEnteredValue: { numberValue: 34 } },
              { userEnteredValue: { numberValue: 60 } },
            ],
          }],
          fields: 'userEnteredValue',
        },
      },
      // running deposit/non-income totals, on the summary sheet
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 23, endRowIndex: 24, startColumnIndex: 6, endColumnIndex: 7 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 500 } }] }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 38, endRowIndex: 39, startColumnIndex: 6, endColumnIndex: 7 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 20 } }] }],
          fields: 'userEnteredValue',
        },
      },
      // deposit row: date, description, amount (chronological, no account grouping)
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: 1 },
          rows: [{ values: [{ userEnteredValue: { stringValue: '03/08' } }] }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 1, endColumnIndex: 2 },
          rows: [{ values: [{ userEnteredValue: { stringValue: 'Vendor B' } }] }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 6, endColumnIndex: 7 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 60 } }] }],
          fields: 'userEnteredValue',
        },
      },
      // expense account row: placed by accountNumber (12), not write order -> row 4 + (12-1) = 15
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 15, endRowIndex: 16, startColumnIndex: 9, endColumnIndex: 10 },
          rows: [{ values: [{ userEnteredValue: { stringValue: 'Vehicle' } }] }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 15, endRowIndex: 16, startColumnIndex: 11, endColumnIndex: 12 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 45 } }] }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 15, endRowIndex: 16, startColumnIndex: 13, endColumnIndex: 14 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 100 } }] }],
          fields: 'userEnteredValue',
        },
      },
      // non-deductible expense row: placed by accountNumber (75, the first NE slot) -> row 46 + (75-75) = 46
      // account name is the combined "accountNumber - accountName" format
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 46, endRowIndex: 47, startColumnIndex: 0, endColumnIndex: 1 },
          rows: [{ values: [{ userEnteredValue: { stringValue: '75 - Groceries' } }] }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 46, endRowIndex: 47, startColumnIndex: 2, endColumnIndex: 3 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 58 } }] }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 46, endRowIndex: 47, startColumnIndex: 4, endColumnIndex: 5 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 380 } }] }],
          fields: 'userEnteredValue',
        },
      },
    ]);
  });

  it('truncates the deposit transaction list to its max row allotment instead of overflowing the sheet', async () => {
    spreadsheetsGet.mockResolvedValue(twoSheets);
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });

    // MaxD is 16; send more rows than that and confirm the extras are dropped.
    const tooManyDeposits = Array.from({ length: 20 }, (_, i) => ({
      date: { seconds: Math.floor(new Date(2024, 2, 1 + i).getTime() / 1000) },
      description: `Payer ${i}`,
      amount: i,
    }));

    await googleAuth.updateSpreadsheet('sheet-id', [], {
      lastDTotal: 0,
      lastNDTotal: 0,
      lastTotal: 0,
      E: [],
      NE: [],
      D: tooManyDeposits,
      ND: [],
    });

    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];
    // 1 lastTotal + 2 (lastDTotal/lastNDTotal) + 16 rows * 3 requests/row (date + description + amount)
    expect(requestBody.requests).toHaveLength(1 + 2 + 16 * 3);

    const serialized = JSON.stringify(requestBody.requests);
    expect(serialized).toContain('Payer 15');
    expect(serialized).not.toContain('Payer 16');
  });

  it('skips expense accounts whose accountNumber falls outside their section\'s valid range', async () => {
    spreadsheetsGet.mockResolvedValue(twoSheets);
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });

    await googleAuth.updateSpreadsheet('sheet-id', [], {
      lastDTotal: 0,
      lastNDTotal: 0,
      lastTotal: 0,
      // MaxE is 51, so 52 is one past the valid E range (1-51).
      E: [{ accountName: 'Too High', accountNumber: 52, value: 10, previousTotal: 0 }],
      // NE's valid range is 75-81, so 74 is one below it.
      NE: [{ accountName: 'Too Low', accountNumber: 74, value: 10, previousTotal: 0 }],
      D: [],
      ND: [],
    });

    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];
    // lastTotal + lastDTotal + lastNDTotal writes only - both out-of-range accounts are skipped entirely
    expect(requestBody.requests).toHaveLength(3);
    const serialized = JSON.stringify(requestBody.requests);
    expect(serialized).not.toContain('Too High');
    expect(serialized).not.toContain('Too Low');
  });

  it('still writes expense accounts whose accountNumber is a numeric string (legacy Firestore data)', async () => {
    spreadsheetsGet.mockResolvedValue(twoSheets);
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });

    await googleAuth.updateSpreadsheet('sheet-id', [], {
      lastDTotal: 0,
      lastNDTotal: 0,
      lastTotal: 0,
      E: [{ accountName: 'Vehicle', accountNumber: '12', value: 45, previousTotal: 100 }],
      NE: [{ accountName: 'Groceries', accountNumber: '75', value: 58, previousTotal: 380 }],
      D: [],
      ND: [],
    });

    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];
    // lastTotal + lastDTotal + lastNDTotal + 2 accounts * 3 requests/account (name + value + previousTotal)
    expect(requestBody.requests).toHaveLength(3 + 2 * 3);
    const serialized = JSON.stringify(requestBody.requests);
    expect(serialized).toContain('Vehicle');
    expect(serialized).toContain('75 - Groceries');
  });

  it('swallows errors from the Sheets API instead of throwing', async () => {
    spreadsheetsGet.mockResolvedValue(twoSheets);
    spreadsheetsBatchUpdate.mockRejectedValue(new Error('quota exceeded'));

    const result = await googleAuth.updateSpreadsheet('sheet-id', [], {
      lastDTotal: 0,
      lastNDTotal: 0,
      lastTotal: 0,
      E: [],
      NE: [],
      D: [],
      ND: [],
    });

    expect(result).toBeUndefined();
  });
});

describe('copySheetToTemplate', () => {
  it('copies the source spreadsheet\'s first tab into the destination spreadsheet', async () => {
    spreadsheetsGet.mockResolvedValue({ data: { sheets: [{ properties: { sheetId: 999 } }] } });
    sheetsCopyTo.mockResolvedValue({ data: { sheetId: 12345 } });

    const result = await googleAuth.copySheetToTemplate('template-id', 'source-id');

    expect(spreadsheetsGet).toHaveBeenCalledWith({ spreadsheetId: 'source-id' });
    expect(sheetsCopyTo).toHaveBeenCalledWith({
      spreadsheetId: 'source-id',
      sheetId: 999,
      requestBody: { destinationSpreadsheetId: 'template-id' },
    });
    expect(result).toEqual({ data: { sheetId: 12345 } });
  });
});
