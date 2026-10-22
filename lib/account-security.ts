import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "./prisma";
import { ApiError, body, json, rateLimit, text } from "./api";
import {
  requireUser,
  sessionTokenHash,
  clearSessionCookie,
  startSession,
} from "./auth";
import { verifyPassword, hashPassword } from "./password";
import {
  decryptSecret,
  encryptSecret,
  newRecoveryCodes,
  newSecret,
  recoveryHash,
  securityConfigured,
  verifyTotp,
} from "./totp";

export async function verifySecondFactor(userId: string, code: unknown) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.twoFactorSecret) return;
  await rateLimit(`otp:${userId}`, 6, 60);
  if (!securityConfigured())
    throw new ApiError(
      503,
      "SECURITY_CONFIGURATION",
      "La verificación de seguridad no está disponible. Contacta con soporte.",
    );
  if (!code)
    throw new ApiError(
      401,
      "TWO_FACTOR_REQUIRED",
      "Introduce el código de tu autenticador o un código de recuperación.",
    );
  const counter = verifyTotp(
    decryptSecret(user.twoFactorSecret, userId),
    code,
    user.twoFactorLastCounter,
  );
  if (counter !== null) {
    const result = await prisma.user.updateMany({
      where: {
        id: userId,
        twoFactorSecret: user.twoFactorSecret,
        twoFactorLastCounter: { lt: counter },
      },
      data: { twoFactorLastCounter: counter },
    });
    if (result.count === 1) return;
  } else if (typeof code === "string" && /^[a-f0-9-]{16,19}$/i.test(code)) {
    const hashes: string[] = JSON.parse(user.recoveryCodes);
    const digest = recoveryHash(code);
    if (hashes.includes(digest)) {
      const result = await prisma.user.updateMany({
        where: {
          id: userId,
          recoveryCodes: user.recoveryCodes,
          twoFactorSecret: user.twoFactorSecret,
        },
        data: {
          recoveryCodes: JSON.stringify(hashes.filter((h) => h !== digest)),
        },
      });
      if (result.count === 1) return;
    }
  }
  throw new ApiError(
    401,
    "INVALID_TWO_FACTOR",
    "Código no válido o ya utilizado. Espera el siguiente código o usa uno de recuperación.",
  );
}

