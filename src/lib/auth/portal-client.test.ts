import { beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("server-only", () => ({}));
vi.mock("./portal-user", () => ({ getPortalUser: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { createPortalClient } from "./portal-client";
describe("company data access barrier", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({profile: {is_active: true}}); mocks.client.mockResolvedValue({verified: true}); });
  it("waits for completed enrollment before creating a data client", async () => {
    let finish!: (value: unknown) => void;
    mocks.user.mockReturnValue(new Promise(resolve => {finish=resolve;}));
    const pending = createPortalClient(); expect(mocks.client).not.toHaveBeenCalled();
    finish({profile: {is_active: true}}); expect(await pending).toEqual({verified: true});
  });
  it("blocks missing or suspended profiles before any data query", async () => {
    mocks.user.mockResolvedValue(null); await expect(createPortalClient()).rejects.toThrow("REDIRECT:/login");
    mocks.user.mockResolvedValue({profile: {is_active: false}}); await expect(createPortalClient()).rejects.toThrow("not-authorized");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("guards every portal page that directly loads Supabase data", () => {
    const pages: string[] = [];
    function walk(directory: string) { for(const file of readdirSync(directory,{withFileTypes:true})) { const next=path.join(directory,file.name); if(file.isDirectory())walk(next); else if(file.name==="page.tsx")pages.push(next); } }
    walk(path.join(process.cwd(),"src/app/(portal)"));
    let guarded=0;
    for(const file of pages) { const source=readFileSync(file,"utf8"); expect(source,file).not.toContain('import { createClient } from "@/lib/supabase/server"'); if(source.includes('createPortalClient as createClient'))guarded++; }
    expect(guarded).toBe(13);
  });
});
