import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { config } from "@/lib/config";

// Reuse a single instance across hot reloads in dev, one per process in prod.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const adapter = new PrismaMariaDb(config.DATABASE_URL);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
