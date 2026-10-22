import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { ApiError, appOrigin, publicUserSelect } from "./api";
export const cookieName = "nexora_session";
const duration = 7 * 24 * 60 * 60;
export function sessionTokenHash(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}
export async function currentUser(request: NextRequest) {
  const hash = sessionTokenHash(request);
  if (!hash) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hash },
    include: { user: { select: publicUserSelect } },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.user.status === "banned"
  )
    return null;
  return session.user;
}
export async function requireUser(request: NextRequest, roles?: string[]) {
  const user = await currentUser(request);
  if (!user)
    throw new ApiError(401, "UNAUTHORIZED", "Inicia sesión para continuar.");
  if (roles && !roles.includes(user.role))
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permisos para esta acción.",
    );
  return user;
}
function cookieOptions(request: NextRequest) {
  const url = new URL(appOrigin(request));
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!loopback && url.protocol !== "https:")
    throw new ApiError(
      503,
      "CONFIGURATION",
      "APP_URL debe usar HTTPS fuera del entorno local.",
    );
  return {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
  };
}
export async function revokeSession(request: NextRequest) {
  const hash = sessionTokenHash(request);
  if (hash) await prisma.session.deleteMany({ where: { tokenHash: hash } });
}
export async function startSession(
  request: NextRequest,
  response: NextResponse,
  userId: string,
) {
  const options = cookieOptions(request);
  const token = randomBytes(32).toString("hex");
  await revokeSession(request);
  await prisma.session.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId,
      userAgent: (request.headers.get("user-agent") || "Dispositivo sin identificar").slice(0, 160),
      expiresAt: new Date(Date.now() + duration * 1000),
    },
  });
  response.cookies.set(cookieName, token, { ...options, maxAge: duration });
  return response;
}
export function clearSessionCookie(
  request: NextRequest,
  response: NextResponse,
) {
  response.cookies.set(cookieName, "", {
    ...cookieOptions(request),
    maxAge: 0,
  });
  return response;
}
