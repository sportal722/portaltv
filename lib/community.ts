import { createHash, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import {
  ApiError,
  body,
  findStream,
  json,
  positiveId,
  rateLimit,
  streamInclude,
  text,
} from "./api";
import { currentUser, requireUser } from "./auth";
import { withVideo } from "./video";

type Channel = Awaited<ReturnType<typeof findStream>>;
type Account = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
export async function canModerate(user: Account | null, stream: Channel) {
  return (
    !!user &&
    user.status === "active" &&
    (user.id === stream.ownerId ||
      ["admin", "moderator"].includes(user.role) ||
      !!(await prisma.channelModerator.findUnique({
        where: { streamId_userId: { streamId: stream.id, userId: user.id } },
      })))
  );
}
async function moderator(request: NextRequest, stream: Channel) {
  const user = await requireUser(request);
  if (!(await canModerate(user, stream)))
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No formas parte del equipo de este canal.",
    );
  return user;
}
async function owner(request: NextRequest, stream: Channel) {
  const user = await requireUser(request);
  if (user.id !== stream.ownerId || user.status !== "active")
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Solo el propietario puede gestionar esta sección.",
    );
  return user;
}
function integer(
  data: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
) {
  const value = data[key];
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new ApiError(
      400,
      "VALIDATION",
      `${key}: introduce un entero entre ${min} y ${max}.`,
    );
  return value;
}
function boolean(data: Record<string, unknown>, key: string) {
  if (typeof data[key] !== "boolean")
    throw new ApiError(400, "VALIDATION", `${key}: valor no válido.`);
  return data[key] as boolean;
}
export function auditData(
  user: Account,
  action: string,
  target: string,
  streamId?: number,
) {
  return {
    actorId: user.id,
    actorName: user.username,
    action,
    target,
    streamId,
  };
}
const defaults = {
  slowSeconds: 0,
  followersOnly: false,
  blockLinks: false,
  blockedWords: "",
};
const alertDefaults = {
  followersEnabled: true,
  template: "¡Gracias por seguir el canal, {user}!",
  accent: "#a78bfa",
  durationSeconds: 6,
  soundEnabled: false,
};
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export async function chatSnapshot(
  request: NextRequest,
  stream: Channel,
  scope: string,
) {
  const user = await currentUser(request);
  const staff = await canModerate(user, stream);
  if (scope === "staff" && !staff)
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Este chat es privado para el equipo del canal.",
    );
  const mods = await prisma.channelModerator.findMany({
    where: { streamId: stream.id },
    select: { userId: true },
  });
  const messages = await prisma.chatMessage.findMany({
    where: { streamId: stream.id, scope },
    orderBy: { id: "desc" },
    take: 100,
    include: { user: { select: { username: true, role: true } } },
  });
  return messages.reverse().map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.isBot ? "NEXORA" : m.user.username,
    text: m.text,
    createdAt: m.createdAt,
    isBot: m.isBot,
    role: m.isBot
      ? "bot"
      : m.userId === stream.ownerId
        ? "streamer"
        : m.user.role === "admin"
          ? "admin"
          : m.user.role === "moderator" ||
              mods.some((x) => x.userId === m.userId)
            ? "moderator"
            : "viewer",
  }));
}
export async function handleCommunity(request: NextRequest, path: string[]) {
  const route = path.join("/"),
    method = request.method;
  if (route === "account/creator" && method === "POST") {
    const user = await requireUser(request);
    if (user.status !== "active")
      throw new ApiError(403, "FORBIDDEN", "La cuenta debe estar activa.");
    if (user.role === "viewer")
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "creator" },
      });
    return json({ enabled: true });
  }
  if (route === "moderation" && method === "GET") {
    const user = await requireUser(request);
    const streams = await prisma.stream.findMany({
      where: {
        isDemo: false,
        owner: { status: { not: "banned" } },
        OR: [
          { ownerId: user.id },
          { moderators: { some: { userId: user.id } } },
          ...(["admin", "moderator"].includes(user.role) ? [{}] : []),
        ],
      },
      include: streamInclude,
      take: 100,
    });
    return json(await withVideo(streams));
  }
  if (route === "admin/audit" && method === "GET") {
    await requireUser(request, ["admin", "moderator"]);
    return json(
      await prisma.auditEvent.findMany({ orderBy: { id: "desc" }, take: 100 }),
    );
  }
  if (
    path[0] !== "streams" ||
    path.length < 3 ||
    ![
      "dashboard",
      "moderators",
      "bans",
      "chat-settings",
      "commands",
      "alerts",
      "overlay-key",
      "overlay-events",
      "alert-test",
      "chat",
      "staff-chat",
    ].includes(path[2])
  )
    return null;
  const stream = await findStream(path[1]);
  const area = path[2];
  if (area === "dashboard" && method === "GET") {
    const user = await moderator(request, stream);
    const [
      channels,
      activities,
      audit,
      settings,
      bans,
      moderators,
      messageCount,
    ] = await Promise.all([
      withVideo([stream]),
      prisma.activityEvent.findMany({
        where: { streamId: stream.id },
        orderBy: { id: "desc" },
        take: 30,
      }),
      prisma.auditEvent.findMany({
        where: { streamId: stream.id },
        orderBy: { id: "desc" },
        take: 50,
      }),
      prisma.chatSettings.findUnique({ where: { streamId: stream.id } }),
      prisma.channelBan.findMany({
        where: {
          streamId: stream.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { user: { select: { username: true } } },
      }),
      prisma.channelModerator.findMany({
        where: { streamId: stream.id },
        include: { user: { select: { username: true } } },
      }),
      prisma.chatMessage.count({
        where: { streamId: stream.id, scope: "public", isBot: false },
      }),
    ]);
    return json({
      stream: channels[0],
      isOwner: user.id === stream.ownerId,
      activities,
      audit,
      settings: settings ?? defaults,
      bans,
      moderators,
      messageCount,
    });
  }
  if (area === "moderators") {
    const user = await owner(request, stream);
    if (method === "POST" || method === "DELETE") {
      const username = text(await body(request), "username", 3, 24);
      const target = await prisma.user.findUnique({ where: { username } });
      if (!target || target.status !== "active")
        throw new ApiError(
          404,
          "NOT_FOUND",
          "No se encontró una cuenta activa con ese nombre exacto.",
        );
      if (target.id === user.id || ["admin", "moderator"].includes(target.role))
        throw new ApiError(
          400,
          "VALIDATION",
          "Esta cuenta ya tiene permisos de gestión.",
        );
      await prisma.$transaction(async (tx) => {
        if (method === "POST") {
          await tx.channelBan.deleteMany({
            where: { streamId: stream.id, userId: target.id },
          });
          await tx.channelModerator.upsert({
            where: {
              streamId_userId: { streamId: stream.id, userId: target.id },
            },
            create: { streamId: stream.id, userId: target.id },
            update: {},
          });
        } else
          await tx.channelModerator.deleteMany({
            where: { streamId: stream.id, userId: target.id },
          });
        await tx.auditEvent.create({
          data: auditData(
            user,
            method === "POST" ? "moderator.add" : "moderator.remove",
            username,
            stream.id,
          ),
        });
      });
      return json({ saved: true });
    }
  }
  if (area === "bans") {
    const user = await moderator(request, stream);
    if (method === "POST" || method === "DELETE") {
      const data = await body(request),
        username = text(data, "username", 3, 24);
      const target = await prisma.user.findUnique({ where: { username } });
      if (!target)
        throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado.");
      if (
        target.id === stream.ownerId ||
        ["admin", "moderator"].includes(target.role) ||
        (await canModerate(target, stream))
      )
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Retira primero el rol del equipo; no puedes sancionar al propietario o a un administrador.",
        );
      const reason = method === "POST" ? text(data, "reason", 3, 200) : "";
      const minutes =
        method === "POST" ? integer(data, "minutes", 0, 43200) : 0;
      await prisma.$transaction(async (tx) => {
        if (method === "POST")
          await tx.channelBan.upsert({
            where: {
              streamId_userId: { streamId: stream.id, userId: target.id },
            },
            create: {
              streamId: stream.id,
              userId: target.id,
              reason,
              expiresAt: minutes
                ? new Date(Date.now() + minutes * 60000)
                : null,
            },
            update: {
              reason,
              expiresAt: minutes
                ? new Date(Date.now() + minutes * 60000)
                : null,
            },
          });
        else
          await tx.channelBan.deleteMany({
            where: { streamId: stream.id, userId: target.id },
          });
        await tx.auditEvent.create({
          data: auditData(
            user,
            method === "POST" ? "chat.ban" : "chat.unban",
            `${username}${reason ? `: ${reason}` : ""}`,
            stream.id,
          ),
        });
      });
      return json({ saved: true });
    }
  }
  if (area === "chat-settings") {
    const user = await moderator(request, stream);
    if (method === "PATCH") {
      const data = await body(request);
      const values = {
        slowSeconds: integer(data, "slowSeconds", 0, 300),
        followersOnly: boolean(data, "followersOnly"),
        blockLinks: boolean(data, "blockLinks"),
        blockedWords: text(data, "blockedWords", 0, 2000),
      };
      await prisma.$transaction([
        prisma.chatSettings.upsert({
          where: { streamId: stream.id },
          create: { streamId: stream.id, ...values },
          update: values,
        }),
        prisma.auditEvent.create({
          data: auditData(
            user,
            "chat.settings",
            "Reglas actualizadas",
            stream.id,
          ),
        }),
      ]);
      return json(values);
    }
  }
  if (area === "commands") {
    const user = await owner(request, stream);
    if (method === "GET")
      return json(
        await prisma.chatCommand.findMany({
          where: { streamId: stream.id },
          orderBy: { name: "asc" },
        }),
      );
    if (method === "POST" || method === "DELETE") {
      const data = await body(request),
        name = text(data, "name", 1, 24).toLowerCase().replace(/^!/, "");
      if (!/^[a-z0-9_]{1,23}$/.test(name))
        throw new ApiError(
          400,
          "VALIDATION",
          "Comando: usa letras, números o guion bajo.",
        );
      await prisma.$transaction(async (tx) => {
        if (method === "DELETE")
          await tx.chatCommand.deleteMany({
            where: { streamId: stream.id, name },
          });
        else {
          if (
            (await tx.chatCommand.count({ where: { streamId: stream.id } })) >=
              100 &&
            !(await tx.chatCommand.findUnique({
              where: { streamId_name: { streamId: stream.id, name } },
            }))
          )
            throw new ApiError(409, "LIMIT", "Máximo 100 comandos por canal.");
          const values = {
            response: text(data, "response", 1, 300),
            cooldownSeconds: integer(data, "cooldownSeconds", 5, 3600),
            moderatorsOnly: boolean(data, "moderatorsOnly"),
            enabled: boolean(data, "enabled"),
          };
          await tx.chatCommand.upsert({
            where: { streamId_name: { streamId: stream.id, name } },
            create: { streamId: stream.id, name, ...values },
            update: values,
          });
        }
        await tx.auditEvent.create({
          data: auditData(
            user,
            method === "POST" ? "command.save" : "command.delete",
            name,
            stream.id,
          ),
        });
      });
      return json({ saved: true });
    }
  }
  if (area === "alerts") {
    const user = await owner(request, stream);
    if (method === "GET") {
      const settings = await prisma.alertSettings.findUnique({
        where: { streamId: stream.id },
      });
      const { tokenHash, ...safe } = settings ?? {
        ...alertDefaults,
        tokenHash: null,
      };
      return json({ ...safe, hasOverlayKey: !!tokenHash });
    }
    if (method === "PATCH") {
      const data = await body(request);
      const values = {
        followersEnabled: boolean(data, "followersEnabled"),
        template: text(data, "template", 1, 180),
        accent: text(data, "accent", 7, 7),
        durationSeconds: integer(data, "durationSeconds", 3, 20),
        soundEnabled: boolean(data, "soundEnabled"),
      };
      if (!/^#[a-f0-9]{6}$/i.test(values.accent))
        throw new ApiError(400, "VALIDATION", "Color no válido.");
      await prisma.$transaction([
        prisma.alertSettings.upsert({
          where: { streamId: stream.id },
          create: { streamId: stream.id, ...values },
          update: values,
        }),
        prisma.auditEvent.create({
          data: auditData(
            user,
            "alerts.settings",
            "Alertas actualizadas",
            stream.id,
          ),
        }),
      ]);
      return json(values);
    }
  }
  if (area === "overlay-key" && (method === "POST" || method === "DELETE")) {
    const user = await owner(request, stream);
    await rateLimit(`overlay-key:${user.id}`, 20, 3600);
    const token = method === "POST" ? randomBytes(32).toString("hex") : null;
    await prisma.$transaction([
      prisma.alertSettings.upsert({
        where: { streamId: stream.id },
        create: { streamId: stream.id, tokenHash: token ? hash(token) : null },
        update: { tokenHash: token ? hash(token) : null },
      }),
      prisma.auditEvent.create({
        data: auditData(
          user,
          "alerts.key",
          method === "POST" ? "Renovada" : "Revocada",
          stream.id,
        ),
      }),
    ]);
    return json({ token });
  }
  if (area === "alert-test" && method === "POST") {
    const user = await owner(request, stream);
    await rateLimit(`alert-test:${user.id}`, 10, 60);
    await prisma.activityEvent.create({
      data: { streamId: stream.id, kind: "test", username: user.username },
    });
    return json({ sent: true });
  }
  if (area === "overlay-events" && method === "GET") {
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const settings = await prisma.alertSettings.findUnique({
      where: { streamId: stream.id },
    });
    if (
      !/^[a-f0-9]{64}$/.test(token) ||
      !settings?.tokenHash ||
      hash(token) !== settings.tokenHash
    )
      throw new ApiError(
        403,
        "FORBIDDEN",
        "La URL de alertas ha caducado o fue revocada.",
      );
    const after = Number(request.nextUrl.searchParams.get("after") ?? 0);
    if (!Number.isSafeInteger(after) || after < 0)
      throw new ApiError(400, "VALIDATION", "Cursor no válido.");
    const latest = await prisma.activityEvent.findFirst({
      where: { streamId: stream.id },
      orderBy: { id: "desc" },
    });
    const events = request.nextUrl.searchParams.has("after")
      ? await prisma.activityEvent.findMany({
          where: {
            streamId: stream.id,
            id: { gt: after },
            createdAt: { gt: new Date(Date.now() - 60000) },
            kind: {
              in: settings.followersEnabled ? ["follow", "test"] : ["test"],
            },
          },
          orderBy: { id: "asc" },
          take: 20,
        })
      : [];
    return json({
      events,
      cursor: events.at(-1)?.id ?? latest?.id ?? 0,
      settings: {
        template: settings.template,
        accent: settings.accent,
        durationSeconds: settings.durationSeconds,
        soundEnabled: settings.soundEnabled,
      },
    });
  }
  if (area === "chat" || area === "staff-chat") {
    const scope = area === "staff-chat" ? "staff" : "public";
    if (method === "GET" && path.length === 3)
      return json(await chatSnapshot(request, stream, scope));
    const user = await requireUser(request);
    const staff = await canModerate(user, stream);
    if (scope === "staff" && !staff)
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Chat privado del equipo del canal.",
      );
    if (method === "POST" && path.length === 3) {
      if (user.status !== "active")
        throw new ApiError(403, "MUTED", "Tu cuenta no puede enviar mensajes.");
      const message = text(await body(request), "text", 1, 300);
      await rateLimit(`chat:${user.id}`, 10, 10);
      const created = await prisma.$transaction(async (tx) => {
        const settings =
          (await tx.chatSettings.findUnique({
            where: { streamId: stream.id },
          })) ?? defaults;
        if (!staff) {
          const ban = await tx.channelBan.findUnique({
            where: {
              streamId_userId: { streamId: stream.id, userId: user.id },
            },
          });
          if (ban && (!ban.expiresAt || ban.expiresAt > new Date()))
            throw new ApiError(
              403,
              "CHANNEL_BAN",
              ban.expiresAt
                ? "Estás silenciado temporalmente en este canal."
                : "No puedes escribir en este canal.",
            );
          if (
            settings.followersOnly &&
            !(await tx.follow.findUnique({
              where: {
                userId_streamId: { userId: user.id, streamId: stream.id },
              },
            }))
          )
            throw new ApiError(
              403,
              "FOLLOWERS_ONLY",
              "Este chat está reservado a seguidores.",
            );
          if (
            settings.blockLinks &&
            /(?:https?:|www\.|[\p{L}\d-]+\.[a-z]{2,}(?:\b|\/))/iu.test(message)
          )
            throw new ApiError(
              400,
              "MODERATION",
              "Los enlaces están desactivados en este canal.",
            );
          const normalized = message.normalize("NFKC").toLocaleLowerCase();
          if (
            settings.blockedWords
              .split(/\n|,/)
              .map((x) => x.trim().normalize("NFKC").toLocaleLowerCase())
              .filter(Boolean)
              .some((x) => normalized.includes(x))
          )
            throw new ApiError(
              400,
              "MODERATION",
              "El mensaje contiene una palabra bloqueada.",
            );
          const last = await tx.chatMessage.findFirst({
            where: {
              streamId: stream.id,
              userId: user.id,
              isBot: false,
              scope,
            },
            orderBy: { id: "desc" },
          });
          if (
            last &&
            (Date.now() - last.createdAt.getTime() <
              settings.slowSeconds * 1000 ||
              (last.text === message &&
                Date.now() - last.createdAt.getTime() < 10000))
          )
            throw new ApiError(
              429,
              "SLOW_MODE",
              "Espera antes de enviar otro mensaje.",
            );
        }
        const result = await tx.chatMessage.create({
          data: { streamId: stream.id, userId: user.id, text: message, scope },
        });
        if (scope === "public" && /^![a-z0-9_]+$/i.test(message)) {
          const command = await tx.chatCommand.findUnique({
            where: {
              streamId_name: {
                streamId: stream.id,
                name: message.slice(1).toLowerCase(),
              },
            },
          });
          if (command?.enabled && (!command.moderatorsOnly || staff)) {
            const used = await tx.chatCommand.updateMany({
              where: {
                id: command.id,
                OR: [
                  { lastUsedAt: null },
                  {
                    lastUsedAt: {
                      lt: new Date(Date.now() - command.cooldownSeconds * 1000),
                    },
                  },
                ],
              },
              data: { lastUsedAt: new Date() },
            });
            if (used.count)
              await tx.chatMessage.create({
                data: {
                  streamId: stream.id,
                  userId: stream.ownerId,
                  text: command.response
                    .replaceAll("{user}", user.username)
                    .slice(0, 500),
                  isBot: true,
                },
              });
          }
        }
        return result;
      });
      return json({ ...created, name: user.username }, 201);
    }
    if (method === "DELETE" && path.length === 4) {
      const id = positiveId(Number(path[3]));
      const message = await prisma.chatMessage.findFirst({
        where: { id, streamId: stream.id, scope },
      });
      if (!message)
        throw new ApiError(404, "NOT_FOUND", "Mensaje no encontrado.");
      if (!staff && (message.userId !== user.id || message.isBot))
        throw new ApiError(403, "FORBIDDEN", "No puedes borrar este mensaje.");
      await prisma.$transaction([
        prisma.chatMessage.delete({ where: { id } }),
        prisma.auditEvent.create({
          data: auditData(user, "chat.delete", String(id), stream.id),
        }),
      ]);
      return json({ deleted: true });
    }
  }
  throw new ApiError(404, "NOT_FOUND", "Ruta o método no disponible.");
}
