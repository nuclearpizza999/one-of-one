import nextDynamic from "next/dynamic";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const VariationGallery =
  process.env.NODE_ENV === "production" ? null : nextDynamic(() => import("./VariationGallery").then((m) => m.VariationGallery));

/** Development only: every local test photo under every texture. */
export default function DevVariationPage() {
  if (process.env.NODE_ENV === "production" || !VariationGallery) notFound();
  return <VariationGallery />;
}
