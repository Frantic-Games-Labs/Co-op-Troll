import { useEffect, useRef, useState } from 'react';
import { Game, type UISnapshot } from '../game/game';
import { VIEW_H, VIEW_W } from '../game/constants';
import { Overlays } from './Overlays';
import { TouchControls } from './TouchControls';

interface Layout { scale: number; left: number; top: number; portrait: boolean }

function computeLayout(): Layout {
  const vw = window.innerWidth, vh = window.innerHeight;
  const raw = Math.min(vw / VIEW_W, vh / VIEW_H);
  const scale = raw >= 2 ? Math.floor(raw) : Math.max(0.4, Math.floor(raw * 20) / 20);
  const w = VIEW_W * scale, h = VIEW_H * scale;
  return { scale, left: Math.floor((vw - w) / 2), top: Math.floor((vh - h) / 2), portrait: vh > vw };
}

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [ui, setUi] = useState<UISnapshot | null>(null);
  const [layout, setLayout] = useState<Layout>(() => computeLayout());
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, setUi);
    gameRef.current = game;
    game.start();
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setLayout(computeLayout());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    setTouch(window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const game = gameRef.current;
  const w = VIEW_W * layout.scale, h = VIEW_H * layout.scale;
  const fontSize = Math.max(9, 8 * layout.scale);
  const inGame = ui?.state === 'playing' || ui?.state === 'paused';

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#12131f' }}>
      <div className="absolute" style={{ width: w, height: h, left: layout.left, top: layout.top, fontSize }}>
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="block"
          style={{ width: w, height: h, imageRendering: 'pixelated' }}
        />
        <div className="crt absolute inset-0 pointer-events-none" />
        {ui && game && <Overlays ui={ui} game={game} touch={touch} />}
      </div>
      {touch && game && <TouchControls input={game.input} visible={!!inGame} />}
      {touch && layout.portrait && ui?.state === 'menu' && (
        <div className="absolute bottom-3 inset-x-0 text-center font-pixel text-[10px]" style={{ color: '#94b0c2' }}>
          ↻ rotate your device for a bigger arena
        </div>
      )}
    </div>
  );
}
