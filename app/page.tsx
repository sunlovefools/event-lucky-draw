import { cookies } from "next/headers";

import { DELEGATE_SESSION_COOKIE } from "@/app/delegate/session";
import { PENDING_STAMP_COOKIE } from "@/app/stamp/pending";
import { Home } from "@/app/home";
import { getDelegateHome, SupabaseDelegateStore } from "@/lib/delegate";

function errorMessage(error?: string) {
  if (error === "registration-closed") {
    return "Registration is closed.";
  }

  if (error === "delegate-invalid") {
    return "Enter a registration number and full name to register.";
  }

  return undefined;
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ error?: string; pendingStamp?: string }> }) {
  const [cookieStore, params] = await Promise.all([cookies(), searchParams]);
  const sessionId = cookieStore.get(DELEGATE_SESSION_COOKIE)?.value;

  return (
    <Home
      delegateHomePromise={getDelegateHome({ store: new SupabaseDelegateStore(), sessionId })}
      error={errorMessage(params?.error)}
      pendingStamp={params?.pendingStamp === "true" || Boolean(cookieStore.get(PENDING_STAMP_COOKIE)?.value)}
    />
  );
}
