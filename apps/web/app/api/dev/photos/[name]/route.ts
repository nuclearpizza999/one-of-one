import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveDevPhoto } from "@/lib/devPhotos";

export const dynamic = "force-dynamic";

/** Development only: one JPEG from the local test-photo folder, by plain name. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const { name } = await params;
  const file = await resolveDevPhoto(name);
  if (!file) return new NextResponse(null, { status: 404 });
  const bytes = await readFile(file);
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
}
