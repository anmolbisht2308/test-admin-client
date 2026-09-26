/** Rupees text ("499", "1,299.5") → integer paise, parsed as text (no float math). null if invalid. */
export function rupeesToPaise(input: string): number | null {
  const clean = input.replace(/[,\s₹]/g, "");
  const m = /^(\d{1,9})(?:\.(\d{0,2}))?$/.exec(clean);
  if (!m) return null;
  const rupees = m[1] ?? "0";
  const paise = (m[2] ?? "").padEnd(2, "0");
  return Number(rupees) * 100 + Number(paise);
}

/** Integer paise → "499" / "499.50" for inputs. */
export function paiseToRupeesInput(paise: number | null): string {
  if (paise === null) return "";
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return p === 0 ? String(r) : `${r}.${String(p).padStart(2, "0")}`;
}

/** Integer paise → "₹1,23,456.50" (display only). */
export function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}
