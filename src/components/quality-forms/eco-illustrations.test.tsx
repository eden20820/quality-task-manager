import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EcoIllustrations } from "./eco-illustrations";
describe("ECO image heading direction", () => {
  it("explicitly keeps both photo labels and block titles RTL, even when starting with English or numbers", () => {
    const html = renderToStaticMarkup(<EcoIllustrations inline value={[{ id: "test", mode: "pair", title: "ABC שינוי 01", beforeLabel: "01 לפני", afterLabel: "02 אחרי", beforeImage: "", afterImage: "", beforeCaption: "", afterCaption: "", notes: "" }]} onChange={() => {}} onBusy={() => {}} />);
    expect(html.match(/aria-label="כותרת תמונה" dir="rtl"/g)).toHaveLength(2);
    expect(html).toMatch(/value="ABC שינוי 01"/);
    expect(html).toMatch(/<input[^>]*dir="rtl"[^>]*value="ABC שינוי 01"|<input[^>]*value="ABC שינוי 01"[^>]*dir="rtl"/);
    expect(html.match(/text-right/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
