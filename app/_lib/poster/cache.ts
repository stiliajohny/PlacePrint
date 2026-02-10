import { promises as fs } from "node:fs";
import path from "node:path";

import { CACHE_DIR } from "@/app/_lib/poster/constants";

function cacheSafeKey(key: string): string {
  return key.replace(/[\\/\s]+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function cachePath(key: string, ext: string): string {
  return path.join(CACHE_DIR, `${cacheSafeKey(key)}.${ext}`);
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

export async function cacheGetJson<T>(key: string): Promise<T | undefined> {
  try {
    const filePath = cachePath(key, "json");
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
}

export async function cacheSetJson(key: string, value: unknown): Promise<void> {
  await ensureCacheDir();
  const filePath = cachePath(key, "json");
  await fs.writeFile(filePath, JSON.stringify(value), "utf8");
}

export async function cacheGetBuffer(key: string, ext = "bin"): Promise<Buffer | undefined> {
  try {
    const filePath = cachePath(key, ext);
    return await fs.readFile(filePath);
  } catch {
    return undefined;
  }
}

export async function cacheSetBuffer(key: string, data: Buffer, ext = "bin"): Promise<void> {
  await ensureCacheDir();
  const filePath = cachePath(key, ext);
  await fs.writeFile(filePath, data);
}

export async function ensurePosterDirs(dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}
