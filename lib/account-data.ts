import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { ApiError, body, json, rateLimit, text } from "./api";
import { clearSessionCookie, requireUser } from "./auth";
import { verifyPassword } from "./password";
import { verifySecondFactor } from "./account-security";
import { disconnectVideoPaths } from "./video";

// Exports contain personal data, never credentials or other people's conversations.
const exportLimit = 10_000;
export async function handleAccountData(request: NextRequest, path: string[]) {
  const route = path.join("/");
  if (!["account/export", "account/delete"].includes(route)) return null;
  const identity = await requireUser(request);
  if (request.method !== (route === "account/export" ? "POST" : "DELETE"))
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Método no permitido.");
  await rateLimit(`account-data:${identity.id}`, 5, 900);
  const input = await body(request);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: identity.id } });
  if (!(await verifyPassword(text(input, "password", 1, 128), user.passwordHash)))
    throw new ApiError(401, "INVALID_CREDENTIALS", "Contraseña incorrecta.");
  if (route === "account/delete" && input.confirmation !== user.username)
    throw new ApiError(400, "CONFIRMATION", "Escribe tu nombre de usuario para confirmar.");
  await verifySecondFactor(user.id, input.code);
  if (route === "account/export") {
    const data = await prisma.$transaction(async (tx) => {
      const account = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { id: true, username: true, email: true, role: true, status: true, createdAt: true },
      });
      const channels = await tx.stream.findMany({ where: { ownerId: user.id }, take: exportLimit + 1 });
      const ids = channels.map(c => c.id);
      const [follows, messages, sessions, moderatorships, sanctions, commands, chatSettings, alerts, notifications, reports] = await Promise.all([
        tx.follow.findMany({ where: { userId: user.id }, take: exportLimit + 1 }),
        tx.chatMessage.findMany({ where: { userId: user.id }, take: exportLimit + 1 }),
        tx.session.findMany({ where: { userId: user.id }, select: { id: true, createdAt: true, expiresAt: true, userAgent: true }, take: exportLimit + 1 }),
        tx.channelModerator.findMany({ where: { userId: user.id }, take: exportLimit + 1 }),
        tx.channelBan.findMany({ where: { userId: user.id }, take: exportLimit + 1 }),
        tx.chatCommand.findMany({ where: { streamId: { in: ids } }, take: exportLimit + 1 }),
        tx.chatSettings.findMany({ where: { streamId: { in: ids } }, take: exportLimit + 1 }),
        tx.alertSettings.findMany({ where: { streamId: { in: ids } }, select: { streamId: true, followersEnabled: true, template: true, accent: true, durationSeconds: true, soundEnabled: true }, take: exportLimit + 1 }),
        tx.liveNotification.findMany({ where: { userId: user.id }, take: exportLimit + 1 }),
        tx.report.findMany({ where: { reporterId: user.id }, take: exportLimit + 1 }),
      ]);
      const sections = { channels, follows, messages, sessions, moderatorships, sanctions, commands, chatSettings, alerts, reports, notifications };
      if (Object.values(sections).some(rows => rows.length > exportLimit))
        throw new ApiError(413, "EXPORT_TOO_LARGE", "Tu cuenta supera el límite de exportación inmediata. Contacta con administración para obtener una copia completa.");
      return { formatVersion: 1, exportedAt: new Date().toISOString(), account, ...sections };
    });
    return json(data);
  }
  const paths = await prisma.$transaction(async tx => {
    const current = await tx.user.findUnique({ where: { id: user.id } });
    if (!current || current.passwordHash !== user.passwordHash || current.twoFactorSecret !== user.twoFactorSecret)
      throw new ApiError(409, "CHANGED", "La seguridad de tu cuenta cambió. Vuelve a iniciar sesión.");
    if (current.role === "admin" && await tx.user.count({ where: { role: "admin", status: "active", id: { not: user.id } } }) === 0)
      throw new ApiError(409, "LAST_ADMIN", "Asigna otro administrador activo antes de eliminar tu cuenta.");
    const channels = await tx.stream.findMany({ where: { ownerId: user.id }, select: { id: true, slug: true, legacySlug: true } });
    const ids = channels.map(c => c.id);
    const credentials = await tx.streamCredential.findMany({ where: { streamId: { in: ids } }, select: { path: true } });
    // Keep operational action history, detached from deleted channels and identity.
    await tx.auditEvent.updateMany({ where: { streamId: { in: ids } }, data: { streamId: null } });
    await tx.auditEvent.updateMany({ where: { actorId: user.id }, data: { actorId: "deleted", actorName: "Cuenta eliminada" } });
    const identifiers = [user.id, user.username, user.email, ...channels.flatMap(c => [c.slug, c.legacySlug].filter((s): s is string => !!s))];
    const events = await tx.auditEvent.findMany({ where: { OR: identifiers.map(value => ({ target: { contains: value } })) }, select: { id: true, target: true } });
    for (const event of events) {
      let target = event.target;
      for (const value of identifiers.sort((a,b) => b.length - a.length)) target = target.split(value).join("[cuenta eliminada]");
      await tx.auditEvent.update({ where: { id: event.id }, data: { target } });
    }
    await tx.report.deleteMany({ where: { OR: [{ reporterId: user.id }, { streamId: { in: ids } }] } });
    await tx.activityEvent.deleteMany({ where: { username: user.username } });
    await tx.user.delete({ where: { id: user.id } });
    await tx.auditEvent.create({ data: { actorId: "deleted", actorName: "Cuenta eliminada", action: "account.delete", target: "Cuenta y canales eliminados" } });
    return credentials.map(c => c.path);
  });
  const disconnectPending = await disconnectVideoPaths(paths);
  return clearSessionCookie(request, json({ deleted: true, disconnectPending }));
}
