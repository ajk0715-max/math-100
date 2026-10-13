import { countKo, josa, nativeNum, sinoNum, type JosaKind } from '../ko';
import { distinctInts, shuffle, type Rng } from '../rng';
import type { AnswerSpec, GenCtx, Option, Question } from '../types';

export function mk(c: GenCtx, q: Omit<Question, 'id' | 'skill' | 'level'>): Question {
  return { id: `${c.skillId}#${c.seed}`, skill: c.skillId, level: c.level, ...q };
}

type ChoiceSpec = Extract<AnswerSpec, { t: 'choice' }>;

/** 정답 1개 + 오답 후보로 객관식을 만든다. 오답은 key 기준으로 중복을 없애고, 섞어서 count-1개만 고른다. */
export function buildChoice(r: Rng, correct: Option, wrong: Option[], count = 3, cols?: number): ChoiceSpec {
  const seen = new Set<string>([correct.key]);
  const uniq: Option[] = [];
  for (const w of wrong) {
    if (seen.has(w.key)) continue;
    seen.add(w.key);
    uniq.push(w);
  }
  const options = shuffle(r, [correct, ...shuffle(r, uniq).slice(0, count - 1)]);
  const spec: ChoiceSpec = { t: 'choice', options, correct: options.findIndex((o) => o.key === correct.key) };
  if (cols) spec.cols = cols;
  return spec;
}

/** 숫자 보기: 정답 근처 값을 우선 오답으로 쓰고, 모자라면 범위 전체에서 채운다. */
export function numChoice(
  r: Rng,
  correct: number,
  min: number,
  max: number,
  opts: { count?: number; spread?: number; say?: (n: number) => string; text?: (n: number) => string } = {},
): ChoiceSpec {
  const count = opts.count ?? 3;
  const spread = opts.spread ?? 2;
  const text = opts.text ?? ((n: number) => String(n));
  const toOpt = (n: number): Option => {
    const o: Option = { key: String(n), text: text(n) };
    if (opts.say) o.say = opts.say(n);
    return o;
  };
  const near: number[] = [];
  for (let d = 1; d <= spread; d++) {
    if (correct - d >= min) near.push(correct - d);
    if (correct + d <= max) near.push(correct + d);
  }
  let wrong = near;
  if (wrong.length < count - 1) {
    wrong = near.concat(distinctInts(r, min, max, count, [correct, ...near]));
  }
  return buildChoice(r, toOpt(correct), wrong.map(toOpt), count);
}

/** 한자어 수 읽기(추상적인 수): 오, 이십삼 */
export const sn = (n: number): string => sinoNum(n);

/** 읽기용: 한자어 수 + 조사. sj(5, '은/는') → "오는" */
export const sj = (n: number, kind: JosaKind): string => {
  const w = sinoNum(n);
  return w + josa(w, kind);
};

/** 세는 말(하나, 둘 …) */
export const nn = (n: number): string => nativeNum(n);

/** 화면용: 숫자 + 조사. dj(5, '이/가') → "5가", dj(6, '이/가') → "6이" */
export const dj = (n: number, kind: JosaKind): string => `${n}${josa(String(n), kind)}`;

/** 읽기용: 세는 수 + 단위 + 조사. cj(3, '개', '를') → "세 개를" */
export const cj = (n: number, counter: string, kind: JosaKind): string => `${countKo(n, counter)}${josa(counter, kind)}`;

export function range(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
}

/** 섞은 순서가 정답 순서와 같아지지 않게 섞는다(순서 맞추기 문제용). */
export function shuffleDiff<T extends { key: string }>(r: Rng, items: readonly T[], correct: readonly string[]): T[] {
  let out = shuffle(r, items);
  for (let i = 0; i < 8 && out.every((it, k) => it.key === correct[k]); i++) out = shuffle(r, items);
  if (out.every((it, k) => it.key === correct[k]) && out.length > 1) out = [...out.slice(1), out[0] as T];
  return out;
}
