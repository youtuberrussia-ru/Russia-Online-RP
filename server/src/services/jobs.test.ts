import { describe, expect, it } from "vitest";
import { calculateJobPayout, JOBS } from "./jobs.js";

describe("job catalogue and payout rules", () => {
  it("has unique stable job codes and positive server-owned rates", () => {
    expect(new Set(JOBS.map(job => job.code)).size).toBe(JOBS.length);
    expect(JOBS.every(job => job.hourlyRate > 0n)).toBe(true);
  });

  it("rejects shifts shorter than ten minutes", () => {
    expect(() => calculateJobPayout(1800n, 9 * 60 * 1000)).toThrow("SHIFT_TOO_SHORT");
  });

  it("calculates pay from server-measured elapsed time", () => {
    expect(calculateJobPayout(1800n, 30 * 60 * 1000)).toBe(900n);
  });

  it("caps paid time at two hours", () => {
    expect(calculateJobPayout(1800n, 8 * 60 * 60 * 1000)).toBe(3600n);
  });
});
