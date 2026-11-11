import { AdhesionLeakTestForm } from "@/components/quality-forms/adhesion-leak-test-form";
import { loadPartsCatalog } from "@/lib/quality-forms/parts-catalog-server";

export default async function AdhesionLeakTestPage() {
  return <AdhesionLeakTestForm catalogItems={await loadPartsCatalog()} />;
}
