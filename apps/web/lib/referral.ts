/** A friend's referral code from a ?ref= link, kept until onboarding (per-browser convenience). */
const KEY = "mp_ref";
const VALID = /^[A-Z0-9]{6,12}$/;

export function rememberReferral(code: string | null) {
  const ref = code?.trim().toUpperCase();
  if (!ref || !VALID.test(ref)) return;
  try {
    localStorage.setItem(KEY, ref);
  } catch {
    // storage blocked: the referral is simply not applied
  }
}

export function storedReferral(): string | undefined {
  try {
    const ref = localStorage.getItem(KEY);
    return ref && VALID.test(ref) ? ref : undefined;
  } catch {
    return undefined;
  }
}
