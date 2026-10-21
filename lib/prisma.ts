import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { nexoraPrisma?: PrismaClient };
export const prisma = globalDb.nexoraPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.nexoraPrisma = prisma;
