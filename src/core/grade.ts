import type { AnswerSpec, Question } from './types';

/** 아이가 낸 답. 화면의 입력 방식마다 모양이 다르다. */
export type Response =
  | { t: 'choice'; index: number }
  | { t: 'number'; value: number }
  | { t: 'pickN'; count: number }
  | { t: 'gaps'; values: (number | null)[] }
  | { t: 'order'; keys: string[] }
  | { t: 'clockSet'; h: number; m: number }
  | { t: 'tapTargets'; keys: string[] }
  | { t: 'coins'; total: number }
  | { t: 'trace'; ok: boolean }
  | { t: 'calTap'; days: number[] }
  | { t: 'split'; left: number }
  | { t: 'match'; mistakes: number };

export interface Grade {
  correct: boolean;
  /** 헷갈린 쌍을 찾기 위한 문자열(정답 키, 고른 키) */
  expected: string;
  given: string;
}

const sorted = (xs: readonly (string | number)[]): string => [...xs].map(String).sort().join(',');

function clockKey(h: number, m: number): string {
  return m === 0 ? String(h) : `${h}:${m}`;
}

/** 시침이 같은 위치인지 비교하기 위해 12시와 0시를 같게 본다 */
const hour12 = (h: number): number => ((h - 1 + 12) % 12) + 1;

export function grade(q: Question, r: Response): Grade {
  const a: AnswerSpec = q.answer;
  if (a.t !== r.t) throw new Error(`답 종류가 다릅니다: ${a.t} / ${r.t}`);
  switch (a.t) {
    case 'choice': {
      const rr = r as Extract<Response, { t: 'choice' }>;
      const exp = a.options[a.correct]?.key ?? '';
      const giv = a.options[rr.index]?.key ?? '';
      return { correct: rr.index === a.correct, expected: exp, given: giv };
    }
    case 'number': {
      const rr = r as Extract<Response, { t: 'number' }>;
      return { correct: rr.value === a.correct, expected: String(a.correct), given: String(rr.value) };
    }
    case 'pickN': {
      const rr = r as Extract<Response, { t: 'pickN' }>;
      return { correct: rr.count === a.n, expected: String(a.n), given: String(rr.count) };
    }
    case 'gaps': {
      const rr = r as Extract<Response, { t: 'gaps' }>;
      const ok = rr.values.length === a.answers.length && rr.values.every((v, i) => v === a.answers[i]);
      return { correct: ok, expected: a.answers.join(','), given: rr.values.map((v) => (v === null ? '_' : String(v))).join(',') };
    }
    case 'order': {
      const rr = r as Extract<Response, { t: 'order' }>;
      const ok = rr.keys.length === a.correct.length && rr.keys.every((k, i) => k === a.correct[i]);
      return { correct: ok, expected: a.correct.join(','), given: rr.keys.join(',') };
    }
    case 'clockSet': {
      const rr = r as Extract<Response, { t: 'clockSet' }>;
      const ok = hour12(rr.h) === hour12(a.h) && rr.m === a.m;
      return { correct: ok, expected: clockKey(hour12(a.h), a.m), given: clockKey(hour12(rr.h), rr.m) };
    }
    case 'tapTargets': {
      const rr = r as Extract<Response, { t: 'tapTargets' }>;
      const need = a.need ?? (a.targets.length === 1 ? 'one' : 'all');
      const ok = need === 'one' ? rr.keys.length === 1 && a.targets.includes(rr.keys[0] as string) : sorted(rr.keys) === sorted(a.targets);
      return { correct: ok, expected: sorted(a.targets), given: sorted(rr.keys) };
    }
    case 'coins': {
      const rr = r as Extract<Response, { t: 'coins' }>;
      return { correct: rr.total === a.target, expected: String(a.target), given: String(rr.total) };
    }
    case 'trace': {
      const rr = r as Extract<Response, { t: 'trace' }>;
      return { correct: rr.ok, expected: a.glyph, given: rr.ok ? a.glyph : '' };
    }
    case 'calTap': {
      const rr = r as Extract<Response, { t: 'calTap' }>;
      const need = a.need ?? (a.targets.length === 1 ? 'one' : 'all');
      const ok = need === 'one' ? rr.days.length === 1 && a.targets.includes(rr.days[0] as number) : sorted(rr.days) === sorted(a.targets);
      return { correct: ok, expected: sorted(a.targets), given: sorted(rr.days) };
    }
    case 'split': {
      const rr = r as Extract<Response, { t: 'split' }>;
      return { correct: rr.left === a.left, expected: String(a.left), given: String(rr.left) };
    }
    case 'match': {
      const rr = r as Extract<Response, { t: 'match' }>;
      return { correct: rr.mistakes === 0, expected: 'match', given: String(rr.mistakes) };
    }
  }
}

/** 정답을 보여 줄 때 쓰는 문자열 요약(화면에는 쓰지 않고 기록용) */
export function answerSummary(q: Question): string {
  const a = q.answer;
  switch (a.t) {
    case 'choice':
      return a.options[a.correct]?.key ?? '';
    case 'number':
      return String(a.correct);
    case 'pickN':
      return String(a.n);
    case 'gaps':
      return a.answers.join(',');
    case 'order':
      return a.correct.join(',');
    case 'clockSet':
      return clockKey(a.h, a.m);
    case 'tapTargets':
      return sorted(a.targets);
    case 'coins':
      return String(a.target);
    case 'trace':
      return a.glyph;
    case 'calTap':
      return sorted(a.targets);
    case 'split':
      return String(a.left);
    case 'match':
      return 'match';
  }
}
