import { BrandLoader } from "@/app/components/brand-loader";

// Admin route-level loading fallback. Matches the delegate experience so
// section-to-section navigation keeps the branded loading screen in place.
export default function Loading() {
  return (
    <main className="shell shell-wide" id="main" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
      <BrandLoader message="Loading admin…" />
    </main>
  );
}