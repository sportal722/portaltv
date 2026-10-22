import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { channelCategories, images } from "./catalog";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function fail(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "El email o nombre de usuario ya está registrado.",
        },
      },
      { status: 409 },
    );
  // Do not log request bodies, credentials or database errors.
  console.error("NEXORA API: operación no completada");
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "No se pudo completar la operación. Inténtalo de nuevo.",
      },
    },
    { status: 500 },
  );
}
export function appOrigin(request: NextRequest) {
  const configured = process.env.APP_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.NODE_ENV === "production")
    throw new ApiError(
      503,
      "CONFIGURATION",
      "Falta configurar APP_URL en el servidor.",
    );
  return request.nextUrl.origin;
}
export function guardOrigin(request: NextRequest) {
  if (request.headers.get("origin") !== appOrigin(request))
    throw new ApiError(
      403,
      "ORIGIN",
      "El origen de la petición no está permitido.",
    );
}
export async function body(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new ApiError(415, "CONTENT_TYPE", "Usa application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_JSON", "Falta el cuerpo JSON.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new ApiError(
          413,
          "PAYLOAD_TOO_LARGE",
          "La petición es demasiado grande.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error();
    return data as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "El cuerpo JSON no es válido.");
  }
}
export function text(
  data: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
) {
  const value = data[key];
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new ApiError(
      400,
      "VALIDATION",
      `${key}: debe tener entre ${min} y ${max} caracteres.`,
    );
  return value.trim();
}
export function positiveId(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new ApiError(400, "VALIDATION", "Identificador no válido.");
  return value;
}
export function streamInput(data: Record<string, unknown>) {
  const title = text(data, "title", 3, 100);
  const category = text(data, "category", 2, 30);
  if (!channelCategories.some((c) => c === category))
    throw new ApiError(400, "VALIDATION", "Categoría no válida.");
  const game = data.game === undefined ? category : text(data, "game", 2, 60);
  const image =
    data.image === undefined ? "channel" : text(data, "image", 2, 30);
  if (!images.some((i) => i === image))
    throw new ApiError(400, "VALIDATION", "Imagen no válida.");
  if (
    data.status !== undefined ||
    data.ownerId !== undefined ||
    data.isDemo !== undefined ||
    data.viewers !== undefined
  )
    throw new ApiError(
      400,
      "VALIDATION",
      "El estado, la identidad y los espectadores se gestionan en el servidor.",
    );
  const description =
    data.description === undefined ? "" : text(data, "description", 0, 1000);
  const language =
    data.language === undefined ? "Español" : text(data, "language", 2, 30);
  const tag = data.tag === undefined ? "Comunidad" : text(data, "tag", 0, 100);
  const thumbnailUrl =
    data.thumbnailUrl === undefined ? "" : text(data, "thumbnailUrl", 0, 1000);
  if (thumbnailUrl) {
    let url: URL;
    try {
      url = new URL(thumbnailUrl);
    } catch {
      throw new ApiError(
        400,
        "VALIDATION",
        "La miniatura debe ser una URL HTTPS.",
      );
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new ApiError(
        400,
        "VALIDATION",
        "La miniatura debe ser una URL HTTPS pública sin credenciales.",
      );
  }
  return {
    title,
    category,
    game,
    image,
    description,
    language,
    tag,
    thumbnailUrl,
  };
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const now = new Date();
  await prisma.rateLimit.deleteMany({ where: { expiresAt: { lte: now } } });
  const entry = await prisma.rateLimit.upsert({
    where: { key },
    create: {
      key,
      count: 1,
      expiresAt: new Date(now.getTime() + seconds * 1000),
    },
    update: { count: { increment: 1 } },
  });
  if (entry.count > limit)
    throw new ApiError(
      429,
      "RATE_LIMIT",
      "Has realizado demasiados intentos. Espera unos minutos.",
    );
}
export const publicUserSelect = {
  id: true,
  username: true,
  role: true,
  status: true,
} as const;
export const streamInclude = {
  owner: { select: { username: true } },
  _count: { select: { follows: true } },
} as const;
export function serializeStream(
  stream: Prisma.StreamGetPayload<{ include: typeof streamInclude }>,
) {
  const { owner, _count, legacySlug: _legacySlug, ...rest } = stream;
  return {
    ...rest,
    name: owner.username,
    followers: _count.follows,
    viewers: "0",
  };
}
export async function findStream(slug: string) {
  if (!/^[a-z0-9_-]{3,80}$/.test(slug))
    throw new ApiError(400, "VALIDATION", "Canal no válido.");
  const stream = await prisma.stream.findFirst({
    where: { OR: [{ slug }, { legacySlug: slug }] },
    include: streamInclude,
  });
  if (
    !stream ||
    stream.isDemo ||
    (
      await prisma.user.findUnique({
        where: { id: stream.ownerId },
        select: { status: true },
      })
    )?.status === "banned"
  )
    throw new ApiError(404, "NOT_FOUND", "No se encontró el canal.");
  return stream;
}
