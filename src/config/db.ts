import { PrismaClient } from "@prisma/client";

// In development, Next.js (or ts-node-dev) hot-reloads modules, which
// creates new PrismaClient instances and exhausts the connection pool.
// This global singleton pattern prevents that.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
