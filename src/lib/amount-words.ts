// Amounts in words, Indian numbering (thousand / lakh / crore), as printed on rent receipts.
// e.g. 125000 → "Rupees One Lakh Twenty Five Thousand Only". Safe for client and server.

const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 1..99 → words. */
function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return n % 10 ? `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}` : TENS[n / 10];
}

/** 1..999 → words. */
function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/**
 * Non-negative whole number → words in the Indian system.
 * Crores above 99 recurse ("One Hundred Twenty Crore", "Twelve Thousand Crore").
 */
export function numberToIndianWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`Expected a non-negative whole number, got ${n}`);
  if (n === 0) return ONES[0];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  return [
    crore ? `${numberToIndianWords(crore)} Crore` : "",
    lakh ? `${belowHundred(lakh)} Lakh` : "",
    thousand ? `${belowHundred(thousand)} Thousand` : "",
    rest ? belowThousand(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * INR amount → receipt wording (rounded to paise).
 *   125000   → "Rupees One Lakh Twenty Five Thousand Only"
 *   1500.5   → "Rupees One Thousand Five Hundred and Fifty Paise Only"
 *   0.75     → "Seventy Five Paise Only"
 *   0        → "Rupees Zero Only"
 */
export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount)) throw new RangeError(`Expected a finite amount, got ${amount}`);
  const totalPaise = Math.round(Math.abs(amount) * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const sign = amount < 0 && totalPaise > 0 ? "Minus " : "";

  let words: string;
  if (paise === 0) words = `Rupees ${numberToIndianWords(rupees)}`;
  else if (rupees === 0) words = `${belowHundred(paise)} Paise`;
  else words = `Rupees ${numberToIndianWords(rupees)} and ${belowHundred(paise)} Paise`;
  return `${sign}${words} Only`;
}
