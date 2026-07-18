import { PublicDrawDisplay } from "@/app/draw/public-display";
import { getPublicDrawState, SupabasePublicDrawStore } from "@/lib/public-draw";

export default async function PublicDrawPage() {
  const initialState = await getPublicDrawState({ store: new SupabasePublicDrawStore() });
  return <PublicDrawDisplay initialState={initialState} />;
}
