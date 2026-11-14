"use client";

import { createSupabasePlatform, type Platform } from "@civil/platform";
import { createBrowserClient } from "@supabase/ssr";

let cached: Platform | null = null;

/**
 * Browser-side platform. The driver is chosen by NEXT_PUBLIC_PLATFORM_DRIVER so
 * another backend can be added without touching UI code.
 */
export function getPlatform(): Platform {
  if (cached) return cached;
  const driver = process.env.NEXT_PUBLIC_PLATFORM_DRIVER ?? "supabase";
  if (driver !== "supabase") throw new Error(`Unknown platform driver: ${driver}`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured (see .env.example).");
  cached = createSupabasePlatform(createBrowserClient(url, key));
  return cached;
}
