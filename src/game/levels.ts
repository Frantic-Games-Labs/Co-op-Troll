import type { Condition, LevelDef } from './types';

// Map legend: # solid  . empty  1/2 spawns  ^ spikes up  v spikes hanging down
// EVERY trap below is a data-driven "logic plan" interpreted by LogicRunner:
// conditions evaluated live, micro-action sequences with deliberate delays,
// per-player zone evaluation, and simultaneous contradictory actions.

const onPlate = (plate: string): Condition => ({ op: 'onPlate', plate });
// per-player plate check (a standing player's centre sits below the plate rect,
// so zone tests don't work for "who is standing on this plate")
const onPlateWho = (plate: string, who: 'p1' | 'p2'): Condition => ({ op: 'onPlate', plate, who });
const inZone = (zone: string, who: 'p1' | 'p2' | 'any' | 'both' = 'any'): Condition => ({ op: 'inZone', zone, who });
const standingOn = (target: string, who: 'p1' | 'p2' | 'any' | 'both' = 'any'): Condition => ({ op: 'standingOn', target, who });
const not = (of: Condition): Condition => ({ op: 'not', of });
const or = (...of: Condition[]): Condition => ({ op: 'or', of });
const and = (...of: Condition[]): Condition => ({ op: 'and', of });

// ---------------------------------------------------------------------------
// LEVEL 1 — First Steps: heavy plates, fleeing exit, safe-zone betrayal
// (ceiling spikes drop exactly 0.5s after landing) and a silent invert zone.
// ---------------------------------------------------------------------------
const L1: LevelDef = {
  id: 'l1',
  name: 'First Steps',
  subtitle: 'Heavy plates need heavy friends',
  par: 55,
  tip: 'Hold a plate for your partner. Trust nothing — especially safe floors.',
  map: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#1.2...........................#',
    '#########.......####...#########',
    '#########.......####...#########',
    '#########.......####...#########',
    '#########^^^^^^^####^^^#########',
    '################################',
  ],
  entities: [
    { id: 'signHelp', kind: 'sign', x: 4, y: 12, props: { text: 'P1: WASD   P2: ARROWS' } },
    { id: 'plateA', kind: 'plate', x: 5, y: 12, w: 2 },
    { id: 'exit', kind: 'exit', x: 7, y: 11, w: 2, h: 2 },
    { id: 'exitZone', kind: 'zone', x: 7, y: 11, w: 2, h: 2 },
    { id: 'bridge', kind: 'platform', x: 9, y: 13, w: 7, state: 'off', props: { look: 'bridge' } },
    { id: 'landing', kind: 'zone', x: 16, y: 10, w: 2, h: 3 },
    { id: 'signSafe', kind: 'sign', x: 18, y: 12, props: { text: 'TOTALLY SAFE ->' } },
    { id: 'popSpikes', kind: 'spikes', x: 19, y: 12, w: 2, state: 'down', props: { dir: 'up' } },
    { id: 'crumble1', kind: 'platform', x: 20, y: 13, w: 3 },
    { id: 'plateB', kind: 'plate', x: 25, y: 12, w: 2 },
    // SAFE ZONE BETRAYAL: hidden ceiling spikes above the "safe" landing
    { id: 'ceilDrop1', kind: 'spikes', x: 16, y: 2, w: 2, state: 'down', props: { dir: 'down', hidden: true } },
    // SILENT INPUT MALFUNCTION: invisible invert field over the bridge
    { id: 'invBridge', kind: 'zone', x: 11, y: 11, w: 4, h: 3 },
    // DELAYED SLAPSTICK: an OBVIOUS trap plate that does... nothing. For 5 seconds.
    { id: 'trapPlate', kind: 'plate', x: 2, y: 12, w: 2 },
    { id: 'piano1', kind: 'anvil', x: 3, y: -3, w: 2, h: 2, state: 'idle', props: { look: 'piano' } },
    // PROP COMEDY: a perfectly normal jump spring
    { id: 'spring1', kind: 'spring', x: 27, y: 12, w: 1, h: 1 },
  ],
  plans: [
    {
      id: 'delayedPiano', cooldownMs: 9000, when: onPlate('trapPlate'),
      do: [
        { act: 'mark', zone: 'trapPlate' },
        { act: 'sound', name: 'blip' },
        { act: 'say', text: 'TRAP plate pressed. Nothing happened. Phew!', ms: 1800 },
        { act: 'wait', ms: 5000 },
        { act: 'drop', target: 'piano1', above: 'marked' },
        { act: 'sound', name: 'alarm' },
        { act: 'say', text: '♪ Special delivery ♪', ms: 1600 },
        { act: 'wait', ms: 3000 },
        { act: 'reset', target: 'piano1' },
      ],
    },
    {
      id: 'exitFlee', once: true, when: inZone('exitZone'),
      do: [
        { act: 'sound', name: 'troll' },
        { act: 'say', text: 'Nope! Work for it.', ms: 1800 },
        { act: 'particles', target: 'exit', kind: 'poof' },
        { act: 'move', target: 'exit', to: [28, 11], ms: 900, ease: 'inOut' },
      ],
    },
    {
      id: 'bridge', when: or(onPlate('plateA'), onPlate('plateB')),
      do: [{ act: 'set', target: 'bridge', state: 'solid' }, { act: 'sound', name: 'unlock' }],
      else: [{ act: 'set', target: 'bridge', state: 'off' }, { act: 'sound', name: 'unplate' }],
    },
    // SAFE ZONE BETRAYAL: exactly 0.5s after landing, ceiling spikes slam down.
    {
      id: 'ceilBetrayal', cooldownMs: 5000, when: inZone('landing'),
      do: [
        { act: 'wait', ms: 500 },
        { act: 'set', target: 'ceilDrop1', state: 'up' },
        { act: 'sound', name: 'spike' },
        { act: 'shake', power: 4 },
        { act: 'move', target: 'ceilDrop1', to: [16, 12], ms: 220, ease: 'linear' },
        { act: 'say', text: 'Safe floor? Cute.', ms: 1300 },
        { act: 'wait', ms: 1400 },
        { act: 'move', target: 'ceilDrop1', to: [16, 2], ms: 600, ease: 'inOut' },
        { act: 'wait', ms: 700 },
        { act: 'set', target: 'ceilDrop1', state: 'down' },
      ],
    },
    {
      id: 'popTrap', cooldownMs: 3500, when: inZone('landing'),
      do: [
        { act: 'telegraph', target: 'popSpikes', ms: 260 },
        { act: 'set', target: 'popSpikes', state: 'up' },
        { act: 'sound', name: 'spike' },
        { act: 'shake', power: 3 },
        { act: 'wait', ms: 1600 },
        { act: 'set', target: 'popSpikes', state: 'down' },
      ],
    },
    // SILENT INVERT: no warning, no message — evaluated per specific player.
    {
      id: 'invP1', cooldownMs: 6000, when: inZone('invBridge', 'p1'),
      do: [{ act: 'invert', who: 'p1', ms: 2500 }, { act: 'flag', name: 'invDone', value: 1 }],
    },
    {
      id: 'invP2', cooldownMs: 6000, when: inZone('invBridge', 'p2'),
      do: [{ act: 'invert', who: 'p2', ms: 2500 }, { act: 'flag', name: 'invDone', value: 1 }],
    },
    {
      id: 'invTaunt', once: true, when: { op: 'flag', name: 'invDone' },
      do: [{ act: 'wait', ms: 2200 }, { act: 'say', text: 'Controls feel weird? :)', ms: 2000 }],
    },
    {
      id: 'crumble', once: true, when: standingOn('crumble1'),
      do: [
        { act: 'telegraph', target: 'crumble1', ms: 140 },
        { act: 'set', target: 'crumble1', state: 'gone' },
        { act: 'sound', name: 'poof' },
        { act: 'shake', power: 2 },
      ],
    },
    {
      id: 'hint', once: true, when: { op: 'elapsed', ms: 4500 },
      do: [{ act: 'say', text: 'Plates need weight. One holds, one crosses.', ms: 3000, style: 'info' }],
    },
  ],
};

