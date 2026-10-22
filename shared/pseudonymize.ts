const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Removes participant names from free texts before they are sent to an external LLM.
 * Replaces full names first, then single name parts (>= 3 characters) as whole words.
 */
export function pseudonymize(text: string, names: string[]): string {
  const parts = new Set<string>();
  for (const n of names) {
    const full = n.trim();
    if (full) parts.add(full);
    for (const word of full.split(/\s+/)) {
      if (word.length >= 3) parts.add(word);
      for (const p of word.split(/[.\-]+/)) if (p.length >= 3) parts.add(p);
    }
  }
  const sorted = [...parts].sort((a, b) => b.length - a.length);
  let out = text;
  for (const p of sorted) {
    // \b does not work for umlauts, so use explicit letter lookarounds
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(p)}(?![\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, '[Name]');
  }
  return out.replace(/(\[Name\]\s*){2,}/g, '[Name] ');
}
