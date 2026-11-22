import type { Resolution } from '@hocus/core';

export function summarize(r: Resolution): string {
  const w = r.words.find((x) => x.candidates.length) ?? r.words[0];
  const cands = (w?.candidates ?? []).slice(0, 3).map((c) => `${c.label} ${c.evidence.toFixed(3)}`).join(', ');
  switch (r.status) {
    case 'resolved':
      return `Resolved via ${r.words.map((x) => `${x.word}: ${x.via}`).join('; ')}. Evidence: ${cands || 'n/a'}.`;
    case 'ask':
      return `Asked because the top candidates were within the margin: ${cands}.`;
    case 'no_target':
      return `No target: nothing reached the minimum evidence for "${w?.word ?? ''}".`;
    case 'no_action':
      return `No action: ${r.hint}.`;
  }
}
