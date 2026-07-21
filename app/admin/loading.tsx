import { BrandLoader } from "@/app/components/brand-loader";

// Keep the admin chrome (sidenav + header) visible during admin navigations.
export default function Loading() {
  return (
    <div className="admin-page-loading" role="status" aria-live="polite">
      <BrandLoader message="Loading admin…" />
    </div>
  );
}
