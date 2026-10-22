import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { ApiError, body, json, positiveId, rateLimit } from "./api";
import { requireUser } from "./auth";

// Called by authenticated video-worker polling only. A short reconnect is one broadcast.
export async function recordLiveChannels(streamIds: number[], now = new Date()) {
  if (!streamIds.length) return;
  await prisma.$transaction(async tx => {
    const channels = await tx.stream.findMany({ where: { id: { in: streamIds }, isDemo: false, isSuspended: false, owner: { status: "active" } }, select: { id: true, ownerId: true, title: true, liveState: true } });
    for (const channel of channels) {
      const state = channel.liveState;
      if (state && now.getTime() - state.lastSeenAt.getTime() < 10_000) continue;
      const fresh = !state || now.getTime() - state.lastSeenAt.getTime() > 60_000;
      await tx.liveState.upsert({ where: { streamId: channel.id }, create: { streamId: channel.id, lastSeenAt: now, startedAt: now }, update: { lastSeenAt: now, ...(fresh ? { startedAt: now } : {}) } });
      if (!fresh) continue;
      const followers = await tx.follow.findMany({ where: { streamId: channel.id, notifyLive: true, userId: { not: channel.ownerId }, user: { status: "active" } }, select: { userId: true } });
      // Batches avoid SQLite parameter limits; unique index prevents duplicate deliveries.
      for (let offset = 0; offset < followers.length; offset += 100)
        await tx.liveNotification.createMany({ data: followers.slice(offset, offset + 100).map(f => ({ userId: f.userId, streamId: channel.id, startedAt: now, title: channel.title })) });
    }
    await tx.liveNotification.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - 30 * 86400000) } } });
  });
}
export async function handleNotifications(request: NextRequest, path: string[]) {
  if (path[0] !== "notifications") return null;
  const user = await requireUser(request), route = path.join("/");
  if (route === "notifications" && request.method === "GET") {
    const before = request.nextUrl.searchParams.get("before");
    const where = { userId: user.id, startedAt: { gte: new Date(Date.now() - 30 * 86400000) }, stream: { isSuspended: false, isDemo: false, owner: { status: "active" } } };
    const [items, unread] = await Promise.all([
      prisma.liveNotification.findMany({ where: { ...where, ...(before ? { id: { lt: positiveId(Number(before)) } } : {}) }, orderBy: { id: "desc" }, take: 51, select: { id: true, title: true, startedAt: true, readAt: true, stream: { select: { slug: true, owner: { select: { username: true } } } } } }),
      prisma.liveNotification.count({ where: { ...where, readAt: null } }),
    ]);
    return json({ items: items.slice(0, 50), unread, next: items.length > 50 ? items[49].id : null });
  }
  if (route === "notifications/preferences" && request.method === "GET") {
    const after = request.nextUrl.searchParams.get("after");
    const items = await prisma.follow.findMany({ where: { userId: user.id, ...(after ? { streamId: { gt: positiveId(Number(after)) } } : {}) }, take: 51, orderBy: { streamId: "asc" }, select: { streamId: true, notifyLive: true, stream: { select: { slug: true, owner: { select: { username: true } } } } } });
    return json({ items: items.slice(0, 50), next: items.length > 50 ? items[49].streamId : null });
  }
  if (route === "notifications/preferences" && request.method === "PATCH") {
    await rateLimit(`notification-preferences:${user.id}`, 60, 60);
    const data = await body(request), streamId = positiveId(data.streamId);
    if (typeof data.notifyLive !== "boolean") throw new ApiError(400, "VALIDATION", "Preferencia no válida.");
    const changed = await prisma.follow.updateMany({ where: { userId: user.id, streamId }, data: { notifyLive: data.notifyLive } });
    if (!changed.count) throw new ApiError(404, "NOT_FOUND", "Primero sigue este canal.");
    return json({ updated: true });
  }
  if (route === "notifications/read" && request.method === "POST") {
    await rateLimit(`notification-read:${user.id}`, 60, 60);
    const data = await body(request);
    const through = positiveId(data.through);
    await prisma.liveNotification.updateMany({ where: { userId: user.id, id: { lte: through }, readAt: null }, data: { readAt: new Date() } });
    return json({ read: true });
  }
  throw new ApiError(405, "METHOD_NOT_ALLOWED", "Acción no disponible.");
}
