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
      { date: { seconds: Math.floor(new Date(2024, 2, 1).getTime() / 1000) }, checkNumber: '101', paidTo: 'Vendor A', memo: 'Oil change', accountNumber: 12, value: 45 },
      { date: { seconds: Math.floor(new Date(2024, 2, 8).getTime() / 1000) }, checkNumber: '', paidTo: 'Vendor B', accountNumber: 34, value: 60 },
    ];

    const allUpdates = {
      lastDTotal: 500,
      lastNDTotal: 20,
      lastTotal: 1000,
      E: [{ accountName: 'Vehicle', accountNumber: 12, value: 45, previousTotal: 100 }],
      NE: [{ accountName: 'Groceries', accountNumber: 51, value: 58, previousTotal: 380 }],
      D: [{ date: { seconds: Math.floor(new Date(2024, 2, 8).getTime() / 1000) }, description: 'Vendor B', amount: 60 }],
      ND: [],
    };

    await googleAuth.updateSpreadsheet('sheet-id', transactions, allUpdates);

    expect(spreadsheetsBatchUpdate).toHaveBeenCalledTimes(1);
    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];

    // D/ND now always rewrite their whole row budget (MaxD=16, MaxND=7) so a removed
    // transaction blanks the row it used to occupy instead of leaving stale data - so
    // build the expected blank rows for everything past the one real D item / all of ND.
    const blankDepositRow = (rowIndex) => ([
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 1 },
          rows: [{ values: [{ userEnteredValue: { stringValue: '' } }] }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 1, endColumnIndex: 2 },
          rows: [{ values: [{ userEnteredValue: { stringValue: '' } }] }],
          fields: 'userEnteredValue',
        },
      },
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 6, endColumnIndex: 7 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 0 } }] }],
          fields: 'userEnteredValue',
        },
      },
    ]);
    const blankNDRows = Array.from({ length: 7 }, (_, i) => blankDepositRow(29 + i)).flat();
    const blankDRowsAfterFirst = Array.from({ length: 15 }, (_, i) => blankDepositRow(5 + 1 + i)).flat();

    // The Ledger sheet now always rewrites its whole row budget (MaxLedgerRows=46, rows
    // 5-50) too, so a deleted transaction blanks its old row instead of leaving stale data.
    const blankLedgerRow = (rowIndex) => ({
      updateCells: {
        range: { sheetId: 111, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
        rows: [{
          values: [
            ...Array.from({ length: 10 }, () => ({ userEnteredValue: { stringValue: '' } })),
            { userEnteredValue: { numberValue: 0 } },
          ],
        }],
        fields: 'userEnteredValue',
      },
    });
    // 2 real transactions occupy rows 4-5 (0-indexed); the remaining 44 of the 46-row
    // budget (rows 6-49) get blanked.
    const blankLedgerRowsAfterReal = Array.from({ length: 44 }, (_, i) => blankLedgerRow(6 + i));

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
              { userEnteredValue: { stringValue: 'Oil change' } },
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
      // remaining Ledger sheet rows (up to MaxLedgerRows=46) get blanked
      ...blankLedgerRowsAfterReal,
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
      // remaining D rows (up to MaxD=16) get blanked so a removed deposit can't leave stale data
      ...blankDRowsAfterFirst,
      // ND has no items at all, so its whole row budget (MaxND=7) is blanked
      ...blankNDRows,
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
      // non-deductible expense row: placed by accountNumber (51, the first NE slot) -> row 46 + (51-51) = 46
      // account name is the combined "accountNumber - accountName" format
      {
        updateCells: {
          range: { sheetId: 222, startRowIndex: 46, endRowIndex: 47, startColumnIndex: 0, endColumnIndex: 1 },
          rows: [{ values: [{ userEnteredValue: { stringValue: '51 - Groceries' } }] }],
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
    // 1 lastTotal + 2 (lastDTotal/lastNDTotal) + 16 D rows * 3 + 7 ND rows * 3 (ND's whole
    // row budget gets blanked too now, since D/ND always rewrite their full row budget)
    // + 46 Ledger sheet rows (MaxLedgerRows), all blank since transactions is []
    expect(requestBody.requests).toHaveLength(1 + 2 + 16 * 3 + 7 * 3 + 46);

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
      // MaxE is 50, so 51 is one past the valid E range (1-50).
      E: [{ accountName: 'Too High', accountNumber: 51, value: 10, previousTotal: 0 }],
      // NE's valid range is 51-57, so 50 is one below it.
      NE: [{ accountName: 'Too Low', accountNumber: 50, value: 10, previousTotal: 0 }],
      D: [],
      ND: [],
    });

    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];
    // lastTotal + lastDTotal + lastNDTotal + D/ND's full (blank) row budgets + 46 Ledger
    // sheet rows (MaxLedgerRows, all blank) - both out-of-range accounts are skipped entirely
    expect(requestBody.requests).toHaveLength(3 + 16 * 3 + 7 * 3 + 46);
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
      NE: [{ accountName: 'Groceries', accountNumber: '51', value: 58, previousTotal: 380 }],
      D: [],
      ND: [],
    });

    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];
    // lastTotal + lastDTotal + lastNDTotal + D/ND's full (blank) row budgets + 46 Ledger
    // sheet rows (MaxLedgerRows, all blank) + 2 accounts * 3 requests/account (name + value
    // + previousTotal)
    expect(requestBody.requests).toHaveLength(3 + 16 * 3 + 7 * 3 + 46 + 2 * 3);
    const serialized = JSON.stringify(requestBody.requests);
    expect(serialized).toContain('Vehicle');
    expect(serialized).toContain('51 - Groceries');
  });

  it('blanks an E/NE account row once its combined total (value + previousTotal) drops to $0', async () => {
    spreadsheetsGet.mockResolvedValue(twoSheets);
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });

    await googleAuth.updateSpreadsheet('sheet-id', [], {
      lastDTotal: 0,
      lastNDTotal: 0,
      lastTotal: 0,
      // e.g. an account's only transaction was deleted, so this ledger's value and
      // everything carried forward from earlier ledgers are both now zero.
      E: [{ accountName: 'Vehicle', accountNumber: 12, value: 0, previousTotal: 0 }],
      NE: [{ accountName: 'Groceries', accountNumber: 51, value: 0, previousTotal: 0 }],
      D: [],
      ND: [],
    });

    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];
    const serialized = JSON.stringify(requestBody.requests);
    expect(serialized).not.toContain('Vehicle');
    expect(serialized).not.toContain('Groceries');

    const nameCellRequests = requestBody.requests.filter(
      (r) => r.updateCells.range.sheetId === 222 && (r.updateCells.range.startRowIndex === 15 || r.updateCells.range.startRowIndex === 46)
    );
    expect(nameCellRequests.every((r) => r.updateCells.rows[0].values[0].userEnteredValue.stringValue === '' || typeof r.updateCells.rows[0].values[0].userEnteredValue.numberValue === 'number')).toBe(true);
  });

  it('keeps an E/NE account row when only this ledger\'s value is $0 but a previousTotal carries forward', async () => {
    spreadsheetsGet.mockResolvedValue(twoSheets);
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });

    await googleAuth.updateSpreadsheet('sheet-id', [], {
      lastDTotal: 0,
      lastNDTotal: 0,
      lastTotal: 0,
      E: [{ accountName: 'Vehicle', accountNumber: 12, value: 0, previousTotal: 80 }],
      NE: [],
      D: [],
      ND: [],
    });

    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];
    const serialized = JSON.stringify(requestBody.requests);
    expect(serialized).toContain('Vehicle');
  });

  it('blanks trailing deposit rows left over from a deleted transaction', async () => {
    spreadsheetsGet.mockResolvedValue(twoSheets);
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });

    // Only one deposit remains where there used to be more; the row(s) after it must
    // be blanked rather than left showing the deleted transaction's stale data.
    await googleAuth.updateSpreadsheet('sheet-id', [], {
      lastDTotal: 0,
      lastNDTotal: 0,
      lastTotal: 0,
      E: [],
      NE: [],
      D: [{ date: { seconds: Math.floor(new Date(2024, 2, 1).getTime() / 1000) }, description: 'Remaining Payer', amount: 25 }],
      ND: [],
    });

    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];
    // Row for the one remaining item (startRowIndex 5) keeps its data.
    const remainingRow = requestBody.requests.filter((r) => r.updateCells.range.startRowIndex === 5);
    expect(JSON.stringify(remainingRow)).toContain('Remaining Payer');

    // Every other D row (6 through 20, i.e. rows 1-15 of MaxD=16) is blanked.
    const laterRows = requestBody.requests.filter(
      (r) => r.updateCells.range.sheetId === 222 && r.updateCells.range.startRowIndex > 5 && r.updateCells.range.startRowIndex < 21
    );
    expect(laterRows.length).toBe(15 * 3);
    expect(laterRows.every((r) => {
      const value = r.updateCells.rows[0].values[0].userEnteredValue;
      return value.stringValue === '' || value.numberValue === 0;
    })).toBe(true);
  });

  it('blanks trailing Ledger sheet rows left over from deleted transactions', async () => {
    spreadsheetsGet.mockResolvedValue(twoSheets);
    spreadsheetsBatchUpdate.mockResolvedValue({ status: 200, data: {} });

    // Two transactions remain where there used to be more (e.g. a couple got deleted);
    // the rows after them must be blanked rather than left showing the deleted data.
    const transactions = [
      { date: { seconds: Math.floor(new Date(2024, 2, 1).getTime() / 1000) }, paidTo: 'Vendor A', accountNumber: 12, value: 45 },
      { date: { seconds: Math.floor(new Date(2024, 2, 2).getTime() / 1000) }, paidTo: 'Vendor B', accountNumber: 34, value: 60 },
    ];

    await googleAuth.updateSpreadsheet('sheet-id', transactions, {
      lastDTotal: 0,
      lastNDTotal: 0,
      lastTotal: 0,
      E: [],
      NE: [],
      D: [],
      ND: [],
    });

    const [{ requestBody }] = spreadsheetsBatchUpdate.mock.calls[0];
    const ledgerRequests = requestBody.requests.filter((r) => r.updateCells.range.sheetId === 111);
    // lastTotal + 46 rows (MaxLedgerRows) = 47
    expect(ledgerRequests).toHaveLength(47);

    const remainingRows = ledgerRequests.filter((r) => r.updateCells.range.startRowIndex === 4 || r.updateCells.range.startRowIndex === 5);
    expect(JSON.stringify(remainingRows)).toContain('Vendor A');
    expect(JSON.stringify(remainingRows)).toContain('Vendor B');

    // Rows 6-49 (0-indexed), the remaining 44 of the 46-row budget, are blanked.
    const blankedRows = ledgerRequests.filter((r) => r.updateCells.range.startRowIndex >= 6);
    expect(blankedRows).toHaveLength(44);
    expect(blankedRows.every((r) =>
      r.updateCells.rows[0].values.every((v, i) =>
        i < 10 ? v.userEnteredValue.stringValue === '' : v.userEnteredValue.numberValue === 0
      )
    )).toBe(true);
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
