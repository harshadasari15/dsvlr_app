import { describe, expect, it } from "vitest";
import { formatChainage, formatFixed, roundHalfUp } from "./index";

describe("roundHalfUp", () => {
  it("rounds .5 cases up where Math.round(x*1000)/1000 drifts", () => {
    expect(roundHalfUp(1.0005, 3)).toBe(1.001);
    expect(roundHalfUp(2.675, 2)).toBe(2.68);
  });
  it("rounds negatives away from zero", () => {
    expect(roundHalfUp(-1.0005, 3)).toBe(-1.001);
  });
  it("formats fixed decimals", () => {
    expect(formatFixed(5, 3)).toBe("5.000");
  });
});

describe("formatChainage", () => {
  it("formats km+m", () => {
    expect(formatChainage(11530)).toBe("11+530");
    expect(formatChainage(26050)).toBe("26+050");
    expect(formatChainage(0)).toBe("0+000");
  });
});
