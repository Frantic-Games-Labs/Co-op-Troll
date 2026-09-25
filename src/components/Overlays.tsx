import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Game, UISnapshot } from '../game/game';
import { formatTime } from '../game/scores';
import { getPlayerSprite } from '../game/sprites';
import type { PlayerId } from '../game/types';

const C = {
  bg: '#1a1c2c', deep: '#12131f', slate: '#566c86', grey: '#94b0c2', white: '#f4f4f4',
  yellow: '#ffcd75', orange: '#ef7d57', red: '#b13e53', lime: '#a7f070', green: '#38b764',
  sky: '#41a6f6', cyan: '#73eff7', purple: '#5d275d', dark: '#333c57',
};

// ----------------------------------------------------------------- atoms
function Btn({ children, onClick, color = C.yellow, text = C.deep, small }: {
  children: ReactNode; onClick: () => void; color?: string; text?: string; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-pixel leading-none cursor-pointer transition-transform active:translate-y-[0.2em] hover:brightness-110 ${small ? 'text-[0.7em] px-[1em] py-[0.7em]' : 'text-[0.95em] px-[1.4em] py-[0.9em]'}`}
      style={{ background: color, color: text, boxShadow: `0 0.3em 0 ${C.deep}, 0 0.3em 0 0.15em ${C.dark}` }}
    >
      {children}
    </button>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`anim-pop font-pixel text-center ${className}`}
      style={{ background: 'rgba(26,28,44,0.96)', border: `0.25em solid ${C.slate}`, boxShadow: `0.5em 0.5em 0 ${C.deep}`, padding: '1.4em 1.8em' }}
    >
      {children}
    </div>
  );
}

function Sprite({ pid, size = 4 }: { pid: PlayerId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    let frame = 0;
    let alive = true;
    const draw = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      const f = Math.floor(frame / 20) % 2 === 0 ? 'run1' : 'run2';
      const bob = Math.floor(frame / 20) % 2;
      ctx.drawImage(getPlayerSprite(pid, f, pid === 1 ? 1 : -1, frame % 180 < 8), 0, 0, 10, 14, 0, bob, 10 * size, 14 * size);
      frame++;
      requestAnimationFrame(draw);
    };
    draw();
    return () => { alive = false; };
  }, [pid, size]);
  return <canvas ref={ref} width={10 * size} height={14 * size + size} style={{ imageRendering: 'pixelated' }} />;
}

const Key = ({ children, color }: { children: ReactNode; color: string }) => (
  <span className="inline-block px-[0.45em] py-[0.3em] mx-[0.1em] text-[0.8em] leading-none" style={{ border: `0.15em solid ${color}`, color, boxShadow: `0 0.15em 0 ${color}` }}>{children}</span>
);

// ------------------------------------------------------------------- HUD
function Hud({ ui, game }: { ui: UISnapshot; game: Game }) {
  return (
    <>
      <div className="absolute inset-x-0 top-0 flex items-start justify-between px-[0.8em] py-[0.5em] font-pixel text-[0.85em] pointer-events-none" style={{ textShadow: `0.12em 0.12em 0 ${C.deep}` }}>
        <div style={{ color: C.grey }}>
          <span style={{ color: C.yellow }}>LV {ui.levelIndex + 1}/{ui.levelCount}</span> {ui.levelName.toUpperCase()}
        </div>
        <div style={{ color: C.white }}>{formatTime(ui.time)}</div>
        <div className="flex items-center gap-[0.6em]">
          <span style={{ color: C.red }}>☠ {ui.deaths}</span>
          <span key={ui.hudBounce} className={ui.hudBounce > 0 ? 'anim-bonk inline-block' : 'inline-block'} style={{ color: C.lime }}>★ {ui.score}</span>
          <button className="pointer-events-auto cursor-pointer hover:brightness-125 px-[0.4em] py-[0.3em] -my-[0.3em]" style={{ color: C.grey }} onClick={(e) => { e.currentTarget.blur(); game.toggleMute(); }} aria-label="Toggle sound">{ui.muted ? '♪✕' : '♪'}</button>
          <button className="pointer-events-auto cursor-pointer hover:brightness-125 px-[0.4em] py-[0.3em] -my-[0.3em]" style={{ color: C.grey }} onClick={(e) => { e.currentTarget.blur(); game.restartLevel(); }} aria-label="Restart level">↻</button>
          <button className="pointer-events-auto cursor-pointer hover:brightness-125 px-[0.4em] py-[0.3em] -my-[0.3em]" style={{ color: C.yellow }} onClick={(e) => { e.currentTarget.blur(); game.togglePause(); }} aria-label="Pause">▐▐</button>
        </div>
      </div>
      {ui.swapped && (
        <div className="absolute inset-x-0 top-[2.2em] flex justify-center pointer-events-none">
          <div className="font-pixel text-[0.65em] px-[1em] py-[0.5em] anim-blink" style={{ background: 'rgba(93,39,93,0.9)', color: C.cyan, border: `0.15em solid ${C.cyan}` }}>
            ⇄ CONTROLS SWAPPED ⇄
          </div>
        </div>
      )}
    </>
  );
}

function IntroBanner({ ui }: { ui: UISnapshot }) {
  if (ui.introT <= 0) return null;
  const a = Math.min(1, ui.introT / 0.5);
  return (
    <div className="absolute inset-x-0 top-[22%] flex flex-col items-center font-pixel text-center pointer-events-none" style={{ opacity: a }}>
      <div className="anim-pop text-[1.9em] pixel-shadow" style={{ color: C.yellow }}>{ui.levelName.toUpperCase()}</div>
      <div className="mt-[0.6em] text-[0.8em] pixel-shadow" style={{ color: C.cyan }}>{ui.levelSubtitle}</div>
      <div className="mt-[1.2em] text-[0.7em] px-[1em] py-[0.6em] max-w-[80%]" style={{ background: 'rgba(18,19,31,0.85)', color: C.grey }}>{ui.tip}</div>
    </div>
  );
}

function MessageToast({ ui }: { ui: UISnapshot }) {
  if (!ui.message) return null;
  const troll = ui.message.style === 'troll';
  return (
    <div className="absolute inset-x-0 top-[12%] flex justify-center pointer-events-none">
      <div key={ui.message.text} className="anim-pop font-pixel text-[0.85em] px-[1em] py-[0.7em] max-w-[85%] text-center" style={{ background: 'rgba(18,19,31,0.9)', color: troll ? C.orange : C.cyan, border: `0.15em solid ${troll ? C.orange : C.cyan}` }}>
        {ui.message.text}
      </div>
    </div>
  );
}

function DeathBanner({ ui }: { ui: UISnapshot }) {
  if (!ui.death) return null;
  return (
    <div className="absolute inset-x-0 top-[34%] flex flex-col items-center font-pixel text-center pointer-events-none">
      <div className="anim-pop text-[2.1em] pixel-shadow" style={{ color: C.red }}>SHARED FATE</div>
      <div className="mt-[0.8em] text-[0.8em] px-[1em] py-[0.5em]" style={{ background: 'rgba(18,19,31,0.9)', color: C.white }}>{ui.death}</div>
      <div className="mt-[0.9em] text-[0.65em] anim-blink" style={{ color: C.grey }}>BOTH RESTART... (R = instant)</div>
    </div>
  );
}

// --------------------------------------------------------------- screens
function Menu({ game, touch }: { game: Game; touch: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(18,19,31,0.78)' }}>
      <div className="flex items-end gap-[1.2em]">
        <div className="anim-float"><Sprite pid={1} size={4} /></div>
        <div className="font-pixel text-center">
          <div className="text-[2.6em] leading-none pixel-shadow" style={{ color: C.yellow }}>SHARED</div>
          <div className="text-[2.6em] leading-none pixel-shadow mt-[0.15em]" style={{ color: C.orange }}>FATE</div>
        </div>
        <div className="anim-float" style={{ animationDelay: '0.8s' }}><Sprite pid={2} size={4} /></div>
      </div>
      <div className="font-pixel text-[0.75em] mt-[1em]" style={{ color: C.cyan }}>a 2-player co-op platformer of dumb, hilarious deaths</div>

      <div className="flex gap-[1em] mt-[1.6em]">
        <Btn onClick={() => game.play()}>▶ PLAY {touch ? '' : '(ENTER)'}</Btn>
        <Btn onClick={() => game.showScores()} color={C.dark} text={C.white}>HIGH SCORES</Btn>
      </div>

      <div className="grid grid-cols-2 gap-[1.6em] mt-[1.6em] font-pixel text-[0.7em]">
        <div className="text-center">
          <div style={{ color: C.sky }}>PLAYER 1</div>
          <div className="mt-[0.6em]"><Key color={C.sky}>A</Key><Key color={C.sky}>D</Key> move <Key color={C.sky}>W</Key> jump</div>
        </div>
        <div className="text-center">
          <div style={{ color: C.orange }}>PLAYER 2</div>
          <div className="mt-[0.6em]"><Key color={C.orange}>◀</Key><Key color={C.orange}>▶</Key> move <Key color={C.orange}>▲</Key> jump</div>
        </div>
      </div>
      <div className="font-pixel text-[0.62em] mt-[1.4em] text-center leading-[1.8]" style={{ color: C.grey }}>
        BOTH must reach the EXIT. If one dies, BOTH restart.<br />
        Plates need weight. Signs lie. Balloons kill. Pianos fall.{touch ? ' Touch pads: P1 left, P2 right.' : ' ESC pause · R restart · M mute'}
      </div>
    </div>
  );
}

function Pause({ game, ui }: { game: Game; ui: UISnapshot }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(18,19,31,0.7)' }}>
      <Panel>
        <div className="text-[1.6em]" style={{ color: C.yellow }}>PAUSED</div>
        <div className="text-[0.65em] mt-[0.8em]" style={{ color: C.grey }}>LV {ui.levelIndex + 1} · {formatTime(ui.time)} · ☠ {ui.deaths}</div>
        <div className="flex flex-col gap-[0.8em] mt-[1.4em]">
          <Btn onClick={() => game.togglePause()}>RESUME</Btn>
          <Btn onClick={() => game.restartLevel()} color={C.sky}>RESTART LEVEL</Btn>
          <Btn onClick={() => game.toggleMute()} color={C.dark} text={C.white} small>SOUND: {ui.muted ? 'OFF' : 'ON'}</Btn>
          <Btn onClick={() => game.quitToMenu()} color={C.red} text={C.white} small>QUIT TO MENU</Btn>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, color = C.white }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between gap-[2em] text-[0.75em]">
      <span style={{ color: C.grey }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

function LevelClear({ game, ui }: { game: Game; ui: UISnapshot }) {
  const r = ui.lastResult;
  if (!r) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(18,19,31,0.6)' }}>
      <Panel>
        <div className="text-[1.5em]" style={{ color: C.lime }}>LEVEL CLEAR!</div>
        <div className="text-[0.65em] mt-[0.5em]" style={{ color: C.grey }}>{r.name.toUpperCase()}</div>
        <div className="flex flex-col gap-[0.5em] mt-[1.2em]">
          <Stat label="TIME" value={formatTime(r.time)} />
          <Stat label="DEATHS" value={String(r.deaths)} color={C.red} />
          <Stat label="LEVEL SCORE" value={`+${r.score}`} color={C.yellow} />
          <Stat label="TOTAL" value={String(ui.score)} color={C.lime} />
        </div>
        <div className="mt-[1.4em]"><Btn onClick={() => game.nextLevel()}>NEXT LEVEL ▶</Btn></div>
        <div className="text-[0.55em] mt-[0.8em]" style={{ color: C.slate }}>press ENTER</div>
      </Panel>
    </div>
  );
}

function Victory({ game, ui }: { game: Game; ui: UISnapshot }) {
  const [name, setName] = useState('P1 & P2');
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(18,19,31,0.75)' }}>
      <Panel>
        <div className="text-[1.3em]" style={{ color: C.yellow }}>YOU ESCAPED TOGETHER!</div>
        <div className="flex justify-center gap-[1em] mt-[0.6em]"><Sprite pid={1} size={2} /><Sprite pid={2} size={2} /></div>
        <div className="flex flex-col gap-[0.4em] mt-[0.8em]">
          <Stat label="TOTAL TIME" value={formatTime(ui.runTime)} />
          <Stat label="TOTAL DEATHS" value={String(ui.runDeaths)} color={C.red} />
          <Stat label="FINAL SCORE" value={String(ui.score)} color={C.lime} />
        </div>
        {ui.isHigh && !ui.scoreSaved ? (
          <div className="mt-[1em]">
            <div className="text-[0.7em] anim-blink" style={{ color: C.cyan }}>NEW HIGH SCORE!</div>
            <div className="flex gap-[0.6em] mt-[0.7em] justify-center">
              <input
                value={name}
                maxLength={12}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') game.submitScore(name); e.stopPropagation(); }}
                className="font-pixel text-[0.8em] px-[0.6em] py-[0.5em] outline-none w-[11em]"
                style={{ background: C.deep, color: C.white, border: `0.15em solid ${C.slate}` }}
                placeholder="TEAM NAME"
              />
              <Btn onClick={() => game.submitScore(name)} small>SAVE</Btn>
            </div>
          </div>
        ) : (
          <div className="flex gap-[0.8em] mt-[1.2em] justify-center">
            <Btn onClick={() => game.showScores()} color={C.dark} text={C.white} small>SCORES</Btn>
            <Btn onClick={() => game.play()} small>PLAY AGAIN</Btn>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Scores({ game, ui }: { game: Game; ui: UISnapshot }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(18,19,31,0.85)' }}>
      <Panel className="min-w-[60%]">
        <div className="text-[1.3em]" style={{ color: C.yellow }}>HIGH SCORES</div>
        {ui.scores.length === 0 ? (
          <div className="text-[0.7em] mt-[1.2em]" style={{ color: C.grey }}>No teams have escaped yet.</div>
        ) : (
          <table className="mt-[1em] w-full text-[0.68em]" style={{ borderSpacing: 0 }}>
            <thead>
              <tr style={{ color: C.slate }}>
                <th className="text-left font-normal pb-[0.5em]">#</th>
                <th className="text-left font-normal pb-[0.5em]">TEAM</th>
                <th className="text-right font-normal pb-[0.5em]">SCORE</th>
                <th className="text-right font-normal pb-[0.5em]">TIME</th>
                <th className="text-right font-normal pb-[0.5em]">☠</th>
              </tr>
            </thead>
            <tbody>
              {ui.scores.map((s, i) => (
                <tr key={s.date + '-' + i} style={{ color: i === 0 ? C.yellow : C.white }}>
                  <td className="text-left py-[0.25em]">{i + 1}</td>
                  <td className="text-left py-[0.25em]">{s.name}</td>
                  <td className="text-right py-[0.25em]" style={{ color: C.lime }}>{s.score}</td>
                  <td className="text-right py-[0.25em]">{formatTime(s.time)}</td>
                  <td className="text-right py-[0.25em]" style={{ color: C.red }}>{s.deaths}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex gap-[0.8em] mt-[1.4em] justify-center">
          <Btn onClick={() => game.play()} small>PLAY</Btn>
          <Btn onClick={() => game.quitToMenu()} color={C.dark} text={C.white} small>MENU</Btn>
        </div>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ root
export function Overlays({ ui, game, touch }: { ui: UISnapshot; game: Game; touch: boolean }) {
  const inGame = ui.state === 'playing' || ui.state === 'paused';
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ color: C.white }}>
      {inGame && <Hud ui={ui} game={game} />}
      {ui.state === 'playing' && <IntroBanner ui={ui} />}
      {ui.state === 'playing' && <MessageToast ui={ui} />}
      {ui.state === 'playing' && <DeathBanner ui={ui} />}
      {ui.state === 'menu' && <Menu game={game} touch={touch} />}
      {ui.state === 'paused' && <Pause game={game} ui={ui} />}
      {ui.state === 'levelclear' && <LevelClear game={game} ui={ui} />}
      {ui.state === 'victory' && <Victory game={game} ui={ui} />}
      {ui.state === 'scores' && <Scores game={game} ui={ui} />}
    </div>
  );
}
