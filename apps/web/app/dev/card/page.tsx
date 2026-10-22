import { notFound } from "next/navigation";
import { DevCard, type Fixture } from "./DevCard";

export const dynamic = "force-dynamic";

const FIXTURES: readonly Fixture[] = ["portrait", "landscape", "square"];

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Dev-only: renders the DOM card and the PNG side by side for e2e/equivalence.spec.ts. */
export default async function DevCardPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const fixture = FIXTURES.find((f) => f === one(q.fixture)) ?? "portrait";
  const parsed = Number.parseInt(one(q.number) ?? "", 10);
  const number = Number.isNaN(parsed) ? 3 : parsed === 0 ? null : parsed;
  return (
    <DevCard
      fixture={fixture}
      coords={one(q.coords) !== "0"}
      number={number}
      longPlace={one(q.place) === "long"}
      drift={one(q.drift) === "1"}
    />
  );
}
