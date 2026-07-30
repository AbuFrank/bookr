import { describe, it, expect, beforeEach, vi } from 'vitest';

// These three functions are the single shared implementation behind both
// server/googleDriveRoutes.js (local dev, Express) and api/*.js (Vercel).
// Mocking the shared module once lets us drive both entry points with the
// exact same inputs and assert they produce the same HTTP-facing behavior.
const { createFolder, copyTemplateFile, updateSpreadsheet, getAuthenticatedEmail, assertAuthorizedForFileIds } = vi.hoisted(() => ({
  createFolder: vi.fn(),
  copyTemplateFile: vi.fn(),
  updateSpreadsheet: vi.fn(),
  getAuthenticatedEmail: vi.fn(),
  assertAuthorizedForFileIds: vi.fn(),
}));

vi.mock('../server/google-auth.js', () => ({
  createFolder,
  copyTemplateFile,
  updateSpreadsheet,
  assertAuthorizedForFileIds,
  copySheetToTemplate: vi.fn(),
  updateSpreadsheetMetaData: vi.fn(),
  getServiceAccountDrive: vi.fn(),
}));

// getAuthenticatedEmail (server/firebaseAuth.js) is exercised directly in
// server/firebaseAuth.test.js - here it's mocked so these parity tests can
// focus on whether both entry points handle its resolved email / thrown
// auth errors identically.
vi.mock('../server/firebaseAuth.js', () => ({
  getAuthenticatedEmail,
}));

const AUTH_HEADERS = { authorization: 'Bearer valid-token' };

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

  getAuthenticatedEmail.mockResolvedValue('user@example.com');
  assertAuthorizedForFileIds.mockResolvedValue(undefined);

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
    await expressFolder({ headers: AUTH_HEADERS, body: {} }, expressRes);

    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', headers: AUTH_HEADERS, body: {} }, vercelRes);

    expect(expressRes.statusCode).toBe(400);
    expect(vercelRes.statusCode).toBe(vercelRes.statusCode);
    expect(vercelRes.body).toEqual(expressRes.body);
  });

  it('both reject an unauthenticated request with the same 401, without calling createFolder', async () => {
    getAuthenticatedEmail.mockRejectedValue(Object.assign(new Error('Missing or malformed Authorization header'), { statusCode: 401 }));
    const input = { name: 'My Book' };

    const expressRes = createMockRes();
    await expressFolder({ headers: {}, body: input }, expressRes);
    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', headers: {}, body: input }, vercelRes);

    expect(expressRes.statusCode).toBe(401);
    expect(vercelRes.statusCode).toBe(401);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(createFolder).not.toHaveBeenCalled();
  });

  it('both call createFolder with the authenticated email (not a client-supplied one) and return the same success body', async () => {
    createFolder.mockResolvedValue({ id: 'folder-1', name: 'My Book', webViewLink: 'https://drive/folder-1' });
    const input = { name: 'My Book', parentId: 'parent-1' };

    const expressRes = createMockRes();
    await expressFolder({ headers: AUTH_HEADERS, body: input }, expressRes);
    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', headers: AUTH_HEADERS, body: input }, vercelRes);

    expect(expressRes.statusCode).toBe(200);
    expect(vercelRes.statusCode).toBe(200);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(createFolder).toHaveBeenNthCalledWith(1, 'My Book', 'user@example.com', 'shared-folder-123', 'parent-1');
    expect(createFolder).toHaveBeenNthCalledWith(2, 'My Book', 'user@example.com', 'shared-folder-123', 'parent-1');
    expect(assertAuthorizedForFileIds).toHaveBeenNthCalledWith(1, ['parent-1'], 'user@example.com');
    expect(assertAuthorizedForFileIds).toHaveBeenNthCalledWith(2, ['parent-1'], 'user@example.com');
  });

  it('does not check authorization when creating a top-level folder (no parentId)', async () => {
    createFolder.mockResolvedValue({ id: 'folder-1', name: 'root', webViewLink: 'https://drive/folder-1' });
    const input = { name: 'root' };

    const expressRes = createMockRes();
    await expressFolder({ headers: AUTH_HEADERS, body: input }, expressRes);
    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', headers: AUTH_HEADERS, body: input }, vercelRes);

    expect(expressRes.statusCode).toBe(200);
    expect(vercelRes.statusCode).toBe(200);
    expect(assertAuthorizedForFileIds).not.toHaveBeenCalled();
  });

  it('both reject an unauthorized parentId with the same 403, without calling createFolder', async () => {
    assertAuthorizedForFileIds.mockRejectedValue(Object.assign(new Error('Not authorized for file parent-1'), { statusCode: 403 }));
    const input = { name: 'My Book', parentId: 'parent-1' };

    const expressRes = createMockRes();
    await expressFolder({ headers: AUTH_HEADERS, body: input }, expressRes);
    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', headers: AUTH_HEADERS, body: input }, vercelRes);

    expect(expressRes.statusCode).toBe(403);
    expect(vercelRes.statusCode).toBe(403);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(createFolder).not.toHaveBeenCalled();
  });

  it('both return 401 "Invalid Token" for a credential error', async () => {
    createFolder.mockRejectedValue(new Error('Request had invalid authentication credentials.'));
    const input = { name: 'My Book' };

    const expressRes = createMockRes();
    await expressFolder({ headers: AUTH_HEADERS, body: input }, expressRes);
    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', headers: AUTH_HEADERS, body: input }, vercelRes);

    expect(expressRes.statusCode).toBe(401);
    expect(vercelRes.statusCode).toBe(401);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(expressRes.body).toEqual({ error: 'Invalid Token' });
  });

  it('both return the same 500 for any other error', async () => {
    createFolder.mockRejectedValue(new Error('boom'));
    const input = { name: 'My Book' };

    const expressRes = createMockRes();
    await expressFolder({ headers: AUTH_HEADERS, body: input }, expressRes);
    const vercelRes = createMockRes();
    await vercelFolder({ method: 'POST', headers: AUTH_HEADERS, body: input }, vercelRes);

    expect(expressRes.statusCode).toBe(500);
    expect(vercelRes.statusCode).toBe(500);
    expect(vercelRes.body).toEqual(expressRes.body);
  });
});

