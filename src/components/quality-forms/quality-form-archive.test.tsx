import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
import { QualityFormArchive, type QualityFormArchiveRow } from "./quality-form-archive";
import { ADHESION_LEAK_TEST_FORM_TITLE, buildArchivedFormDescription } from "@/lib/quality-forms/form-archive";
const row = (id: string, status: "pending-signature" | "signed" | "archived"): QualityFormArchiveRow => ({ id, title: id, description: buildArchivedFormDescription(ADHESION_LEAK_TEST_FORM_TITLE, status), file_name: `${id}.pdf`, file_size: 1000, mime_type: "application/pdf", storage_path: `${id}.pdf`, created_at: "2026-11-12T10:00:00Z" });
describe("signature archive separation", () => {
  const forms = [row("PENDING_ONLY", "pending-signature"), row("SIGNED_ONLY", "signed"), row("MANUAL_ONLY", "archived")];
  it("shows signed and manually archived forms only in the regular archive", () => {
    const html = renderToStaticMarkup(<QualityFormArchive initialForms={forms} />);
    expect(html).toContain("SIGNED_ONLY.pdf"); expect(html).toContain("MANUAL_ONLY.pdf"); expect(html).not.toContain("PENDING_ONLY.pdf"); expect(html).toContain("הועבר ללא השלמת חתימה");
  });
  it("shows pending forms with a clear manual transfer action", () => {
    const html = renderToStaticMarkup(<QualityFormArchive initialForms={forms} initialTab="pending" />);
    expect(html).toContain("PENDING_ONLY.pdf"); expect(html).not.toContain("SIGNED_ONLY.pdf"); expect(html).not.toContain("MANUAL_ONLY.pdf"); expect(html).toContain("העברה למאגר"); expect(html).toContain("השלמת חתימה");
  });
  it("removes a successfully transferred form from pending immediately and shows it in the regular archive", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("window", { confirm: () => true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ archived: true, record: row("MOVED_ONLY", "archived") }), { headers: { "Content-Type": "application/json" } })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let root!: ReturnType<typeof create>;
    try {
      await act(async () => { root = create(<QualityFormArchive initialForms={[forms[0]]} initialTab="pending" />); });
      const transfer = root.root.findAllByType("button").find(button => Array.isArray(button.props.children) && button.props.children.includes("העברה למאגר"));
      expect(transfer).toBeDefined();
      await act(async () => { await transfer!.props.onClick(); });
      expect(JSON.stringify(root.toJSON())).not.toContain("PENDING_ONLY.pdf");
      await act(async () => { root.root.findAllByType("button")[0].props.onClick(); });
      expect(JSON.stringify(root.toJSON())).toContain("MOVED_ONLY.pdf");
      expect(JSON.stringify(root.toJSON())).toContain("הועבר ללא השלמת חתימה");
    } finally { if (root) await act(async () => root.unmount()); log.mockRestore(); vi.unstubAllGlobals(); }
  });
});