// ---------------------------------------------------------------------------
// LEVEL 2 — Bait & Switch: hunter saw, safe-floor betrayal on the right and a
// silent mid-jump control swap inside the tunnel.
// ---------------------------------------------------------------------------
const RAIL: [number, number][] = [[112, 152], [200, 208], [256, 208], [312, 208], [400, 152]];
const L2: LevelDef = {
  id: 'l2',
  name: 'Bait & Switch',
  subtitle: 'Someone has to be the worm',
  par: 70,
  tip: 'One baits, one runs. Then swap. The tunnel swaps more than you think.',
  map: [
    '################################',
    '#.............####.............#',
    '#.............####.............#',
    '#.............####.............#',
    '#.............####.............#',
    '#.............####.............#',
    '#.............####.............#',
    '#.............####.............#',
    '#.............####.............#',
    '#.............####.............#',
    '#.###.........####.........###.#',
    '#.............####.............#',
    '#.....##................##.....#',
    '#.......1.2....................#',
    '###################..###########',
    '###################..###########',
    '###################^^###########',
    '################################',
  ],
  entities: [
    { id: 'baitL', kind: 'zone', x: 2, y: 8, w: 3, h: 2, props: { look: 'ledge' } },
    { id: 'baitR', kind: 'zone', x: 27, y: 8, w: 3, h: 2, props: { look: 'ledge' } },
    { id: 'saw', kind: 'saw', x: 16, y: 13, props: { radius: 14 } },
    { id: 'crumble2', kind: 'platform', x: 19, y: 14, w: 2 },
    { id: 'exit', kind: 'exit', x: 29, y: 12, w: 2, h: 2 },
    { id: 'sign1', kind: 'sign', x: 5, y: 13, props: { text: 'THE SAW HUNTS GLOWING LEDGES' } },
    { id: 'sign2', kind: 'sign', x: 12, y: 13, props: { text: 'DO NOT CROWD THE DOOR' } },
    { id: 'safeR', kind: 'zone', x: 21, y: 12, w: 3, h: 2 },
    { id: 'ceilDrop2', kind: 'spikes', x: 21, y: 2, w: 3, state: 'down', props: { dir: 'down', hidden: true } },
    { id: 'swapAir', kind: 'zone', x: 17, y: 11, w: 5, h: 4 },
    // ANTI-CLIMAX: a colossal spike crusher looms over the left approach...
    { id: 'crusher', kind: 'platform', x: 5, y: 1, w: 5, h: 2, props: { look: 'crusher' } },
    { id: 'crusherZone', kind: 'zone', x: 5, y: 9, w: 5, h: 4 },
    { id: 'balloon1', kind: 'balloon', x: 7.5, y: 4, state: 'off', props: { homeSpeed: 22 } },
    { id: 'signCrush', kind: 'sign', x: 10, y: 13, props: { text: 'DANGER: MEGA CRUSHER 9000' } },
  ],
  plans: [
    {
      id: 'antiClimax', cooldownMs: 14000, when: inZone('crusherZone'),
      do: [
        { act: 'sound', name: 'alarm' },
        { act: 'say', text: 'MEGA CRUSHER 9000 CHARGING...', ms: 2200 },
        { act: 'shake', power: 3, ms: 900 },
        { act: 'telegraph', target: 'crusher', ms: 900 },
        { act: 'shake', power: 6, ms: 900 },
        { act: 'telegraph', target: 'crusher', ms: 900 },
        { act: 'flash', color: '#b13e53' },
        { act: 'shake', power: 12, ms: 700 },
        { act: 'sound', name: 'rumble' },
        { act: 'telegraph', target: 'crusher', ms: 700 },
        { act: 'sound', name: 'blip' },
        { act: 'set', target: 'balloon1', state: 'on' },
        { act: 'say', text: '...a balloon.', ms: 2000 },
        { act: 'wait', ms: 2500 },
        { act: 'say', text: "It's coming for you. Slowly. Inevitably.", ms: 2200 },
        { act: 'wait', ms: 9000 },
        { act: 'set', target: 'balloon1', state: 'off' },
        { act: 'reset', target: 'balloon1' },
      ],
    },
    { id: 'lureL', when: inZone('baitL'), do: [{ act: 'sound', name: 'rumble' }, { act: 'rail', target: 'saw', points: RAIL, to: 0, speed: 250 }] },
    { id: 'lureR', when: inZone('baitR'), do: [{ act: 'sound', name: 'rumble' }, { act: 'rail', target: 'saw', points: RAIL, to: 4, speed: 250 }] },
    {
      id: 'sawHome', when: and(not(inZone('baitL')), not(inZone('baitR'))),
      do: [{ act: 'rail', target: 'saw', points: RAIL, to: 2, speed: 330 }],
    },
    {
      id: 'ceilBetrayal2', cooldownMs: 6000, when: inZone('safeR'),
      do: [
        { act: 'wait', ms: 500 },
        { act: 'set', target: 'ceilDrop2', state: 'up' },
        { act: 'sound', name: 'spike' },
        { act: 'shake', power: 4 },
        { act: 'move', target: 'ceilDrop2', to: [21, 13], ms: 250, ease: 'linear' },
        { act: 'say', text: 'Resting is for the spiked.', ms: 1400 },
        { act: 'wait', ms: 1400 },
        { act: 'move', target: 'ceilDrop2', to: [21, 2], ms: 600, ease: 'inOut' },
        { act: 'wait', ms: 700 },
        { act: 'set', target: 'ceilDrop2', state: 'down' },
      ],
    },
    // SILENT SWAP MID-JUMP: airborne + inside tunnel => P1<->P2 controls swap.
    {
      id: 'swapMid', cooldownMs: 8000,
      when: and(inZone('swapAir', 'any'), { op: 'airborne', who: 'any' }),
      do: [{ act: 'swap', mode: 'toggle', ms: 3500 }],
    },
    {
      id: 'swapTaunt', once: true, when: { op: 'swapped' },
      do: [{ act: 'wait', ms: 1800 }, { act: 'say', text: 'Who are you now? :)', ms: 2000 }],
    },
    {
      id: 'crumble', once: true, when: standingOn('crumble2'),
      do: [
        { act: 'telegraph', target: 'crumble2', ms: 140 },
        { act: 'set', target: 'crumble2', state: 'gone' },
        { act: 'sound', name: 'poof' },
        { act: 'shake', power: 2 },
      ],
    },
    {
      id: 'hint', once: true, when: { op: 'elapsed', ms: 1500 },
      do: [{ act: 'say', text: 'One baits, one runs. Then swap.', ms: 2600, style: 'info' }],
    },
  ],
};

