import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function securityConfigured() {
  return /^[a-f0-9]{64}$/i.test(process.env.ACCOUNT_ENCRYPTION_KEY ?? "");
}
function key() {
  if (!securityConfigured())
    throw Error("Account encryption is not configured");
  return Buffer.from(process.env.ACCOUNT_ENCRYPTION_KEY!, "hex");
}
export function encryptSecret(secret: string, userId: string) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [nonce, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function decryptSecret(value: string, userId: string) {
  const [nonce, tag, data] = value
    .split(".")
    .map((p) => Buffer.from(p, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(Buffer.from(userId));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
export function newSecret() {
  let value = 0,
    bits = 0,
    result = "";
  for (const byte of randomBytes(20)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 31];
    }
  }
  return result;
}
function decode(secret: string) {
  if (!/^[A-Z2-7]{32}$/.test(secret)) throw Error("Invalid secret");
  let value = 0,
    bits = 0;
  const bytes: number[] = [];
  for (const char of secret) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}
export function totp(secret: string, counter: number) {
  const count = Buffer.alloc(8);
  count.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", decode(secret)).update(count).digest();
  const offset = hmac[hmac.length - 1] & 15;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export function verifyTotp(
  secret: string,
  code: unknown,
  last: number,
  now = Date.now(),
) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const counter of [current - 1, current, current + 1])
    if (
      counter > last &&
      counter >= 0 &&
      timingSafeEqual(Buffer.from(totp(secret, counter)), Buffer.from(code))
    )
      return counter;
  return null;
}
export function recoveryHash(code: string) {
  return createHash("sha256")
    .update(code.replace(/-/g, "").toLowerCase())
    .digest("hex");
}
export function newRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () =>
    randomBytes(8).toString("hex").match(/.{4}/g)!.join("-"),
  );
  return { codes, hashes: JSON.stringify(codes.map(recoveryHash)) };
}
