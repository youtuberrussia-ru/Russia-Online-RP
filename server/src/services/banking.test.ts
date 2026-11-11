import { describe, expect, it } from "vitest";
import { assertBankRequestId, parseBankAmount } from "./banking.js";

describe("banking input validation", () => {
  it("accepts positive integer amounts as exact bigint values", () => {
    expect(parseBankAmount("1")).toBe(1n);
    expect(parseBankAmount("250000")).toBe(250000n);
    expect(parseBankAmount("1000000000")).toBe(1_000_000_000n);
  });

  it("rejects zero, signs, decimals, whitespace and oversized values", () => {
    for (const value of ["0", "-1", "+2", "1.5", " 10", "1000000001", "1e4"]) {
      expect(() => parseBankAmount(value)).toThrow();
    }
  });

  it("requires a UUID request key", () => {
    expect(() => assertBankRequestId("not-a-uuid")).toThrow("INVALID_REQUEST_ID");
    expect(() => assertBankRequestId("550e8400-e29b-41d4-a716-446655440000")).not.toThrow();
  });
});
