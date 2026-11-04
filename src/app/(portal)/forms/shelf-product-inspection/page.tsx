import { ShelfProductInspectionForm } from "@/components/quality-forms/shelf-product-inspection-form";
import { loadSupplierBinderDirectory } from "@/lib/quality-forms/supplier-binder-directory";

export default async function ShelfProductInspectionPage() {
  const binderDirectory = await loadSupplierBinderDirectory();
  return <ShelfProductInspectionForm binderDirectory={binderDirectory} />;
}
