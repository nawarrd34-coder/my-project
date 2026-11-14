/**
 * Minimal robots.txt support: groups for "*" and our own token, Allow/Disallow
 * with longest-match precedence, "*" and "$" wildcards, and Sitemap lines.
 */
export const BOT_TOKEN = 'businesshealthcheck';

interface Rule {
  allow: boolean;
  pattern: RegExp;
  length: number;
}

export interface Robots {
  isAllowed: (pathAndQuery: string) => boolean;
  sitemaps: string[];
}

const toRegex = (p: string) =>
  new RegExp(
    `^${p
      .replace(/[.+?^${}()|[\]\\]/g, (c) => (c === '$' ? c : `\\${c}`))
      .replace(/\*/g, '.*')
      .replace(/\\\$$/, '$')}`,
  );

export function parseRobots(text: string): Robots {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r?\n/).slice(0, 5000)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'sitemap') {
      if (/^https?:\/\//i.test(value)) sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (key === 'disallow' && value === '') continue; // empty Disallow = allow all
      current.rules.push({ allow: key === 'allow', pattern: toRegex(value), length: value.length });
    }
  }

  const own = groups.filter((g) => g.agents.some((a) => a !== '*' && BOT_TOKEN.includes(a)));
  const star = groups.filter((g) => g.agents.includes('*'));
  const rules = (own.length ? own : star).flatMap((g) => g.rules);

  return {
    sitemaps,
    isAllowed: (pathAndQuery: string) => {
      let best: Rule | null = null;
      for (const r of rules) {
        if (r.pattern.test(pathAndQuery) && (!best || r.length > best.length || (r.length === best.length && r.allow))) best = r;
      }
      return best ? best.allow : true;
    },
  };
}

export const allowAll: Robots = { isAllowed: () => true, sitemaps: [] };
