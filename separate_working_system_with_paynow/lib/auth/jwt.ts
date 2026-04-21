import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'connect_admin_token';
const JWT_ALG = 'HS256';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export interface AdminTokenPayload {
  sub: string;   // admin id
  email: string;
  role: string;
  name: string;
}

/**
 * Sign a JWT and return it as a string.
 */
export async function signToken(payload: AdminTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret());
}

/**
 * Verify a JWT string. Returns the payload or null if invalid.
 */
export async function verifyToken(
  token: string
): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AdminTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Get the current admin from the cookie (for use in API route handlers).
 */
export async function getAdminFromCookie(): Promise<AdminTokenPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export { COOKIE_NAME };