// ---------------------------------------------------------------------------
// LEVEL 3 — Trust Issues: fake platforms, mid-air silent inverts and a ceiling
// betrayal over the real path. Someone still has to fall first.
// ---------------------------------------------------------------------------
const REALS = ['R1', 'R2', 'R3', 'R4'];
const STAIRS = ['S1', 'S2', 'S3'];
const L3: LevelDef = {
  id: 'l3',
  name: 'Trust Issues',
  subtitle: 'The platforms are 100% real*',
  par: 90,
  tip: 'Fake platforms vanish. The real path is fast, high — and watched.',
  map: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#.1.2..........................#',
    '#######..................#######',
    '#######....#.............#######',
    '#######....#.............#######',
    '#######....#.............#######',
    '#######....#.............#######',
    '#######..................#######',
    '#######..................#######',
    '##############^^^^^^^^^^^#######',
    '################################',
  ],
  entities: [
    { id: 'signL', kind: 'sign', x: 5, y: 8, props: { text: '100% REAL PLATFORMS ->' } },
    { id: 'fakeA', kind: 'platform', x: 8, y: 9, w: 2 },
    { id: 'fakeB', kind: 'platform', x: 12, y: 9, w: 2 },
    { id: 'fakeC', kind: 'platform', x: 16, y: 9, w: 2 },
    { id: 'R1', kind: 'platform', x: 10, y: 7, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'R2', kind: 'platform', x: 14, y: 7, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'R3', kind: 'platform', x: 18, y: 7, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'R4', kind: 'platform', x: 22, y: 7, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'pocket', kind: 'zone', x: 7, y: 10, w: 4, h: 6 },
    { id: 'plateP', kind: 'plate', x: 8, y: 15, w: 2 },
    { id: 'signP', kind: 'sign', x: 10, y: 15, props: { text: 'STAND HERE. TRUST ME.' } },
    { id: 'door', kind: 'platform', x: 11, y: 14, w: 1, h: 2, props: { look: 'door' } },
    { id: 'S1', kind: 'platform', x: 15, y: 14, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'S2', kind: 'platform', x: 18, y: 12, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'S3', kind: 'platform', x: 22, y: 10, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'plateQ', kind: 'plate', x: 26, y: 8, w: 2 },
    { id: 'signQ', kind: 'sign', x: 25, y: 8, props: { text: 'HOLD THIS FOR YOUR BUDDY' } },
    // PROP COMEDY: the exit is a cardboard cutout. It falls over. Onto you.
    { id: 'cardboardExit', kind: 'exit', x: 29, y: 7, w: 2, h: 2, props: { fake: true, cardboard: true } },
    { id: 'cardboardZone', kind: 'zone', x: 28, y: 7, w: 3, h: 2 },
    { id: 'exit', kind: 'exit', x: 29, y: 4, w: 2, h: 2, state: 'off' },
    { id: 'ledgeReal', kind: 'platform', x: 28, y: 6, w: 3, state: 'off', props: { look: 'glow', hidden: true } },
    { id: 'invertAir3', kind: 'zone', x: 15, y: 4, w: 5, h: 3 },
    { id: 'ceilDrop3', kind: 'spikes', x: 18, y: 1, w: 2, state: 'down', props: { dir: 'down', hidden: true } },
  ],
  plans: [
    ...(['fakeA', 'fakeB', 'fakeC'] as const).map((id, i) => ({
      id: `poof-${id}`, once: true, when: standingOn(id) as Condition,
      do: [
        { act: 'telegraph', target: id, ms: 90 },
        { act: 'set', target: id, state: 'gone' },
        { act: 'sound', name: 'poof' },
        { act: 'shake', power: 3 },
        { act: 'say', text: ['Whoops. Mind the gap.', 'Also fake.', "You're not learning."][i], ms: 1400 },
      ] as LevelDef['plans'][number]['do'],
    })),
    {
      id: 'reveal', when: onPlate('plateP'),
      do: [{ act: 'set', target: REALS, state: 'solid', force: true }, { act: 'sound', name: 'unlock' }],
      else: [{ act: 'set', target: REALS, state: 'off', force: true }, { act: 'sound', name: 'unplate' }],
    },
    {
      id: 'revealMsg', once: true, when: onPlate('plateP'),
      do: [{ act: 'say', text: 'The real path appears... while the plate is held.', ms: 2600, style: 'info' }],
    },
    {
      id: 'invP1_3', cooldownMs: 5000, when: inZone('invertAir3', 'p1'),
      do: [{ act: 'invert', who: 'p1', ms: 2000 }, { act: 'flag', name: 'inv3', value: 1 }],
    },
    {
      id: 'invP2_3', cooldownMs: 5000, when: inZone('invertAir3', 'p2'),
      do: [{ act: 'invert', who: 'p2', ms: 2000 }, { act: 'flag', name: 'inv3', value: 1 }],
    },
    {
      id: 'invTaunt3', once: true, when: { op: 'flag', name: 'inv3' },
      do: [{ act: 'wait', ms: 2200 }, { act: 'say', text: 'Air feels funny up here.', ms: 1800 }],
    },
    {
      id: 'ceilBetrayal3', cooldownMs: 4000, when: standingOn('R3'),
      do: [
        { act: 'wait', ms: 500 },
        { act: 'set', target: 'ceilDrop3', state: 'up' },
        { act: 'sound', name: 'spike' },
        { act: 'shake', power: 4 },
        { act: 'move', target: 'ceilDrop3', to: [18, 6], ms: 220, ease: 'linear' },
        { act: 'say', text: 'Keep moving!', ms: 1200 },
        { act: 'wait', ms: 1200 },
        { act: 'move', target: 'ceilDrop3', to: [18, 1], ms: 500, ease: 'inOut' },
        { act: 'wait', ms: 600 },
        { act: 'set', target: 'ceilDrop3', state: 'down' },
      ],
    },
    {
      id: 'crumbleR2', cooldownMs: 1500, when: standingOn('R2'),
      do: [
        { act: 'telegraph', target: 'R2', ms: 120 },
        { act: 'set', target: 'R2', state: 'gone' },
        { act: 'sound', name: 'poof' },
      ],
    },
    {
      id: 'bothInPocket', cooldownMs: 6000, when: inZone('pocket', 'both'),
      do: [{ act: 'say', text: 'Both in the pocket? Only one should fall. Restart (R / pause).', ms: 3500 }],
    },
    {
      id: 'cardboardTopple', once: true, when: inZone('cardboardZone'),
      do: [
        { act: 'sound', name: 'tick' },
        { act: 'say', text: 'Wait... is this door made of CARDBOARD?', ms: 1600 },
        { act: 'wait', ms: 350 },
        { act: 'topple', target: 'cardboardExit' },
        { act: 'wait', ms: 1400 },
        { act: 'say', text: 'Stage prop. The real door is up there — needs Q held.', ms: 2800, style: 'info' },
        { act: 'flag', name: 'cardboardDown', value: 1 },
      ],
    },
    {
      id: 'realExit3', once: true, when: and({ op: 'flag', name: 'cardboardDown' }, onPlate('plateQ')),
      do: [
        { act: 'set', target: 'ledgeReal', state: 'solid' },
        { act: 'set', target: 'exit', state: 'on' },
        { act: 'say', text: 'A real door! Probably.', ms: 1600 },
      ],
    },
    {
      id: 'gateQ', when: onPlate('plateQ'),
      do: [{ act: 'set', target: 'door', state: 'off' }, { act: 'set', target: STAIRS, state: 'solid' }, { act: 'sound', name: 'unlock' }],
      else: [{ act: 'set', target: 'door', state: 'solid' }, { act: 'set', target: STAIRS, state: 'off' }, { act: 'sound', name: 'unplate' }],
    },
    {
      id: 'hint', once: true, when: { op: 'elapsed', ms: 1500 },
      do: [{ act: 'say', text: 'Trust nothing. Trust your partner.', ms: 2600, style: 'info' }],
    },
  ],
};

