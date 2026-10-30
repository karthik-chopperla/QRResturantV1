import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.TABLE_TOKEN_SECRET;

function getSecret(): string {
  if (!SECRET || SECRET.length < 16) {
    throw new Error(
      "TABLE_TOKEN_SECRET must be set and at least 16 characters."
    );
  }
  return SECRET;
}

function base64urlEncode(data: string): string {
  return Buffer.from(data, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(data: string): string {
  let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64").toString("utf-8");
}

function sign(tableId: string): string {
  return createHmac("sha256", getSecret()).update(tableId).digest("base64url");
}

export function generateTableToken(tableId: string): string {
  const sig = sign(tableId);
  return `${base64urlEncode(tableId)}.${sig}`;
}

export function verifyTableToken(token: string): string | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;

  try {
    const tableId = base64urlDecode(token.slice(0, dotIndex));
    const providedSig = token.slice(dotIndex + 1);
    const expectedSig = sign(tableId);

    const providedBuf = Buffer.from(providedSig, "utf-8");
    const expectedBuf = Buffer.from(expectedSig, "utf-8");

    if (providedBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

    return tableId;
  } catch {
    return null;
  }
}
