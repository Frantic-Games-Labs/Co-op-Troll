import { useEffect, useRef, useState } from 'react';
import type { ButtonName, Input } from '../game/input';
import type { PlayerId } from '../game/types';

interface Props { input: Input; visible: boolean }

const P1 = { bg: 'rgba(65,166,246,0.28)', border: '#41a6f6' };
const P2 = { bg: 'rgba(239,125,87,0.28)', border: '#ef7d57' };

function Btn({ k, pressed, color, children }: { k: string; pressed: boolean; color: typeof P1; children: string }) {
  return (
    <div
      data-btn={k}
      className="flex items-center justify-center rounded-md font-pixel text-white text-xl sm:text-2xl select-none"
      style={{
        width: 'clamp(46px, 11vw, 68px)',
        height: 'clamp(46px, 11vw, 68px)',
        background: pressed ? color.border : color.bg,
        border: `2px solid ${color.border}`,
        boxShadow: pressed ? 'none' : `0 4px 0 ${color.border}55`,
        transform: pressed ? 'translateY(3px)' : 'none',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        opacity: 0.95,
      }}
    >
      {children}
    </div>
  );
}

/** Split-screen virtual pads: P1 bottom-left, P2 bottom-right. Multi-touch + slide aware. */
export function TouchControls({ input, visible }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = new Map<number, string>();
    const sync = () => setPressed(new Set(active.values()));
    const press = (key: string, down: boolean) => {
      const [pid, btn] = key.split(':');
      input.setTouch(Number(pid) as PlayerId, btn as ButtonName, down);
    };
    const keyAt = (x: number, y: number): string | null => {
      const t = document.elementFromPoint(x, y) as HTMLElement | null;
      return t?.closest<HTMLElement>('[data-btn]')?.dataset.btn ?? null;
    };
    const onStart = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const k = keyAt(t.clientX, t.clientY);
        if (!k) continue;
        e.preventDefault();
        active.set(t.identifier, k);
        press(k, true);
      }
      sync();
    };
    const onMove = (e: TouchEvent) => {
      let changed = false;
      for (const t of Array.from(e.changedTouches)) {
        const prev = active.get(t.identifier);
        if (prev === undefined) continue;
        e.preventDefault();
        const k = keyAt(t.clientX, t.clientY);
        if (k === prev) continue;
        press(prev, false);
        if (k) { active.set(t.identifier, k); press(k, true); } else active.delete(t.identifier);
        changed = true;
      }
      if (changed) sync();
    };
    const onEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const prev = active.get(t.identifier);
        if (prev === undefined) continue;
        e.preventDefault();
        press(prev, false);
        active.delete(t.identifier);
      }
      sync();
    };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    el.addEventListener('touchcancel', onEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      for (const k of active.values()) press(k, false);
    };
  }, [input]);

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-30 pointer-events-none transition-opacity"
      style={{ opacity: visible ? 1 : 0, visibility: visible ? 'visible' : 'hidden' }}
    >
      <div className="flex items-end justify-between px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="flex items-end gap-2 pointer-events-auto">
          <Btn k="1:left" pressed={pressed.has('1:left')} color={P1}>◀</Btn>
          <Btn k="1:right" pressed={pressed.has('1:right')} color={P1}>▶</Btn>
          <div className="w-3 sm:w-6" />
          <Btn k="1:jump" pressed={pressed.has('1:jump')} color={P1}>▲</Btn>
        </div>
        <div className="flex items-end gap-2 pointer-events-auto">
          <Btn k="2:jump" pressed={pressed.has('2:jump')} color={P2}>▲</Btn>
          <div className="w-3 sm:w-6" />
          <Btn k="2:left" pressed={pressed.has('2:left')} color={P2}>◀</Btn>
          <Btn k="2:right" pressed={pressed.has('2:right')} color={P2}>▶</Btn>
        </div>
      </div>
      <div className="flex justify-between px-4 pb-1 font-pixel text-[9px] text-white/50 -mt-1">
        <span style={{ color: '#41a6f6' }}>P1</span>
        <span style={{ color: '#ef7d57' }}>P2</span>
      </div>
    </div>
  );
}
