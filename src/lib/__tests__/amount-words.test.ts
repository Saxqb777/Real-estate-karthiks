import { describe, expect, it } from "vitest";
import { amountInWords, numberToIndianWords } from "../amount-words";

describe("numberToIndianWords", () => {
  it.each([
    [0, "Zero"],
    [1, "One"],
    [9, "Nine"],
    [10, "Ten"],
    [11, "Eleven"],
    [19, "Nineteen"],
    [20, "Twenty"],
    [21, "Twenty One"],
    [99, "Ninety Nine"],
    [100, "One Hundred"],
    [101, "One Hundred One"],
    [110, "One Hundred Ten"],
    [999, "Nine Hundred Ninety Nine"],
    [1000, "One Thousand"],
    [1001, "One Thousand One"],
    [8500, "Eight Thousand Five Hundred"],
    [10000, "Ten Thousand"],
    [99999, "Ninety Nine Thousand Nine Hundred Ninety Nine"],
    [100000, "One Lakh"],
    [100001, "One Lakh One"],
    [125000, "One Lakh Twenty Five Thousand"],
    [1000000, "Ten Lakh"],
    [1234567, "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven"],
    [4520000, "Forty Five Lakh Twenty Thousand"],
    [9999999, "Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine"],
    [10000000, "One Crore"],
    [12500000, "One Crore Twenty Five Lakh"],
    [10000100, "One Crore One Hundred"],
    [123456789, "Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine"],
    [1000000000, "One Hundred Crore"],
    [1234500000000, "One Lakh Twenty Three Thousand Four Hundred Fifty Crore"],
  ])("%d → %s", (n, words) => {
    expect(numberToIndianWords(n)).toBe(words);
  });

  it("rejects fractions, negatives and non-finite input", () => {
    expect(() => numberToIndianWords(1.5)).toThrow(RangeError);
    expect(() => numberToIndianWords(-1)).toThrow(RangeError);
    expect(() => numberToIndianWords(NaN)).toThrow(RangeError);
  });
});

describe("amountInWords", () => {
  it("formats the receipt example from the spec", () => {
    expect(amountInWords(125000)).toBe("Rupees One Lakh Twenty Five Thousand Only");
  });

  it.each([
    [0, "Rupees Zero Only"],
    [1, "Rupees One Only"],
    [8500, "Rupees Eight Thousand Five Hundred Only"],
    [25000, "Rupees Twenty Five Thousand Only"],
    [4520000, "Rupees Forty Five Lakh Twenty Thousand Only"],
    [12500000, "Rupees One Crore Twenty Five Lakh Only"],
  ])("whole rupees %d", (n, words) => {
    expect(amountInWords(n)).toBe(words);
  });

  it("supports paise", () => {
    expect(amountInWords(125000.5)).toBe("Rupees One Lakh Twenty Five Thousand and Fifty Paise Only");
    expect(amountInWords(100.05)).toBe("Rupees One Hundred and Five Paise Only");
    expect(amountInWords(1500.99)).toBe("Rupees One Thousand Five Hundred and Ninety Nine Paise Only");
    expect(amountInWords(12345678.9)).toBe(
      "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only",
    );
  });

  it("handles paise-only amounts", () => {
    expect(amountInWords(0.5)).toBe("Fifty Paise Only");
    expect(amountInWords(0.01)).toBe("One Paise Only");
  });

  it("is robust to binary floating point (0.29 * 100 = 28.999…)", () => {
    expect(amountInWords(0.29)).toBe("Twenty Nine Paise Only");
    expect(amountInWords(1.1)).toBe("Rupees One and Ten Paise Only");
  });

  it("rounds to the nearest paisa", () => {
    expect(amountInWords(99.999)).toBe("Rupees One Hundred Only");
    expect(amountInWords(10.004)).toBe("Rupees Ten Only");
  });

  it("prefixes negatives with Minus", () => {
    expect(amountInWords(-2500)).toBe("Minus Rupees Two Thousand Five Hundred Only");
    expect(amountInWords(-0.001)).toBe("Rupees Zero Only");
  });

  it("rejects non-finite amounts", () => {
    expect(() => amountInWords(Infinity)).toThrow(RangeError);
    expect(() => amountInWords(NaN)).toThrow(RangeError);
  });
});
