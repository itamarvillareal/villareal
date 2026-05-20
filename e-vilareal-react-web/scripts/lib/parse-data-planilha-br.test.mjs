import { describe, expect, it } from "vitest";
import { parseDataPlanilhaBrIso, parseDataPlanilhaCellIso } from "./parse-data-planilha-br.mjs";

describe("parseDataPlanilhaBrIso", () => {
  it("interpreta d/m/aa como dia/mês/ano BR", () => {
    expect(parseDataPlanilhaBrIso("10/5/26")).toBe("2026-05-10");
    expect(parseDataPlanilhaBrIso("10/05/2026")).toBe("2026-05-10");
  });

  it("não inverte para mm/dd do serial Excel", () => {
    expect(parseDataPlanilhaBrIso("05/10/2026")).toBe("2026-10-05");
  });
});

describe("parseDataPlanilhaCellIso", () => {
  it("prefere texto formatado ao serial", () => {
    expect(parseDataPlanilhaCellIso(46300, "10/5/26")).toBe("2026-05-10");
  });
});
