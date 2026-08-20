import { FollowupsBoard, type Followup } from "@/components/followups/followups-board";
import { PaginationControls } from "@/components/pagination-controls";
import { PAGE_SIZE, pageRange, parsePage } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

type Category = "pka" | "nonconformity" | "eco";
type StatusFilter = "all" | "active" | "open" | "waiting" | "closed";

const categories: Category[] = ["pka", "nonconformity", "eco"];
const statuses: StatusFilter[] = ["all", "active", "open", "waiting", "closed"];

export default async function FollowupsPage({ searchParams }: { searchParams: Promise<{ page?: string; category?: string; status?: string; q?: string }> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const category: Category = categories.includes(params.category as Category) ? params.category as Category : "pka";
  const status: StatusFilter = statuses.includes(params.status as StatusFilter) ? params.status as StatusFilter : "active";
  const query = (params.q ?? "").trim().slice(0, 100);
  const { from, to } = pageRange(page);
  const supabase = await createClient();

  let rowsQuery = supabase
    .from("quality_followups")
    .select("id, category, reference_number, name, quantity, status, alerts_enabled, assignee_key, opened_at, created_at, notes", { count: "exact" })
    .eq("category", category);

  if (status === "active") rowsQuery = rowsQuery.neq("status", "closed");
  else if (status !== "all") rowsQuery = rowsQuery.eq("status", status);

  const safeQuery = query.replace(/[,%()]/g, " ").trim();
  if (safeQuery) {
    rowsQuery = rowsQuery.or(`reference_number.ilike.%${safeQuery}%,name.ilike.%${safeQuery}%,notes.ilike.%${safeQuery}%`);
  }

  const [{ data, error, count }, pkaCount, nonconformityCount, ecoCount] = await Promise.all([
    rowsQuery.order("reference_number", { ascending: true }).order("created_at", { ascending: false }).range(from, to),
    supabase.from("quality_followups").select("id", { count: "exact", head: true }).eq("category", "pka").neq("status", "closed"),
    supabase.from("quality_followups").select("id", { count: "exact", head: true }).eq("category", "nonconformity").neq("status", "closed"),
    supabase.from("quality_followups").select("id", { count: "exact", head: true }).eq("category", "eco").neq("status", "closed"),
  ]);

  if (error) console.error("Load quality followups error:", error);
  return <div className="space-y-5">
    <FollowupsBoard
      rows={(data ?? []) as Followup[]}
      activeCategory={category}
      statusFilter={status}
      query={query}
      total={count ?? 0}
      counts={{ pka: pkaCount.count ?? 0, nonconformity: nonconformityCount.count ?? 0, eco: ecoCount.count ?? 0 }}
    />
    <PaginationControls basePath="/followups" page={page} pageSize={PAGE_SIZE} total={count ?? 0} query={{ category, status, q: query || undefined }} />
  </div>;
}
