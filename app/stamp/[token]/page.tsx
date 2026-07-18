import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DELEGATE_SESSION_COOKIE } from "@/app/delegate/session";
import { PENDING_STAMP_COOKIE } from "@/app/stamp/pending";
import { StampResult } from "@/app/stamp/[token]/stamp-result";
import { prepareStampCollectionRequest, SupabaseStampCollectionStore } from "@/lib/stamp";
import { SupabaseDelegateSessionStore } from "@/lib/delegate-session";

export default async function StampPage({ params }: { params: Promise<{ token: string }> }) {
  const [cookieStore, resolvedParams] = await Promise.all([cookies(), params]);
  const sessionId = cookieStore.get(DELEGATE_SESSION_COOKIE)?.value;
  const session = sessionId
    ? await new SupabaseDelegateSessionStore().findValidDelegateSession(sessionId, new Date().toISOString())
    : null;

  const prepared = await prepareStampCollectionRequest({
    store: new SupabaseStampCollectionStore(),
    session,
    token: resolvedParams.token,
  });

  if (prepared.registrationRequired) {
    cookieStore.set(PENDING_STAMP_COOKIE, prepared.pendingStampToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: "/",
    });
    redirect("/?pendingStamp=true");
  }

  cookieStore.delete(PENDING_STAMP_COOKIE);
  return <StampResult result={prepared.result} />;
}
