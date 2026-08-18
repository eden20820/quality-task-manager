import { FollowupsBoard, type Followup } from "@/components/followups/followups-board";
import { createClient } from "@/lib/supabase/server";

export default async function FollowupsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("quality_followups").select("id, category, reference_number, name, quantity, status, opened_at, notes").order("opened_at", { ascending: false });
  if (error) console.error("Load quality followups error:", error);
  return <FollowupsBoard rows={(data ?? []) as Followup[]} />;
}
