import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { db } from "./db";
import { verifyTotp, decryptTotpSecret } from "@/lib/utils/totp";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      twoFactorEnabled: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    twoFactorEnabled?: boolean;
    twoFactorSecret?: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
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
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.email = user.email as string;
        token.twoFactorEnabled = (user.twoFactorEnabled ?? false) as boolean;
        token.twoFactorVerified = true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.twoFactorEnabled = (token.twoFactorEnabled ?? false) as boolean;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
