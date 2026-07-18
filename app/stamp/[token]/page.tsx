import { cookies } from "next/headers";

import { DELEGATE_SESSION_COOKIE } from "@/app/delegate/session";
import { StampResult } from "@/app/stamp/[token]/stamp-result";
import { collectStationStamp, SupabaseStampCollectionStore } from "@/lib/stamp";

export default async function StampPage({ params }: { params: Promise<{ token: string }> }) {
  const [cookieStore, resolvedParams] = await Promise.all([cookies(), params]);
  const result = await collectStationStamp({
    store: new SupabaseStampCollectionStore(),
    sessionId: cookieStore.get(DELEGATE_SESSION_COOKIE)?.value,
    token: resolvedParams.token,
  });

  return <StampResult result={result} />;
}
