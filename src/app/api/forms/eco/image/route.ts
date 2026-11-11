import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "נדרשת התחברות למערכת" }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 4_100_000) return NextResponse.json({ error: "תמונות להמרה צריכות להיות קטנות מ־4MB" }, { status: 413 });
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.size || file.size > 4_000_000) return NextResponse.json({ error: "יש לבחור תמונה עד 4MB להמרה" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const head = Buffer.from(bytes.subarray(0, 12));
    const rasterHeader = head[0] === 0xff && head[1] === 0xd8 || head.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71])) || head.toString("ascii", 0, 4) === "GIF8" || head.toString("ascii", 8, 12) === "WEBP" || ["49492a00", "4d4d002a", "49492b00", "4d4d002b"].includes(head.subarray(0, 4).toString("hex")) || head.toString("ascii", 4, 8) === "ftyp";
    if (!rasterHeader) return NextResponse.json({ error: "פורמט התמונה אינו נתמך" }, { status: 400 });
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000, pages: 1 }).metadata();
    if (!["jpeg", "png", "webp", "gif", "tiff", "heif", "avif"].includes(metadata.format ?? "")) return NextResponse.json({ error: "פורמט התמונה אינו נתמך" }, { status: 400 });
    const result = await sharp(bytes, { limitInputPixels: 40_000_000, pages: 1 }).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).flatten({ background: "white" }).jpeg({ quality: 75 }).toBuffer();
    if (result.byteLength > 310_000) return NextResponse.json({ error: "התמונה גדולה מדי אחרי המרה. יש להקטין אותה" }, { status: 400 });
    return NextResponse.json({ image: `data:image/jpeg;base64,${result.toString("base64")}` }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "לא ניתן לפענח תמונה זו. נסה לשמור אותה כ־PNG או JPG" }, { status: 400 }); }
}
