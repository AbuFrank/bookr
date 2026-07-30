import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Verifying a Firebase ID token only needs the project ID (to check the
// token's `aud` claim) - Google's public signing certs are fetched over
// HTTPS with no credential required, so no service account key is needed
// here (unlike server/google-auth.js's Drive/Sheets service account).
function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is required');
  }

  return initializeApp({ projectId });
}

export async function verifyIdToken(idToken) {
  return getAuth(getAdminApp()).verifyIdToken(idToken);
}

// Confirms the request carries a valid Firebase ID token and returns the
// email it was issued for. Used by both server/googleDriveRoutes.js and the
// api/*.js handlers to establish who is actually making the request, rather
// than trusting an email the client puts in the request body.
export async function getAuthenticatedEmail(req) {
  const authHeader = req.headers?.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    const error = new Error('Missing or malformed Authorization header');
    error.statusCode = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = await verifyIdToken(token);
  } catch (err) {
    console.error('verifyIdToken failed:', err);
    const error = new Error('Invalid or expired token');
    error.statusCode = 401;
    throw error;
  }

  if (!decoded.email) {
    const error = new Error('Token has no associated email');
    error.statusCode = 401;
    throw error;
  }

  if (!decoded.email_verified) {
    const error = new Error('Email not verified');
    error.statusCode = 403;
    throw error;
  }

  return decoded.email;
}
