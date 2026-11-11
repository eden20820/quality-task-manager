import { DevelopmentInspectionForm } from "@/components/quality-forms/development-inspection-form";
import { loadPartsCatalog } from "@/lib/quality-forms/parts-catalog-server";
export default async function DevelopmentInspectionPage() { return <DevelopmentInspectionForm catalogItems={await loadPartsCatalog()} />; }