// ---------------------------------------------------------------------------
// LEVEL 4 — Gravity Anchor: gravity flips only while anchored. The well hides
// a silent swap field, and the far landing hides a ceiling betrayal.
// ---------------------------------------------------------------------------
const ANCHOR = or(onPlate('plateA'), onPlate('plateB'));
const L4: LevelDef = {
  id: 'l4',
  name: 'Gravity Anchor',
  subtitle: 'Do NOT let go',
  par: 80,
  tip: 'Anchor = flipped gravity in the well. The well also flips... other things.',
  map: [
    '################################',
    '################################',
    '################################',
    '################################',
    '#..............vv..............#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#1.2...........................#',
    '#######..................#######',
    '#######..................#######',
    '#######..................#######',
    '#######..................#######',
    '#######^^^^^^^^^^^^^^^^^^#######',
    '################################',
  ],
  entities: [
    { id: 'signA', kind: 'sign', x: 4, y: 11, props: { text: 'ANCHOR = GRAVITY. HOLD IT.' } },
    { id: 'plateA', kind: 'plate', x: 5, y: 11, w: 2 },
    { id: 'well', kind: 'zone', x: 7, y: 4, w: 18, h: 12, props: { look: 'well' } },
    { id: 'saw1', kind: 'saw', x: 11.5, y: 6, props: { radius: 13, path: [[184, 72], [184, 236]], speed: 100 } },
    { id: 'trip', kind: 'zone', x: 17, y: 4, w: 2, h: 3 },
    { id: 'popCeil', kind: 'spikes', x: 20, y: 4, w: 2, state: 'down', props: { dir: 'down' } },
    { id: 'plateB', kind: 'plate', x: 25, y: 11, w: 2 },
    { id: 'signB', kind: 'sign', x: 27, y: 11, props: { text: 'SWAP! HOLD THE OTHER ONE' } },
    { id: 'exit', kind: 'exit', x: 29, y: 10, w: 2, h: 2 },
    { id: 'swapWell', kind: 'zone', x: 13, y: 6, w: 5, h: 4 },
    { id: 'landR', kind: 'zone', x: 25, y: 10, w: 2, h: 3 },
    { id: 'ceilDrop4', kind: 'spikes', x: 25, y: 4, w: 2, state: 'down', props: { dir: 'down', hidden: true } },
  ],
  plans: [
    {
      id: 'gravP1', when: and(inZone('well', 'p1'), ANCHOR),
      do: [{ act: 'gravity', who: 'p1', scale: -1 }, { act: 'sound', name: 'flip' }],
      else: [{ act: 'gravity', who: 'p1', scale: 1 }],
    },
    {
      id: 'gravP2', when: and(inZone('well', 'p2'), ANCHOR),
      do: [{ act: 'gravity', who: 'p2', scale: -1 }, { act: 'sound', name: 'flip' }],
      else: [{ act: 'gravity', who: 'p2', scale: 1 }],
    },
    {
      id: 'wellFx', when: ANCHOR,
      do: [{ act: 'set', target: 'well', state: 'on' }],
      else: [{ act: 'set', target: 'well', state: 'idle' }],
    },
    // CO-OP BACKFIRE: the heavy anchor plate pumps air into whoever holds it.
    // Hold too long and you POP. Step off and you slowly deflate. Time it!
    ...(['plateA', 'plateB'] as const).flatMap((plate) =>
      (['p1', 'p2'] as const).map((who) => ({
        id: `inflate-${plate}-${who}`,
        when: onPlateWho(plate, who),
        do: [{ act: 'inflate', who, rate: 1 / 5.5 }] as LevelDef['plans'][number]['do'],
        else: [{ act: 'inflate', who, rate: -1 / 4 }] as LevelDef['plans'][number]['do'],
      })),
    ),
    {
      id: 'inflateHint', once: true, when: ANCHOR,
      do: [{ act: 'wait', ms: 1800 }, { act: 'say', text: 'Uh. The anchor is... inflating you. Hurry, partner!', ms: 2600 }],
    },
    {
      id: 'swapWellPlan', cooldownMs: 8000, when: inZone('swapWell', 'any'),
      do: [{ act: 'swap', mode: 'toggle', ms: 3000 }],
    },
    {
      id: 'swapTaunt4', once: true, when: { op: 'swapped' },
      do: [{ act: 'wait', ms: 1700 }, { act: 'say', text: 'Gravity AND controls? Rude.', ms: 2000 }],
    },
    {
      id: 'ceilBetrayal4', cooldownMs: 6000, when: inZone('landR'),
      do: [
        { act: 'wait', ms: 500 },
        { act: 'set', target: 'ceilDrop4', state: 'up' },
        { act: 'sound', name: 'spike' },
        { act: 'shake', power: 4 },
        { act: 'move', target: 'ceilDrop4', to: [25, 11], ms: 250, ease: 'linear' },
        { act: 'say', text: 'No rest for the anchored.', ms: 1400 },
        { act: 'wait', ms: 1300 },
        { act: 'move', target: 'ceilDrop4', to: [25, 4], ms: 600, ease: 'inOut' },
        { act: 'wait', ms: 700 },
        { act: 'set', target: 'ceilDrop4', state: 'down' },
      ],
    },
    {
      id: 'ceilTrap', cooldownMs: 4000, when: inZone('trip'),
      do: [
        { act: 'telegraph', target: 'popCeil', ms: 240 },
        { act: 'set', target: 'popCeil', state: 'up' },
        { act: 'sound', name: 'spike' },
        { act: 'shake', power: 3 },
        { act: 'wait', ms: 1400 },
        { act: 'set', target: 'popCeil', state: 'down' },
      ],
    },
    {
      id: 'hint', once: true, when: { op: 'elapsed', ms: 1500 },
      do: [{ act: 'say', text: 'Anchor held = gravity flips inside the purple well.', ms: 3000, style: 'info' }],
    },
  ],
};

