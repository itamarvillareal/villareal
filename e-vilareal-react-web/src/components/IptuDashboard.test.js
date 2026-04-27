import { describe, it, expect } from "vitest";

function diasAte(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date();
  t.setHours(12, 0, 0, 0);
  return Math.ceil((d - t) / 86400000);
}

describe("IptuDashboard helpers", () => {
  it("diasAte retorna diferenca em dias", () => {
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    const fut = new Date(base);
    fut.setDate(fut.getDate() + 3);
    const iso = fut.toISOString().slice(0, 10);
    expect(diasAte(iso)).toBe(3);
  });
});