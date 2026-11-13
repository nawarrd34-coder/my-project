import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { AiSummary, CategoryResult, Finding } from '@/types/audit';

/**
 * Optional AI layer. It only rewrites what the audit already established into
 * a short executive summary — it is given the verified findings as data and
 * is not allowed to add any. Without ANTHROPIC_API_KEY (or on any failure)
 * the app silently uses the deterministic recommendations alone.
 */
const MODEL = 'claude-opus-5-5';

const SummarySchema = z.object({
  summary_en: z.string(),
  summary_ar: z.string(),
});

const SYSTEM = `You write the executive summary of a website audit for a Saudi business owner who is not technical.

You receive JSON with category scores and a list of findings. Each finding was measured by the audit; its "params" are the evidence.

Rules:
- Use only what is in the JSON. Never mention an issue, number, tool, or cause that is not there.
- If a score is null, say that area could not be tested. Do not estimate it.
- Findings marked basis "inferred" are observations from the page's HTML, not measurements. Phrase them as "appears" / "we did not find".
- Do not predict revenue, sales, ranking positions, or traffic changes.
- 3 to 4 sentences per language: where the site stands, the one or two issues that matter most, and what to do first.
- Plain business language. No headings, lists, or markdown.
- summary_ar: natural Modern Standard Arabic as used in Saudi business writing, written directly in Arabic rather than translated word for word. Use Western digits.`;

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.AI_RECOMMENDATIONS !== 'off';
}

export async function summarizeWithAi(input: {
  host: string;
  overall: number | null;
  categories: CategoryResult[];
  findings: Finding[];
}): Promise<AiSummary | null> {
  if (!aiEnabled() || input.findings.length === 0) return null;
  try {
    const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
    const payload = {
      site: input.host,
      overall_score: input.overall,
      categories: input.categories.map((c) => ({ id: c.id, score: c.score, status: c.status })),
      findings: input.findings.slice(0, 25).map((f) => ({
        id: f.id,
        category: f.category,
        severity: f.severity,
        basis: f.basis,
        params: f.params,
      })),
    };
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: zodOutputFormat(SummarySchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
    if (response.stop_reason === 'refusal') return null;
    const out = response.parsed_output;
    if (!out || !out.summary_en.trim() || !out.summary_ar.trim()) return null;
    return { en: out.summary_en.trim().slice(0, 1200), ar: out.summary_ar.trim().slice(0, 1200), model: MODEL };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.warn(`[ai] summary skipped: ${err.status ?? 'network'} ${err.name}`);
    } else {
      console.warn('[ai] summary skipped');
    }
    return null;
  }
}