// ---------------------------------------------------------------------------
// LEVEL 5 — Friendly Fire: an unavoidable FREE LASER that does nothing to the
// environment and everything to your partner. Facing direction is everything.
// Impossible alone: bridge needs a holder on X (then Y) while the other walks.
// ---------------------------------------------------------------------------
const LF: LevelDef = {
  id: 'lf',
  name: 'Friendly Fire',
  subtitle: 'Free laser! What could go wrong?',
  par: 75,
  tip: 'The laser only hurts your partner. Face AWAY while you hold the plate.',
  map: [
    '################################',
    '#........##.....................#',
    '#........##.....................#',
    '#........##.....................#',
    '#........##.....................#',
    '#........##.....................#',
    '#........##.....................#',
    '#........##.....................#',
    '#........##.....................#',
    '#........##.....................#',
    '#........##.....................#',
    '#........##.....................#',
    '#1.2............................#',
    '################.......#########',
    '################.......#########',
    '################.......#########',
    '################^^^^^^^#########',
    '################################',
  ],
  entities: [
    { id: 'signFree', kind: 'sign', x: 6, y: 12, props: { text: 'FREE LASER AHEAD! NO CATCH!' } },
    { id: 'laserPickup', kind: 'pickup', x: 9, y: 12, w: 2, h: 1 },
    { id: 'plateX', kind: 'plate', x: 12, y: 12, w: 2 },
    { id: 'signX', kind: 'sign', x: 14, y: 12, props: { text: 'HOLD THIS. FACE AWAY. TRUST ME.' } },
    { id: 'bridgeF', kind: 'platform', x: 16, y: 13, w: 7, state: 'off', props: { look: 'bridge' } },
    { id: 'plateY', kind: 'plate', x: 24, y: 12, w: 2 },
    { id: 'signDoor', kind: 'sign', x: 27, y: 12, props: { text: 'LASER-PROOF DOOR (ALL DOORS ARE)' } },
    { id: 'exit', kind: 'exit', x: 29, y: 11, w: 2, h: 2 },
    { id: 'crossZone', kind: 'zone', x: 16, y: 10, w: 7, h: 3 },
  ],
  plans: [
    {
      id: 'bridgeF', when: or(onPlate('plateX'), onPlate('plateY')),
      do: [{ act: 'set', target: 'bridgeF', state: 'solid' }, { act: 'sound', name: 'unlock' }],
      else: [{ act: 'set', target: 'bridgeF', state: 'off' }, { act: 'sound', name: 'unplate' }],
    },
    {
      id: 'laserTip', once: true, when: and(onPlate('plateX'), inZone('crossZone')),
      do: [{ act: 'say', text: 'Holder: which way are you FACING?', ms: 1800, style: 'info' }],
    },
    {
      id: 'hintF', once: true, when: { op: 'elapsed', ms: 1500 },
      do: [{ act: 'say', text: 'Only one of you gets the laser. Choose wisely. (You cannot choose.)', ms: 3000, style: 'info' }],
    },
  ],
};

