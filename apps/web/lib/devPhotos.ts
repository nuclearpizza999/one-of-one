import { readdir, stat } from "node:fs/promises";
import path from "node:path";

/** A plain JPEG file name: no slashes, no spaces. */
export const PHOTO_NAME = /^[\w.-]+\.(jpe?g)$/i;

/** The folder of local test photos: DEV_PHOTOS_DIR, else dev-photos/ at the repo root (two levels above apps/web). */
export function devPhotosDir(): string {
  return process.env.DEV_PHOTOS_DIR ?? path.resolve(process.cwd(), "..", "..", "dev-photos");
}

/** JPEG names in the folder, sorted; empty when the folder does not exist. */
export async function listDevPhotos(dir = devPhotosDir()): Promise<string[]> {
  try {
    const names = await readdir(dir);
    return names.filter((n) => PHOTO_NAME.test(n)).sort();
  } catch {
    return [];
  }
}

/** The absolute path of one photo, or null unless the name is a plain JPEG name that resolves to a file inside the folder. */
export async function resolveDevPhoto(name: string, dir = devPhotosDir()): Promise<string | null> {
  if (!PHOTO_NAME.test(name)) return null;
  const root = path.resolve(dir);
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) return null;
  try {
    return (await stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}
