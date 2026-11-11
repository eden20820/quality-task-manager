import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), range: vi.fn(), eq: vi.fn(), select: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/auth/portal-user", () => ({ getPortalUser: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { loadPartsCatalog } from "./parts-catalog-server";
describe("company catalog authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = { select: mocks.select, eq: mocks.eq, order: vi.fn(), range: mocks.range };
    mocks.select.mockReturnValue(chain); mocks.eq.mockReturnValue(chain); chain.order.mockReturnValue(chain);
    mocks.client.mockResolvedValue({ from: () => chain });
  });
  it.each([null, { userId: "u", profile: { is_active: false, active_organization_id: "company-a" } }, { userId: "u", profile: { is_active: true, active_organization_id: null } }])("does not query company data for unauthorized sessions", async user => {
    mocks.user.mockResolvedValue(user); expect(await loadPartsCatalog()).toEqual([]); expect(mocks.client).not.toHaveBeenCalled();
  });
  it("filters by the active company and projects only the three permitted business fields", async () => {
    mocks.user.mockResolvedValue({ userId: "u", profile: { is_active: true, active_organization_id: "company-a" } });
    mocks.range.mockResolvedValue({ data: [{ catalog_number: "TEST-1", part_name: "Sample", revision: "00", price: 99 }], error: null });
    expect(await loadPartsCatalog()).toEqual([{ catalogNumber: "TEST-1", partName: "Sample", revision: "00" }]);
    expect(mocks.eq).toHaveBeenCalledWith("organization_id", "company-a");
    expect(mocks.select).toHaveBeenCalledWith("catalog_number,part_name,revision");
    mocks.user.mockResolvedValue({ userId: "other", profile: { is_active: true, active_organization_id: "company-b" } });
    mocks.range.mockResolvedValue({ data: [], error: null });
    expect(await loadPartsCatalog()).toEqual([]);
    expect(mocks.eq).toHaveBeenCalledWith("organization_id", "company-b");
  });
  it("reads all pages beyond the default database row limit", async () => {
    mocks.user.mockResolvedValue({ userId: "u", profile: { is_active: true, active_organization_id: "company-a" } });
    const row = { catalog_number: "TEST-1", part_name: "Sample", revision: "00" };
    mocks.range.mockResolvedValueOnce({ data: Array(1000).fill(row), error: null }).mockResolvedValueOnce({ data: [{ ...row, catalog_number: "TEST-2" }], error: null });
    expect(await loadPartsCatalog()).toHaveLength(2);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});
