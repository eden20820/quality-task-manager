import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
const auth = vi.hoisted(() => ({ claims: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: auth.claims } }) }));
import { POST } from "./route";
function request(bytes: Uint8Array, name: string) { const body = new FormData(); body.append("file", new File([new Uint8Array(bytes)], name)); return new Request("https://example.test/api/forms/eco/image", {method: "POST", body}); }
describe("authenticated image conversion", () => {
  beforeEach(() => auth.claims.mockResolvedValue({ data: { claims: { sub: "test-user" } } }));
  it("does not process files before authentication", async () => { auth.claims.mockResolvedValue({data: null}); expect((await POST(request(new Uint8Array([1]), "test.tif"))).status).toBe(401); });
  it("converts TIFF to a bounded metadata-free JPEG", async () => {
    const tiff = await sharp({create: {width: 1600, height: 800, channels: 3, background: "white"}}).tiff().toBuffer();
    const response = await POST(request(tiff, "drawing.tif")); expect(response.status).toBe(200);
    const json = await response.json(), metadata = await sharp(Buffer.from(json.image.split(",")[1], "base64")).metadata();
    expect(metadata.width).toBe(1400); expect(metadata.format).toBe("jpeg"); expect(metadata.exif).toBeUndefined(); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects corrupt images and oversized input", async () => {
    expect((await POST(request(new Uint8Array([1,2,3]), "bad.tiff"))).status).toBe(400);
    expect((await POST(request(new Uint8Array(4_000_001), "large.tiff"))).status).toBe(400);
  });
});
