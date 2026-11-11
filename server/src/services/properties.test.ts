import { describe, expect, it } from "vitest";
import { getPropertyCatalog, propertyCatalog } from "./properties.js";

describe("property catalogue", () => {
  it("has unique stable codes and positive prices", () => {
    const codes = propertyCatalog.map(item => item.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const item of propertyCatalog) expect(item.price).toBeGreaterThan(0n);
  });

  it("contains homes, apartments, garages and commercial premises", () => {
    const types = new Set(propertyCatalog.map(item => item.type));
    for (const type of ["ROOM", "APARTMENT", "PENTHOUSE", "HOUSE", "COTTAGE", "MANSION", "GARAGE", "WORKSHOP", "COMMERCIAL", "OFFICE"]) {
      expect(types.has(type as typeof propertyCatalog[number]["type"])).toBe(true);
    }
  });

  it("defines valid storage, parking and interior data", () => {
    for (const item of propertyCatalog) {
      expect(item.district.trim().length).toBeGreaterThan(0);
      expect(item.interiorCode.trim().length).toBeGreaterThan(0);
      expect(item.storageSlots).toBeGreaterThanOrEqual(0);
      expect(item.parkingSlots).toBeGreaterThanOrEqual(0);
    }
  });

  it("serializes prices as decimal strings", () => {
    const catalogue = getPropertyCatalog();
    expect(catalogue).toHaveLength(propertyCatalog.length);
    expect(catalogue.every(item => typeof item.price === "string")).toBe(true);
  });
});
