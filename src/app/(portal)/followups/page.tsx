import { FollowupsBoard, type Followup } from "@/components/followups/followups-board";
import { PaginationControls } from "@/components/pagination-controls";
import { PAGE_SIZE, pageRange, parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export default async function FollowupsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();
  const { data, error, count } = await supabase.from("quality_followups").select("id, category, reference_number, name, quantity, status, alerts_enabled, assignee_key, opened_at, created_at, notes", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (error) console.error("Load quality followups error:", error);
  return <div className="space-y-5">
    <FollowupsBoard rows={(data ?? []) as Followup[]} />
    <PaginationControls basePath="/followups" page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
  </div>;
}
