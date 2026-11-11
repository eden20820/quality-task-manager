import { ShelfProductInspectionForm } from "@/components/quality-forms/shelf-product-inspection-form";
import { loadSupplierBinderDirectory } from "@/lib/quality-forms/supplier-binder-directory";
import { loadPartsCatalog } from "@/lib/quality-forms/parts-catalog-server";

export default async function ShelfProductInspectionPage() {
  const [binderDirectory, catalogItems] = await Promise.all([loadSupplierBinderDirectory(), loadPartsCatalog()]);
  return <ShelfProductInspectionForm binderDirectory={binderDirectory} catalogItems={catalogItems} />;
}
