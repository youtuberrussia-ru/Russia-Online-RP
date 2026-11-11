import { describe, expect, it } from "vitest";
import { getPropertyCatalog, propertyCatalog } from "./properties.js";

describe("property catalogue", () => {
  it("has unique stable codes and positive prices", () => {
    const codes = propertyCatalog.map(item => item.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const item of propertyCatalog) expect(item.price).toBeGreaterThan(0n);
  });

  it("serializes prices as decimal strings", () => {
    const catalogue = getPropertyCatalog();
    expect(catalogue).toHaveLength(propertyCatalog.length);
    expect(catalogue.every(item => typeof item.price === "string")).toBe(true);
  });
});