describe('/copy-template parity (server/googleDriveRoutes.js vs api/copy-template.js)', () => {
  const validInput = {
    fileName: 'My Ledger',
    parentFolderId: 'parent-1',
    description: 'A description',
  };

  it('both call copyTemplateFile with the authenticated email (not a client-supplied one) and return the same success body', async () => {
    copyTemplateFile.mockResolvedValue({ fileId: 'file-1', fileUrl: 'https://docs.google.com/document/d/file-1/edit' });

    const expressRes = createMockRes();
    await expressCopyTemplate({ headers: AUTH_HEADERS, body: validInput }, expressRes);
    const vercelRes = createMockRes();
    await vercelCopyTemplate({ method: 'POST', headers: AUTH_HEADERS, body: validInput }, vercelRes);

    expect(expressRes.statusCode).toBe(200);
    expect(vercelRes.statusCode).toBe(200);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(copyTemplateFile).toHaveBeenNthCalledWith(1, 'template-123', 'My Ledger', 'user@example.com', 'parent-1', 'A description');
    expect(copyTemplateFile).toHaveBeenNthCalledWith(2, 'template-123', 'My Ledger', 'user@example.com', 'parent-1', 'A description');
    expect(assertAuthorizedForFileIds).toHaveBeenNthCalledWith(1, ['parent-1'], 'user@example.com');
    expect(assertAuthorizedForFileIds).toHaveBeenNthCalledWith(2, ['parent-1'], 'user@example.com');
  });

  it('both reject an unauthenticated request with the same 401, without calling copyTemplateFile', async () => {
    getAuthenticatedEmail.mockRejectedValue(Object.assign(new Error('Invalid or expired token'), { statusCode: 401 }));

    const expressRes = createMockRes();
    await expressCopyTemplate({ headers: {}, body: validInput }, expressRes);
    const vercelRes = createMockRes();
    await vercelCopyTemplate({ method: 'POST', headers: {}, body: validInput }, vercelRes);

    expect(expressRes.statusCode).toBe(401);
    expect(vercelRes.statusCode).toBe(401);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(copyTemplateFile).not.toHaveBeenCalled();
  });

  it('both reject an unauthorized parentFolderId with the same 403, without calling copyTemplateFile', async () => {
    assertAuthorizedForFileIds.mockRejectedValue(Object.assign(new Error('Not authorized for file parent-1'), { statusCode: 403 }));

    const expressRes = createMockRes();
    await expressCopyTemplate({ headers: AUTH_HEADERS, body: validInput }, expressRes);
    const vercelRes = createMockRes();
    await vercelCopyTemplate({ method: 'POST', headers: AUTH_HEADERS, body: validInput }, vercelRes);

    expect(expressRes.statusCode).toBe(403);
    expect(vercelRes.statusCode).toBe(403);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(copyTemplateFile).not.toHaveBeenCalled();
  });

  it('both return the same status for a Google API error carrying a .code', async () => {
    for (const code of [400, 403, 404]) {
      copyTemplateFile.mockRejectedValue(Object.assign(new Error('google api error'), { code }));

      const expressRes = createMockRes();
      await expressCopyTemplate({ headers: AUTH_HEADERS, body: validInput }, expressRes);
      const vercelRes = createMockRes();
      await vercelCopyTemplate({ method: 'POST', headers: AUTH_HEADERS, body: validInput }, vercelRes);

      expect(expressRes.statusCode).toBe(code);
      expect(vercelRes.statusCode).toBe(code);
      expect(vercelRes.body).toEqual(expressRes.body);
    }
  });

  it('both return 401 "Invalid Token" for a credential error', async () => {
    copyTemplateFile.mockRejectedValue(new Error('Request had invalid authentication credentials.'));

    const expressRes = createMockRes();
    await expressCopyTemplate({ headers: AUTH_HEADERS, body: validInput }, expressRes);
    const vercelRes = createMockRes();
    await vercelCopyTemplate({ method: 'POST', headers: AUTH_HEADERS, body: validInput }, vercelRes);

    expect(expressRes.statusCode).toBe(401);
    expect(vercelRes.statusCode).toBe(401);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(expressRes.body).toEqual({ error: 'Invalid Token' });
  });

  it('both return the same 500 for an uncoded error', async () => {
    copyTemplateFile.mockRejectedValue(new Error('boom'));

    const expressRes = createMockRes();
    await expressCopyTemplate({ headers: AUTH_HEADERS, body: validInput }, expressRes);
    const vercelRes = createMockRes();
    await vercelCopyTemplate({ method: 'POST', headers: AUTH_HEADERS, body: validInput }, vercelRes);

    expect(expressRes.statusCode).toBe(500);
    expect(vercelRes.statusCode).toBe(500);
    expect(vercelRes.body).toEqual(expressRes.body);
  });
});

