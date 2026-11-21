import { z } from 'zod';
import type { HocusEvent } from './types.ts';

/** Zod schemas for every event that crosses a trust boundary (adapters, replay files, MCP input). */
const finite = z.number().finite();
const lang = z.enum(['en', 'hi', 'ta']);
const vec3 = z.object({ x: finite, y: finite, z: finite });
const surfacePoint = z.object({ surface: z.string().max(64), world: vec3 });

export const PointerSampleSchema = z.object({
  t: finite,
  x: finite,
  y: finite,
  conf: z.number().min(0).max(1),
  source: z.enum(['hand', 'head', 'mouse', 'touch']),
  pose: z.enum(['point', 'rest', 'confirm', 'cancel']),
  aperture: z.number().min(0).max(1).optional(),
  hits: z.array(z.object({ id: z.string().max(128), quality: z.number().min(0).max(1) })).max(64),
  place: surfacePoint.optional(),
});

export const SpeechEventSchema = z.object({
  t: finite,
  kind: z.enum(['start', 'interim', 'final', 'end', 'typed']),
  text: z.string().max(500).optional(),
  lang,
  alts: z.array(z.string().max(500)).max(10).optional(),
  vad: z.array(z.object({ start: finite, end: finite })).max(200).optional(),
});

const ids = z.array(z.string().max(128)).max(500);

export const HocusEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pointer'), sample: PointerSampleSchema }),
  z.object({ type: z.literal('speech'), speech: SpeechEventSchema }),
  z.object({ type: z.literal('select'), t: finite, ids, mode: z.enum(['replace', 'add', 'clear']), place: surfacePoint.optional() }),
  z.object({ type: z.literal('lasso'), t: finite, ids }),
  z.object({ type: z.literal('key'), t: finite, intent: z.enum(['confirm', 'cancel', 'undo', 'redo', 'choose']), index: z.number().int().min(0).max(9).optional() }),
  z.object({ type: z.literal('gesture'), t: finite, gesture: z.enum(['confirm', 'cancel']) }),
  z.object({ type: z.literal('tick'), t: finite }),
  z.object({ type: z.literal('calibrate'), t: finite, lagMs: finite }),
  z.object({ type: z.literal('config'), t: finite, patch: z.record(z.string(), z.union([finite, z.boolean(), z.string()])) }),
  z.object({ type: z.literal('lang'), t: finite, lang }),
  z.object({ type: z.literal('command'), t: finite, action: z.string().max(64), args: z.record(z.string(), z.unknown()) }),
]);

export const ReplayFileSchema = z.object({
  version: z.literal(1),
  app: z.string(),
  origin: z.enum(['synthetic', 'recorded']),
  description: z.string().optional(),
  lang: lang.default('en'),
  config: z.record(z.string(), z.union([finite, z.boolean(), z.string()])).optional(),
  events: z.array(HocusEventSchema),
  expected: z
    .object({
      decisions: z.array(z.object({ raw: z.string(), outcome: z.string(), bindings: z.record(z.string(), z.unknown()).optional() })).optional(),
      finalApp: z.unknown().optional(),
    })
    .optional(),
});

export type ReplayFile = z.infer<typeof ReplayFileSchema>;

/** Validate an event at the boundary. Throws with the bad field path (requirement 1.6). */
export function validateEvent(e: unknown): HocusEvent {
  const r = HocusEventSchema.safeParse(e);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new Error(`Invalid HocusEvent at "${issue?.path.join('.') || '(root)'}": ${issue?.message ?? 'unknown error'}`);
  }
  return r.data as HocusEvent;
}

export function parseReplayFile(json: unknown): ReplayFile {
  return ReplayFileSchema.parse(json);
}
