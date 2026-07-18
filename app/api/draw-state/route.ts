import { getPublicDrawState, SupabasePublicDrawStore } from "@/lib/public-draw";

export async function GET() {
  const state = await getPublicDrawState({ store: new SupabasePublicDrawStore() });
  return Response.json(state, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
