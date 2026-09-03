"use server";
import { createClient } from "@/lib/supabase/server";
export type GlobalSearchResult={id:string;type:"task"|"calibration"|"supplier"|"followup"|"expiry"|"reminder"|"document";title:string;subtitle:string;href:string};
export async function globalSearch(raw:string):Promise<GlobalSearchResult[]>{const q=raw.trim().slice(0,80).replace(/[,%()]/g,"");if(q.length<2)return[];const s=await createClient();const p=`%${q}%`;const [tasks,cal,sup,fol,exp,rem,docs]=await Promise.all([
s.from("tasks").select("id,title,description").or(`title.ilike.${p},description.ilike.${p}`).limit(6),
s.from("calibration_items").select("id,equipment_name,serial_number,location").or(`equipment_name.ilike.${p},serial_number.ilike.${p},location.ilike.${p}`).limit(6),
s.from("suppliers").select("id,supplier_name,supplier_number,product_service").or(`supplier_name.ilike.${p},supplier_number.ilike.${p},product_service.ilike.${p}`).limit(6),
s.from("quality_followups").select("id,category,reference_number,name").or(`reference_number.ilike.${p},name.ilike.${p},notes.ilike.${p}`).limit(6),
s.from("expiry_items").select("id,material_name,location").or(`material_name.ilike.${p},location.ilike.${p}`).limit(6),
s.from("reminders").select("id,title,notes").or(`title.ilike.${p},notes.ilike.${p}`).limit(6),
s.from("quality_documents").select("id,title,category").or(`title.ilike.${p},category.ilike.${p}`).limit(6)]);
return [
...(tasks.data??[]).map(x=>({id:x.id,type:"task" as const,title:x.title,subtitle:x.description||"משימה",href:`/tasks?q=${encodeURIComponent(q)}`})),
...(cal.data??[]).map(x=>({id:x.id,type:"calibration" as const,title:x.equipment_name,subtitle:[x.serial_number,x.location].filter(Boolean).join(" • ")||"כיול",href:`/calibrations?q=${encodeURIComponent(q)}`})),
...(sup.data??[]).map(x=>({id:x.id,type:"supplier" as const,title:x.supplier_name,subtitle:[x.supplier_number,x.product_service].filter(Boolean).join(" • ")||"ספק",href:`/suppliers?q=${encodeURIComponent(q)}`})),
...(fol.data??[]).map(x=>({id:x.id,type:"followup" as const,title:`${x.reference_number} • ${x.name}`,subtitle:x.category,href:`/followups?q=${encodeURIComponent(q)}`})),
...(exp.data??[]).map(x=>({id:x.id,type:"expiry" as const,title:x.material_name,subtitle:x.location||"פג תוקף",href:"/expiry"})),
...(rem.data??[]).map(x=>({id:x.id,type:"reminder" as const,title:x.title,subtitle:x.notes||"תזכורת",href:"/calendar"})),
...(docs.data??[]).map(x=>({id:x.id,type:"document" as const,title:x.title,subtitle:x.category||"מסמך",href:"/documents"}))].slice(0,30);}
