import { NextResponse } from "next/server";
import { listDevPhotos } from "@/lib/devPhotos";

export const dynamic = "force-dynamic";

/** Development only: the JPEG names in the local test-photo folder. */
export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  return NextResponse.json({ photos: await listDevPhotos() }, { headers: { "Cache-Control": "no-store" } });
}
