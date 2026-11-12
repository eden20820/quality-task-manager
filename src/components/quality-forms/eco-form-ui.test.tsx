import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
import { EcoForm } from "./eco-form";
describe("ECO modular editor rendering", () => {
  it("renders controls around every standard section without duplicating or hiding its form fields", () => {
    const html=renderToStaticMarkup(<EcoForm catalogItems={[]} />);
    expect(html.match(/id="eco-document-/g)).toHaveLength(9);
    expect(html.match(/aria-label="הוספת מקטע במיקום זה"/g)).toHaveLength(10);
    for(const label of ["מספר טופס","גרסה חדשה","תיאור השינוי","אישורים נדרשים","פעולות נלוות","סגירת הטופס"])expect(html).toContain(label);
    expect(html.match(/draggable="true"/g)).toHaveLength(9);
    expect(html).toContain("text-justify"); expect(html).toContain("מיקום");
  });
});
