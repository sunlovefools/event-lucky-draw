import { BrandLoader } from "./components/brand-loader";

// Root route-level loading fallback (Next.js Suspense boundary). Shown while
// the target route's server work is in flight — e.g. the delegate home DB
// lookup — so every navigation has a smooth, on-brand transition.
export default function Loading() {
  return (
    <main className="shell" id="main" style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
      <BrandLoader message="Loading…" />
    </main>
  );
}
