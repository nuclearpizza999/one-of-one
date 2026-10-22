import { noProvider, resolvePlace } from "@one-of-one/places";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function coordinate(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function bad(): NextResponse {
  return NextResponse.json(
    { error: "lat and lng must be numbers within range" },
    { status: 400, headers: NO_STORE },
  );
}

/**
 * Resolves a photo's coordinates to a place. Stores nothing, logs nothing:
 * the coordinates are the owner's and go no further than this process.
 * POST with a JSON body, so the coordinates never appear in a URL or an access log.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad();
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return bad();
  const { lat: rawLat, lng: rawLng } = body as Record<string, unknown>;
  const lat = coordinate(rawLat, -90, 90);
  const lng = coordinate(rawLng, -180, 180);
  if (lat === null || lng === null) return bad();
  const match = await resolvePlace(lat, lng, noProvider);
  return NextResponse.json({ match }, { headers: NO_STORE });
}