export async function handleAccountSecurity(
  request: NextRequest,
  path: string[],
) {
  if (
    path[0] !== "account" ||
    !["security", "sessions", "two-factor", "password"].includes(path[1])
  )
    return null;
  const identity = await requireUser(request);
  const userId = identity.id,
    method = request.method,
    route = path.join("/");
  const current = sessionTokenHash(request)!;
  const audit = (action: string) => ({
    actorId: userId,
    actorName: identity.username,
    action,
    target: identity.username,
  });
  if (route === "account/security" && method === "GET") {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return json({
      twoFactorEnabled: !!user.twoFactorSecret,
      configured: securityConfigured(),
      recoveryCodesRemaining: JSON.parse(user.recoveryCodes).length,
    });
  }
  if (route === "account/sessions" && method === "GET") {
    const sessions = await prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return json(
      sessions.map(({ id, createdAt, expiresAt, userAgent, tokenHash }) => ({
        id,
        createdAt,
        expiresAt,
        userAgent,
        current: tokenHash === current,
      })),
    );
  }
  if (path[1] === "sessions" && method === "DELETE" && path.length <= 3) {
    await rateLimit(`sessions:${userId}`, 30, 60);
    if (path.length === 2) {
      await prisma.session.deleteMany({
        where: { userId, tokenHash: { not: current } },
      });
      await prisma.auditEvent.create({
        data: audit("account.sessions.revokeOthers"),
      });
      return json({ revoked: true });
    }
    const session = await prisma.session.findFirst({
      where: { userId, id: path[2] },
    });
    if (!session)
      throw new ApiError(404, "NOT_FOUND", "No se encontró la sesión.");
    await prisma.session.deleteMany({ where: { userId, id: session.id } });
    await prisma.auditEvent.create({ data: audit("account.session.revoke") });
    const response = json({ revoked: true });
    return session.tokenHash === current
      ? clearSessionCookie(request, response)
      : response;
  }
  if (!["POST", "DELETE", "PATCH"].includes(method))
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Método no permitido.");
  await rateLimit(`account-security:${userId}`, 10, 300);
  const input = await body(request),
    password = text(input, "password", 1, 128);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password, user.passwordHash)))
    throw new ApiError(401, "INVALID_CREDENTIALS", "Contraseña incorrecta.");
  if (route === "account/password" && method === "PATCH") {
    await verifySecondFactor(userId, input.code);
    const next = text(input, "newPassword", 12, 128);
    if (next === password)
      throw new ApiError(400, "VALIDATION", "Elige una contraseña diferente.");
    const passwordHash = await hashPassword(next);
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: userId, passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (!changed.count)
        throw new ApiError(
          409,
          "CHANGED",
          "La contraseña cambió. Vuelve a iniciar sesión.",
        );
      await tx.session.deleteMany({ where: { userId } });
      await tx.twoFactorSetup.deleteMany({ where: { userId } });
      await tx.auditEvent.create({ data: audit("account.password.change") });
    });
    return startSession(request, json({ changed: true }), userId);
  }
  if (!securityConfigured())
    throw new ApiError(
      503,
      "SECURITY_CONFIGURATION",
      "La autenticación en dos pasos todavía no está configurada.",
    );
  if (route === "account/two-factor/setup" && method === "POST") {
    if (user.twoFactorSecret)
      throw new ApiError(
        409,
        "ALREADY_ENABLED",
        "La autenticación en dos pasos ya está activa.",
      );
    const secret = newSecret(),
      encrypted = encryptSecret(secret, userId);
    const expiresAt = new Date(Date.now() + 600000);
    await prisma.twoFactorSetup.upsert({
      where: { userId },
      create: { userId, secret: encrypted, expiresAt },
      update: { secret: encrypted, expiresAt },
    });
    const uri = `otpauth://totp/${encodeURIComponent(`NEXORA:${user.username}`)}?secret=${secret}&issuer=NEXORA&algorithm=SHA1&digits=6&period=30`;
    return json({
      secret,
      qrCode: await QRCode.toDataURL(uri, { width: 220, margin: 2 }),
      expiresAt,
    });
  }
  if (route === "account/two-factor/confirm" && method === "POST") {
    const setup = await prisma.twoFactorSetup.findUnique({ where: { userId } });
    if (!setup || setup.expiresAt <= new Date() || user.twoFactorSecret)
      throw new ApiError(
        400,
        "SETUP_EXPIRED",
        "Vuelve a iniciar la configuración del autenticador.",
      );
    const counter = verifyTotp(
      decryptSecret(setup.secret, userId),
      input.code,
      -1,
    );
    if (counter === null)
      throw new ApiError(
        401,
        "INVALID_TWO_FACTOR",
        "Código del autenticador incorrecto.",
      );
    const recovery = newRecoveryCodes();
    await prisma.$transaction(async (tx) => {
      const removed = await tx.twoFactorSetup.deleteMany({
        where: { userId, secret: setup.secret, expiresAt: { gt: new Date() } },
      });
      if (!removed.count)
        throw new ApiError(
          409,
          "CHANGED",
          "La configuración ha cambiado. Vuelve a empezar.",
        );
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: setup.secret,
          twoFactorLastCounter: counter,
          recoveryCodes: recovery.hashes,
        },
      });
      await tx.session.deleteMany({
        where: { userId, tokenHash: { not: current } },
      });
    });
    await prisma.auditEvent.create({ data: audit("account.2fa.enable") });
    return json({ enabled: true, recoveryCodes: recovery.codes });
  }
  if (route === "account/two-factor" && method === "DELETE") {
    if (!user.twoFactorSecret)
      throw new ApiError(
        400,
        "NOT_ENABLED",
        "La autenticación en dos pasos no está activa.",
      );
    await verifySecondFactor(userId, input.code);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: null,
          twoFactorLastCounter: -1,
          recoveryCodes: "[]",
        },
      });
      await tx.twoFactorSetup.deleteMany({ where: { userId } });
      await tx.session.deleteMany({
        where: { userId, tokenHash: { not: current } },
      });
    });
    await prisma.auditEvent.create({ data: audit("account.2fa.disable") });
    return json({ enabled: false });
  }
  if (route === "account/two-factor/recovery" && method === "POST") {
    if (!user.twoFactorSecret)
      throw new ApiError(
        400,
        "NOT_ENABLED",
        "Activa primero la autenticación en dos pasos.",
      );
    await verifySecondFactor(userId, input.code);
    const recovery = newRecoveryCodes();
    await prisma.user.update({
      where: { id: userId },
      data: { recoveryCodes: recovery.hashes },
    });
    await prisma.auditEvent.create({ data: audit("account.recovery.rotate") });
    return json({ recoveryCodes: recovery.codes });
  }
  throw new ApiError(404, "NOT_FOUND", "No se encontró esta acción.");
}