// ---------------------------------------------------------------------------
// LEVEL 6 — Inverted Trust: distinct pedestals unseal the exit, then invert
// both players forever. The middle hides one last ceiling betrayal.
// ---------------------------------------------------------------------------
const OUTER = ['B1', 'B4'];
const INNER = ['B2', 'B3'];
const L5: LevelDef = {
  id: 'l5',
  name: 'Inverted Trust',
  subtitle: 'What could possibly go wrong?',
  par: 90,
  tip: 'One player on each pedestal at the same time. Then... improvise.',
  map: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#.............####.............#',
    '#..............................#',
    '####........................####',
    '####........................####',
    '####..##................##..####',
    '####..##^..1.......2...^##..####',
    '################################',
    '################################',
    '################################',
    '################################',
  ],
  entities: [
    { id: 'ZL', kind: 'zone', x: 1, y: 8, w: 3, h: 2, props: { look: 'ledge' } },
    { id: 'ZR', kind: 'zone', x: 28, y: 8, w: 3, h: 2, props: { look: 'ledge' } },
    { id: 'pedSpL', kind: 'spikes', x: 1, y: 9, w: 3, state: 'down', props: { dir: 'up' } },
    { id: 'pedSpR', kind: 'spikes', x: 28, y: 9, w: 3, state: 'down', props: { dir: 'up' } },
    { id: 'seal', kind: 'platform', x: 14, y: 5, w: 4, h: 3, props: { look: 'seal', hidden: true } },
    { id: 'exit', kind: 'exit', x: 15, y: 6, w: 2, h: 2 },
    { id: 'B1', kind: 'platform', x: 9, y: 12, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'B2', kind: 'platform', x: 12, y: 10, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'B3', kind: 'platform', x: 18, y: 10, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'B4', kind: 'platform', x: 21, y: 12, w: 2, state: 'off', props: { look: 'glow' } },
    { id: 'signMid', kind: 'sign', x: 15, y: 13, props: { text: 'ONE ON EACH PEDESTAL. EASY.' } },
    { id: 'centerSafe', kind: 'zone', x: 14, y: 12, w: 4, h: 2 },
    { id: 'ceilDrop5', kind: 'spikes', x: 14, y: 9, w: 3, state: 'down', props: { dir: 'down', hidden: true } },
  ],
  plans: [
    {
      id: 'opener', once: true, when: { op: 'distinctZones', zones: ['ZL', 'ZR'] },
      do: [
        { act: 'sound', name: 'rumble' },
        { act: 'shake', power: 4, ms: 900 },
        { act: 'say', text: 'Both pedestals held. Unsealing the exit...', ms: 1600, style: 'info' },
        { act: 'wait', ms: 800 },
        { act: 'particles', target: 'seal', kind: 'poof' },
        { act: 'set', target: 'seal', state: 'off' },
        { act: 'set', target: [...OUTER, ...INNER], state: 'solid' },
        { act: 'sound', name: 'unlock' },
        { act: 'flag', name: 'opened', value: 1 },
        { act: 'wait', ms: 1000 },
        { act: 'say', text: 'Oh, one more thing...', ms: 1200 },
        { act: 'wait', ms: 1300 },
        { act: 'invert', who: 'both' },
        { act: 'flash', color: '#5d275d' },
        { act: 'shake', power: 6, ms: 500 },
        { act: 'sound', name: 'troll' },
        { act: 'say', text: 'CONTROLS INVERTED. Have fun :)', ms: 2400 },
        { act: 'flag', name: 'inverted', value: 1 },
        { act: 'wait', ms: 900 },
        { act: 'telegraph', target: ['pedSpL', 'pedSpR'], ms: 500 },
        { act: 'set', target: ['pedSpL', 'pedSpR'], state: 'up' },
        { act: 'sound', name: 'spike' },
        { act: 'shake', power: 3 },
      ],
    },
    {
      id: 'collapseCycle', once: true, when: { op: 'flag', name: 'inverted' },
      do: [
        { act: 'wait', ms: 2500 },
        { act: 'telegraph', target: OUTER, ms: 150 },
        { act: 'set', target: OUTER, state: 'gone' },
        { act: 'sound', name: 'poof' },
        { act: 'wait', ms: 1500 },
        { act: 'set', target: OUTER, state: 'solid', force: true },
        { act: 'sound', name: 'blip' },
        { act: 'wait', ms: 1200 },
        { act: 'telegraph', target: INNER, ms: 150 },
        { act: 'set', target: INNER, state: 'gone' },
        { act: 'sound', name: 'poof' },
        { act: 'wait', ms: 1500 },
        { act: 'set', target: INNER, state: 'solid', force: true },
        { act: 'sound', name: 'blip' },
        { act: 'goto', step: 0 },
      ],
    },
    {
      id: 'ceilBetrayal5', cooldownMs: 6000, when: inZone('centerSafe'),
      do: [
        { act: 'wait', ms: 500 },
        { act: 'set', target: 'ceilDrop5', state: 'up' },
        { act: 'sound', name: 'spike' },
        { act: 'shake', power: 4 },
        { act: 'move', target: 'ceilDrop5', to: [14, 13], ms: 250, ease: 'linear' },
        { act: 'say', text: 'Center stage = spike stage.', ms: 1400 },
        { act: 'wait', ms: 1300 },
        { act: 'move', target: 'ceilDrop5', to: [14, 9], ms: 600, ease: 'inOut' },
        { act: 'wait', ms: 700 },
        { act: 'set', target: 'ceilDrop5', state: 'down' },
      ],
    },
    {
      id: 'hint', once: true, when: { op: 'elapsed', ms: 1500 },
      do: [{ act: 'say', text: 'Get one player on EACH pedestal at the same time.', ms: 3000, style: 'info' }],
    },
  ],
};

