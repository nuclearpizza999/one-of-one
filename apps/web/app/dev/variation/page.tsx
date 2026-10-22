import { notFound } from "next/navigation";
import { VariationGallery } from "./VariationGallery";

export const dynamic = "force-dynamic";

/** Development only: every local test photo under every texture. */
export default function DevVariationPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VariationGallery />;
}
