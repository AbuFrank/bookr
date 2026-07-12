import { describe, it, expect, beforeEach, vi } from 'vitest';

// These three functions are the single shared implementation behind both
// server/googleDriveRoutes.js (local dev, Express) and api/*.js (Vercel).
// Mocking the shared module once lets us drive both entry points with the
// exact same inputs and assert they produce the same HTTP-facing behavior.
const { createFolder, copyTemplateFile, updateSpreadsheet } = vi.hoisted(() => ({
  createFolder: vi.fn(),
  copyTemplateFile: vi.fn(),
  updateSpreadsheet: vi.fn(),
}));

vi.mock('../server/google-auth.js', () => ({
  createFolder,
  copyTemplateFile,
  updateSpreadsheet,
  copySheetToTemplate: vi.fn(),
  updateSpreadsheetMetaData: vi.fn(),
  getServiceAccountDrive: vi.fn(),
}));

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function getExpressHandler(router, method, path) {
  const layer = router.stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`No route found for ${method.toUpperCase()} ${path}`);
  return layer.route.stack[0].handle;
}

let expressFolder;
let expressCopyTemplate;
let expressUpdateSheets;
let vercelFolder;
let vercelCopyTemplate;
let vercelUpdateSheets;

beforeEach(async () => {
  vi.clearAllMocks();

  process.env.GOOGLE_TEMPLATE_ID = 'template-123';
  process.env.GOOGLE_SOURCE_ID = 'source-123';
  process.env.GOOGLE_PARENT_FOLDER_ID = 'shared-folder-123';

  vi.resetModules();

  const { default: router } = await import('../server/googleDriveRoutes.js');
  expressFolder = getExpressHandler(router, 'post', '/folder');
  expressCopyTemplate = getExpressHandler(router, 'post', '/copy-template');
  expressUpdateSheets = getExpressHandler(router, 'put', '/update-sheets');

  vercelFolder = (await import('./folder.js')).default;
  vercelCopyTemplate = (await import('./copy-template.js')).default;
  vercelUpdateSheets = (await import('./update-sheets.js')).default;
});

describe('/folder parity (server/googleDriveRoutes.js vs api/folder.js)', () => {
  it('both reject a missing name with the same 400', async () => {
    const expressRes = createMockRes();
    await expressFolder({ body: { userEmail: 'user@example.com' } }, expressRes);

    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', body: { userEmail: 'user@example.com' } }, vercelRes);

    expect(expressRes.statusCode).toBe(400);
    expect(vercelRes.statusCode).toBe(vercelRes.statusCode);
    expect(vercelRes.body).toEqual(expressRes.body);
  });

  it('both reject a missing userEmail with the same 400', async () => {
    const expressRes = createMockRes();
    await expressFolder({ body: { name: 'My Book' } }, expressRes);

    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', body: { name: 'My Book' } }, vercelRes);

    expect(expressRes.statusCode).toBe(400);
    expect(vercelRes.statusCode).toBe(400);
    expect(vercelRes.body).toEqual(expressRes.body);
  });

  it('both call createFolder with the same arguments and return the same success body', async () => {
    createFolder.mockResolvedValue({ id: 'folder-1', name: 'My Book', webViewLink: 'https://drive/folder-1' });
    const input = { name: 'My Book', userEmail: 'user@example.com', parentId: 'parent-1' };

    const expressRes = createMockRes();
    await expressFolder({ body: input }, expressRes);
    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', body: input }, vercelRes);

    expect(expressRes.statusCode).toBe(200);
    expect(vercelRes.statusCode).toBe(200);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(createFolder).toHaveBeenNthCalledWith(1, 'My Book', 'user@example.com', 'shared-folder-123', 'parent-1');
    expect(createFolder).toHaveBeenNthCalledWith(2, 'My Book', 'user@example.com', 'shared-folder-123', 'parent-1');
  });

  it('both return 401 "Invalid Token" for a credential error', async () => {
    createFolder.mockRejectedValue(new Error('Request had invalid authentication credentials.'));
    const input = { name: 'My Book', userEmail: 'user@example.com' };

    const expressRes = createMockRes();
    await expressFolder({ body: input }, expressRes);
    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', body: input }, vercelRes);

    expect(expressRes.statusCode).toBe(401);
    expect(vercelRes.statusCode).toBe(401);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(expressRes.body).toEqual({ error: 'Invalid Token' });
  });

  it('both return the same 500 for any other error', async () => {
    createFolder.mockRejectedValue(new Error('boom'));
    const input = { name: 'My Book', userEmail: 'user@example.com' };

    const expressRes = createMockRes();
    await expressFolder({ body: input }, expressRes);
    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', body: input }, vercelRes);

    expect(expressRes.statusCode).toBe(500);
    expect(vercelRes.statusCode).toBe(500);
    expect(vercelRes.body).toEqual(expressRes.body);
  });
});

