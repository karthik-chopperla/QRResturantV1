import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type DriverError = {
  message?: string;
  code?: string;
  cause?: { message?: string };
};

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;

function isPoolError(err: unknown): boolean {
  const e = err as DriverError;
  return (
    (typeof e.message === "string" && e.message.includes("EMAXCONNSESSION")) ||
    e.code === "EMAXCONNSESSION" ||
    (typeof e.cause?.message === "string" &&
      e.cause.message.includes("EMAXCONNSESSION"))
  );
}

async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isPoolError(err) && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      return withRetry(fn, attempt + 1);
    }

    throw err;
  }
}

let prismaClient: PrismaClient | undefined;

function getPoolerUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required to initialize Prisma.");
  try {
    const url = new URL(raw);
    if (url.hostname.includes("pooler.supabase.com") && url.port === "5432") {
      url.port = "6543";
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function getPrisma(): PrismaClient {
  if (prismaClient) return prismaClient;
  const connectionString = getPoolerUrl();
  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 10000,
  });
  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
  });
  prismaClient = client;
  return client;
}

export function prismaWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn);
}

const prismaProxy = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return getPrisma()[prop as keyof PrismaClient];
  },
});

export default prismaProxy;
