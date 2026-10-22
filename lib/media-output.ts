import { readFile } from "node:fs/promises";

type Output = {
  state: "ready" | "starting" | "retrying" | "capacity";
  generation?: string;
  updatedAt: number;
  thumbnailAt?: number | null;
};
export function processedVideoConfigured() {
  return !!(process.env.VIDEO_MEDIA_URL && process.env.VIDEO_STATE_FILE);
}
export async function mediaOutputs(): Promise<Record<string, Output>> {
  if (!processedVideoConfigured()) return {};
  try {
    const data = JSON.parse(
      await readFile(process.env.VIDEO_STATE_FILE!, "utf8"),
    );
    if (
      !Number.isFinite(data.updatedAt) ||
      Math.abs(Date.now() - data.updatedAt) > 15000
    )
      return {};
    return data.jobs && typeof data.jobs === "object" ? data.jobs : {};
  } catch {
    return {};
  }
}
export function outputUrls(path: string, output?: Output) {
  if (
    !/^live\/[a-f0-9]{32}$/.test(path) ||
    output?.state !== "ready" ||
    !/^[a-f0-9]{16}$/.test(output.generation ?? "") ||
    !Number.isFinite(output.updatedAt) ||
    Math.abs(Date.now() - output.updatedAt) > 15000
  )
    return null;
  const base = `${process.env.VIDEO_MEDIA_URL!.replace(/\/$/, "")}/${path.slice(5)}/${output.generation}`;
  return {
    url: `${base}/hls/index.m3u8`,
    dashUrl: `${base}/dash/manifest.mpd`,
    thumbnailUrl:
      output.thumbnailAt && Math.abs(Date.now() - output.thumbnailAt) < 30000
        ? `${base}/thumbnail.jpg?v=${output.thumbnailAt}`
        : null,
  };
}

export async function mediaHealth() {
  if (!processedVideoConfigured()) return "not_configured";
  try {
    const data = JSON.parse(
      await readFile(process.env.VIDEO_STATE_FILE!, "utf8"),
    );
    return Number.isFinite(data.updatedAt) &&
      Math.abs(Date.now() - data.updatedAt) < 15000
      ? "healthy"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}