describe('/copy-template parity (server/googleDriveRoutes.js vs api/copy-template.js)', () => {
  const validInput = {
    fileName: 'My Ledger',
    email: 'user@example.com',
    parentFolderId: 'parent-1',
    description: 'A description',
  };

  it('both call copyTemplateFile with the same arguments and return the same success body', async () => {
    copyTemplateFile.mockResolvedValue({ fileId: 'file-1', fileUrl: 'https://docs.google.com/document/d/file-1/edit' });

    const expressRes = createMockRes();
    await expressCopyTemplate({ body: validInput }, expressRes);
    const vercelRes = createMockRes();
    await vercelCopyTemplate({ method: 'POST', body: validInput }, vercelRes);

    expect(expressRes.statusCode).toBe(200);
    expect(vercelRes.statusCode).toBe(200);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(copyTemplateFile).toHaveBeenNthCalledWith(1, 'template-123', 'My Ledger', 'user@example.com', 'parent-1', 'A description');
    expect(copyTemplateFile).toHaveBeenNthCalledWith(2, 'template-123', 'My Ledger', 'user@example.com', 'parent-1', 'A description');
  });

  it('both return the same status for a Google API error carrying a .code', async () => {
    for (const code of [400, 403, 404]) {
      copyTemplateFile.mockRejectedValue(Object.assign(new Error('google api error'), { code }));

      const expressRes = createMockRes();
      await expressCopyTemplate({ body: validInput }, expressRes);
      const vercelRes = createMockRes();
      await vercelCopyTemplate({ method: 'POST', body: validInput }, vercelRes);

      expect(expressRes.statusCode).toBe(code);
      expect(vercelRes.statusCode).toBe(code);
      expect(vercelRes.body).toEqual(expressRes.body);
    }
  });

  it('both return 401 "Invalid Token" for a credential error', async () => {
    copyTemplateFile.mockRejectedValue(new Error('Request had invalid authentication credentials.'));

    const expressRes = createMockRes();
    await expressCopyTemplate({ body: validInput }, expressRes);
    const vercelRes = createMockRes();
    await vercelCopyTemplate({ method: 'POST', body: validInput }, vercelRes);

    expect(expressRes.statusCode).toBe(401);
    expect(vercelRes.statusCode).toBe(401);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(expressRes.body).toEqual({ error: 'Invalid Token' });
  });

  it('both return the same 500 for an uncoded error', async () => {
    copyTemplateFile.mockRejectedValue(new Error('boom'));

    const expressRes = createMockRes();
    await expressCopyTemplate({ body: validInput }, expressRes);
    const vercelRes = createMockRes();
    await vercelCopyTemplate({ method: 'POST', body: validInput }, vercelRes);

    expect(expressRes.statusCode).toBe(500);
    expect(vercelRes.statusCode).toBe(500);
    expect(vercelRes.body).toEqual(expressRes.body);
  });
});

describe('/update-sheets parity (server/googleDriveRoutes.js vs api/update-sheets.js)', () => {
  it('both reject a non-array updates payload with the same 400', async () => {
    const expressRes = createMockRes();
    await expressUpdateSheets({ body: { updates: 'not-an-array' } }, expressRes);
    const vercelRes = createMockRes();
    await vercelUpdateSheets({ method: 'PUT', body: { updates: 'not-an-array' } }, vercelRes);

    expect(expressRes.statusCode).toBe(400);
    expect(vercelRes.statusCode).toBe(400);
    expect(vercelRes.body).toEqual(expressRes.body);
  });

  it('both produce the same { index, success, data } shape, including when a ledger update silently fails', async () => {
    // First update succeeds; second simulates updateSpreadsheet's internal error-swallowing
    // behavior (it resolves to undefined rather than rejecting) -- both layers must guard
    // against reading .status/.data off of that undefined result.
    updateSpreadsheet
      .mockResolvedValueOnce({ status: 200, data: { spreadsheetId: 'sheet-1' } })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ status: 200, data: { spreadsheetId: 'sheet-1' } })
      .mockResolvedValueOnce(undefined);

    const body = {
      updates: [
        { fileId: 'sheet-1', transactions: [], lastTotal: 100 },
        { fileId: 'sheet-2', transactions: [], lastTotal: 200 },
      ],
    };

    const expressRes = createMockRes();
    await expressUpdateSheets({ body }, expressRes);
    const vercelRes = createMockRes();
    await vercelUpdateSheets({ method: 'PUT', body }, vercelRes);

    expect(expressRes.statusCode).toBe(200);
    expect(vercelRes.statusCode).toBe(200);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(expressRes.body).toEqual([
      { index: 0, success: true, data: { spreadsheetId: 'sheet-1' } },
      { index: 1, success: false, data: undefined },
    ]);

    expect(updateSpreadsheet).toHaveBeenNthCalledWith(1, 'sheet-1', [], { lastTotal: 100 });
    expect(updateSpreadsheet).toHaveBeenNthCalledWith(2, 'sheet-2', [], { lastTotal: 200 });
    expect(updateSpreadsheet).toHaveBeenNthCalledWith(3, 'sheet-1', [], { lastTotal: 100 });
    expect(updateSpreadsheet).toHaveBeenNthCalledWith(4, 'sheet-2', [], { lastTotal: 200 });
  });

  it('both return the same 500 for an uncoded error', async () => {
    updateSpreadsheet.mockRejectedValue(new Error('boom'));
    const body = { updates: [{ fileId: 'sheet-1', transactions: [] }] };

    const expressRes = createMockRes();
    await expressUpdateSheets({ body }, expressRes);
    const vercelRes = createMockRes();
    await vercelUpdateSheets({ method: 'PUT', body }, vercelRes);

    expect(expressRes.statusCode).toBe(500);
    expect(vercelRes.statusCode).toBe(500);
    expect(vercelRes.body).toEqual(expressRes.body);
  });
});
