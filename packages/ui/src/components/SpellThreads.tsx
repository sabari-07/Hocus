import { useEffect, useRef } from 'react';
import { THREE } from '@hocus/three';
import { useRuntime } from '../hooks.ts';

/**
 * Spell threads: a glowing curve from every word chip that carries `data-thread` to the 3D object or place it
 * bound to. `data-thread="<id>"` or `data-thread="place:x,y,z"`; `data-thread-kind` is `bound` | `live` | `ask`.
 * Drawn in a fixed SVG layer, positions recomputed every animation frame (objects and the camera move).
 * Purely decorative (aria-hidden): the same information is in the chip text and the live region.
 */
export function SpellThreads() {
  const rt = useRuntime();
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let raf = 0;
    const paths = new Map<Element, SVGGElement>();
    const NS = 'http://www.w3.org/2000/svg';
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const root = svg.current;
      const stage = rt.stage;
      if (!root || !stage) return;
      const chips = Array.from(document.querySelectorAll<HTMLElement>('[data-thread]'));
      const seen = new Set<Element>();
      for (const chip of chips) {
        const r = chip.getBoundingClientRect();
        if (!r.width) continue;
        const spec = chip.dataset.thread!;
        let to: { x: number; y: number } | null = null;
        if (spec.startsWith('place:')) {
          const [x, y, z] = spec.slice(6).split(',').map(Number);
          const p = stage.toScreen(new THREE.Vector3(x, y, z));
          if (!p.behind) to = p;
        } else to = stage.screenOf(spec);
        if (!to) continue;
        seen.add(chip);
        let g = paths.get(chip);
        if (!g) {
          g = document.createElementNS(NS, 'g');
          g.innerHTML = '<path class="hx-thread__glow"/><path class="hx-thread__line"/><circle class="hx-thread__end" r="5"/>';
          root.appendChild(g);
          paths.set(chip, g);
        }
        g.setAttribute('class', `hx-thread hx-thread--${chip.dataset.threadKind ?? 'bound'}`);
        const x0 = r.left + r.width / 2;
        const y0 = r.top;
        const lift = Math.max(80, Math.abs(y0 - to.y) * 0.55);
        const d = `M ${x0} ${y0} C ${x0} ${y0 - lift}, ${to.x} ${to.y + lift * 0.6}, ${to.x} ${to.y}`;
        for (const p of g.querySelectorAll('path')) p.setAttribute('d', d);
        const end = g.querySelector('circle')!;
        end.setAttribute('cx', String(to.x));
        end.setAttribute('cy', String(to.y));
      }
      for (const [chip, g] of paths)
        if (!seen.has(chip)) {
          g.remove();
          paths.delete(chip);
        }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [rt]);

  return <svg ref={svg} className="hx-threads" aria-hidden="true" />;
}
