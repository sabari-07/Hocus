import { z } from 'zod';

/**
 * Optional on-device language proposer (Chrome built-in Prompt API, `LanguageModel`).
 * "Language proposes, the engine disposes": it may only rewrite free-form phrasing into ONE of
 * the app's own example commands, keeping the user's pointing words. The rewrite is passed to the
 * engine as an alternative transcript; the engine still parses it and binds every pointing word
 * from pointer evidence. The proposer never chooses a target and never executes anything.
 */
interface LMSession {
  prompt(input: string, opts?: { responseConstraint?: unknown; signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}
interface LMStatic {
  availability(opts?: unknown): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(opts?: unknown): Promise<LMSession>;
}

const LM_OPTS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };

const Out = z.object({ command: z.string().max(120) });

export type ProposerStatus = 'unsupported' | 'unavailable' | 'downloadable' | 'ready';

export class Proposer {
  status: ProposerStatus = 'unsupported';
  private session: LMSession | null = null;
  enabled = false;

  private api(): LMStatic | undefined {
    return (globalThis as unknown as { LanguageModel?: LMStatic }).LanguageModel;
  }

  async check(): Promise<ProposerStatus> {
    const api = this.api();
    if (!api) return (this.status = 'unsupported');
    try {
      const a = await api.availability(LM_OPTS);
      this.status = a === 'available' ? 'ready' : a === 'unavailable' ? 'unavailable' : 'downloadable';
    } catch {
      this.status = 'unavailable';
    }
    return this.status;
  }

  /** Returns a rewrite chosen from `allowed`, or null. Times out quickly to keep latency low. */
  async propose(utterance: string, allowed: string[], timeoutMs = 1500): Promise<string | null> {
    if (!this.enabled || this.status !== 'ready') return null;
    const api = this.api();
    if (!api) return null;
    try {
      this.session ??= await api.create({
        ...LM_OPTS,
        initialPrompts: [
          {
            role: 'system',
            content:
              'Rewrite the user utterance into exactly one command from the allowed list. Keep pointing words (this, that, these, here, there, it) as the user said them. If nothing fits, answer with an empty command.',
          },
        ],
      });
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const raw = await this.session.prompt(`Allowed: ${JSON.stringify(allowed)}\nUtterance: ${JSON.stringify(utterance)}`, {
        signal: ctrl.signal,
        responseConstraint: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      });
      clearTimeout(timer);
      const parsed = Out.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      const cmd = parsed.data.command.trim();
      // Strict validation: must be one of the allowed templates (after normalising case and punctuation).
      const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
      return allowed.some((a) => norm(a) === norm(cmd)) ? cmd : null;
    } catch {
      return null;
    }
  }
}
