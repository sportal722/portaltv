import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  body,
  fail,
  findStream,
  guardOrigin,
  json,
  positiveId,
  publicUserSelect,
  rateLimit,
  serializeStream,
  streamInclude,
  streamInput,
  text,
} from "@/lib/api";
import {
  clearSessionCookie,
  currentUser,
  requireUser,
  revokeSession,
  startSession,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  authorizeVideo,
  keyInfo,
  playback,
  revokeKey,
  revokeUserVideo,
  rotateKey,
  videoConfigured,
  videoJobs,
  withVideo,
} from "@/lib/video";
import { handleCommunity, auditData } from "@/lib/community";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, context: Context) {
  try {
    const { path } = await context.params;
    const route = path.join("/");
    const method = request.method;
    if (route === "video/auth" && method === "POST") {
      await authorizeVideo(await body(request));
      return json({ allowed: true });
    }
    if (route === "video/jobs" && method === "GET")
      return json(await videoJobs(request.headers.get("authorization")));
    if (!["GET", "HEAD"].includes(method)) guardOrigin(request);
    if (route === "health" && method === "GET") {
      await prisma.$queryRaw`SELECT 1`;
      return json({
        status: "ok",
        database: "connected",
        video: videoConfigured() ? "configured" : "not_configured",
      });
    }
    if (route === "auth/me" && method === "GET")
      return json(await currentUser(request));
    if (
      (route === "auth/register" || route === "auth/login") &&
      method === "POST"
    ) {
      await rateLimit("auth:global", 120, 60);
      const data = await body(request);
      const email = text(data, "email", 3, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new ApiError(400, "VALIDATION", "Email no válido.");
      const password = data.password;
      if (
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128
      )
        throw new ApiError(
          400,
          "VALIDATION",
          "La contraseña debe tener entre 12 y 128 caracteres.",
        );
      const emailKey = createHash("sha256").update(email).digest("hex");
      await rateLimit(`auth:${route}:${emailKey}`, 8, 900);
      if (route === "auth/register") {
        await rateLimit("register:global", 60, 3600);
        const username = text(data, "username", 3, 24);
        if (!/^[a-zA-Z0-9_]{3,24}$/.test(username))
          throw new ApiError(
            400,
            "VALIDATION",
            "Usa letras, números y guion bajo en el nombre.",
          );
        const role = data.role ?? "viewer";
        if (role !== "viewer" && role !== "creator")
          throw new ApiError(400, "VALIDATION", "Elige espectador o creador.");
        const user = await prisma.user.create({
          data: {
            email,
            username,
            passwordHash: await hashPassword(password),
            role,
          },
          select: publicUserSelect,
        });
        return await startSession(request, json(user, 201), user.id);
      }
      const user = await prisma.user.findUnique({ where: { email } });
      // Always execute scrypt, including unknown identities, to reduce timing differences.
      const valid = await verifyPassword(
        password,
        user?.passwordHash ??
          `scrypt$00000000000000000000000000000000$${"00".repeat(64)}`,
      );
      if (!user || !valid || user.status === "banned")
        throw new ApiError(
          401,
          "INVALID_CREDENTIALS",
          "Email o contraseña incorrectos.",
        );
      return await startSession(
        request,
        json({
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
        }),
        user.id,
      );
    }
    if (route === "auth/logout" && method === "POST") {
      await revokeSession(request);
      return clearSessionCookie(request, json({ loggedOut: true }));
    }
    const community = await handleCommunity(request, path);
    if (community) return community;
    if (route === "streams" && method === "GET") {
      const query = (request.nextUrl.searchParams.get("q") || "").trim();
      if (query.length > 100)
        throw new ApiError(
          400,
          "VALIDATION",
          "La búsqueda es demasiado larga.",
        );
      const category = request.nextUrl.searchParams.get("category");
      const mine = request.nextUrl.searchParams.get("mine") === "true";
      const user = mine ? await requireUser(request) : null;
      const result = await prisma.stream.findMany({
        where: {
          isDemo: false,
          owner: { status: { not: "banned" } },
          ...(user ? { ownerId: user.id } : {}),
          ...(category ? { category } : {}),
          ...(query
            ? {
                OR: [
                  { title: { contains: query } },
                  { game: { contains: query } },
                  { owner: { username: { contains: query } } },
                ],
              }
            : {}),
        },
        include: streamInclude,
        orderBy: { id: "asc" },
        take: 100,
      });
      return json(await withVideo(result));
    }
    if (route === "streams" && method === "POST") {
      const user = await requireUser(request, ["creator", "admin"]);
      await rateLimit(`streams:${user.id}`, 10, 3600);
      if ((await prisma.stream.count({ where: { ownerId: user.id } })) >= 5)
        throw new ApiError(
          409,
          "CHANNEL_LIMIT",
          "Puedes crear un máximo de cinco canales.",
        );
      const data = streamInput(await body(request));
      const result = await prisma.$transaction(async (tx) => {
        const base = user.username.toLowerCase();
        let slug = base;
        for (
          let number = 2;
          await tx.stream.findFirst({
            where: { OR: [{ slug }, { legacySlug: slug }] },
            select: { id: true },
          });
          number++
        ) {
          slug = `${base}--${number}`;
        }
        return tx.stream.create({
          data: { ...data, ownerId: user.id, slug },
          include: streamInclude,
        });
      });
      return json(serializeStream(result), 201);
    }
    if (path[0] === "streams" && path.length === 2) {
      const stream = await findStream(path[1]);
      if (method === "GET") return json((await withVideo([stream]))[0]);
      if (method === "PATCH") {
        const user = await requireUser(request, ["creator", "admin"]);
        if (stream.ownerId !== user.id && user.role !== "admin")
          throw new ApiError(
            403,
            "FORBIDDEN",
            "Solo el propietario puede editar este canal.",
          );
        const input = await body(request);
        const data = streamInput({
          ...{
            title: stream.title,
            category: stream.category,
            game: stream.game,
            image: stream.image,
            tag: stream.tag,
            description: stream.description,
            language: stream.language,
            thumbnailUrl: stream.thumbnailUrl,
          },
          ...input,
        });
        return json(
          serializeStream(
            await prisma.stream.update({
              where: { id: stream.id },
              data,
              include: streamInclude,
            }),
          ),
        );
      }
    }
    if (
      path[0] === "streams" &&
      path.length === 3 &&
      path[2] === "playback" &&
      method === "GET"
    ) {
      return json(await playback(await findStream(path[1])));
    }
    if (path[0] === "streams" && path.length === 3 && path[2] === "key") {
      const user = await requireUser(request, ["creator", "admin"]);
      const stream = await findStream(path[1]);
      if (stream.ownerId !== user.id || stream.isDemo)
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Solo el propietario puede gestionar la clave de este canal.",
        );
      if (method === "GET") return json(await keyInfo(stream.id));
      if (method === "POST" || method === "DELETE") {
        await rateLimit(`video-key:${user.id}`, 20, 3600);
        return json(
          method === "POST"
            ? await rotateKey(stream.id)
            : await revokeKey(stream.id),
        );
      }
    }
    if (route === "follows") {
      const user = await requireUser(request);
      if (method === "GET")
        return json(
          (
            await prisma.follow.findMany({
              where: { userId: user.id },
              select: { streamId: true },
            })
          ).map((f) => f.streamId),
        );
      if (method === "POST" || method === "DELETE") {
        const streamId = positiveId((await body(request)).streamId);
        if (
          !(await prisma.stream.findUnique({
            where: { id: streamId },
            select: { id: true },
          }))
        )
          throw new ApiError(404, "NOT_FOUND", "No se encontró el canal.");
        await rateLimit(`follow:${user.id}`, 30, 60);
        await prisma.$transaction(async (tx) => {
          const existing = await tx.follow.findUnique({
            where: { userId_streamId: { userId: user.id, streamId } },
          });
          if (method === "POST" && !existing) {
            await tx.follow.create({ data: { userId: user.id, streamId } });
            const recent = await tx.activityEvent.findFirst({
              where: {
                streamId,
                username: user.username,
                kind: "follow",
                createdAt: { gt: new Date(Date.now() - 86400000) },
              },
            });
            if (!recent)
              await tx.activityEvent.create({
                data: { streamId, kind: "follow", username: user.username },
              });
          } else if (method === "DELETE")
            await tx.follow.deleteMany({
              where: { userId: user.id, streamId },
            });
        });
        return json({ streamId, following: method === "POST" });
      }
    }
    if (route === "admin/users") {
      const admin = await requireUser(request, ["admin"]);
      if (method === "GET")
        return json(
          await prisma.user.findMany({
            select: { ...publicUserSelect, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        );
      if (method === "PATCH") {
        const data = await body(request);
        const id = text(data, "id", 1, 80);
        const status = text(data, "status", 3, 10);
        if (
          !["active", "muted", "banned"].includes(status) ||
          data.role !== undefined
        )
          throw new ApiError(
            400,
            "VALIDATION",
            "Estado no válido. No se pueden asignar roles desde esta API.",
          );
        if (id === admin.id)
          throw new ApiError(
            400,
            "VALIDATION",
            "No puedes modificar tu propio estado.",
          );
        if (
          !(await prisma.user.findUnique({
            where: { id },
            select: { id: true },
          }))
        )
          throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado.");
        const user = await prisma.$transaction(async (tx) => {
          const result = await tx.user.update({
            where: { id },
            data: { status },
            select: publicUserSelect,
          });
          if (status === "banned")
            await tx.session.deleteMany({ where: { userId: id } });
          await tx.auditEvent.create({
            data: auditData(
              admin,
              "user.status",
              `${result.username}: ${status}`,
            ),
          });
          return result;
        });
        const disconnectPending =
          status === "banned" ? await revokeUserVideo(id) : false;
        return json({ ...user, disconnectPending });
      }
    }
    if (route === "clips" && method === "GET") return json([]);
    throw new ApiError(404, "NOT_FOUND", "No se encontró esta ruta o método.");
  } catch (error) {
    return fail(error);
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
