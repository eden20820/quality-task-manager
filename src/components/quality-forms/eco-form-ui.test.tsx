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
    // Editor stays inert until archive handoff / local recovery has completed.
    expect(html.match(/draggable="false"/g)).toHaveLength(9);
    expect(html).toContain("inert=");
    expect(html).toContain("text-justify"); expect(html).toContain("מיקום");
    for (const label of ["תצוגה מקדימה", "ביטול פעולה", "שחזור פעולה", "במכשיר זה בלבד"]) expect(html).toContain(label);
    expect(html).not.toContain("<aside");
    expect(html).not.toContain('aria-label="ניווט וסידור מקטעי ECO"');
    expect(html).not.toContain("מעבר למקטע");
    expect(html).not.toContain("xl:grid-cols-[260px_minmax(0,1fr)]");
    expect(html).toContain('class="mx-auto w-full max-w-6xl"');
  });
});
