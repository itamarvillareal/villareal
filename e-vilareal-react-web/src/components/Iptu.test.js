import { describe, it, expect } from "vitest";

function parseValorBrParaNumero(tx) {
  const s = String(tx ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

describe("Iptu (helpers)", () => {
  it("parseValorBrParaNumero aceita formato BR", () => {
    expect(parseValorBrParaNumero("1.200,00")).toBe(1200);
    expect(parseValorBrParaNumero("")).toBeNull();
  });
});