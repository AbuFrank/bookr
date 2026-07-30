import { describe, it, expect, beforeEach, vi } from 'vitest';

const { verifyIdToken: adminVerifyIdToken, authFactory, initializeApp } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  authFactory: vi.fn(),
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const apps = [];
  return {
    default: {
      apps,
      initializeApp: (...args) => {
        const app = initializeApp(...args) || {};
        apps.push(app);
        return app;
      },
      auth: authFactory,
    },
  };
});

let getAuthenticatedEmail;
let verifyIdToken;

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();

  process.env.FIREBASE_PROJECT_ID = 'bookr-905fd';
  authFactory.mockReturnValue({ verifyIdToken: adminVerifyIdToken });

  ({ getAuthenticatedEmail, verifyIdToken } = await import('./firebaseAuth.js'));
});

describe('verifyIdToken', () => {
  it('delegates to firebase-admin auth().verifyIdToken', async () => {
    adminVerifyIdToken.mockResolvedValue({ email: 'user@example.com', email_verified: true });

    const decoded = await verifyIdToken('some-token');

    expect(decoded).toEqual({ email: 'user@example.com', email_verified: true });
    expect(adminVerifyIdToken).toHaveBeenCalledWith('some-token');
  });
});

describe('getAuthenticatedEmail', () => {
  it('returns the verified email for a valid Bearer token', async () => {
    adminVerifyIdToken.mockResolvedValue({ email: 'user@example.com', email_verified: true });

    const email = await getAuthenticatedEmail({ headers: { authorization: 'Bearer good-token' } });

    expect(email).toBe('user@example.com');
    expect(adminVerifyIdToken).toHaveBeenCalledWith('good-token');
  });

  it('throws a 401 when the Authorization header is missing', async () => {
    await expect(getAuthenticatedEmail({ headers: {} })).rejects.toMatchObject({ statusCode: 401 });
    expect(adminVerifyIdToken).not.toHaveBeenCalled();
  });

  it('throws a 401 when the Authorization header is not a Bearer token', async () => {
    await expect(
      getAuthenticatedEmail({ headers: { authorization: 'Basic abc123' } })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws a 401 when verifyIdToken rejects (expired/invalid token)', async () => {
    adminVerifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'));

    await expect(
      getAuthenticatedEmail({ headers: { authorization: 'Bearer expired-token' } })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws a 401 when the decoded token has no email', async () => {
    adminVerifyIdToken.mockResolvedValue({ email_verified: true });

    await expect(
      getAuthenticatedEmail({ headers: { authorization: 'Bearer good-token' } })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws a 403 when the email is not verified', async () => {
    adminVerifyIdToken.mockResolvedValue({ email: 'user@example.com', email_verified: false });

    await expect(
      getAuthenticatedEmail({ headers: { authorization: 'Bearer good-token' } })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
