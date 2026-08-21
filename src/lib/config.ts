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
});

export const config = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  CERTS_DIR: process.env.CERTS_DIR,
  DUMP_PM2_PATH: process.env.DUMP_PM2_PATH,
});