describe('/update-sheets parity (server/googleDriveRoutes.js vs api/update-sheets.js)', () => {
  it('both reject a non-array updates payload with the same 400', async () => {
    const expressRes = createMockRes();
    await expressUpdateSheets({ headers: AUTH_HEADERS, body: { updates: 'not-an-array' } }, expressRes);
    const vercelRes = createMockRes();
    await vercelUpdateSheets({ method: 'PUT', headers: AUTH_HEADERS, body: { updates: 'not-an-array' } }, vercelRes);

    expect(expressRes.statusCode).toBe(400);
    expect(vercelRes.statusCode).toBe(400);
    expect(vercelRes.body).toEqual(expressRes.body);
  });

  it('both reject an unauthenticated request with the same 401, without calling updateSpreadsheet', async () => {
    getAuthenticatedEmail.mockRejectedValue(Object.assign(new Error('Invalid or expired token'), { statusCode: 401 }));
    const body = { updates: [{ fileId: 'sheet-1', transactions: [] }] };

    const expressRes = createMockRes();
    await expressUpdateSheets({ headers: {}, body }, expressRes);
    const vercelRes = createMockRes();
    await vercelUpdateSheets({ method: 'PUT', headers: {}, body }, vercelRes);

    expect(expressRes.statusCode).toBe(401);
    expect(vercelRes.statusCode).toBe(401);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(updateSpreadsheet).not.toHaveBeenCalled();
  });

  it('both reject a batch containing an unauthorized fileId with the same 403, without calling updateSpreadsheet', async () => {
    assertAuthorizedForFileIds.mockRejectedValue(Object.assign(new Error('Not authorized for file sheet-2'), { statusCode: 403 }));
    const body = {
      updates: [
        { fileId: 'sheet-1', transactions: [] },
        { fileId: 'sheet-2', transactions: [] },
      ],
    };

    const expressRes = createMockRes();
    await expressUpdateSheets({ headers: AUTH_HEADERS, body }, expressRes);
    const vercelRes = createMockRes();
    await vercelUpdateSheets({ method: 'PUT', headers: AUTH_HEADERS, body }, vercelRes);

    expect(expressRes.statusCode).toBe(403);
    expect(vercelRes.statusCode).toBe(403);
    expect(vercelRes.body).toEqual(expressRes.body);
    expect(updateSpreadsheet).not.toHaveBeenCalled();
    expect(assertAuthorizedForFileIds).toHaveBeenNthCalledWith(1, ['sheet-1', 'sheet-2'], 'user@example.com');
    expect(assertAuthorizedForFileIds).toHaveBeenNthCalledWith(2, ['sheet-1', 'sheet-2'], 'user@example.com');
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
    await expressUpdateSheets({ headers: AUTH_HEADERS, body }, expressRes);
    const vercelRes = createMockRes();
    await vercelUpdateSheets({ method: 'PUT', headers: AUTH_HEADERS, body }, vercelRes);

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
    await expressUpdateSheets({ headers: AUTH_HEADERS, body }, expressRes);
    const vercelRes = createMockRes();
    await vercelUpdateSheets({ method: 'PUT', headers: AUTH_HEADERS, body }, vercelRes);

    expect(expressRes.statusCode).toBe(500);
    expect(vercelRes.statusCode).toBe(500);
    expect(vercelRes.body).toEqual(expressRes.body);
  });
});
