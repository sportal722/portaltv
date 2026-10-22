import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import {
  ApiError,
  body,
  findStream,
  json,
  positiveId,
  publicUserSelect,
  rateLimit,
  streamInclude,
  text,
} from "./api";
import { requireUser } from "./auth";
import { auditData } from "./community";
import { verifyPassword } from "./password";
import { verifySecondFactor } from "./account-security";
import { revokeKey, videoConfigured, videoPaths, withVideo } from "./video";
import {
  mediaHealth,
  mediaOutputs,
  processedVideoConfigured,
} from "./media-output";

export async function platformSettings() {
  return (
    (await prisma.platformSettings.findUnique({ where: { id: "main" } })) ?? {
      registrationOpen: true,
      announcement: "",
    }
  );
}
export async function handlePlatform(request: NextRequest, path: string[]) {
  const route = path.join("/"),
    method = request.method;
  if (route === "platform" && method === "GET") {
    const { registrationOpen, announcement } = await platformSettings();
    return json({ registrationOpen, announcement });
  }
  if (route === "reports" && method === "POST") {
    const reporter = await requireUser(request),
      data = await body(request);
    await rateLimit(`reports:${reporter.id}`, 5, 3600);
    const stream = await findStream(text(data, "slug", 3, 80));
    const reason = text(data, "reason", 3, 30),
      description = text(data, "description", 10, 1500);
    if (
      !["spam", "harassment", "copyright", "unsafe", "other"].includes(reason)
    )
      throw new ApiError(400, "VALIDATION", "Motivo no válido.");
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: reporter.id,
        streamId: stream.id,
        status: { in: ["open", "reviewing"] },
      },
    });
    if (existing)
      throw new ApiError(
        409,
        "DUPLICATE_REPORT",
        "Ya tienes una denuncia pendiente para este canal.",
      );
    const report = await prisma.report.create({
      data: {
        reporterId: reporter.id,
        streamId: stream.id,
        reason,
        description,
      },
    });
    return json({ id: report.id, status: report.status }, 201);
  }
  if (path[0] !== "admin") return null;
  const user = await requireUser(request, ["admin", "moderator"]);
  if (user.status !== "active")
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Tu cuenta no tiene acceso activo a administración.",
    );
  const admin = user.role === "admin";
  if (route === "admin/overview" && method === "GET") {
    const [users, channels, followers, reports, staff, securedStaff, outputs] =
      await Promise.all([
        prisma.user.count(),
        prisma.stream.count({ where: { isDemo: false } }),
        prisma.follow.count(),
        prisma.report.count({
          where: { status: { in: ["open", "reviewing"] } },
        }),
        prisma.user.count({ where: { role: { in: ["admin", "moderator"] } } }),
        prisma.user.count({
          where: {
            role: { in: ["admin", "moderator"] },
            twoFactorSecret: { not: null },
          },
        }),
        mediaOutputs(),
      ]);
    let live: number | null = null,
      video = "not_configured";
    if (videoConfigured()) {
      try {
        live = (await videoPaths()).filter(
          (p) => p.available && p.online && p.source,
        ).length;
        video = "connected";
      } catch {
        video = "unavailable";
      }
    }
    return json({
      users,
      channels,
      followers,
      reports,
      staff,
      securedStaff,
      live,
      video,
      workerHealth: await mediaHealth(),
      checkedAt: new Date().toISOString(),
      worker: processedVideoConfigured()
        ? Object.values(outputs).map((o) => o.state)
        : null,
      actorRole: user.role,
    });
  }
  if (route === "admin/roles" && method === "PATCH") {
    if (!admin)
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Solo administración puede asignar roles globales.",
      );
    await rateLimit(`admin-roles:${user.id}`, 10, 300);
    const data = await body(request),
      id = text(data, "id", 1, 80),
      role = text(data, "role", 3, 12);
    if (
      !["viewer", "creator", "moderator", "admin"].includes(role) ||
      id === user.id
    )
      throw new ApiError(
        400,
        "VALIDATION",
        "Elige otro usuario y un rol válido.",
      );
    const account = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (
      !(await verifyPassword(
        text(data, "password", 1, 128),
        account.passwordHash,
      ))
    )
      throw new ApiError(401, "INVALID_CREDENTIALS", "Contraseña incorrecta.");
    await verifySecondFactor(user.id, data.code);
    const target = await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: user.id } });
      if (actor?.role !== "admin" || actor.status !== "active")
        throw new ApiError(403, "FORBIDDEN", "Tu acceso ha cambiado.");
      const target = await tx.user.findUnique({ where: { id } });
      if (!target)
        throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado.");
      if (
        target.role === "admin" &&
        role !== "admin" &&
        (await tx.user.count({ where: { role: "admin", status: "active" } })) <=
          1
      )
        throw new ApiError(
          409,
          "LAST_ADMIN",
          "Debe existir al menos un administrador activo.",
        );
      const result = await tx.user.update({
        where: { id },
        data: { role },
        select: publicUserSelect,
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditEvent.create({
        data: auditData(
          user,
          "user.role",
          `${target.username}: ${target.role} → ${role}`,
        ),
      });
      return result;
    });
    return json(target);
  }
  if (route === "admin/channels" && method === "GET") {
    const q = (request.nextUrl.searchParams.get("q") || "").slice(0, 100);
    const page = Math.min(
      1000,
      Math.max(0, Number(request.nextUrl.searchParams.get("page")) || 0),
    );
    const rows = await prisma.stream.findMany({
      where: {
        isDemo: false,
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { owner: { username: { contains: q } } },
              ],
            }
          : {}),
      },
      include: streamInclude,
      orderBy: { id: "desc" },
      take: 50,
      skip: Math.floor(page) * 50,
    });
    return json(await withVideo(rows));
  }
  if (route === "admin/channels" && method === "PATCH") {
    const data = await body(request),
      id = positiveId(data.id),
      reason = text(data, "reason", 3, 500);
    if (typeof data.suspended !== "boolean")
      throw new ApiError(400, "VALIDATION", "Estado no válido.");
    const channel = await prisma.stream.findUnique({
      where: { id },
      include: { owner: { select: { role: true } } },
    });
    if (!channel || channel.isDemo)
      throw new ApiError(404, "NOT_FOUND", "Canal no encontrado.");
    if (!admin && ["admin", "moderator"].includes(channel.owner.role))
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Solo administración puede intervenir sobre canales del equipo global.",
      );
    await rateLimit(`admin-channel:${user.id}`, 30, 60);
    await prisma.$transaction([
      prisma.stream.update({
        where: { id },
        data: {
          isSuspended: data.suspended,
          suspensionReason: data.suspended ? reason : "",
        },
      }),
      prisma.auditEvent.create({
        data: auditData(
          user,
          data.suspended ? "channel.suspend" : "channel.restore",
          `${channel.slug}: ${reason}`,
          id,
        ),
      }),
    ]);
    const disconnectPending =
      data.suspended && videoConfigured()
        ? (await revokeKey(id)).disconnectPending
        : false;
    return json({ id, isSuspended: data.suspended, disconnectPending });
  }
  if (
    route === "admin/channel-moderators" &&
    ["POST", "DELETE"].includes(method)
  ) {
    if (!admin)
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Solo administración puede gestionar equipos desde este panel.",
      );
    const data = await body(request),
      streamId = positiveId(data.streamId),
      username = text(data, "username", 3, 24);
    const [channel, target] = await Promise.all([
      prisma.stream.findUnique({ where: { id: streamId } }),
      prisma.user.findUnique({ where: { username } }),
    ]);
    if (!channel || channel.isDemo || !target)
      throw new ApiError(404, "NOT_FOUND", "Canal o usuario no encontrado.");
    if (
      target.status !== "active" ||
      target.id === channel.ownerId ||
      ["admin", "moderator"].includes(target.role)
    )
      throw new ApiError(
        400,
        "VALIDATION",
        "Ese usuario no necesita o no puede recibir este rol de canal.",
      );
    await rateLimit(`admin-team:${user.id}`, 30, 60);
    await prisma.$transaction(async (tx) => {
      if (method === "POST")
        await tx.channelModerator.upsert({
          where: { streamId_userId: { streamId, userId: target.id } },
          create: { streamId, userId: target.id },
          update: {},
        });
      else
        await tx.channelModerator.deleteMany({
          where: { streamId, userId: target.id },
        });
      await tx.auditEvent.create({
        data: auditData(
          user,
          method === "POST" ? "moderator.add" : "moderator.remove",
          target.username,
          streamId,
        ),
      });
    });
    return json({ updated: true });
  }
  if (route === "admin/reports" && method === "GET") {
    const status = request.nextUrl.searchParams.get("status") || "open";
    if (!["open", "reviewing", "resolved", "dismissed"].includes(status))
      throw new ApiError(400, "VALIDATION", "Estado no válido.");
    const rows = await prisma.report.findMany({
      where: { status },
      orderBy: { id: "desc" },
      take: 100,
    });
    const [channels, reporters] = await Promise.all([
      prisma.stream.findMany({
        where: { id: { in: rows.map((r) => r.streamId) } },
        select: { id: true, slug: true, title: true },
      }),
      prisma.user.findMany({
        where: { id: { in: rows.map((r) => r.reporterId) } },
        select: { id: true, username: true },
      }),
    ]);
    return json(
      rows.map((r) => ({
        ...r,
        channel: channels.find((c) => c.id === r.streamId) ?? null,
        reporter:
          reporters.find((u) => u.id === r.reporterId)?.username ??
          "Cuenta eliminada",
      })),
    );
  }
  if (route === "admin/reports" && method === "PATCH") {
    const data = await body(request),
      id = positiveId(data.id),
      status = text(data, "status", 4, 12),
      resolution = text(data, "resolution", 3, 1500);
    if (!["reviewing", "resolved", "dismissed"].includes(status))
      throw new ApiError(400, "VALIDATION", "Estado no válido.");
    if (!(await prisma.report.findUnique({ where: { id } })))
      throw new ApiError(404, "NOT_FOUND", "Denuncia no encontrada.");
    await rateLimit(`admin-reports:${user.id}`, 30, 60);
    const [report] = await prisma.$transaction([
      prisma.report.update({ where: { id }, data: { status, resolution } }),
      prisma.auditEvent.create({
        data: auditData(
          user,
          "report.status",
          `#${id}: ${status}; ${resolution}`,
        ),
      }),
    ]);
    return json(report);
  }
  if (route === "admin/settings") {
    if (!admin)
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Solo administración puede cambiar la configuración global.",
      );
    if (method === "GET") return json(await platformSettings());
    if (method === "PATCH") {
      const data = await body(request),
        announcement = text(data, "announcement", 0, 500);
      if (typeof data.registrationOpen !== "boolean")
        throw new ApiError(400, "VALIDATION", "Estado de registro no válido.");
      const settings = {
        announcement,
        registrationOpen: data.registrationOpen,
      };
      await rateLimit(`admin-settings:${user.id}`, 20, 300);
      const [result] = await prisma.$transaction([
        prisma.platformSettings.upsert({
          where: { id: "main" },
          create: { id: "main", ...settings },
          update: settings,
        }),
        prisma.auditEvent.create({
          data: auditData(
            user,
            "platform.settings",
            `Registro ${settings.registrationOpen ? "abierto" : "cerrado"}; anuncio actualizado`,
          ),
        }),
      ]);
      return json(result);
    }
  }
  return null;
}
