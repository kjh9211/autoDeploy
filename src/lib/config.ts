import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  // Directory webproxy's addContext() certs live in, e.g. E:\webproxy\certs
  CERTS_DIR: z.string().min(1, "CERTS_DIR is required"),
  // Path to PM2's dump.pm2, e.g. C:\Users\<user>\.pm2\dump.pm2
  DUMP_PM2_PATH: z.string().min(1, "DUMP_PM2_PATH is required"),

  // Phase 3 — all optional so Phase 0-2 setups keep working without them.
  // webproxy's internal admin API (127.0.0.1-only per docs/webproxy-integration.md).
  WEBPROXY_ADMIN_URL: z.string().optional(),
  WEBPROXY_ADMIN_TOKEN: z.string().optional(),
  // Cloudflare API token, scoped to Zone:DNS:Edit + Zone:Zone:Read.
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  // Comma-separated zone names, e.g. "kjh9211.kr,noahsoft.kr".
  CLOUDFLARE_ZONES: z.string().optional(),
  // Expected origin IP every A record should point at (docs/PLANNING.md §3).
  ORIGIN_IP: z.string().optional(),

  // Phase 4 — mailcow, also optional.
  MAILCOW_API_URL: z.string().optional(),
  MAILCOW_API_KEY: z.string().optional(),
  // docker-compose project directory for the mailcow stack, e.g. E:\mailcow-dockerized.old
  MAILCOW_COMPOSE_DIR: z.string().optional(),
});

const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  CERTS_DIR: process.env.CERTS_DIR,
  DUMP_PM2_PATH: process.env.DUMP_PM2_PATH,
  WEBPROXY_ADMIN_URL: process.env.WEBPROXY_ADMIN_URL,
  WEBPROXY_ADMIN_TOKEN: process.env.WEBPROXY_ADMIN_TOKEN,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ZONES: process.env.CLOUDFLARE_ZONES,
  ORIGIN_IP: process.env.ORIGIN_IP,
  MAILCOW_API_URL: process.env.MAILCOW_API_URL,
  MAILCOW_API_KEY: process.env.MAILCOW_API_KEY,
  MAILCOW_COMPOSE_DIR: process.env.MAILCOW_COMPOSE_DIR,
});

export const config = {
  ...env,
  cloudflareZones: env.CLOUDFLARE_ZONES
    ? env.CLOUDFLARE_ZONES.split(",").map((z) => z.trim()).filter(Boolean)
    : [],
};
