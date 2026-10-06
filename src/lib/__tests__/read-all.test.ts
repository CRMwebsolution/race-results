import { describe, expect, it } from "vitest";
import { readAll } from "../read-all";
describe("complete API reads", () => {
  it("continues through a server cap smaller than the requested page", async () => {
    const all = Array.from({ length: 1203 }, (_, id) => ({ id }));
    const query = { order: () => query, range: async (from: number) => ({ data: all.slice(from, from + 137), error: null }) };
    expect((await readAll(query)).data).toEqual(all);
  });
  it("rejects a failed later page rather than returning a partial race", async () => {
    const query = { order: () => query, range: async (from: number) => from ? { data: null, error: { message: "Permission denied" } } : { data: [{ id: 1 }], error: null } };
    await expect(readAll(query)).rejects.toThrow("Permission denied");
  });
});
