/**
 * OrbitGuard System Configuration
 * Provides type-safe access to environment variables with fallback values.
 */

export const ANTHROPIC_API_KEY: string = process.env.ANTHROPIC_API_KEY || "";

export const BACKEND_API_URL: string = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

export const NEXT_PUBLIC_APP_NAME: string = process.env.NEXT_PUBLIC_APP_NAME || "OrbitGuard";

export const NEXT_PUBLIC_AUTO_REFRESH_INTERVAL: number = parseInt(
  process.env.NEXT_PUBLIC_AUTO_REFRESH_INTERVAL || "60000",
  10
);
