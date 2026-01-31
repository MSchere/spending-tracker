import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { db } from "./db";
import { verifyTotp, decryptTotpSecret } from "@/lib/utils/totp";
import { authConfig } from "@/lib/auth.config";

// Custom error for 2FA requirement
class TwoFactorRequiredError extends CredentialsSignin {
  code = "2FA_REQUIRED";
}

class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

class Invalid2FACodeError extends CredentialsSignin {
  code = "invalid_2fa_code";
}

// Full auth config with Node.js dependencies (for server-side use only)
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        // NextAuth may serialize undefined as "undefined" string
        const rawTotpCode = credentials.totpCode as string | undefined;
        const totpCode =
          rawTotpCode && rawTotpCode !== "undefined" ? rawTotpCode : undefined;

        // Find user by email
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user) {
          throw new InvalidCredentialsError();
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          throw new InvalidCredentialsError();
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!totpCode) {
            // Signal that 2FA is required
            throw new TwoFactorRequiredError();
          }

          const decryptedSecret = decryptTotpSecret(user.twoFactorSecret);
          const isValidTotp = verifyTotp(totpCode, decryptedSecret);

          if (!isValidTotp) {
            throw new Invalid2FACodeError();
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          twoFactorEnabled: user.twoFactorEnabled,
          twoFactorSecret: user.twoFactorSecret,
        };
      },
    }),
  ],
});
