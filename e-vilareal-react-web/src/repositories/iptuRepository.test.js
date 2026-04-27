import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/httpClient.js", () => ({
  request: vi.fn(),
}));

import { request } from "../api/httpClient.js";
import { registrarConsultaDebito, upsertAnual } from "./iptuRepository.js";

beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(request).mockResolvedValue({});
});

describe("iptuRepository", () => {
  it("registrarConsultaDebito envia dataConsulta em yyyy-MM-dd quando recebe dd/mm/yyyy", async () => {
    await registrarConsultaDebito({
      imovelId: 9,
      dataConsulta: "15/07/2025",
      existeDebito: true,
      valorDebito: "123,45",
    });
    expect(request).toHaveBeenCalledWith(
      "/api/iptu/consultas",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          imovelId: 9,
          dataConsulta: "2025-07-15",
          existeDebito: true,
          valorDebito: 123.45,
        }),
      }),
    );
  });

  it("upsertAnual envia numeros nativos", async () => {
    await upsertAnual({ imovelId: 2, anoReferencia: 2025, valorTotalAnual: 1200 });
    expect(request).toHaveBeenCalledWith(
      "/api/iptu/anual",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          imovelId: 2,
          anoReferencia: 2025,
          valorTotalAnual: 1200,
        }),
      }),
    );
  });
});