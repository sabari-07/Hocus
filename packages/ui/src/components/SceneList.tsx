import { useMemo, useState } from 'react';
import type { SlotKind } from '@hocus/core';
import { useCore, useRuntime } from '../hooks.ts';
import { t } from '../i18n/index.ts';

/**
 * Keyboard and screen-reader path to every object (modality parity, a11y.md).
 * Selecting an item opens an Actions menu with the same commands the voice path offers.
 */
export function SceneList({ title }: { title?: string }) {
  const rt = useRuntime();
  const core = useCore();
  const items = rt.engine.selectables(core);
  const selected = core.selection.ids;
  const [focusIdx, setFocusIdx] = useState(0);
  const menu = useMemo(
    () =>
      Object.entries(rt.app.actions).filter(([, spec]) => {
        const kinds = Object.values(spec.slots) as SlotKind[];
        // Offer actions whose required slots can be filled from the selection alone.
        return (kinds.includes('object') || kinds.includes('objects')) && kinds.every((k) => ['object', 'objects', 'factor', 'number', 'color', 'boolean', 'place'].includes(k));
      }),
    [rt.app],
  );
  const target = selected[0];
  const targetCaps = items.find((i) => i.id === target)?.caps ?? [];

  const run = (name: string) => {
    const spec = rt.app.actions[name]!;
    const args: Record<string, unknown> = {};
    for (const [slot, kind] of Object.entries(spec.slots)) {
      if (kind === 'object') args[slot] = slot === Object.keys(spec.slots).filter((s) => spec.slots[s] === 'object')[1] ? selected[1] : target;
      if (kind === 'objects') args[slot] = selected;
      if (kind === 'factor') args[slot] = spec.defaults?.[slot] ?? 1.25;
      if (kind === 'color') args[slot] = 'green';
      if (kind === 'boolean') args[slot] = true;
      if (kind === 'place') args[slot] = { x: 0, y: 0, world: { x: 0, y: 0, z: 0.5 }, surface: 'floor' };
    }
    rt.command(name, args);
  };

  return (
    <nav aria-label={title ?? t('sceneList')}>
      <h2>{title ?? t('sceneList')}</h2>
      <ul
        className="hx-scenelist"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const n = (focusIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
            setFocusIdx(n);
            (e.currentTarget.querySelectorAll('button')[n] as HTMLButtonElement | undefined)?.focus();
          }
        }}
      >
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              aria-pressed={selected.includes(it.id)}
              tabIndex={i === focusIdx ? 0 : -1}
              onFocus={() => setFocusIdx(i)}
              onClick={(e) => rt.select([it.id], e.shiftKey || e.ctrlKey || e.metaKey ? 'add' : 'replace')}
            >
              {rt.engine.labelOf(core, it.id)}
            </button>
          </li>
        ))}
      </ul>
      {target && (
        <div role="group" aria-label={t('actions')} className="hx-menu">
          {menu
            .filter(([, spec]) => !spec.requires || targetCaps.includes(spec.requires))
            .filter(([, spec]) => !spec.distinct || selected.length >= 2)
            .map(([name, spec]) => (
              <button key={name} className="hx-btn" onClick={() => run(name)}>
                {spec.menuLabel ?? name}
              </button>
            ))}
        </div>
      )}
    </nav>
  );
}
