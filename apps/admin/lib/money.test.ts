import { describe, expect, it } from "vitest";
import { formatRupees, paiseToRupeesInput, rupeesToPaise } from "./money";

describe("money inputs", () => {
  it("parses rupees text to integer paise without floats", () => {
    expect(rupeesToPaise("499")).toBe(49900);
    expect(rupeesToPaise("1,299.5")).toBe(129950);
    expect(rupeesToPaise("₹ 0.07")).toBe(7);
    expect(rupeesToPaise("19.99")).toBe(1999);
    expect(rupeesToPaise("1.234")).toBeNull();
    expect(rupeesToPaise("-5")).toBeNull();
    expect(rupeesToPaise("")).toBeNull();
  });
  it("round-trips and formats", () => {
    expect(paiseToRupeesInput(129950)).toBe("1299.50");
    expect(paiseToRupeesInput(49900)).toBe("499");
    expect(formatRupees(12345600)).toBe("₹1,23,456");
  });
});
