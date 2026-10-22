import { recordLiveChannels } from "./notifications";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { ApiError, serializeStream, streamInclude } from "./api";
import { Prisma } from "@prisma/client";
import {
  mediaOutputs,
  outputUrls,
  processedVideoConfigured,
} from "./media-output";

type Channel = Prisma.StreamGetPayload<{ include: typeof streamInclude }>;
type VideoPath = {
  name: string;
  available: boolean;
  online: boolean;
  source: { type: string; id: string } | null;
};
export function videoConfigured() {
  return !!(
    process.env.MEDIAMTX_API_URL &&
    process.env.MEDIAMTX_API_PASSWORD &&
    process.env.VIDEO_INGEST_URL &&
    process.env.VIDEO_HLS_URL
  );
}
function configured() {
  if (!videoConfigured())
    throw new ApiError(
      503,
      "VIDEO_CONFIGURATION",
      "El servidor de vídeo todavía no está configurado.",
    );
}
async function control(path: string, method = "GET") {
  configured();
  try {
    return await fetch(
      `${process.env.MEDIAMTX_API_URL!.replace(/\/$/, "")}${path}`,
      {
        method,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(3000),
        headers: {
          Authorization: `Basic ${Buffer.from(`nexora-api:${process.env.MEDIAMTX_API_PASSWORD}`).toString("base64")}`,
        },
      },
    );
  } catch {
    throw new ApiError(
      503,
      "VIDEO_UNAVAILABLE",
      "No se pudo conectar con el servidor de vídeo.",
    );
  }
}
export async function videoPaths(): Promise<VideoPath[]> {
  const result: VideoPath[] = [];
  for (let page = 0; page < 100; page++) {
    const response = await control(
      `/v3/paths/list?itemsPerPage=100&page=${page}`,
    );
    if (!response.ok)
      throw new ApiError(
        503,
        "VIDEO_UNAVAILABLE",
        "El servidor de vídeo no está disponible.",
      );
    const data = await response.json();
    if (!Array.isArray(data.items))
      throw new ApiError(
        503,
        "VIDEO_UNAVAILABLE",
        "Respuesta de vídeo no válida.",
      );
    result.push(...data.items);
    if (page + 1 >= data.pageCount) return result;
  }
  throw new ApiError(503, "VIDEO_UNAVAILABLE", "Demasiados canales de vídeo.");
}
export async function withVideo(streams: Channel[]) {
  const result = streams.map(serializeStream);
  if (!videoConfigured())
    return result.map((s) => ({ ...s, status: "offline" }));
  const credentials = await prisma.streamCredential.findMany({
    where: { streamId: { in: streams.map((s) => s.id) } },
    select: { streamId: true, path: true },
  });
  let paths: VideoPath[];
  try {
    paths = await videoPaths();
  } catch {
    return result.map((s) => ({
      ...s,
      status: s.isDemo ? "offline" : "unavailable",
    }));
  }
  const live = new Set(
    paths.filter((p) => p.available && p.online && p.source).map((p) => p.name),
  );
  const outputs = await mediaOutputs();
  return result.map((s) => {
    const credential = credentials.find((c) => c.streamId === s.id);
    const online =
      !s.isDemo && !s.isSuspended && !!credential && live.has(credential.path);
    return {
      ...s,
      status: online ? "live" : "offline",
      liveThumbnailUrl:
        online && credential
          ? (outputUrls(credential.path, outputs[credential.path])
              ?.thumbnailUrl ?? null)
          : null,
    };
  });
}
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function matches(value: unknown, expected: string) {
  return (
    typeof value === "string" &&
    timingSafeEqual(
      Buffer.from(hash(value), "hex"),
      Buffer.from(expected, "hex"),
    )
  );
}
// This public callback only validates credentials. It never changes channel state.
// Origin cookies are intentionally unused: MediaMTX is a server-to-server client.
export async function authorizeVideo(data: Record<string, unknown>) {
  configured();
  if (data.action === "api") {
    if (
      data.user === "nexora-api" &&
      matches(data.password, hash(process.env.MEDIAMTX_API_PASSWORD!))
    )
      return;
  } else if (
    (data.action === "publish" || data.action === "read") &&
    typeof data.path === "string" &&
    /^live\/[a-f0-9]{32}$/.test(data.path)
  ) {
    const credential = await prisma.streamCredential.findUnique({
      where: { path: data.path },
      include: { stream: { include: { owner: { select: { status: true } } } } },
    });
    if (
      credential &&
      !credential.stream.isDemo &&
      !credential.stream.isSuspended &&
      credential.stream.owner.status !== "banned"
    ) {
      if (data.action === "read" && data.protocol === "hls") return;
      if (
        data.action === "read" &&
        data.protocol === "rtsp" &&
        data.user === "nexora-api" &&
        matches(data.password, hash(process.env.MEDIAMTX_API_PASSWORD!))
      )
        return;
      if (
        data.action === "publish" &&
        data.protocol === "rtmp" &&
        data.user === "publisher" &&
        matches(data.password, credential.keyHash)
      )
        return;
    }
  }
  throw new ApiError(403, "VIDEO_FORBIDDEN", "Acceso de vídeo denegado.");
}
function connection() {
  configured();
  return { server: process.env.VIDEO_INGEST_URL!.replace(/\/$/, "") };
}
export async function keyInfo(streamId: number) {
  const { server } = connection();
  const credential = await prisma.streamCredential.findUnique({
    where: { streamId },
    select: { updatedAt: true },
  });
  return {
    server,
    hasKey: !!credential,
    updatedAt: credential?.updatedAt ?? null,
  };
}
async function disconnect(path: string | undefined) {
  if (!path) return false;
  try {
    const source = (await videoPaths()).find((p) => p.name === path)?.source;
    if (!source) return false;
    const endpoints: Record<string, string> = {
      rtmpConn: "rtmp/conns",
      rtmpsConn: "rtmps/conns",
    };
    const endpoint = endpoints[source.type];
    if (!endpoint) return true;
    const response = await control(
      `/v3/${endpoint}/kick/${encodeURIComponent(source.id)}`,
      "POST",
    );
    // A vanished connection is already disconnected.
    return !response.ok && response.status !== 404;
  } catch {
    return true;
  }
}
export async function rotateKey(streamId: number) {
  const { server } = connection();
  const key = randomBytes(32).toString("base64url");
  const path = `live/${randomBytes(16).toString("hex")}`;
  const previous = await prisma.$transaction(async (tx) => {
    const previous = await tx.streamCredential.findUnique({
      where: { streamId },
    });
    await tx.streamCredential.upsert({
      where: { streamId },
      create: { streamId, path, keyHash: hash(key) },
      update: { path, keyHash: hash(key) },
    });
    return previous;
  });
  const disconnectPending = await disconnect(previous?.path);
  return {
    server,
    streamKey: `${path.slice(5)}?user=publisher&pass=${key}`,
    hasKey: true,
    disconnectPending,
  };
}
export async function revokeKey(streamId: number) {
  configured();
  const previous = await prisma.$transaction(async (tx) => {
    const previous = await tx.streamCredential.findUnique({
      where: { streamId },
    });
    await tx.streamCredential.deleteMany({ where: { streamId } });
    return previous;
  });
  return { hasKey: false, disconnectPending: await disconnect(previous?.path) };
}
export async function disconnectVideoPaths(paths: string[]) {
  return (await Promise.all(paths.map(path => disconnect(path)))).some(Boolean);
}
export async function revokeUserVideo(ownerId: string) {
  const credentials = await prisma.streamCredential.findMany({
    where: { stream: { ownerId } },
  });
  await prisma.streamCredential.deleteMany({ where: { stream: { ownerId } } });
  return (await Promise.all(credentials.map((c) => disconnect(c.path)))).some(
    Boolean,
  );
}
export async function playback(stream: Channel) {
  if (stream.isDemo || stream.isSuspended || !videoConfigured())
    return { status: "offline", url: null };
  const credential = await prisma.streamCredential.findUnique({
    where: { streamId: stream.id },
  });
  if (!credential) return { status: "offline", url: null };
  const live = (await videoPaths()).some(
    (p) => p.name === credential.path && p.available && p.online && p.source,
  );
  if (live && processedVideoConfigured()) {
    const output = (await mediaOutputs())[credential.path];
    const urls = outputUrls(credential.path, output);
    return urls
      ? { status: "live", ...urls }
      : {
          status: output?.state === "capacity" ? "capacity" : "processing",
          url: null,
          dashUrl: null,
        };
  }
  return {
    status: live ? "live" : "offline",
    url: live
      ? `${process.env.VIDEO_HLS_URL!.replace(/\/$/, "")}/${credential.path}/index.m3u8`
      : null,
  };
}
// Private worker polling: current credentials only, including immediate revocation/suspension.
export async function videoJobs(authorization: string | null) {
  configured();
  if (
    !authorization?.startsWith("Bearer ") ||
    !matches(authorization.slice(7), hash(process.env.MEDIAMTX_API_PASSWORD!))
  )
    throw new ApiError(403, "VIDEO_FORBIDDEN", "Acceso de vídeo denegado.");
  const credentials = await prisma.streamCredential.findMany({
    where: {
      stream: {
        isDemo: false,
        isSuspended: false,
        owner: { status: { not: "banned" } },
      },
    },
    select: { path: true, streamId: true },
  });
  const paths = new Set(
    (await videoPaths())
      .filter((p) => p.available && p.online && p.source)
      .map((p) => p.name),
  );
  const live = credentials.filter((c) => paths.has(c.path));
  try {
    await recordLiveChannels(live.map(c => c.streamId));
  } catch {
    // Notification storage must not interrupt video processing; next poll retries.
    console.error("Live notification delivery failed; pending retry");
  }
  return live.map(({ path }) => ({ path }));
}
