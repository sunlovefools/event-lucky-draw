import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE } from "@/app/admin/session";
import { exportAdminCsv, SupabaseAdminExportStore, type AdminExportKind } from "@/lib/admin/exports";

const EXPORT_KINDS = new Set<AdminExportKind>([
  "participants",
  "station-completions",
  "survey-responses",
  "winner-history",
  "scan-audit",
]);

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!EXPORT_KINDS.has(kind as AdminExportKind)) {
    return new Response("Unknown export.", { status: 404 });
  }

  const cookieStore = await cookies();
  const result = await exportAdminCsv({
    store: new SupabaseAdminExportStore(),
    sessionId: cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
    kind: kind as AdminExportKind,
  });

  if (!result.ok) {
    return new Response(result.error, { status: 401 });
  }

  return new Response(result.body, {
    status: 200,
    headers: {
      "content-type": result.contentType,
      "content-disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
