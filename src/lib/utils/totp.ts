import {
  generateSecret as otpGenerateSecret,
  generateSync,
  verifySync,
  generateURI,
} from "otplib";
import QRCode from "qrcode";
import { encrypt, decrypt } from "./encryption";

const APP_NAME = "SpendingTracker";

/**
 * Generate a new TOTP secret for 2FA setup
 */
export function generateTotpSecret(): string {
  return otpGenerateSecret();
}

/**
 * Generate a QR code data URL for 2FA setup
 */
export async function generateQrCodeDataUrl(
  email: string,
  secret: string
): Promise<string> {
  const otpauth = generateURI({
    secret,
    issuer: APP_NAME,
    label: email,
  });
  return QRCode.toDataURL(otpauth);
}

/**
 * Verify a TOTP token against a secret
 */
export function verifyTotp(token: string, secret: string): boolean {
  // Sanitize token: remove any non-digit characters and trim
  const sanitizedToken = token.replace(/\D/g, "").trim();

  // Validate token length
  if (sanitizedToken.length !== 6) {
    console.error(
      `TOTP validation failed: expected 6 digits, got ${sanitizedToken.length}`
    );
    return false;
  }

  const result = verifySync({ token: sanitizedToken, secret });
  return result.valid;
}

/**
 * Generate current TOTP token (for testing)
 */
export function generateTotp(secret: string): string {
  return generateSync({ secret });
}

/**
 * Encrypt a TOTP secret for database storage
 */
export function encryptTotpSecret(secret: string): string {
  return encrypt(secret);
}

/**
 * Decrypt a TOTP secret from database storage
 */
export function decryptTotpSecret(encryptedSecret: string): string {
  return decrypt(encryptedSecret);
}
