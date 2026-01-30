import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { db } from "./db";
import { verifyTotp, decryptTotpSecret } from "@/lib/utils/totp";
import { authConfig } from "@/lib/auth.config";

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
        const totpCode = credentials.totpCode as string | undefined;

        // Find user by email
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          throw new Error("Invalid email or password");
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!totpCode) {
            // Signal that 2FA is required
            throw new Error("2FA_REQUIRED");
          }

          const decryptedSecret = decryptTotpSecret(user.twoFactorSecret);
          const isValidTotp = verifyTotp(totpCode, decryptedSecret);

          if (!isValidTotp) {
            throw new Error("Invalid 2FA code");
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
