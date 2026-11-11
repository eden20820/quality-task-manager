import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), profile: vi.fn(), member: vi.fn(), provision: vi.fn() }));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/auth/authorized-users", () => ({ CAELI_ORGANIZATION_ID: "company", isAuthorizedPortalEmail: (email: string) => email?.endsWith("@caeli.pro"), provisionAuthorizedPortalUser: mocks.provision }));
vi.mock("@/lib/supabase/server", () => ({createClient: async () => ({auth: {getClaims:mocks.claims},from:(table:string)=> {const query={select:()=>query,eq:()=>query,single:mocks.profile,maybeSingle:mocks.member};return query;}})}));
import { getPortalUser } from "./portal-user";
const active = {full_name:"Example",is_active:true,dashboard_cleared_at:null,active_organization_id:"company"};
describe("first request membership repair", () => {
  beforeEach(() => {vi.clearAllMocks();mocks.claims.mockResolvedValue({data:{claims:{sub:"user",email:"staff@caeli.pro"}}});mocks.profile.mockResolvedValue({data:active});mocks.member.mockResolvedValue({data:{user_id:"user"}});mocks.provision.mockResolvedValue(true);});
  it("does not rewrite a healthy member on every navigation",async()=>{expect((await getPortalUser())?.profile).toEqual(active);expect(mocks.provision).not.toHaveBeenCalled();});
  it("repairs an existing session before returning its active profile",async()=>{mocks.member.mockResolvedValue({data:null});mocks.profile.mockResolvedValueOnce({data:{...active,is_active:false}}).mockResolvedValueOnce({data:active});expect((await getPortalUser())?.profile.is_active).toBe(true);expect(mocks.provision).toHaveBeenCalledTimes(1);expect(mocks.profile).toHaveBeenCalledTimes(2);});
  it("fails closed when membership provisioning fails",async()=>{mocks.member.mockResolvedValue({data:null});mocks.provision.mockRejectedValue(new Error("blocked"));const log=vi.spyOn(console,"error").mockImplementation(()=>{});expect(await getPortalUser()).toBeNull();log.mockRestore();});
  it("preserves manually authorized accounts outside the automatic company domain",async()=>{mocks.claims.mockResolvedValue({data:{claims:{sub:"user",email:"manual@example.test"}}});expect(await getPortalUser()).not.toBeNull();expect(mocks.provision).not.toHaveBeenCalled();});
  it("rejects invalid authentication before reading profiles",async()=>{mocks.claims.mockResolvedValue({data:null,error:{message:"expired"}});expect(await getPortalUser()).toBeNull();expect(mocks.profile).not.toHaveBeenCalled();});
});
