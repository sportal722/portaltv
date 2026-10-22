import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  totp,
  verifyTotp,
  newSecret,
  encryptSecret,
  decryptSecret,
  newRecoveryCodes,
  recoveryHash,
} from "../lib/totp.ts";
const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
for (const [seconds, expected] of [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
])
  assert.equal(totp(secret, Math.floor(seconds / 30)), expected);
const now = 1234567890000,
  counter = Math.floor(now / 30000),
  code = totp(secret, counter);
assert.equal(verifyTotp(secret, code, -1, now), counter);
assert.equal(verifyTotp(secret, code, counter, now), null);
assert.equal(verifyTotp(secret, totp(secret, counter + 2), -1, now), null);
assert.equal(verifyTotp(secret, "bad", -1, now), null);
assert.match(newSecret(), /^[A-Z2-7]{32}$/);
process.env.ACCOUNT_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const cipher = encryptSecret(secret, "account");
assert.equal(decryptSecret(cipher, "account"), secret);
assert.throws(() => decryptSecret(cipher, "other"));
assert.throws(() => decryptSecret(cipher.slice(0, -4) + "AAAA", "account"));
const backup = newRecoveryCodes();
assert.equal(new Set(backup.codes).size, 10);
assert.deepEqual(JSON.parse(backup.hashes), backup.codes.map(recoveryHash));
assert(!backup.hashes.includes(backup.codes[0]));
console.log(
  "PASS: RFC6238 vectors, replay/window rejection, random secrets, authenticated encryption/account binding and hashed recovery codes",
);
