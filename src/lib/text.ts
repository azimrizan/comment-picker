// Text helpers shared by every rule. Everything that reads comment text goes
// through normalizeText() first so emoji digits, fancy fonts and Indic numerals
// are treated exactly like plain ASCII.

const INDIC_DIGIT_BLOCKS = [
  0x0d66, // Malayalam
  0x0966, // Devanagari
  0x0be6, // Tamil
  0x0ce6, // Kannada
  0x0c66, // Telugu
  0x0660, // Arabic-Indic
  0x06f0, // Extended Arabic-Indic
];

export function normalizeText(input: string): string {
  // NFKC folds fullwidth digits and "𝐊𝐁𝐅𝐂"-style math letters to ASCII.
  let s = input.normalize("NFKC");
  // Keycap emoji: 2️⃣ -> 2, 🔟 -> 10
  s = s.replace(/([0-9#*])️?⃣/g, "$1").replace(/\u{1F51F}/gu, "10");
  for (const base of INDIC_DIGIT_BLOCKS) {
    const re = new RegExp(`[\\u${base.toString(16).padStart(4, "0")}-\\u${(base + 9).toString(16).padStart(4, "0")}]`, "g");
    s = s.replace(re, (d) => String(d.charCodeAt(0) - base));
  }
  return s;
}

/** Lowercase + strip Latin accents only (Malayalam vowel signs must survive). */
export function foldCase(s: string): string {
  return normalizeText(s).normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC").toLowerCase();
}

const MENTION_RE = /(?<![\p{L}\p{N}_@.])@([A-Za-z0-9._]+)/gu;

/** Instagram usernames: letters, digits, '.', '_', max 30 chars, no trailing '.'. */
export function extractMentions(text: string): string[] {
  const out: string[] = [];
  for (const m of normalizeText(text).matchAll(MENTION_RE)) {
    const name = m[1].replace(/\.+$/, "").toLowerCase();
    if (name.length >= 1 && name.length <= 30) out.push(name);
  }
  return out;
}

export function stripMentions(text: string): string {
  return normalizeText(text).replace(MENTION_RE, " ");
}

export function normalizeUsername(u: string): string {
  return u.trim().replace(/^@/, "").toLowerCase();
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word/phrase match. "#kbfc" will not match "#kbfcfans", "luna" will not
 * match "lunatic". Works for Malayalam too (combining marks count as part of a word).
 */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const p = foldCase(phrase).trim();
  if (!p) return false;
  const body = p.split(/\s+/).map(escapeRe).join("\\s+");
  const re = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${body}(?![\\p{L}\\p{M}\\p{N}_])`, "u");
  return re.test(foldCase(haystack));
}

export function words(text: string): string[] {
  return foldCase(text).match(/[\p{L}\p{M}\p{N}_']+/gu) ?? [];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Instagram timestamps look like 2026-10-20T10:00:00+0000; make them Date-safe. */
export function parseIgTime(ts: string): number {
  return Date.parse(ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
}
