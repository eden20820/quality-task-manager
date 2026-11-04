export type YesNo = "yes" | "no" | "";
export type CuringMethod = "epoxy" | "uv" | "";
export type LeakTestMethod = "air-pressure" | "vacuum" | "bubbles" | "dye-penetration" | "";
export type FinalDecision = "pass" | "fail" | "repair" | "";

export type AdhesionLeakTestPayload = {
  testDate: string;
  testerName: string;
  testLocation: string;
  operationDescription: string;
  testedProduct: string;
  bondedProductMaterial: string;
  bondingArea: string;
  adheringProductMaterial: string;
  seamAreaOrLength: string;
  quantity: string;
  adhesiveType: string;
  adhesiveManufacturerModel: string;
  adhesiveExpiryDate: string;
  curingMethod: CuringMethod;
  exposureTime: string;
  waitingTime: string;
  temperature: string;
  humidity: string;
  underHood: YesNo;
  environmentNotes: string;
  testMethod: LeakTestMethod;
  cracks: YesNo;
  bubbles: YesNo;
  materialSeparation: YesNo;
  leakObserved: YesNo;
  leakLocation: string;
  findings: string;
  decision: FinalDecision;
  checkedByName: string;
  checkedByDate: string;
  checkedBySignature: string;
  approvedByName: string;
  approvedByDate: string;
  approvedBySignature: string;
};

export function createEmptyAdhesionLeakTest(today: string): AdhesionLeakTestPayload {
  return {
    testDate: today,
    testerName: "",
    testLocation: "",
    operationDescription: "",
    testedProduct: "",
    bondedProductMaterial: "",
    bondingArea: "",
    adheringProductMaterial: "",
    seamAreaOrLength: "",
    quantity: "",
    adhesiveType: "",
    adhesiveManufacturerModel: "",
    adhesiveExpiryDate: "",
    curingMethod: "",
    exposureTime: "",
    waitingTime: "",
    temperature: "",
    humidity: "",
    underHood: "",
    environmentNotes: "",
    testMethod: "",
    cracks: "",
    bubbles: "",
    materialSeparation: "",
    leakObserved: "",
    leakLocation: "",
    findings: "",
    decision: "",
    checkedByName: "",
    checkedByDate: today,
    checkedBySignature: "",
    approvedByName: "",
    approvedByDate: today,
    approvedBySignature: "",
  };
}

export function isAdhesionLeakTestPayload(value: unknown): value is AdhesionLeakTestPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  const stringFields: Array<keyof AdhesionLeakTestPayload> = [
    "testDate", "testerName", "testLocation", "operationDescription", "testedProduct",
    "bondedProductMaterial", "bondingArea", "adheringProductMaterial", "seamAreaOrLength",
    "quantity", "adhesiveType", "adhesiveManufacturerModel", "adhesiveExpiryDate",
    "exposureTime", "waitingTime", "temperature", "humidity", "environmentNotes",
    "leakLocation", "findings", "checkedByName", "checkedByDate", "checkedBySignature",
    "approvedByName", "approvedByDate", "approvedBySignature",
  ];
  return stringFields.every((field) => typeof payload[field] === "string")
    && ["", "epoxy", "uv"].includes(String(payload.curingMethod))
    && ["", "yes", "no"].includes(String(payload.underHood))
    && ["", "air-pressure", "vacuum", "bubbles", "dye-penetration"].includes(String(payload.testMethod))
    && [payload.cracks, payload.bubbles, payload.materialSeparation, payload.leakObserved].every((item) => ["", "yes", "no"].includes(String(item)))
    && ["", "pass", "fail", "repair"].includes(String(payload.decision))
    && String(payload.checkedBySignature).length < 1_500_000
    && String(payload.approvedBySignature).length < 1_500_000;
}