// ---------------------------------------------------------------------------
// LEVEL 6 — Nice Try: the Level Devil finale.
//   * CO-OP SABOTAGE: the glowing green HELP button builds a bridge AND drops
//     an anvil on whoever crosses. The counter-intuitive truth: ignore green,
//     hold the dull U/V plates to reveal hidden pit platforms instead.
//   * SAFE ZONE BETRAYAL: the middle platform drops ceiling spikes 0.5s after
//     you land and feel safe.
//   * SILENT SWAP: an invisible field on the right silently swaps P1/P2.
//   * GOAL SUBVERSION: the obvious EXIT is a killer fake. The real exit is
//     hidden and appears only when BOTH players reach the far side together.
//   * INVISIBLE WALL: a jumpable phantom block guards the middle.
// Impossible alone: pit needs a holder, real exit needs both on the right.
// ---------------------------------------------------------------------------
const HIDDEN_PIT = ['H1', 'H2', 'H3'];
const L6: LevelDef = {
  id: 'l6',
  name: 'Nice Try',
  subtitle: 'Green means go. Go where? Into spikes.',
  par: 130,
  tip: 'Green lies. Dull plates reveal pit 1. LEAP into pit 2. Exit kills.',
  map: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#1.2...........................#',
    '########.......####...##########',
    '########.......####...##########',
    '########.......####...##########',
    '########^^^^^^^####^^^##########',
    '################################',
  ],
  entities: [
    { id: 'signStart', kind: 'sign', x: 3, y: 12, props: { text: 'GREEN = HELP. TRUST GREEN.' } },
    { id: 'plateU', kind: 'plate', x: 1, y: 12, w: 2 },
    { id: 'greenBtn', kind: 'plate', x: 5, y: 12, w: 2, props: { look: 'greenBtn' } },
    // sabotage bridge (obvious, deadly) over pit 1
    { id: 'trapBridge', kind: 'platform', x: 8, y: 13, w: 7, state: 'off', props: { look: 'bridge' } },
    // hidden pit platforms (counter-intuitive real path, near the spikes)
    { id: 'H1', kind: 'platform', x: 8, y: 15, w: 2, state: 'off', props: { look: 'glow', hidden: true } },
    { id: 'H2', kind: 'platform', x: 11, y: 14, w: 2, state: 'off', props: { look: 'glow', hidden: true } },
    { id: 'H3', kind: 'platform', x: 13, y: 15, w: 2, state: 'off', props: { look: 'glow', hidden: true } },
    { id: 'anvil1', kind: 'anvil', x: 11, y: 4, w: 2, h: 2, state: 'idle', props: { look: 'piano' } },
    { id: 'springShort', kind: 'spring', x: 25, y: 12, w: 1, h: 1 },
    // middle island + invisible wall + betrayal trigger
    { id: 'invWall6', kind: 'platform', x: 16, y: 11, w: 1, h: 2, props: { look: 'invisible' } },
    { id: 'invHintZ', kind: 'zone', x: 15, y: 11, w: 1, h: 2 },
    { id: 'safeMid6', kind: 'zone', x: 15, y: 10, w: 4, h: 3 },
    { id: 'ceilDrop6', kind: 'spikes', x: 15, y: 2, w: 3, state: 'down', props: { dir: 'down', hidden: true } },
    // right side: dull plate, silent swap field, fake + hidden real exits
    { id: 'plateV', kind: 'plate', x: 22, y: 12, w: 2 },
    { id: 'faithLeap', kind: 'zone', x: 19, y: 14, w: 3, h: 2 },
    { id: 'swapRight6', kind: 'zone', x: 24, y: 11, w: 5, h: 2 },
    { id: 'rightSide', kind: 'zone', x: 22, y: 10, w: 9, h: 4 },
    { id: 'signRight', kind: 'sign', x: 28, y: 12, props: { text: 'EXIT HERE! FREE!' } },
    { id: 'fakeExit', kind: 'exit', x: 29, y: 11, w: 2, h: 2, props: { fake: true } },
    { id: 'fakeZone6', kind: 'zone', x: 29, y: 11, w: 2, h: 2 },
    { id: 'exit', kind: 'exit', x: 26, y: 11, w: 2, h: 2, state: 'off' },
  ],
  plans: [
    // CO-OP SABOTAGE, part 1: green builds the obvious bridge...
    {
      id: 'greenBridge', when: onPlate('greenBtn'),
      do: [{ act: 'set', target: 'trapBridge', state: 'solid', force: true }, { act: 'sound', name: 'unlock' }],
      else: [
        { act: 'wait', ms: 1200 },
        { act: 'set', target: 'trapBridge', state: 'off', force: true },
        { act: 'sound', name: 'unplate' },
      ],
    },
    // CO-OP SABOTAGE, part 2: ...and 0.8s later drops an anvil on the crosser.
    // Fires on press (rising edge) — even a quick tap cannot escape it.
    {
      id: 'greenSabotage', when: onPlate('greenBtn'),
      do: [
        { act: 'wait', ms: 800 },
        { act: 'drop', target: 'anvil1' },
        { act: 'shake', power: 5 },
        { act: 'sound', name: 'alarm' },
        { act: 'say', text: 'Bridge toll: one (1) grand piano.', ms: 2000 },
      ],
    },
    // The sabotage bridge also collapses underfoot — green is hopeless.
    {
      id: 'trapCollapse', when: standingOn('trapBridge'),
      do: [
        { act: 'telegraph', target: 'trapBridge', ms: 120 },
        { act: 'set', target: 'trapBridge', state: 'gone' },
        { act: 'sound', name: 'poof' },
        { act: 'shake', power: 3 },
        { act: 'say', text: 'Green sends its regards.', ms: 1500 },
      ],
    },
    // Counter-intuitive truth: dull U/V plates reveal the hidden pit path.
    {
      id: 'hiddenReveal', when: or(onPlate('plateU'), onPlate('plateV')),
      do: [{ act: 'set', target: HIDDEN_PIT, state: 'solid', force: true }, { act: 'sound', name: 'unlock' }],
      else: [{ act: 'set', target: HIDDEN_PIT, state: 'off', force: true }, { act: 'sound', name: 'unplate' }],
    },
    {
      id: 'greenHint', once: true, when: { op: 'elapsed', ms: 3000 },
      do: [{ act: 'say', text: 'Green looks helpful. Green lies.', ms: 2600, style: 'info' }],
    },
    // SAFE ZONE BETRAYAL over the middle island.
    {
      id: 'ceilBetrayal6', cooldownMs: 6000, when: inZone('safeMid6'),
      do: [
        { act: 'wait', ms: 500 },
        { act: 'set', target: 'ceilDrop6', state: 'up' },
        { act: 'sound', name: 'spike' },
        { act: 'shake', power: 4 },
        { act: 'move', target: 'ceilDrop6', to: [15, 12], ms: 220, ease: 'linear' },
        { act: 'say', text: 'Middle is lava. Keep moving!', ms: 1500 },
        { act: 'wait', ms: 1300 },
        { act: 'move', target: 'ceilDrop6', to: [15, 2], ms: 600, ease: 'inOut' },
        { act: 'wait', ms: 700 },
        { act: 'set', target: 'ceilDrop6', state: 'down' },
      ],
    },
    {
      id: 'invHint', once: true, when: inZone('invHintZ'),
      do: [{ act: 'say', text: 'Something blocks you. JUMP it.', ms: 2200, style: 'info' }],
    },
    // SILENT SWAP on the right — no warning, evaluated for whoever enters.
    {
      id: 'swapRightPlan', cooldownMs: 8000, when: inZone('swapRight6', 'any'),
      do: [{ act: 'swap', mode: 'toggle', ms: 3000 }],
    },
    {
      id: 'swapTaunt6', once: true, when: { op: 'swapped' },
      do: [{ act: 'wait', ms: 1500 }, { act: 'say', text: 'Mid-run swap! Cross your brains!', ms: 2200 }],
    },
    // GOAL SUBVERSION: the obvious exit kills — per-player evaluation.
    {
      id: 'fakeKillP1', when: inZone('fakeZone6', 'p1'),
      do: [
        { act: 'sound', name: 'troll' },
        { act: 'shake', power: 6 },
        { act: 'say', text: 'That exit was a LIE.', ms: 1400 },
        { act: 'kill', who: 'p1', zone: 'fakeZone6', cause: 'fakeExit' },
      ],
    },
    {
      id: 'fakeKillP2', when: inZone('fakeZone6', 'p2'),
      do: [
        { act: 'sound', name: 'troll' },
        { act: 'shake', power: 6 },
        { act: 'say', text: 'That exit was a LIE.', ms: 1400 },
        { act: 'kill', who: 'p2', zone: 'fakeZone6', cause: 'fakeExit' },
      ],
    },
    // GOAL SUBVERSION, part 2: the spike pit that SAVES you. Falling into the
    // "bottomless" pit2 teleports you to safety — the only way to earn the exit.
    {
      id: 'faithSave', when: inZone('faithLeap', 'any'),
      do: [
        { act: 'teleport', who: 'any', zone: 'faithLeap', to: [22, 12] },
        { act: 'flag', name: 'leapt', value: 1 },
        { act: 'shake', power: 3 },
        { act: 'say', text: 'The pit... SAVED you?! Have faith.', ms: 2200 },
      ],
    },
    {
      id: 'faithNag', cooldownMs: 8000,
      when: and(inZone('rightSide', 'both'), not({ op: 'flag', name: 'leapt' })),
      do: [{ act: 'say', text: "Exit won't appear. Have FAITH in the pit.", ms: 2600, style: 'info' }],
    },
    // The REAL exit appears only when BOTH reach the far side AND someone took
    // the leap of faith — impossible solo, impossible without trusting the pit.
    {
      id: 'realReveal', when: and(inZone('rightSide', 'both'), { op: 'flag', name: 'leapt' }),
      do: [
        { act: 'set', target: 'exit', state: 'on' },
        { act: 'particles', target: 'exit', kind: 'sparkle' },
        { act: 'sound', name: 'unlock' },
        { act: 'say', text: 'Real exit revealed. Ignore the fake!', ms: 2600, style: 'info' },
      ],
      else: [{ act: 'set', target: 'exit', state: 'off' }],
    },
  ],
};

export const LEVELS: LevelDef[] = [L1, L2, L3, L4, LF, L5, L6];
