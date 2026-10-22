import { noProvider, resolvePlace } from "@one-of-one/places";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function coordinate(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/**
 * Resolves a photo's coordinates to a place. Stores nothing, logs nothing:
 * the coordinates are the owner's and go no further than this process.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const lat = coordinate(searchParams.get("lat"), -90, 90);
  const lng = coordinate(searchParams.get("lng"), -180, 180);
  if (lat === null || lng === null) {
    return NextResponse.json(
      { error: "lat and lng must be numbers within range" },
      { status: 400, headers: NO_STORE },
    );
  }
  const match = await resolvePlace(lat, lng, noProvider);
  return NextResponse.json({ match }, { headers: NO_STORE });
}
