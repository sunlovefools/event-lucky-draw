import { BrandLoader } from "@/app/components/brand-loader";
import { AdminCard } from "@/app/admin/ui";
import { IconUsers } from "@/app/admin/icons";

export default function Loading() {
  return (
    <div className="module-grid">
      <AdminCard icon={IconUsers} eyebrow="Manage" title="Participants">
        <div className="admin-page-loading" role="status" aria-live="polite">
          <BrandLoader message="Applying filters…" />
        </div>
      </AdminCard>
    </div>
  );
}
