import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables schema
   */
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    
    // NextAuth
    NEXTAUTH_SECRET: process.env.NODE_ENV === "production" 
      ? z.string().min(32) 
      : z.string().min(1),
    NEXTAUTH_URL: z.preprocess(
      (str) => process.env.VERCEL_URL ?? str,
      process.env.VERCEL ? z.string() : z.string().url()
    ),
    
    // Encryption for 2FA secrets
    ENCRYPTION_KEY: z.string().length(32, "Encryption key must be exactly 32 characters"),
    
    // Wise API
    WISE_API_TOKEN: z.string().min(1, "Wise API token is required"),
    WISE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("production"),
  },

  /**
   * Client-side environment variables schema
   */
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("Spending Tracker"),
  },

  /**
   * Runtime environment variables
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    WISE_API_TOKEN: process.env.WISE_API_TOKEN,
    WISE_ENVIRONMENT: process.env.WISE_ENVIRONMENT,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },

  /**
   * Skip validation during Docker builds
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Treat empty strings as undefined
   */
  emptyStringAsUndefined: true,
});
