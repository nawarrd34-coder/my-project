import en from '@/locales/en.json';
import ar from '@/locales/ar.json';

type Tree = Record<string, Record<string, string>>;

const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

/** Strip an i18next plural suffix so `days_one` and `days_other` compare equal. */
const baseKey = (key: string): string => {
  const suffix = PLURAL_SUFFIXES.find((s) => key.endsWith(s));
  return suffix ? key.slice(0, -suffix.length) : key;
};

const logicalKeys = (tree: Tree): Set<string> => {
  const out = new Set<string>();
  for (const [ns, entries] of Object.entries(tree)) {
    for (const key of Object.keys(entries)) out.add(`${ns}.${baseKey(key)}`);
  }
  return out;
};

/** Extract `{{placeholder}}` names from a string. */
const placeholders = (value: string): Set<string> =>
  new Set([...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1] as string));

describe('locale parity', () => {
  const enTree = en as unknown as Tree;
  const arTree = ar as unknown as Tree;

  it('defines the same namespaces in both languages', () => {
    expect(Object.keys(arTree).sort()).toEqual(Object.keys(enTree).sort());
  });

  it('defines the same logical keys in both languages', () => {
    const enKeys = logicalKeys(enTree);
    const arKeys = logicalKeys(arTree);
    const missingInAr = [...enKeys].filter((k) => !arKeys.has(k)).sort();
    const missingInEn = [...arKeys].filter((k) => !enKeys.has(k)).sort();
    expect({ missingInAr, missingInEn }).toEqual({ missingInAr: [], missingInEn: [] });
  });

  it('uses the same interpolation placeholders for each key', () => {
    const mismatches: string[] = [];
    for (const [ns, entries] of Object.entries(enTree)) {
      for (const [key, value] of Object.entries(entries)) {
        const base = baseKey(key);
        // Compare against any Arabic plural form of the same logical key.
        const candidates = Object.entries(arTree[ns] ?? {}).filter(
          ([arKey]) => baseKey(arKey) === base,
        );
        for (const [arKey, arValue] of candidates) {
          const expected = placeholders(value);
          const actual = placeholders(arValue);
          // `count` may legitimately be dropped in Arabic literal forms
          // ("عضو واحد" spells the one out), so only flag non-count drift.
          const missing = [...expected].filter((p) => p !== 'count' && !actual.has(p));
          const extra = [...actual].filter((p) => p !== 'count' && !expected.has(p));
          if (missing.length || extra.length) {
            mismatches.push(`${ns}.${arKey}: missing=[${missing}] extra=[${extra}]`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('provides every Arabic plural category where English pluralises', () => {
    const required = ['_zero', '_one', '_two', '_few', '_many', '_other'];
    const problems: string[] = [];
    for (const [ns, entries] of Object.entries(enTree)) {
      const pluralBases = new Set(
        Object.keys(entries)
          .filter((k) => PLURAL_SUFFIXES.some((s) => k.endsWith(s)))
          .map(baseKey),
      );
      for (const base of pluralBases) {
        for (const suffix of required) {
          if (!(base + suffix in (arTree[ns] ?? {}))) {
            problems.push(`ar.${ns}.${base}${suffix}`);
          }
        }
        // English only needs _one and _other.
        for (const suffix of ['_one', '_other']) {
          if (!(base + suffix in entries)) problems.push(`en.${ns}.${base}${suffix}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('has no empty translations', () => {
    const empties: string[] = [];
    for (const [lang, tree] of [['en', enTree], ['ar', arTree]] as const) {
      for (const [ns, entries] of Object.entries(tree)) {
        for (const [key, value] of Object.entries(entries)) {
          if (typeof value !== 'string' || value.trim() === '') empties.push(`${lang}.${ns}.${key}`);
        }
      }
    }
    expect(empties).toEqual([]);
  });
});
