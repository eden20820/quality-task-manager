import { describe, expect, it, vi } from "vitest";
import { createEmptyEcoForm, isEcoFormPayload } from "./eco-form";
import { changeEcoIllustration, changeEcoText, getEcoLayout, insertEcoBlock, moveEcoBlock, removeEcoBlock, validEcoLayout } from "./eco-layout";
import { buildEcoFormPdf, extractEcoFormPayload } from "./eco-form-pdf";
import { DavidFormPdf, type FormCell } from "./david-form-pdf";
const empty = () => createEmptyEcoForm("2026-11-12");
const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
describe("modular ECO document", () => {
  it("retains all nine standard sections and loads legacy illustrations in their original location", () => {
    let payload=insertEcoBlock(empty(),"pair","old"); delete payload.layout;
    expect(getEcoLayout(payload).map(block=>block.kind==="section"?block.section:block.kind)).toEqual(["details","products","description","illustration","justification","initialApproval","impact","approvals","actions","closure"]);
    expect(isEcoFormPayload(payload)).toBe(true); expect(payload.layout).toBeUndefined();
  });
  it("interleaves multiple text and comparison blocks, inserts at the start and moves any section", () => {
    let p=insertEcoBlock(empty(),"pair","pair1","section-description");
    p=insertEcoBlock(p,"text","explanation","image-pair1"); p=changeEcoText(p,"explanation",{title:"הסבר",text:"1. שינוי ABC"});
    p=insertEcoBlock(p,"pair","pair2","explanation");
    const order=getEcoLayout(p).map(block=>block.id);
    expect(order.slice(2,6)).toEqual(["section-description","image-pair1","explanation","image-pair2"]);
    p=moveEcoBlock(p,"image-pair2",2); expect(getEcoLayout(p)[2].id).toBe("image-pair2");
    p=insertEcoBlock(p,"text","opening",null); expect(getEcoLayout(p)[0].id).toBe("opening");
    expect(isEcoFormPayload(p)).toBe(true);
    expect(moveEcoBlock(p,"unknown",0)).toBe(p); expect(moveEcoBlock(p,"opening",-1)).toBe(p);
  });
  it("removes custom blocks and associated pictures without dropping approval sections or files", () => {
    let p=insertEcoBlock(empty(),"pair","photo"); p=insertEcoBlock(p,"text","text");
    p.initialApproval.signature=pixel; p.actions[0].attachments=[{id:"attachment",name:"test.txt",mimeType:"text/plain",data:"VGVzdA=="}];
    expect(removeEcoBlock(p,"section-initialApproval")).toBe(p);
    p=removeEcoBlock(removeEcoBlock(p,"image-photo"),"text");
    expect(p.illustrations).toEqual([]); expect(p.initialApproval.signature).toBe(pixel); expect(p.actions[0].attachments).toHaveLength(1);
    expect(getEcoLayout(p)).toHaveLength(9); expect(isEcoFormPayload(p)).toBe(true);
  });
  it("inserts extra uploaded pictures adjacent to their originating block, retaining intervening text", () => {
    let p=insertEcoBlock(empty(),"pair","pair","section-description"); p=insertEcoBlock(p,"text","text","image-pair");
    p=changeEcoIllustration(p,"pair",current=>[{...current[0],beforeImage:pixel},{...current[0],id:"extra",mode:"single",beforeImage:pixel}]);
    expect(getEcoLayout(p).map(block=>block.id).slice(2,6)).toEqual(["section-description","image-pair","image-extra","text"]);
    expect(isEcoFormPayload(p)).toBe(true);
    expect(()=>changeEcoIllustration(p,"pair",current=>[{...current[0],beforeImage:"A".repeat(2_500_001)}])).toThrow("מגבלת הגודל");
  });
  it("enforces size limits, mandatory unique sections and one valid reference per picture", () => {
    let p=insertEcoBlock(empty(),"pair","picture"); const layout=getEcoLayout(p);
    for(const bad of [null,[],[...layout,layout[0]],layout.slice(1),[...layout,{id:"bad",kind:"illustration",illustrationId:"unknown"}],[...layout,{id:"bad",kind:"text",title:"",text:"A".repeat(30001)}]]) expect(validEcoLayout(bad,p.illustrations!)).toBe(false);
    expect(isEcoFormPayload({...p,layout:[...layout,{id:"unknown",kind:"unknown"}]})).toBe(false);
    expect(isEcoFormPayload({...p,illustrations:[null]})).toBe(false);
    for(let i=0;i<30;i++)p=insertEcoBlock(p,"text",`text${i}`);
    expect(insertEcoBlock(p,"text","over-limit")).toBe(p); expect(isEcoFormPayload(p)).toBe(true);
  });
  it("exports and reopens the chosen order with text between two before/after tables", async () => {
    let p=insertEcoBlock(empty(),"pair","first","section-description");
    p=changeEcoIllustration(p,"first",current=>[{...current[0],beforeImage:pixel,afterImage:pixel,beforeCaption:"COMPARE_FIRST_BEFORE",afterCaption:"COMPARE_FIRST_AFTER"}]);
    p=insertEcoBlock(p,"text","explain","image-first"); p=changeEcoText(p,"explain",{title:"EXPLANATION_TITLE",text:"EXPLANATION_BETWEEN_PICTURES"});
    p=insertEcoBlock(p,"pair","second","explain"); p=changeEcoIllustration(p,"second",current=>[{...current[0],beforeImage:pixel,afterImage:pixel,beforeCaption:"COMPARE_SECOND_BEFORE",afterCaption:"COMPARE_SECOND_AFTER"}]);
    p=moveEcoBlock(p,"section-actions",2);
    p.actions[0].attachments=[{id:"file-with-layout",name:"details.txt",mimeType:"text/plain",data:"VGVzdA=="}];
    const spy=vi.spyOn(DavidFormPdf.prototype,"table");
    try {
      const bytes=await buildEcoFormPdf(p); expect(await extractEcoFormPayload(bytes)).toEqual(p);
      const cells=spy.mock.calls.flatMap(([rows])=>rows.flat().map((cell:FormCell)=>typeof cell==="string"?cell:cell.text));
      expect(cells.indexOf("COMPARE_FIRST_BEFORE")).toBeLessThan(cells.indexOf("EXPLANATION_BETWEEN_PICTURES"));
      expect(cells.indexOf("EXPLANATION_BETWEEN_PICTURES")).toBeLessThan(cells.indexOf("COMPARE_SECOND_BEFORE"));
      expect(cells.indexOf("פעולות נלוות")).toBeLessThan(cells.indexOf("תיאור השינוי - למילוי ע״י יוזם השינוי"));
    } finally {spy.mockRestore();}
  });
});
