export interface ScoreEntry {
  name: string;
  score: number;
  time: number;
  deaths: number;
  date: number;
}

const KEY = 'shared-fate-highscores-v1';
const MAX = 8;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function isHighScore(score: number): boolean {
  const list = loadScores();
  return list.length < MAX || score > list[list.length - 1].score;
}

export function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const list = [...loadScores(), entry]
    .sort((a, b) => b.score - a.score || a.time - b.time)
    .slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  return list;
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
