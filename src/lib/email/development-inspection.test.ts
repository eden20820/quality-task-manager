import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyDevelopmentInspection } from "@/lib/quality-forms/development-inspection";

const send = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("./brevo", () => ({ sendBrevoEmail: send }));
import { sendDevelopmentInspectionToPurchasing } from "./development-inspection";

const input = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  payload: { ...createEmptyDevelopmentInspection("2026-11-23"), supplierName: "Acme <Parts>", catalogNumber: "P-001", itemDescription: "Bracket", receivedQuantity: "12", inspectedQuantity: "3", finalStatus: "rework" as const, gapDetails: "Dimensions < tolerance", generalConformity: "gap" as const },
  bytes: new Uint8Array([37, 80, 68, 70]),
  fileName: "inspection.pdf",
  pending: true,
};

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("development inspection purchasing email", () => {
  it("uses the configured address, summarizes the form and attaches the same PDF", async () => {
    vi.stubEnv("DEVELOPMENT_INSPECTION_PURCHASING_EMAIL", "buyer@example.com");
    send.mockResolvedValue({ status: "sent" });
    expect(await sendDevelopmentInspectionToPurchasing(input)).toBe("sent");
    const mail = send.mock.calls[0][0];
    expect(mail.to).toEqual({ email: "buyer@example.com" });
    expect(mail.subject).toMatch(/^Acme <Parts>/);
    for (const value of ["Acme &lt;Parts&gt;", "23.11.2026", "P-001", "Bracket", "12", "3", "ממתין להשלמת חתימה", "נדרש תיקון", "Dimensions &lt; tolerance"]) expect(mail.html).toContain(value);
    expect(mail.attachments).toEqual([{ name: "inspection.pdf", content: "JVBERg==" }]);
  });

  it("does not send for another organization or without a configured recipient", async () => {
    vi.stubEnv("DEVELOPMENT_INSPECTION_PURCHASING_EMAIL", "buyer@example.com");
    expect(await sendDevelopmentInspectionToPurchasing({ ...input, organizationId: "another-org" })).toBe("skipped");
    vi.stubEnv("DEVELOPMENT_INSPECTION_PURCHASING_EMAIL", "");
    expect(await sendDevelopmentInspectionToPurchasing(input)).toBe("unconfigured");
    expect(send).not.toHaveBeenCalled();
  });
});
