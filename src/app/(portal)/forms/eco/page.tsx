import { EcoForm } from "@/components/quality-forms/eco-form";
import { loadPartsCatalog } from "@/lib/quality-forms/parts-catalog-server";
export default async function EcoFormPage() { return <EcoForm catalogItems={await loadPartsCatalog()} />; }
