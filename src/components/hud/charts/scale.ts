// Axis helpers — pure layout maths (tick spacing / labels), never money maths. Unit-tested.
import { formatIndianNumber } from "../../../lib/format";

/** ~count evenly spaced round ticks covering [min, max] (always includes 0 when the range crosses it). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === 0 && max === 0) return [0, 1000]; // nothing to plot yet: a calm ₹0–₹1k frame
  if (max === min) {
    max = min > 0 ? min * 1.5 : 0;
    min = min > 0 ? 0 : min * 1.5;
  }
  const span = max - min;
  const raw = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  // whole rupees only — never a ₹0.25 tick
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * pow).find((st) => span / st <= count + 0.5) ?? 10 * pow);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Axis label: ₹0 · ₹5k · ₹1.2 L · ₹1 Cr (axis only — tooltips and labels use exact ₹). */
export function axisINR(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a === 0) return "₹0";
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7)} Cr`;
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5)} L`;
  if (a >= 1e3) return `${sign}₹${trim(a / 1e3)}k`;
  return `${sign}₹${formatIndianNumber(a)}`;
}
const trim = (x: number) => x.toFixed(x >= 10 ? 0 : 1).replace(/\.0$/, "");

