import { TEXTURES, TIERS, type Texture, type Tier } from "@one-of-one/card";
import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";
import type { Fixture } from "./DevCard";

export const dynamic = "force-dynamic";

const DevCard =
  process.env.NODE_ENV === "production" ? null : nextDynamic(() => import("./DevCard").then((m) => m.DevCard));

const FIXTURES: readonly Fixture[] = ["portrait", "landscape", "square"];

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Dev-only: renders the DOM card and the PNG side by side for e2e/equivalence.spec.ts. */
export default async function DevCardPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (process.env.NODE_ENV === "production" || !DevCard) notFound();
  const q = await searchParams;
  const fixture = FIXTURES.find((f) => f === one(q.fixture)) ?? "portrait";
  const parsed = Number.parseInt(one(q.number) ?? "", 10);
  const number = Number.isNaN(parsed) ? 3 : parsed === 0 ? null : parsed;
  const texture = (Object.keys(TEXTURES) as Texture[]).find((t) => t === one(q.texture)) ?? null;
  const tier = (Object.keys(TIERS) as Tier[]).find((t) => t === one(q.tier)) ?? "fine";
  return (
    <DevCard
      fixture={fixture}
      coords={one(q.coords) !== "0"}
      number={number}
      longPlace={one(q.place) === "long"}
      drift={one(q.drift) === "1"}
      texture={texture}
      tier={tier}
      driftBorder={one(q.driftBorder) === "1"}
    />
  );
}
