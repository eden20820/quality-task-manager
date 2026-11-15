import { beforeEach, describe, expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("./brevo", () => ({ sendBrevoEmail: send }));
import { sendPendingFormAlerts } from "./pending-form";
beforeEach(() => { vi.clearAllMocks(); send.mockResolvedValue({ status: "sent" }); });
const form = { organizationId: "00000000-0000-4000-8000-000000000001", formTitle: "טופס ביקורת קבלה למוצר מדף", supplierName: "<script>TEST</script>", catalogNumber: "TEST-001", date: "2026-11-12" };
describe("pending form notifications", () => {
  it("never sends another organization's information to the company recipients", async () => { expect(await sendPendingFormAlerts({ ...form, organizationId: "another-company" })).toBe("skipped"); expect(send).not.toHaveBeenCalled(); });
  it("sends the signature reminder to exactly Eden and Sergey, including shelf forms", async () => {
    expect(await sendPendingFormAlerts(form)).toBe("sent");
    expect(send.mock.calls.map(([input]) => input.to.email)).toEqual(["eden@caeli.pro", "sergey@caeli.pro"]);
    for (const [input] of send.mock.calls) { expect(input.subject).toContain("ממתין לחתימה"); expect(input.html).toContain("&lt;script&gt;"); expect(input.html).not.toContain("<script>"); }
  });
  it("still tries the other recipient on failure and reports partial delivery", async () => {
    send.mockRejectedValueOnce(new Error("failure")); expect(await sendPendingFormAlerts(form)).toBe("partial"); expect(send).toHaveBeenCalledTimes(2);
  });
  it("reports failure when neither message is accepted", async () => { send.mockResolvedValue({ status: "failed" }); expect(await sendPendingFormAlerts(form)).toBe("failed"); });
});
