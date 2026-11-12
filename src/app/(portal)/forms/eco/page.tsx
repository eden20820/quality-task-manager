import { EcoForm } from "@/components/quality-forms/eco-form";
import { loadPartsCatalog } from "@/lib/quality-forms/parts-catalog-server";
import { getPortalUser } from "@/lib/auth/portal-user";
import { redirect } from "next/navigation";
export default async function EcoFormPage() {
  const portal = await getPortalUser();
  if (!portal?.profile.is_active || !portal.profile.active_organization_id) redirect("/login");
  return <EcoForm catalogItems={await loadPartsCatalog()} draftScope={`${portal.profile.active_organization_id}:${portal.userId}`} />;
}
