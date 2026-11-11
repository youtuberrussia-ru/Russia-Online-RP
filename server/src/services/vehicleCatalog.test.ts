import { describe, expect, it } from "vitest";
import { getVehicleCatalog, vehicleCatalog } from "./vehicleCatalog.js";

describe("vehicle catalogue", () => {
  it("contains unique stable vehicle codes and positive prices", () => {
    const codes = vehicleCatalog.map(vehicle => vehicle.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const vehicle of vehicleCatalog) expect(vehicle.price).toBeGreaterThan(0n);
  });

  it("exposes prices as decimal strings for JSON clients", () => {
    const catalogue = getVehicleCatalog();
    expect(catalogue.length).toBe(vehicleCatalog.length);
    expect(catalogue.every(vehicle => typeof vehicle.price === "string")).toBe(true);
  });
});
