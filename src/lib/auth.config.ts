import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

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

// Base config that works in Edge Runtime (no Node.js dependencies)
export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      // authorize is defined in auth.ts (Node.js runtime only)
      authorize: async () => null,
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
        session.user.twoFactorEnabled =
          (token.twoFactorEnabled ?? false) as boolean;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const protectedRoutes = [
        "/dashboard",
        "/transactions",
        "/budgets",
        "/savings",
        "/recurring",
        "/settings",
      ];

      const authRoutes = ["/login", "/register"];

      const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route)
      );

      const isAuthRoute = authRoutes.some((route) =>
        pathname.startsWith(route)
      );

      // Protect routes
      if (isProtectedRoute && !isLoggedIn) {
        return false; // Redirect to signIn page
      }

      // Redirect logged in users away from auth pages
      if (isAuthRoute && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // Redirect root
      if (pathname === "/") {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        } else {
          return Response.redirect(new URL("/login", nextUrl));
        }
      }

      return true;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Export for proxy (Edge Runtime compatible)
export const { auth } = NextAuth(authConfig);
