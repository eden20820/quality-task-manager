import { describe, expect, it } from "vitest";

import { EMPTY_INTAKE, sanitizeIntake, validateIntake } from "./company-onboarding";

const valid = {
  ...EMPTY_INTAKE,
  companyName: "Acme",
  industry: "תעשייה וייצור",
  employeeRange: "11–50",
  contactName: "ישראל ישראלי",
  contactEmail: "quality@example.com",
  contactPhone: "0500000000",
  standards: ["ISO 9001"],
  certificationStage: "מוסמכים כיום",
  currentTools: ["Excel"],
  painPoints: "ריבוי קבצים",
  dataMigration: "לא",
  modules: ["אי התאמות ו-CAPA"],
  userCount: "11–25",
  userRoles: ["מנהל/ת איכות"],
  electronicSignatures: "לא בשלב הראשון",
  ssoRequired: "לא",
  languages: ["עברית"],
  integrations: ["לא נדרשת אינטגרציה בשלב הראשון"],
  notifications: ["דוא״ל"],
  goLiveTarget: "תוך 3 חודשים",
  implementationPriority: "גבוהה",
  successDefinition: "מקור מידע אחד",
};

describe("company onboarding", () => {
  it("accepts a complete intake", () => {
    expect(validateIntake(valid)).toEqual({});
  });

  it("allows a completely partial intake", () => {
    expect(validateIntake(EMPTY_INTAKE)).toEqual({});
  });

  it("validates an email only when one was entered", () => {
    expect(validateIntake({ ...EMPTY_INTAKE, contactEmail: "not-an-email" }).contactEmail).toBeTruthy();
  });

  it("sanitizes unknown values and limits arrays", () => {
    const parsed = sanitizeIntake({ ...valid, companyName: "\u0000  Acme  ", modules: Array(40).fill("Module") });
    expect(parsed.companyName).toBe("Acme");
    expect(parsed.modules).toHaveLength(30);
  });
});
