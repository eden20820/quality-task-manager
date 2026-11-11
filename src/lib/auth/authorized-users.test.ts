import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { CAELI_ORGANIZATION_ID, isAuthorizedPortalEmail, provisionAuthorizedPortalUser } from "./authorized-users";
const getUser = vi.fn(), rpc = vi.fn();
const profile = vi.fn(), membership = vi.fn();
const builder = (result: typeof profile) => { const query = { select: () => query, eq: () => query, maybeSingle: result }; return query; };
const client = { auth: { getUser }, rpc, from: (table: string) => builder(table === "profiles" ? profile : membership) } as unknown as SupabaseClient;
describe("verified company enrollment", () => {
  beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: "employee", email: "employee@caeli.pro", email_confirmed_at: "2026-11-11" } }, error: null }); profile.mockResolvedValue({data: null}); membership.mockResolvedValue({data: null}); rpc.mockResolvedValue({data: CAELI_ORGANIZATION_ID, error: null}); });
  it.each(["staff@caeli.pro", " STAFF@CAELI.PRO ", "a.b+quality@caeli.pro"])("accepts exact company email: %s", email => { expect(isAuthorizedPortalEmail(email)).toBe(true); });
  it.each(["staff@caeli.pro.evil.com", "staff@sub.caeli.pro", "staff@caeliXpro", "@caeli.pro", "staff@@caeli.pro", "a b@caeli.pro", "staff@gmail.com", null, {}])("rejects lookalikes and invalid domains: %s", email => { expect(isAuthorizedPortalEmail(email)).toBe(false); });
  it("enrolls verified new employees through a session-only no-argument RPC", async () => { expect(await provisionAuthorizedPortalUser(client)).toBe(true); expect(rpc).toHaveBeenCalledWith("join_caeli_workspace"); });
  it("leaves existing owners/admins alone, including while migration is pending", async () => { profile.mockResolvedValue({data: {is_active: true, active_organization_id: CAELI_ORGANIZATION_ID}}); membership.mockResolvedValue({data: {is_active: true}}); expect(await provisionAuthorizedPortalUser(client)).toBe(true); expect(rpc).not.toHaveBeenCalled(); });
  it("does not authorize editable metadata or an unconfirmed email", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "external", email: "external@gmail.com", user_metadata: {email: "owner@caeli.pro"}, email_confirmed_at: "2026-11-11" } } });
    expect(await provisionAuthorizedPortalUser(client)).toBe(false); expect(rpc).not.toHaveBeenCalled();
    getUser.mockResolvedValue({ data: { user: { id: "employee", email: "employee@caeli.pro", email_confirmed_at: null } } });
    await expect(provisionAuthorizedPortalUser(client)).rejects.toThrow("not confirmed"); expect(rpc).not.toHaveBeenCalled();
  });
  it("fails closed if session verification or enrollment fails", async () => { rpc.mockResolvedValue({data: null, error: {code: "42501"}}); await expect(provisionAuthorizedPortalUser(client)).rejects.toThrow("42501"); getUser.mockResolvedValue({data: {user: null}, error: {message: "invalid token"}}); await expect(provisionAuthorizedPortalUser(client)).rejects.toThrow("verified session"); });
});
