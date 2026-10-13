import { describe, expect, it } from 'vitest';
import { toParts } from '@/core/dates';
import { josa, nativeCounter, sinoNum } from '@/core/ko';
import { generate } from '@/core/question';
import { allSkills } from '@/core/skills';
import type { AnswerSpec, FamilyEvent, Level, MatchPair, Option, Question, Visual } from '@/core/types';

// 2·3단계 문제의 정답 검증.
// 문제를 만든 코드와 따로, 화면에 보이는 값(그림·글·보기)만 읽어서 정답이 맞는지 다시 계산한다.
// 어떤 검사기도 이해하지 못한 문제 모양이 나오면(skipped) 테스트가 실패하므로, 새 문제 유형은 검사기를 함께 늘려야 한다.

const ENVS = [
  {
    today: toParts(new Date(2026, 10, 2)),
    events: [
      { id: 'e1', label: '엄마 생일', month: 3, day: 14, kind: 'birthday' },
      { id: 'e2', label: '아빠 생일', month: 8, day: 2, kind: 'birthday' },
    ] as FamilyEvent[],
  },
  { today: toParts(new Date(2028, 1, 29)), events: [{ id: 'e3', label: '윤일 생일', month: 2, day: 29, kind: 'birthday' }] as FamilyEvent[] },
];
const LEVELS: Level[] = [1, 2, 3];
const SEEDS = 120;

type Env = (typeof ENVS)[number];
interface Case {
  q: Question;
  env: Env;
  level: Level;
  seed: number;
}

function* cases(skill: string, seeds = SEEDS): Generator<Case> {
  for (const env of ENVS) for (const level of LEVELS) for (let seed = 1; seed <= seeds; seed++) yield { q: generate({ skill, level, seed }, env), env, level, seed };
}

const SKIP = 'skip';
type Check = (c: Case) => string | null;

/** 검사기가 이해하지 못해 건너뛴 문제를 묶어 보여 주기 위한 모양(숫자는 #) */
const shape = (q: Question): string => `L${q.level} ${q.answer.t}${q.visual ? '+' + q.visual.k : ''} :: ${q.prompt.replace(/\d+/g, '#').slice(0, 48)}`;

/** 정답 표시를 일부러 다른 것으로 바꾼 문제들(검사기가 이를 잡아내야 한다) */
function mutants(q: Question): Question[] {
  const a = q.answer;
  const out: AnswerSpec[] = [];
  if (a.t === 'choice') a.options.forEach((_, i) => i !== a.correct && out.push({ ...a, correct: i }));
  else if (a.t === 'number') out.push({ ...a, correct: a.correct + 1 });
  else if (a.t === 'tapTargets') {
    const other = a.items.find((it) => !a.targets.includes(it.key));
    if (other) out.push({ ...a, targets: [other.key] });
  } else if (a.t === 'gaps') out.push({ ...a, answers: a.answers.map((x, i) => (i === 0 ? x + 1 : x)) });
  else if (a.t === 'pickN') out.push({ ...a, n: a.n + 1 });
  else if (a.t === 'order') {
    if (a.correct.length >= 2) out.push({ ...a, correct: [a.correct[1] as string, a.correct[0] as string, ...a.correct.slice(2)] });
  } else if (a.t === 'match') {
    if (a.pairs.length >= 2) out.push({ ...a, pairs: a.pairs.map((pr, i) => (i === 0 ? { ...pr, b: (a.pairs[1] as MatchPair).b } : pr)) });
  } else if (a.t === 'coins') out.push({ ...a, target: a.target + 10 });
  else if (a.t === 'split') out.push({ ...a, left: a.left + 1 });
  return out.map((answer) => ({ ...q, answer }));
}

/** 풀이 글·도움말에 적힌 식(a + b = c, a + b − c = d)과 식 그림(eq)이 실제로 맞는지 */
function writtenSumProblem(q: Question): string | null {
  const eqs: string[] = [];
  for (const t of [q.explain ?? '', q.hint?.say ?? '']) for (const m of t.matchAll(/(?<![\d+−×] )(\d+(?: [+−×] \d+)+) = (\d+)/g)) eqs.push(m[0]);
  for (const v of [q.visual, q.hint?.visual]) for (const s of flat(v)) if (s.k === 'eq') eqs.push(s.parts.join(' '));
  for (const e of eqs) {
    const m = /^(\d+(?: [+−×] \d+)+) = (\d+)$/.exec(e);
    if (!m) continue;
    const toks = (m[1] as string).split(' ');
    const ops = toks.filter((_, i) => i % 2 === 1);
    // 곱셈이 다른 계산과 섞이면 계산 순서가 달라지므로 건너뛴다
    if (ops.includes('×') && ops.length > 1) continue;
    let r = Number(toks[0]);
    ops.forEach((op, i) => {
      const n = Number(toks[2 * i + 2]);
      r = op === '+' ? r + n : op === '−' ? r - n : r * n;
    });
    if (r !== Number(m[2])) return `적힌 식이 틀림: ${e}`;
  }
  return null;
}

function run(skill: string, check: Check, opts: { minChecked?: number; allow?: RegExp; missOk?: RegExp } = {}): void {
  const bad: string[] = [];
  const skipped = new Map<string, number>();
  const missed: string[] = [];
  let checked = 0;
  for (const c of cases(skill)) {
    const p = check(c);
    if (p === SKIP) {
      if (opts.allow && opts.allow.test(c.q.prompt)) continue;
      skipped.set(shape(c.q), (skipped.get(shape(c.q)) ?? 0) + 1);
      continue;
    }
    checked++;
    const w = p ?? writtenSumProblem(c.q);
    if (w) bad.push(`L${c.level} s${c.seed}: ${w} :: ${c.q.prompt}`);
    // 맞게 만든 문제를 일부러 틀리게 바꿨을 때 검사기가 잡는지(잡지 못하면 검사기가 정답을 확인하지 않는 것)
    else if (c.seed <= 40) {
      for (const m of mutants(c.q)) {
        if (check({ ...c, q: m }) === null && !(opts.missOk && opts.missOk.test(c.q.prompt))) missed.push(`L${c.level} s${c.seed}: ${shape(m)}`);
      }
    }
    if (bad.length >= 6) break;
  }
  expect(bad).toEqual([]);
  expect([...skipped.keys()].slice(0, 6)).toEqual([]);
  expect(missed.slice(0, 4)).toEqual([]);
  expect(checked).toBeGreaterThanOrEqual(opts.minChecked ?? 100);
}

// ---------------------------------------------------------------------------
// 도구
// ---------------------------------------------------------------------------

const flat = (v?: Visual): Visual[] => (v ? (v.k === 'row' || v.k === 'col' ? [v, ...v.items.flatMap(flat)] : [v]) : []);
const optsOf = (q: Question): Option[] => (q.answer.t === 'choice' ? q.answer.options : []);
const correctOpt = (q: Question): Option => {
  if (q.answer.t !== 'choice') throw new Error('choice가 아님');
  return q.answer.options[q.answer.correct] as Option;
};
const wrongOpts = (q: Question): Option[] => (q.answer.t === 'choice' ? q.answer.options.filter((_, i) => i !== (q.answer as { correct: number }).correct) : []);
const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const optNum = (o: Option): number | null => num(o.key) ?? num(o.text);
const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** 정답이 숫자인 문제의 정답 값(고르기·직접 쓰기) */
function answerNumber(q: Question): number | null {
  const a = q.answer;
  if (a.t === 'number') return a.correct;
  if (a.t === 'choice') return optNum(correctOpt(q));
  return null;
}

/** 숫자 보기가 모두 서로 다른 정수이고 정답과 겹치지 않는지 */
function numericOptionsProblem(q: Question): string | null {
  if (q.answer.t !== 'choice') return null;
  const vals = optsOf(q).map(optNum);
  if (vals.some((v) => v === null)) return null;
  if (new Set(vals).size !== vals.length) return `숫자 보기가 겹침: ${vals.join(',')}`;
  return null;
}

// 한자어(일이삼) 수와 고유어(하나둘셋) 수 읽기
const SINO_D = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
function krSino(n: number): string {
  if (n === 100) return '백';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return (t === 0 ? '' : (t === 1 ? '' : SINO_D[t]) + '십') + (o === 0 ? '' : SINO_D[o]);
}
const NATIVE_T = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const NATIVE_O = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const krNative = (n: number): string => NATIVE_T[Math.floor(n / 10)] + NATIVE_O[n % 10];
const SINO_MAP = new Map(range(1, 100).map((n) => [krSino(n), n]));
const NATIVE_MAP = new Map(range(1, 99).map((n) => [krNative(n), n]));
const parseKr = (w: string): number | null => SINO_MAP.get(w) ?? NATIVE_MAP.get(w) ?? null;

/** 눈에 보이는 그림이 나타내는 수(십 모형, 물건 개수, 큰 글자) */
function visualValue(v: Visual | undefined): number | null {
  if (!v) return null;
  if (v.k === 'tens') return v.tens * 10 + v.ones;
  if (v.k === 'objects') return v.crossed ? v.n - v.crossed : v.n;
  if (v.k === 'big') return num(v.text);
  return null;
}

// ---------------------------------------------------------------------------
// A. 수 감각: 세기·읽기·순서·크기 비교·묶어 세기
// ---------------------------------------------------------------------------

const COUNTER = '(?:개|마리|송이|대|명|권|자루|병)';

/** 개수를 세는 문제(몇 개일까요 / N개 들어 있는 것 / N개를 눌러) */
function countCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  let m: RegExpExecArray | null;
  if (a.t === 'pickN') {
    m = new RegExp(`(\\d+)${COUNTER}를 눌러`).exec(q.prompt);
    if (!m) return SKIP;
    if (a.n !== Number(m[1])) return `누를 개수 ${a.n} ≠ 글의 ${m[1]}`;
    if (a.total <= a.n) return `전체 ${a.total}가 누를 개수 ${a.n}보다 많아야 함`;
    return null;
  }
  if (new RegExp(`(\\d+)${COUNTER} 들어 있는 것을`).test(q.prompt) && a.t === 'choice') {
    const N = Number((new RegExp(`(\\d+)${COUNTER} 들어 있는 것을`).exec(q.prompt) as RegExpExecArray)[1]);
    if (v?.k !== 'big' || Number(v.text) !== N) return '큰 숫자 그림이 글과 다름';
    optsOf(q).forEach((o, i) => {
      void i;
      void o;
    });
    if (visualValue(correctOpt(q).visual) !== N) return `정답 보기의 그림이 ${N}개가 아님`;
    for (const o of wrongOpts(q)) if (visualValue(o.visual) === N) return `오답 보기도 ${N}개`;
    return null;
  }
  m = /숫자 (\d+)만큼 .* 있는 .*를 잡아요/.exec(q.prompt);
  if (m && a.t === 'choice') {
    const N = Number(m[1]);
    if (visualValue(correctOpt(q).visual) !== N) return `정답 보기의 그림이 ${N}개가 아님`;
    for (const o of wrongOpts(q)) if (visualValue(o.visual) === N) return `오답 보기도 ${N}개`;
    return null;
  }
  if (/몇 \S+일까요\?/.test(q.prompt) && v?.k === 'objects') {
    const got = answerNumber(q);
    if (got !== v.n) return `그림은 ${v.n}개인데 정답 ${got}`;
    if (a.t === 'choice') {
      for (const o of wrongOpts(q)) if (optNum(o) === v.n) return '오답 보기도 그림의 개수와 같음';
      for (const o of optsOf(q)) if ((optNum(o) ?? 1) < 1) return '보기에 0 이하가 있음';
    }
    return numericOptionsProblem(q);
  }
  return SKIP;
}

/** 놓이는 칸이 정해진 자리(십의 자리·일의 자리) 문제와 수 읽기 */
function placeCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  let m: RegExpExecArray | null;

  // 한 줄이 가득 찬 뒤 낱개를 더 센다
  m = /(\d+)\S+가 한 줄을 채웠고, 다음 줄에 (\d+)\S+가 있어요/.exec(p);
  if (m) {
    const want = Number(m[1]) + Number(m[2]);
    if (answerNumber(q) !== want) return `${m[1]}+${m[2]}=${want}인데 정답 ${answerNumber(q)}`;
    if (v?.k !== 'objects' || v.n !== want) return '그림의 개수가 다름';
    return numericOptionsProblem(q);
  }
  // 10개 묶음 a개와 낱개 b개 → 모두 몇 개
  m = /^10\S+ 묶음 (\d+)\S+와 낱\S+ (\d+)\S+(?:예요|는)/.exec(p);
  if (m) {
    const want = Number(m[1]) * 10 + Number(m[2]);
    if (answerNumber(q) !== want) return `묶음 ${m[1]}·낱개 ${m[2]} = ${want}인데 정답 ${answerNumber(q)}`;
    if (v?.k === 'tens' && (v.tens !== Number(m[1]) || v.ones !== Number(m[2]))) return '십 모형이 글과 다름';
    return numericOptionsProblem(q);
  }
  m = /^낱\S+가 (\d+)\S+이고 10\S+ 묶음이 (\d+)\S+인 수는 얼마일까요/.exec(p);
  if (m) {
    const want = Number(m[2]) * 10 + Number(m[1]);
    if (answerNumber(q) !== want) return `낱개 ${m[1]}·묶음 ${m[2]} = ${want}인데 정답 ${answerNumber(q)}`;
    return numericOptionsProblem(q);
  }
  // 10개 묶음이 n개 있어요 → 10n
  m = /^10\S+ 묶음이 (\d+)\S+ 있어요\. 모두 몇/.exec(p);
  if (m) {
    const want = Number(m[1]) * 10;
    if (answerNumber(q) !== want) return `묶음 ${m[1]}개 = ${want}인데 정답 ${answerNumber(q)}`;
    if (v?.k === 'tens' && (v.tens !== Number(m[1]) || v.ones !== 0)) return '십 모형이 글과 다름';
    return numericOptionsProblem(q);
  }
  m = /^10\S+ 묶음 (\d+)\S+는 모두 몇/.exec(p);
  if (m) {
    const want = Number(m[1]) * 10;
    if (answerNumber(q) !== want) return `묶음 ${m[1]}개 = ${want}인데 정답 ${answerNumber(q)}`;
    return numericOptionsProblem(q);
  }
  // 10과 7을 모으면 → 17
  m = /^(\d+)(?:과|와) (\d+)(?:을|를) 모으면/.exec(p);
  if (m) {
    const want = Number(m[1]) + Number(m[2]);
    if (answerNumber(q) !== want) return `${m[1]}+${m[2]}=${want}인데 정답 ${answerNumber(q)}`;
    if (v?.k === 'bond' && (v.a !== Number(m[1]) || v.b !== Number(m[2]))) return '가르기 그림이 글과 다름';
    return numericOptionsProblem(q);
  }
  // n을 나타낸 그림 찾기
  m = /^(\d+)(?:을|를) 나타낸 그림을 찾아/.exec(p);
  if (m) {
    const N = Number(m[1]);
    if (visualValue(correctOpt(q).visual) !== N) return `정답 보기의 그림이 ${N}이 아님`;
    for (const o of wrongOpts(q)) if (visualValue(o.visual) === N) return '오답 보기의 그림도 같은 수';
    return null;
  }
  // N은 10개 묶음 몇 개와 낱개 몇 개일까요 / 14는 10개 묶음 1개와 낱개 몇 개
  m = /^(\d+)(?:은|는) 10\S+ 묶음 몇 \S+와 낱\S+ 몇 \S+일까요/.exec(p);
  if (m) {
    const N = Number(m[1]);
    const want = `묶음 ${Math.floor(N / 10)}개, 낱개 ${N % 10}개`;
    if (correctOpt(q).text !== want) return `정답 보기 ${correctOpt(q).text} ≠ ${want}`;
    for (const o of wrongOpts(q)) if (o.text === want) return '오답 보기가 정답과 같음';
    if (v?.k === 'big' && Number(v.text) !== N) return '큰 숫자 그림이 글과 다름';
    return null;
  }
  m = /^(\d+)(?:은|는) 10\S+ 묶음 (\d+)\S+와 낱\S+ 몇 \S+일까요/.exec(p);
  if (m) {
    const N = Number(m[1]);
    const want = N - 10 * Number(m[2]);
    if (answerNumber(q) !== want) return `${N}−${m[2]}0=${want}인데 정답 ${answerNumber(q)}`;
    return null;
  }
  m = /^(\d+)(?:은|는) 10\S+ 묶음 몇 \S+일까요/.exec(p);
  if (m) {
    const N = Number(m[1]);
    if (N % 10 !== 0) return '10의 배수가 아님';
    const got = correctOpt(q).text;
    if (got !== `${N / 10}묶음`) return `정답 보기 ${got} ≠ ${N / 10}묶음`;
    for (const o of wrongOpts(q)) if (o.text === `${N / 10}묶음`) return '오답 보기가 정답과 같음';
    return null;
  }
  // 수 읽기
  m = /^숫자 (\d+)(?:을|를) 바르게 읽은 것은/.exec(p);
  if (m) {
    const N = Number(m[1]);
    if (v?.k === 'big' && Number(v.text) !== N) return '큰 숫자 그림이 글과 다름';
    const ok = new Set([krSino(N), krNative(N)]);
    if (!ok.has(correctOpt(q).text as string)) return `정답 보기 ${correctOpt(q).text}는 ${N}의 읽기가 아님(${[...ok]})`;
    for (const o of wrongOpts(q)) if (ok.has(o.text as string)) return `오답 보기 ${o.text}도 ${N}의 읽기`;
    return null;
  }
  m = /^'(\S+)'(?:을|를) 숫자로 쓰면/.exec(p);
  if (m) {
    const N = parseKr(m[1] as string);
    if (N === null) return `읽기 '${m[1]}'를 해석하지 못함`;
    if (optNum(correctOpt(q)) !== N) return `'${m[1]}'은 ${N}인데 정답 보기 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (optNum(o) === N) return '오답 보기도 같은 수';
    return numericOptionsProblem(q);
  }
  if (/숫자와 읽는 말을 짝지어/.test(p) && a.t === 'match') {
    for (const pr of a.pairs) {
      const n = num(pr.a.text);
      const w = parseKr(pr.b.text ?? '');
      if (n === null || w === null || n !== w) return `짝 ${pr.a.text}~${pr.b.text}이 맞지 않음`;
    }
    if (new Set(a.pairs.map((pr) => pr.a.text)).size !== a.pairs.length) return '같은 숫자가 두 번 나옴';
    return null;
  }
  return SKIP;
}

/** 수를 차례로 놓는 문제: 징검다리(gaps), 앞·뒤·사이, 수 배열표, 뛰어 세기 */
function orderCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  let m: RegExpExecArray | null;

  if (a.t === 'gaps') {
    const filled: number[] = [];
    let k = 0;
    for (const s of a.seq) filled.push(s === null ? (a.answers[k++] as number) : s);
    if (k !== a.answers.length) return '빈칸 수와 답의 수가 다름';
    const d = (filled[1] as number) - (filled[0] as number);
    for (let i = 1; i < filled.length; i++) if ((filled[i] as number) - (filled[i - 1] as number) !== d) return `채운 줄이 같은 간격이 아님: ${filled}`;
    m = /^(\d+)씩 뛰어 세어서/.exec(p);
    if (m && d !== Number(m[1])) return `${m[1]}씩인데 간격 ${d}`;
    if (!m && d !== 1) return `차례대로 놓는 문제인데 간격 ${d}`;
    for (const t of a.answers) if (!a.tokens.includes(t)) return `놓을 수 ${t}가 조각에 없음`;
    if (new Set(a.tokens).size !== a.tokens.length) return '조각이 겹침';
    return null;
  }
  if (a.t !== 'choice') return SKIP;

  // 뛰어 세기: 빈칸 하나
  if (v?.k === 'stones' && /(^\d+씩 뛰어 세어요|^규칙에 따라 뛰어 셀 때)/.test(p)) {
    const seq = v.seq;
    const hole = seq.findIndex((s) => s === null);
    if (hole < 0) return '빈칸이 없음';
    const known = seq.map((s, i) => [s, i] as const).filter((x): x is readonly [number, number] => x[0] !== null);
    const d = ((known[1] as readonly [number, number])[0] - (known[0] as readonly [number, number])[0]) / ((known[1] as readonly [number, number])[1] - (known[0] as readonly [number, number])[1]);
    for (let i = 1; i < known.length; i++) {
      const [x1, i1] = known[i - 1] as readonly [number, number];
      const [x2, i2] = known[i] as readonly [number, number];
      if ((x2 - x1) / (i2 - i1) !== d) return `알려진 수의 간격이 고르지 않음: ${seq}`;
    }
    const want = (known[0] as readonly [number, number])[0] + d * (hole - (known[0] as readonly [number, number])[1]);
    m = /^(\d+)씩 뛰어 세어요/.exec(p);
    if (m && d !== Number(m[1])) return `${m[1]}씩인데 줄의 간격은 ${d}`;
    if (optNum(correctOpt(q)) !== want) return `빈칸은 ${want}인데 정답 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (optNum(o) === want) return '오답 보기도 같은 수';
    return numericOptionsProblem(q);
  }
  // 몇씩 뛰어 센 것일까요
  m = /^(\d+), (\d+), (\d+), (\d+) … 몇씩 뛰어 센 것일까요/.exec(p);
  if (m) {
    const xs = [m[1], m[2], m[3], m[4]].map(Number) as number[];
    const d = (xs[1] as number) - (xs[0] as number);
    if (xs.some((x, i) => i > 0 && x - (xs[i - 1] as number) !== d)) return `간격이 고르지 않음: ${xs}`;
    if (correctOpt(q).text !== `${d}씩`) return `간격은 ${d}인데 정답 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (o.text === `${d}씩`) return '오답 보기도 같은 간격';
    if (v?.k === 'stones') {
      const seen = v.seq.filter((s): s is number => s !== null);
      if (seen.join() !== xs.join()) return '그림의 수가 글과 다름';
    }
    return null;
  }
  // 바로 앞·바로 뒤·사이
  m = /^(\d+) 바로 앞의 수는/.exec(p);
  if (m) {
    const x = Number(m[1]);
    if (optNum(correctOpt(q)) !== x - 1) return `${x} 바로 앞은 ${x - 1}인데 정답 ${correctOpt(q).text}`;
    if (v?.k === 'stones' && v.seq[1] !== x) return '그림의 수가 글과 다름';
    for (const o of wrongOpts(q)) if (optNum(o) === x - 1) return '오답 보기도 같은 수';
    return numericOptionsProblem(q);
  }
  m = /^(\d+) 바로 뒤의 수는/.exec(p);
  if (m) {
    const x = Number(m[1]);
    if (optNum(correctOpt(q)) !== x + 1) return `${x} 바로 뒤는 ${x + 1}인데 정답 ${correctOpt(q).text}`;
    if (v?.k === 'stones' && v.seq[0] !== x) return '그림의 수가 글과 다름';
    for (const o of wrongOpts(q)) if (optNum(o) === x + 1) return '오답 보기도 같은 수';
    return numericOptionsProblem(q);
  }
  m = /^(\d+)(?:과|와) (\d+) 사이의 수는/.exec(p);
  if (m) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (y !== x + 2) return `사이의 수가 하나가 아님: ${x}, ${y}`;
    if (optNum(correctOpt(q)) !== x + 1) return `${x}와 ${y} 사이는 ${x + 1}인데 정답 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (optNum(o) === x + 1) return '오답 보기도 같은 수';
    return numericOptionsProblem(q);
  }
  // 수 배열표의 ?
  if (/^수 배열표에서 \?에 알맞은 수/.test(p)) {
    if (v?.k !== 'chart' || !v.blanks || v.blanks.length !== 1) return '수 배열표에 물음표 칸이 하나가 아님';
    const x = v.blanks[0] as number;
    if (x < v.from || x > v.to) return '물음표 칸이 표 범위 밖';
    if (optNum(correctOpt(q)) !== x) return `물음표 칸은 ${x}인데 정답 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (optNum(o) === x) return '오답 보기도 같은 수';
    return numericOptionsProblem(q);
  }
  return SKIP;
}

/** 두 수·세 수 크기 비교 */
function compareCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  let m: RegExpExecArray | null;

  if (a.t === 'tapTargets') {
    // 두 그림 중 많은/큰 쪽, 풍선 비교
    if (/^더 (많은|적은) 쪽을 눌러|^더 (큰|작은) 수를 나타낸 쪽을 눌러/.test(p)) {
      const big = /많은|큰/.test(p);
      const vals = a.items.map((it) => visualValue(it.visual));
      if (vals.some((x) => x === null) || vals.length !== 2) return '비교할 두 그림의 값을 읽지 못함';
      if (vals[0] === vals[1]) return '두 수가 같음';
      const hit = a.items[big ? ((vals[0] as number) > (vals[1] as number) ? 0 : 1) : (vals[0] as number) < (vals[1] as number) ? 0 : 1] as { key: string };
      if (a.targets.length !== 1 || a.targets[0] !== hit.key) return `${vals} 중 ${big ? '큰' : '작은'} 쪽이 정답 표시와 다름`;
      return null;
    }
    const items = a.items.map((it) => num(it.text ?? it.key));
    if (items.some((x) => x === null)) return SKIP;
    const xs = items as number[];
    const keyOf = (n: number): string => (a.items[xs.indexOf(n)] as { key: string }).key;
    const hits = (f: (n: number) => boolean): string[] => xs.filter(f).map(keyOf).sort();
    const sorted = (t: string[]): string[] => [...t].sort();
    if (new Set(xs).size !== xs.length) return '풍선의 수가 겹침';
    m = /^가장 (작은|큰) 수가 적힌 풍선/.exec(p);
    if (m) {
      const want = m[1] === '큰' ? Math.max(...xs) : Math.min(...xs);
      return sorted(a.targets).join() === keyOf(want) ? null : `가장 ${m[1]} 수 ${want}가 정답 표시와 다름`;
    }
    m = /^(\d+)보다 (작은|큰) 수가 적힌 풍선을 모두/.exec(p);
    if (m) {
      const N = Number(m[1]);
      const want = hits((n) => (m?.[2] === '큰' ? n > N : n < N));
      if (want.length === 0) return `조건에 맞는 풍선이 없음`;
      return sorted(a.targets).join() === want.join() ? null : `${N}보다 ${m[2]} 수: ${want} ≠ 표시 ${a.targets}`;
    }
    m = /^(\d+)보다 크고 (\d+)보다 작은 수가 적힌 풍선을 모두/.exec(p);
    if (m) {
      const lo = Number(m[1]);
      const hi = Number(m[2]);
      const want = hits((n) => n > lo && n < hi);
      if (want.length === 0) return '조건에 맞는 풍선이 없음';
      return sorted(a.targets).join() === want.join() ? null : `${lo}와 ${hi} 사이: ${want} ≠ 표시 ${a.targets}`;
    }
    return SKIP;
  }
  if (a.t !== 'choice') return SKIP;

  m = /^(\d+)(?:과|와) (\d+) 중에서 더 (큰|작은) 수는/.exec(p);
  if (m) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (x === y) return '두 수가 같음';
    const want = m[3] === '큰' ? Math.max(x, y) : Math.min(x, y);
    if (optNum(correctOpt(q)) !== want) return `${x}, ${y} 중 ${m[3]} 수는 ${want}인데 정답 ${correctOpt(q).text}`;
    const shown = flat(v).filter((s) => s.k === 'big').map(visualValue);
    if (shown.length === 2 && shown.join() !== [x, y].join()) return '그림의 두 수가 글과 다름';
    return null;
  }
  m = /^가장 (큰|작은) 수를 찾아/.exec(p);
  if (m) {
    const xs = flat(v).filter((s) => s.k === 'big').map(visualValue) as number[];
    if (xs.length !== 3 || new Set(xs).size !== 3) return '비교할 수가 서로 다른 셋이 아님';
    const want = m[1] === '큰' ? Math.max(...xs) : Math.min(...xs);
    if (optNum(correctOpt(q)) !== want) return `${xs} 중 가장 ${m[1]} 수는 ${want}인데 정답 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (optNum(o) === want) return '오답 보기도 같은 수';
    return null;
  }
  m = /^(\d+)(?:은|는) (\d+)보다 큰 수일까요, 작은 수일까요/.exec(p);
  if (m) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (x === y) return '두 수가 같음';
    const want = x > y ? '크다' : '작다';
    if (correctOpt(q).text !== want) return `${x}는 ${y}보다 ${want}인데 정답 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (o.text === want) return '오답 보기가 정답과 같음';
    return null;
  }
  return SKIP;
}

describe('수 세기', () => {
  for (const id of ['num.count5', 'num.count10', 'num.count20', 'num.count50']) it(id, () => run(id, countCheck));
  for (const id of ['game.fish.5', 'game.fish.10', 'game.fish.20', 'game.fish.50']) it(id, () => run(id, countCheck));
});

describe('자리·읽기·묶어 세기', () => {
  for (const id of ['num.teen', 'num.tens50', 'num.tensOnes50', 'num.read50', 'num.tens100', 'num.tensOnes100', 'num.read100', 'game.bundle.a', 'game.bundle.b']) it(id, () => run(id, placeCheck));
  it('우리말 수 읽기 도구가 맞다', () => {
    expect([11, 20, 25, 30, 47, 99].map(krNative)).toEqual(['열하나', '스물', '스물다섯', '서른', '마흔일곱', '아흔아홉']);
    expect([10, 11, 25, 40, 70, 100].map(krSino)).toEqual(['십', '십일', '이십오', '사십', '칠십', '백']);
  });
});

describe('수의 순서·뛰어 세기', () => {
  const ids = ['num.order10', 'num.order20', 'num.order50', 'num.order100', 'num.skip.a', 'num.skip.b', 'game.stones.10', 'game.stones.20', 'game.stones.50', 'game.stones.100', 'game.stones.skip'];
  for (const id of ids) it(id, () => run(id, orderCheck));
});

describe('수의 크기 비교', () => {
  const ids = ['num.compare10', 'num.compare20', 'num.compare50', 'num.compare100', 'game.balloons.cmp10', 'game.balloons.cmp20', 'game.balloons.cmp50', 'game.balloons.cmp100'];
  for (const id of ids) it(id, () => run(id, compareCheck));
});

// ---------------------------------------------------------------------------
// B. 돈: 동전 읽기·비교·바꾸기·세기·물건 사기·가게 놀이
// ---------------------------------------------------------------------------

const COIN_VALUES = [10, 50, 100, 500];
const coinsOf = (v?: Visual): number[] | null => (v?.k === 'coins' ? v.coins : null);
const sumOf = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);
const wonNum = (s: string | undefined): number | null => {
  const m = /^(\d+)원$/.exec(s ?? '');
  return m ? Number(m[1]) : null;
};
const countNum = (s: string | undefined): number | null => {
  const m = /^(\d+)개$/.exec(s ?? '');
  return m ? Number(m[1]) : null;
};

/** 글자로 된 보기(○원, ○개)가 정답 하나만 want와 같고 서로 겹치지 않는지 */
function textChoiceProblem(q: Question, want: number, unit: '원' | '개'): string | null {
  const parse = unit === '원' ? wonNum : countNum;
  if (parse(correctOpt(q).text) !== want) return `정답은 ${want}${unit}인데 정답 보기 ${correctOpt(q).text}`;
  const texts = optsOf(q).map((o) => o.text);
  if (new Set(texts).size !== texts.length) return `보기가 겹침: ${texts}`;
  for (const o of wrongOpts(q)) {
    const w = parse(o.text);
    if (w === null) return `보기 '${o.text}'를 읽지 못함`;
    if (w === want) return '오답 보기도 같은 값';
  }
  return null;
}

/** 계산한 값 want가 정답(고르기 또는 직접 쓰기)과 같은지 */
function answerIs(q: Question, want: number, unit: '원' | '개'): string | null {
  const a = q.answer;
  if (a.t === 'number') return a.correct === want ? null : `정답은 ${want}인데 쓰기 정답 ${a.correct}`;
  if (a.t === 'choice') return textChoiceProblem(q, want, unit);
  return '정답 모양을 읽지 못함';
}

/** 왼쪽(L)·오른쪽(R) 두 쪽 중 하나를 누르는 문제의 정답 표시 */
function sideProblem(a: Extract<AnswerSpec, { t: 'tapTargets' }>, left: number, right: number, big: boolean, what: string): string | null {
  if (a.items.length !== 2 || a.items[0]?.key !== 'L' || a.items[1]?.key !== 'R') return '왼쪽·오른쪽 두 칸이 아님';
  if (left === right) return `두 쪽이 같음(${left})`;
  const want = (big ? left > right : left < right) ? 'L' : 'R';
  if (a.targets.length !== 1 || a.targets[0] !== want) return `${left}와 ${right} 중 ${what}은(는) ${want}인데 정답 표시 ${a.targets}`;
  return null;
}

function moneyCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  let m: RegExpExecArray | null;

  // 동전 하나의 값
  if (p === '이 동전은 얼마짜리일까요?') {
    const cs = coinsOf(v);
    if (!cs || cs.length !== 1 || !COIN_VALUES.includes(cs[0] as number)) return '동전 하나가 아님';
    return answerIs(q, cs[0] as number, '원');
  }
  // N원짜리 동전 찾아 누르기
  m = /^(\d+)원짜리 동전을 찾아 눌러 보세요/.exec(p);
  if (m && a.t === 'tapTargets') {
    const N = Number(m[1]);
    const vals = a.items.map((it) => coinsOf(it.visual));
    if (vals.some((x) => !x || x.length !== 1)) return '동전 한 개씩이 아님';
    const xs = vals.map((x) => (x as number[])[0] as number);
    if (new Set(xs).size !== xs.length) return '같은 동전이 둘 이상';
    const hit = a.items.filter((_, i) => xs[i] === N).map((it) => it.key);
    if (hit.length !== 1) return `${N}원 동전이 하나가 아님`;
    return a.targets.length === 1 && a.targets[0] === hit[0] ? null : `${N}원 동전은 ${hit[0]}인데 정답 표시 ${a.targets}`;
  }
  // 값 순서대로 누르기
  m = /^값이 (큰|작은) 동전부터 차례대로/.exec(p);
  if (m && a.t === 'order') {
    const vals = new Map<string, number>();
    for (const it of a.items) {
      const cs = coinsOf(it.visual);
      if (!cs || cs.length !== 1) return '동전 한 개씩이 아님';
      vals.set(it.key, cs[0] as number);
      if (it.say !== `${cs[0]}원`) return `읽어 줄 말 ${it.say} ≠ ${cs[0]}원`;
    }
    const xs = [...vals.values()];
    if (new Set(xs).size !== xs.length) return '같은 동전이 둘 이상';
    if (a.correct.length !== a.items.length || new Set(a.correct).size !== a.items.length || a.correct.some((k) => !vals.has(k))) return '정답 순서가 보기와 맞지 않음';
    const want = [...xs].sort((x, y) => (m?.[1] === '큰' ? y - x : x - y));
    const got = a.correct.map((k) => vals.get(k) as number);
    return want.join() === got.join() ? null : `${m[1]} 동전부터는 ${want}인데 정답 순서 ${got}`;
  }
  // 동전과 값 잇기
  if (p === '동전과 알맞은 값을 이어 보세요.' && a.t === 'match') {
    for (const pr of a.pairs) {
      const cs = coinsOf(pr.a.visual);
      if (!cs || cs.length !== 1) return '동전 한 개씩이 아님';
      if (wonNum(pr.b.text) !== cs[0]) return `동전 ${cs[0]}원과 이은 값 ${pr.b.text}가 다름`;
    }
    const texts = a.pairs.map((pr) => pr.b.text);
    return new Set(texts).size === texts.length ? null : '같은 값이 두 번 나옴';
  }
  // 동전 두 개 중 값이 큰 것
  m = /^값이 더 (큰|작은) 동전은 어느 쪽일까요/.exec(p);
  if (m && a.t === 'tapTargets') {
    const [l, r] = a.items.map((it) => coinsOf(it.visual));
    if (!l || !r || l.length !== 1 || r.length !== 1) return '동전 한 개씩이 아님';
    return sideProblem(a, l[0] as number, r[0] as number, m[1] === '큰', `${m[1]} 동전`);
  }
  // 동전 무더기 두 곳 중 돈이 많은 쪽
  m = /^돈이 더 (많은|적은) 쪽을 눌러 보세요/.exec(p);
  if (m && a.t === 'tapTargets') {
    const [l, r] = a.items.map((it) => coinsOf(it.visual));
    if (!l || !r) return '동전 그림이 아님';
    return sideProblem(a, sumOf(l), sumOf(r), m[1] === '많은', `돈이 ${m[1]} 쪽`);
  }
  // 왼쪽과 같은 돈 찾기
  if (p === '왼쪽 돈과 같은 돈을 찾아 보세요.' && a.t === 'choice') {
    const cs = coinsOf(v);
    if (!cs) return '왼쪽 동전 그림이 없음';
    const want = sumOf(cs);
    const sums = optsOf(q).map((o) => coinsOf(o.visual));
    if (sums.some((x) => !x)) return '보기에 동전 그림이 없음';
    if (sumOf(coinsOf(correctOpt(q).visual) as number[]) !== want) return `왼쪽은 ${want}원인데 정답 보기는 ${sumOf(coinsOf(correctOpt(q).visual) as number[])}원`;
    for (const o of wrongOpts(q)) if (sumOf(coinsOf(o.visual) as number[]) === want) return '오답 보기도 같은 금액';
    if (coinsOf(correctOpt(q).visual)?.join() === cs.join()) return '정답 보기가 왼쪽과 똑같은 동전 구성(다른 동전으로 모아야 함)';
    return null;
  }

  // 동전 바꾸기
  m = /^(\d+)원짜리 동전 하나를 (\d+)원짜리 동전으로 바꾸면 모두 몇 개가 될까요/.exec(p);
  if (m) {
    const N = Number(m[1]);
    const M = Number(m[2]);
    if (!COIN_VALUES.includes(N) || !COIN_VALUES.includes(M) || N <= M || N % M !== 0) return `바꿀 수 없는 조합 ${N}→${M}`;
    if (coinsOf(v)?.join() !== String(N)) return '그림의 동전이 글과 다름';
    const h = coinsOf(q.hint?.visual);
    if (h && (sumOf(h) !== N || h.some((c) => c !== M))) return '도움말 그림이 바꾼 동전과 다름';
    return answerIs(q, N / M, '개');
  }
  m = /^(\d+)원은 (\d+)원짜리 동전 몇 개와 같을까요/.exec(p);
  if (m) {
    const N = Number(m[1]);
    const M = Number(m[2]);
    if (!COIN_VALUES.includes(M) || N <= M || N % M !== 0) return `바꿀 수 없는 조합 ${N}→${M}`;
    const cv = coinsOf(v);
    if (v && cv?.join() !== String(N)) return '그림의 동전이 글과 다름';
    const h = coinsOf(q.hint?.visual);
    if (h && (sumOf(h) !== N || h.some((c) => c !== M))) return '도움말 그림이 바꾼 동전과 다름';
    return answerIs(q, N / M, '개');
  }
  m = /^(\d+)원짜리 동전 (\d+)개는 얼마와 같을까요/.exec(p);
  if (m) {
    const M = Number(m[1]);
    const K = Number(m[2]);
    const cv = coinsOf(v);
    if (!cv || cv.length !== K || cv.some((c) => c !== M)) return '그림의 동전이 글과 다름';
    return answerIs(q, M * K, '원');
  }

  // 동전 세기
  if (/^동전은 모두 얼마일까요\?/.test(p)) {
    const cs = coinsOf(v);
    if (!cs) return '동전 그림이 없음';
    const h = coinsOf(q.hint?.visual);
    if (h && sumOf(h) !== sumOf(cs) && h.length > 0 && q.hint?.visual?.k === 'coins') return '도움말 동전의 합이 다름';
    return answerIs(q, sumOf(cs), '원');
  }
  m = /^(\d+)원이 되도록 동전을 지갑에 담아 보세요/.exec(p);
  if (m && a.t === 'coins') return coinPayProblem(q, Number(m[1]));

  // 물건 사기
  m = /^(\S+) 값은 (\d+)원이에요\. 가진 돈으로 살 수 있을까요/.exec(p);
  if (m) {
    const N = Number(m[2]);
    const parts = flat(v);
    const coins = parts.filter((x): x is Extract<Visual, { k: 'coins' }> => x.k === 'coins');
    const prices = parts.filter((x): x is Extract<Visual, { k: 'price' }> => x.k === 'price');
    if (coins.length !== 1 || prices.length !== 1) return '가진 돈과 값표가 하나씩이 아님';
    if ((prices[0] as { won: number }).won !== N || (prices[0] as { name: string }).name !== m[1]) return '값표가 글과 다름';
    const have = sumOf((coins[0] as { coins: number[] }).coins);
    const want = have >= N ? '살 수 있어요' : '살 수 없어요';
    if (correctOpt(q).text !== want) return `가진 돈 ${have}원, 값 ${N}원이면 '${want}'인데 정답 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (o.text === want) return '오답 보기가 정답과 같음';
    return null;
  }
  m = /^값이 더 (싼|비싼) 물건을 눌러 보세요/.exec(p);
  if (m && a.t === 'tapTargets') {
    const [l, r] = a.items.map((it) => (it.visual?.k === 'price' ? it.visual.won : null));
    if (l == null || r == null) return '값표가 아님';
    return sideProblem(a, l, r, m[1] === '비싼', `${m[1]} 물건`);
  }
  m = /^(\d+)원으로 살 수 있는 물건을 모두 골라 보세요/.exec(p);
  if (m && a.t === 'tapTargets') {
    const N = Number(m[1]);
    const cs = coinsOf(v);
    if (!cs || sumOf(cs) !== N) return '가진 돈 그림이 글과 다름';
    const prices = a.items.map((it) => (it.visual?.k === 'price' ? it.visual.won : null));
    if (prices.some((x) => x === null)) return '값표가 아님';
    const want = a.items.filter((_, i) => (prices[i] as number) <= N).map((it) => it.key);
    if (want.length === 0 || want.length === a.items.length) return `살 수 있는 물건 수가 ${want.length}/${a.items.length}`;
    return [...a.targets].sort().join() === [...want].sort().join() ? null : `${N}원 이하는 ${want}인데 정답 표시 ${a.targets}`;
  }
  m = /^(\d+)원으로 (\d+)원짜리 (\S+)(?:를|을) 샀어요\. 남은 돈은 얼마일까요/.exec(p);
  if (m) {
    const N = Number(m[1]);
    const price = Number(m[2]);
    const parts = flat(v);
    const have = sumOf(parts.flatMap((x) => (x.k === 'coins' ? x.coins : [])));
    const shown = parts.filter((x) => x.k === 'price').map((x) => (x as { won: number }).won);
    if (have !== N) return `가진 돈 그림 ${have}원 ≠ 글 ${N}원`;
    if (shown.length !== 1 || shown[0] !== price) return '값표가 글과 다름';
    if (price >= N) return '값이 가진 돈보다 큼';
    return answerIs(q, N - price, '원');
  }
  m = /^(\S+) (\d+)원과 (\S+) (\d+)원을 모두 사려면 얼마가 필요할까요/.exec(p);
  if (m) {
    const x = Number(m[2]);
    const y = Number(m[4]);
    const shown = flat(v).filter((s) => s.k === 'price').map((s) => (s as { won: number }).won);
    if (shown.join() !== [x, y].join()) return '값표가 글과 다름';
    return answerIs(q, x + y, '원');
  }

  m = /^(\S+) (\d+)원과 (\S+) (\d+)원이에요\. (\d+)원으로 둘 다 살 수 있을까요/.exec(p);
  if (m) {
    const x = Number(m[2]);
    const y = Number(m[4]);
    const N = Number(m[5]);
    const parts = flat(v);
    const have = sumOf(parts.flatMap((s) => (s.k === 'coins' ? s.coins : [])));
    const shown = parts.filter((s) => s.k === 'price').map((s) => (s as { won: number }).won);
    if (have !== N) return `가진 돈 그림 ${have}원 ≠ 글 ${N}원`;
    if (shown.join() !== [x, y].join()) return '값표가 글과 다름';
    if (x >= N || y >= N) return '한 물건만으로도 돈이 모자람';
    const want = x + y <= N ? '살 수 있어요' : '살 수 없어요';
    if (correctOpt(q).text !== want) return `${x}+${y}=${x + y}, 가진 돈 ${N}원이면 '${want}'인데 정답 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (o.text === want) return '오답 보기가 정답과 같음';
    return null;
  }
  m = /^(\d+)원을 (\d+)원짜리 동전으로 바꿔서 지갑에 담아 보세요/.exec(p);
  if (m && a.t === 'coins') {
    const N = Number(m[1]);
    const M = Number(m[2]);
    if (N <= M || N % M !== 0) return `바꿀 수 없는 조합 ${N}→${M}`;
    if (a.denoms.join() !== String(M)) return `쓸 동전 ${a.denoms}이 글의 ${M}원과 다름`;
    const h = coinsOf(q.hint?.visual);
    if (h && (h.length !== N / M || h.some((c) => c !== M))) return '도움말 그림이 바꾼 동전과 다름';
    return coinPayProblem(q, N);
  }

  // 가게 놀이: 값을 낼 동전 담기
  m = /^(\S+) (\d+)원이에요\. 동전을 담아서 값을 내 보세요/.exec(p);
  if (m && a.t === 'coins') {
    const N = Number(m[2]);
    if (v?.k !== 'price' || v.won !== N || v.name !== m[1]) return '값표가 글과 다름';
    return coinPayProblem(q, N);
  }
  return SKIP;
}

/** 동전을 담아 N원을 만드는 문제의 정답 조건 */
function coinPayProblem(q: Question, N: number): string | null {
  const a = q.answer;
  if (a.t !== 'coins') return '동전 담기 문제가 아님';
  if (a.target !== N) return `글은 ${N}원인데 만들 금액 ${a.target}원`;
  if (a.denoms.some((d) => !COIN_VALUES.includes(d))) return `없는 동전 ${a.denoms}`;
  if (N <= 0 || N % Math.min(...a.denoms) !== 0) return `${N}원을 ${a.denoms}로 만들 수 없음`;
  const h = coinsOf(q.hint?.visual);
  if (h) {
    if (sumOf(h) !== N) return `도움말 동전의 합 ${sumOf(h)} ≠ ${N}`;
    if (h.some((c) => !a.denoms.includes(c))) return '도움말에 쓸 수 없는 동전이 있음';
  }
  return null;
}

describe('돈', () => {
  const ids = ['money.coinName', 'money.coinCompare', 'money.exchange', 'money.count', 'money.buy', 'game.shop.a', 'game.shop.b', 'game.shop.c', 'game.shop.d', 'adv.money', 'game.adventure.money'];
  for (const id of ids) it(id, () => run(id, moneyCheck, { minChecked: 60 }));
});

// ---------------------------------------------------------------------------
// C. 10 만들기·세 수 계산·20까지의 덧셈과 뺄셈·구슬 병
// ---------------------------------------------------------------------------

/** "a + b − c"를 앞에서부터 차례로 계산한 값 */
function evalChain(nums: number[], ops: string[]): number {
  let r = nums[0] as number;
  ops.forEach((op, i) => {
    const n = nums[i + 1] as number;
    r = op === '+' ? r + n : r - n;
  });
  return r;
}
function parseChain(s: string): { nums: number[]; ops: string[] } | null {
  const toks = s.trim().split(' ');
  if (toks.length % 2 === 0) return null;
  const nums: number[] = [];
  const ops: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i] as string;
    if (i % 2 === 0) {
      if (!/^\d+$/.test(t)) return null;
      nums.push(Number(t));
    } else {
      if (t !== '+' && t !== '−') return null;
      ops.push(t);
    }
  }
  return { nums, ops };
}
type EqVisual = Extract<Visual, { k: 'eq' }>;
const eqsOf = (v?: Visual): EqVisual[] => flat(v).filter((s): s is EqVisual => s.k === 'eq');
const U = '[가-힣]+';

/** 정답(고르기·직접 쓰기)이 want인지, 보기에 음수가 없는지 */
function numAnswerIs(q: Question, want: number): string | null {
  const a = q.answer;
  if (want < 0) return `답이 음수(${want})`;
  if (a.t === 'number') return a.correct === want ? null : `정답은 ${want}인데 쓰기 정답 ${a.correct}`;
  if (a.t !== 'choice') return '정답 모양을 읽지 못함';
  if (optNum(correctOpt(q)) !== want) return `정답은 ${want}인데 정답 보기 ${correctOpt(q).text}`;
  for (const o of wrongOpts(q)) if (optNum(o) === want) return '오답 보기도 같은 수';
  for (const o of optsOf(q)) if ((optNum(o) ?? 0) < 0) return `음수 보기 ${o.text}`;
  return numericOptionsProblem(q);
}

/** 식 안의 □ 하나를 채워 오른쪽 값이 되게 하는 수(하나뿐이어야 한다) */
function solveBlank(expr: string): { sol: number; shown: string } | string {
  const [lhs, rhs] = expr.split(' = ');
  if (!lhs || rhs === undefined || !/^\d+$/.test(rhs)) return `식을 읽지 못함: ${expr}`;
  const toks = lhs.split(' ');
  if (toks.filter((t) => t === '□').length !== 1) return `□가 하나가 아님: ${expr}`;
  const ops = toks.filter((_, i) => i % 2 === 1);
  if (ops.some((o) => o !== '+' && o !== '−')) return `식을 읽지 못함: ${expr}`;
  const sols = range(0, 40).filter((x) => evalChain(toks.filter((_, i) => i % 2 === 0).map((t) => (t === '□' ? x : Number(t))), ops) === Number(rhs));
  if (sols.length !== 1) return `□에 들어갈 수가 하나가 아님: ${sols}`;
  if ((sols[0] as number) < 1) return `□가 ${sols[0]}`;
  return { sol: sols[0] as number, shown: `${lhs.replace('□', '?')} = ${rhs}` };
}

function calcCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  const eqs = eqsOf(v);
  let m: RegExpExecArray | null;

  // 식 계산: a + b, a − b, a + b − c …
  m = /^(\d+(?: [+−] \d+)+)(?:은|는) 얼마일까요/.exec(p);
  if (m) {
    const ch = parseChain(m[1] as string);
    if (!ch) return SKIP;
    const want = evalChain(ch.nums, ch.ops);
    const shown = flat(v).filter((s) => s.k === 'eq' || s.k === 'groups' || s.k === 'tens');
    if (shown.length === 0) return '식을 보여 주는 그림이 없음';
    if (eqs.length > 0 && !eqs.some((e) => e.parts.join(' ') === `${m?.[1]} = ?`)) return '식 그림이 글과 다름';
    for (const g of flat(v).filter((s): s is Extract<Visual, { k: 'groups' }> => s.k === 'groups')) {
      if (ch.nums.length === 2 && [g.a.n, g.b.n].join() !== ch.nums.join()) return `그림 무리 ${g.a.n},${g.b.n}이 식과 다름`;
    }
    const tens = flat(v).filter((s): s is Extract<Visual, { k: 'tens' }> => s.k === 'tens');
    if (tens.length === 2 && ch.nums.length === 2 && tens.map((t) => t.tens * 10 + t.ones).join() !== ch.nums.join()) return '십 모형이 식과 다름';
    if (/^(calc20\.|game\.fish\.calc20)/.test(q.skill) && ch.nums.length === 2 && (ch.nums[0] as number) >= 10) {
      const [x, y] = ch.nums as [number, number];
      if (ch.ops[0] === '+' && (x % 10) + y > 9) return `받아올림이 있음: ${x} + ${y}`;
      if (ch.ops[0] === '−' && (x % 10) < y) return `받아내림이 있음: ${x} − ${y}`;
      if (want > 20) return `20을 넘음: ${want}`;
    }
    return numAnswerIs(q, want);
  }
  // 앞의 두 수를 먼저 계산
  m = /^(\d+(?: [+−] \d+){2})에서 먼저 계산하는 부분의 답은 얼마일까요/.exec(p);
  if (m) {
    const ch = parseChain(m[1] as string);
    if (!ch) return SKIP;
    const want = evalChain(ch.nums.slice(0, 2), ch.ops.slice(0, 1));
    if (!eqs.some((e) => e.parts.join(' ') === `${m?.[1]} = ?`)) return '식 그림이 글과 다름';
    const h = eqsOf(q.hint?.visual)[0];
    if (h && h.parts.slice(0, 3).join(' ') !== ch.nums.slice(0, 2).join(` ${ch.ops[0]} `)) return '도움말 식이 앞의 두 수가 아님';
    return numAnswerIs(q, want);
  }
  // □에 알맞은 수
  m = /^(.+ = \d+)에서 □에 알맞은 수는 무엇일까요/.exec(p) ?? /^□에 알맞은 수를 눌러 알려 주세요\. (.+ = \d+)$/.exec(p);
  if (m) {
    const r = solveBlank(m[1] as string);
    if (typeof r === 'string') return r;
    if (!eqs.some((e) => e.parts.join(' ') === r.shown)) return `식 그림이 글과 다름(${r.shown})`;
    return numAnswerIs(q, r.sol);
  }
  // n에 얼마를 더하면 t가 될까요
  m = /^(\d+)에 얼마를 더하면 (\d+)(?:이|가) 될까요/.exec(p);
  if (m) {
    const x = Number(m[1]);
    const t = Number(m[2]);
    if (t <= x) return `${x}에서 ${t}이 될 수 없음`;
    if (v?.k === 'objects' && v.n !== x) return '그림의 개수가 글과 다름';
    if (v?.k === 'eq' && v.parts.join(' ') !== `${x} + ? = ${t}`) return '식 그림이 글과 다름';
    return numAnswerIs(q, t - x);
  }
  // 틀을 채우려면 몇 개 더
  m = new RegExp(`^\\S+ (\\d+)${U}가 있어요\\. (\\d+)칸을 모두 채우려면 몇 ${U}가 더 필요할까요`).exec(p);
  if (m) {
    const n = Number(m[1]);
    const cap = Number(m[2]);
    if (v?.k !== 'objects' || v.n !== n || v.layout !== (cap === 10 ? 'frame10' : 'frame20')) return '틀 그림이 글과 다름';
    if (n >= cap) return '이미 가득 참';
    return numAnswerIs(q, cap - n);
  }
  m = new RegExp(`^\\S+ (\\d+)${U}(?:와|과) 몇 ${U}를 더하면 (\\d+)${U}(?:이|가) 될까요`).exec(p);
  if (m) {
    const x = Number(m[1]);
    const t = Number(m[2]);
    if (v?.k !== 'groups' || v.a.n !== x || !v.b.unknown || (v.b.n !== 0 && v.b.n !== t - x)) return '무리 그림이 글과 다름';
    return numAnswerIs(q, t - x);
  }
  // 낱개끼리 먼저
  m = /^(\d+) ([+−]) (\d+)에서 낱[가-힣]+끼리 먼저 (더하면|빼면) 얼마일까요/.exec(p);
  if (m) {
    const x = Number(m[1]);
    const y = Number(m[3]);
    if ((m[2] === '+') !== (m[4] === '더하면')) return '글의 계산 말과 식의 부호가 다름';
    const ox = x % 10;
    const oy = y % 10;
    if (!eqs.some((e) => e.parts.join(' ') === `${ox} ${m?.[2]} ${oy} = ?`)) return '낱개 식 그림이 글과 다름';
    if (m[2] === '−' && ox < oy) return '낱개끼리 뺄 수 없음';
    return numAnswerIs(q, m[2] === '+' ? ox + oy : ox - oy);
  }
  // 받아올림 맛보기: 8 + 6에서 6을 2와 □로 갈랐어요
  m = /^(\d+) \+ (\d+)에서 (\d+)(?:을|를) (\d+)(?:과|와) □로 갈랐어요/.exec(p);
  if (m) {
    const [x, y, y2, k] = [m[1], m[2], m[3], m[4]].map(Number) as [number, number, number, number];
    if (y !== y2) return `갈린 수 ${y2}가 더하는 수 ${y}와 다름`;
    if (x + k !== 10) return `${x}에 ${k}를 더해도 10이 되지 않음`;
    if (!eqs.some((e) => e.parts.join(' ') === `${x} + ${k} + ?`)) return '식 그림이 글과 다름';
    return numAnswerIs(q, y - k);
  }
  // 답이 n인 식 누르기
  m = /^답이 (\d+)인 식을 눌러 보세요/.exec(p);
  if (m && a.t === 'tapTargets') {
    const N = Number(m[1]);
    const vals = a.items.map((it) => {
      const ch = parseChain(it.text ?? '');
      return ch ? evalChain(ch.nums, ch.ops) : null;
    });
    if (vals.some((x) => x === null)) return '식을 읽지 못함';
    const hit = a.items.filter((_, i) => vals[i] === N).map((it) => it.key);
    if (hit.length !== 1) return `답이 ${N}인 식이 ${hit.length}개`;
    return a.targets.length === 1 && a.targets[0] === hit[0] ? null : `${N}이 답인 식은 ${hit[0]}인데 정답 표시 ${a.targets}`;
  }
  // 더해서 t가 되는 두 수
  m = /^더해서 (\d+)(?:이|가) 되는 두 수를 이어 보세요/.exec(p);
  if (m && a.t === 'match') {
    const N = Number(m[1]);
    for (const pr of a.pairs) if (num(pr.a.text) === null || num(pr.b.text) === null || (num(pr.a.text) as number) + (num(pr.b.text) as number) !== N) return `짝 ${pr.a.text}~${pr.b.text}의 합이 ${N}이 아님`;
    const as = a.pairs.map((pr) => pr.a.text);
    const bs = a.pairs.map((pr) => pr.b.text);
    if (new Set(as).size !== as.length || new Set(bs).size !== bs.length) return '같은 수가 한쪽에 둘 이상(이을 때 헷갈림)';
    return null;
  }
  m = /^더해서 (\d+)(?:이|가) 되는 두 수를 눌러 보세요/.exec(p);
  if (m && a.t === 'tapTargets') {
    const N = Number(m[1]);
    const vals = a.items.map((it) => num(it.text));
    if (vals.some((x) => x === null)) return '수를 읽지 못함';
    const xs = vals as number[];
    const pairs: string[] = [];
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if ((xs[i] as number) + (xs[j] as number) === N) pairs.push([(a.items[i] as { key: string }).key, (a.items[j] as { key: string }).key].sort().join());
    if (pairs.length !== 1) return `합이 ${N}인 두 수가 ${pairs.length}쌍`;
    return [...a.targets].sort().join() === pairs[0] ? null : `합이 ${N}인 두 수는 ${pairs[0]}인데 정답 표시 ${a.targets}`;
  }
  // 풍선 터뜨리기: x와 더해서 t
  m = /^(\d+)(?:과|와) 더해서 (\d+)(?:이|가) 되는 풍선을 터뜨려 보세요/.exec(p);
  if (m && a.t === 'tapTargets') {
    const x = Number(m[1]);
    const t = Number(m[2]);
    if (v?.k !== 'big' || Number(v.text) !== x) return '큰 숫자 그림이 글과 다름';
    const hit = a.items.filter((it) => num(it.text) === t - x).map((it) => it.key);
    if (hit.length !== 1) return `${t - x} 풍선이 ${hit.length}개`;
    return a.targets.length === 1 && a.targets[0] === hit[0] ? null : `${x}와 합이 ${t}인 풍선은 ${hit[0]}인데 정답 표시 ${a.targets}`;
  }

  // 이야기로 푸는 세 수 계산
  m = new RegExp(`^\\S+ (\\d+)${U}, (\\d+)${U}, (\\d+)${U}를 한곳에 모았어요\\. 모두 몇 ${U}일까요`).exec(p);
  if (m) {
    const [x, y, z] = [m[1], m[2], m[3]].map(Number) as [number, number, number];
    if (!eqs.some((e) => e.parts.join(' ') === `${x} + ${y} + ${z} = ?`)) return '식 그림이 글과 다름';
    return numAnswerIs(q, x + y + z);
  }
  m = new RegExp(`^\\S+ (\\d+)${U} 중에서 (\\d+)${U}를 먹고, 또 (\\d+)${U}를 먹었어요\\. 몇 ${U}가 남았을까요`).exec(p);
  if (m) {
    const [x, y, z] = [m[1], m[2], m[3]].map(Number) as [number, number, number];
    if (!eqs.some((e) => e.parts.join(' ') === `${x} − ${y} − ${z} = ?`)) return '식 그림이 글과 다름';
    return numAnswerIs(q, x - y - z);
  }
  m = new RegExp(`^\\S+ (\\d+)${U}가 있었는데 (\\d+)${U}를 더 받고, (\\d+)${U}를 나눠 주었어요\\. 몇 ${U}가 남았을까요`).exec(p);
  if (m) {
    const [x, y, z] = [m[1], m[2], m[3]].map(Number) as [number, number, number];
    if (!eqs.some((e) => e.parts.join(' ') === `${x} + ${y} − ${z} = ?`)) return '식 그림이 글과 다름';
    return numAnswerIs(q, x + y - z);
  }
  m = new RegExp(`^\\S+ (\\d+)${U}가 있었는데 (\\d+)${U}를 먹고, (\\d+)${U}를 더 받았어요\\. 몇 ${U}가 되었을까요`).exec(p);
  if (m) {
    const [x, y, z] = [m[1], m[2], m[3]].map(Number) as [number, number, number];
    if (!eqs.some((e) => e.parts.join(' ') === `${x} − ${y} + ${z} = ?`)) return '식 그림이 글과 다름';
    return numAnswerIs(q, x - y + z);
  }

  // 구슬 병
  m = new RegExp(`^구슬 (\\d+)${U}를 왼쪽 병에 (\\d+)${U} 담아 보세요`).exec(p);
  if (m && a.t === 'split') {
    const total = Number(m[1]);
    const left = Number(m[2]);
    if (a.total !== total || a.left !== left) return `글은 ${total}개 중 ${left}개인데 정답 ${a.total}, ${a.left}`;
    return left >= 1 && left < total ? null : '왼쪽 개수가 범위 밖';
  }
  m = new RegExp(`^왼쪽 병에 구슬 (\\d+)${U}, 오른쪽 병에 구슬 (\\d+)${U}가 있어요\\. 모두 몇 ${U}일까요`).exec(p);
  if (m) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (v?.k !== 'groups' || v.a.n !== x || v.b.n !== y) return '병 그림이 글과 다름';
    return numAnswerIs(q, x + y);
  }
  m = new RegExp(`^구슬 (\\d+)${U}를 두 병에 나눠 담았어요\\. 왼쪽 병에 (\\d+)${U} 있다면 오른쪽 병에는 몇 ${U} 있을까요`).exec(p);
  if (m) {
    const total = Number(m[1]);
    const left = Number(m[2]);
    if (left >= total) return '왼쪽이 전체보다 많거나 같음';
    if (v?.k === 'groups' && (v.a.n !== left || v.b.n !== total - left)) return '병 그림이 글과 다름';
    if (v?.k === 'bond' && (v.total !== total || v.a !== left || v.b !== null)) return '가르기 그림이 글과 다름';
    return numAnswerIs(q, total - left);
  }
  // 가르기·모으기 ---------------------------------------------------------
  m = /^(\d+)(과|와) (\d+)(을|를) 모으면 몇이 될까요\?$/.exec(p);
  if (m) {
    const x = Number(m[1]);
    const y = Number(m[3]);
    if (m[2] !== nump(x, '과/와') || m[4] !== nump(y, '을/를')) return `조사 ${m[2]}/${m[4]}가 틀림`;
    if (v?.k !== 'bond' || v.a !== x || v.b !== y || v.total !== null) return '모으기 그림이 글과 다름';
    const t = x + y;
    const base = `${x}${nump(x, '과/와')} ${y}${nump(y, '을/를')} 모으면 ${t}${nump(t, '이/가')} 돼요.`;
    // 구슬 병 놀이는 같은 문제에 '구슬은 모두 …예요.'를 덧붙인다
    const okExplain = q.explain === base || q.explain === `${base} 구슬은 모두 ${COUNT_WORD[t]} 개예요.`;
    return numAnswerIs(q, t) ?? (okExplain ? null : `풀이 글: ${q.explain}`);
  }
  m = new RegExp(`^(\\S+) (\\d+)(${U})(와|과) (\\d+)\\3(를|을) 모으면 모두 몇 \\3일까요\\?$`).exec(p);
  if (m) {
    const [x, y] = [Number(m[2]), Number(m[5])];
    const unit = m[3] as string;
    if (m[4] !== particleFor(unit, '과/와') || m[6] !== particleFor(unit, '을/를')) return `조사 ${m[4]}/${m[6]}가 틀림`;
    if (v?.k !== 'groups' || v.a.n !== x || v.b.n !== y || v.b.unknown || v.a.emoji !== v.b.emoji || v.op !== '+') return '무리 그림이 글과 다름';
    const t = x + y;
    return numAnswerIs(q, t) ?? (q.explain === `${COUNT_WORD[t]} ${unit}${particleFor(unit, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  m = new RegExp(`^(\\S+) (\\d+)(${U})(를|을) (\\d+)\\3(와|과) 몇 \\3(로|으로) 가를 수 있을까요\\?$`).exec(p);
  if (m) {
    const [t, x] = [Number(m[2]), Number(m[5])];
    const unit = m[3] as string;
    if (m[4] !== particleFor(unit, '을/를') || m[6] !== particleFor(unit, '과/와') || m[7] !== particleFor(unit, '으로/로')) return `조사 ${m[4]}/${m[6]}/${m[7]}가 틀림`;
    if (x < 1 || x >= t) return `${t}을 ${x}와 가를 수 없음`;
    const [all, part] = v?.k === 'col' ? v.items : [];
    if (all?.k !== 'objects' || all.n !== t || part?.k !== 'groups' || part.a.n !== x || !part.b.unknown || part.b.n !== t - x) return '그림이 글과 다름';
    const w = (n: number): string => `${COUNT_WORD[n]} ${unit}`;
    const ex = `${w(t - x)}${particleFor(unit, '이에요/예요')}. ${w(x)}${particleFor(unit, '과/와')} ${w(t - x)}${particleFor(unit, '을/를')} 합치면 ${w(t)}${particleFor(unit, '이/가')} 돼요.`;
    return numAnswerIs(q, t - x) ?? (q.explain === ex ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)(은|는) (\d+)(과|와) 몇으로 가를 수 있을까요\?$/.exec(p);
  if (m) {
    const [t, x] = [Number(m[1]), Number(m[3])];
    if (m[2] !== nump(t, '은/는') || m[4] !== nump(x, '과/와')) return `조사 ${m[2]}/${m[4]}가 틀림`;
    if (x < 1 || x >= t) return `${t}을 ${x}와 가를 수 없음`;
    if (v?.k !== 'bond' || v.total !== t || v.a !== x || v.b !== null) return '가르기 그림이 글과 다름';
    const b = t - x;
    return numAnswerIs(q, b) ?? (q.explain === `${t}${nump(t, '은/는')} ${x}${nump(x, '과/와')} ${b}${nump(b, '으로/로')} 가를 수 있어요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^모으면 (\d+)(이|가) 되는 짝은 무엇일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const t = Number(m[1]);
    if (m[2] !== nump(t, '이/가')) return `조사 ${m[2]}가 틀림`;
    if (v?.k !== 'big' || Number(v.text) !== t) return '큰 숫자 그림이 글과 다름';
    const pairs = optsOf(q).map((o) => {
      const mm = /^(\d+)(과|와) (\d+)$/.exec(o.text ?? '');
      return mm ? { x: Number(mm[1]), y: Number(mm[3]), p: mm[2] as string, key: o.key } : null;
    });
    if (pairs.some((x) => x === null)) return '보기를 읽지 못함';
    const ps = pairs as { x: number; y: number; p: string; key: string }[];
    for (const x of ps) if (x.p !== nump(x.x, '과/와') || x.key !== `${x.x}-${x.y}` || x.x < 1 || x.y < 1) return `보기 ${x.x}${x.p} ${x.y}가 이상함`;
    if (new Set(ps.map((x) => `${x.x}-${x.y}`)).size !== ps.length) return '보기가 겹침';
    const sums = ps.filter((x) => x.x + x.y === t);
    if (sums.length !== 1) return `합이 ${t}인 보기가 ${sums.length}개`;
    const c = ps[correctOpt(q) && (q.answer as { correct: number }).correct] as { x: number; y: number };
    if (c.x + c.y !== t) return `정답 보기 ${c.x}, ${c.y}의 합이 ${t}이 아님`;
    return q.explain === `${c.x}${nump(c.x, '과/와')} ${c.y}${nump(c.y, '을/를')} 모으면 ${t}${nump(t, '이/가')} 돼요.` ? null : `풀이 글: ${q.explain}`;
  }
  return SKIP;
}

/** 받침 규칙을 시험과 따로 적은 것: 글자 끝에 받침이 있는지 */
function particleFor(word: string, kind: '은/는' | '과/와' | '을/를' | '이/가' | '으로/로' | '이에요/예요'): string {
  const c = (word.slice(-1).charCodeAt(0) ?? 0) - 0xac00;
  const fin = c >= 0 && c < 11172 ? c % 28 : 0;
  const has = fin !== 0;
  switch (kind) {
    case '은/는':
      return has ? '은' : '는';
    case '과/와':
      return has ? '과' : '와';
    case '을/를':
      return has ? '을' : '를';
    case '이/가':
      return has ? '이' : '가';
    case '이에요/예요':
      return has ? '이에요' : '예요';
    case '으로/로':
      return has && fin !== 8 ? '으로' : '로';
  }
}
/** 수를 한자어로 읽었을 때의 조사 */
const nump = (n: number, kind: Parameters<typeof particleFor>[1]): string => particleFor(krSino(n), kind);

describe('10 만들기·세 수 계산·20까지·구슬 병', () => {
  const ids = ['ten.pic', 'ten.eq', 'ten.pairs', 'calc3.add', 'calc3.sub', 'calc3.mix', 'calc20.add', 'calc20.sub', 'carry.taste', 'game.balloons.ten', 'game.balloons.calc3', 'game.fish.calc20', 'game.jars.ten', 'game.jars.split5', 'game.jars.mix5', 'game.jars.split10', 'game.jars.mix10', 'game.jars.merge5'];
  for (const id of ids) it(id, () => run(id, calcCheck, { minChecked: 100 }));
});

// ---------------------------------------------------------------------------
// D. 이야기 문제: 식 세우기, 결과 구하기, 처음 수·덜어 낸 수 찾기
// ---------------------------------------------------------------------------

interface StoryFacts {
  a: number;
  b: number;
  res: number;
  op: '+' | '−';
  unit: string;
  /** 그림이 있다면 맞아야 하는 모양 */
  picture: 'groups+' | 'groups vs' | 'crossed' | 'none';
}

/** 이야기 글에서 수와 계산을 읽어 낸다(글에 쓰인 말만 본다) */
function readStory(p: string): StoryFacts | string | null {
  let m = new RegExp(`^(\\S+) (\\d+)(${U})(?:이|가) 있었어요\\. (\\d+)\\3(?:을|를|이|가) (더 [^.]+)\\. 모두 몇 \\3일까요\\?$`).exec(p);
  if (m) return { a: Number(m[2]), b: Number(m[4]), res: Number(m[2]) + Number(m[4]), op: '+', unit: m[3] as string, picture: 'groups+' };
  m = new RegExp(`^(\\S+) (\\d+)(${U})(?:과|와) (\\S+) (\\d+)\\3(?:이|가) 있어요\\. 모두 몇 \\3일까요\\?$`).exec(p);
  if (m) return { a: Number(m[2]), b: Number(m[5]), res: Number(m[2]) + Number(m[5]), op: '+', unit: m[3] as string, picture: 'groups+' };
  m = new RegExp(`^(\\S+) (\\d+)(${U})(?:이|가) 있었어요\\. (\\d+)\\3(?:을|를|이|가) ([^.]+)\\. 남은 (\\S+?)(?:은|는) 몇 \\3일까요\\?$`).exec(p);
  if (m) {
    if (m[1] !== m[6]) return `이야기의 ${m[1]}과 묻는 ${m[6]}이 다름`;
    if (/^더 /.test(m[5] as string)) return '덜어 내는 이야기인데 늘어나는 동작';
    return { a: Number(m[2]), b: Number(m[4]), res: Number(m[2]) - Number(m[4]), op: '−', unit: m[3] as string, picture: 'crossed' };
  }
  m = new RegExp(`^(\\S+) (\\d+)(${U})(?:과|와) (\\S+) (\\d+)\\3(?:이|가) 있어요\\. (\\S+?)(?:은|는) (\\S+?)보다 몇 \\3 더 많을까요\\?$`).exec(p);
  if (m) {
    if (m[6] !== m[1] || m[7] !== m[4]) return `묻는 순서 ${m[6]}/${m[7]}이 이야기의 ${m[1]}/${m[4]}와 다름`;
    return { a: Number(m[2]), b: Number(m[5]), res: Number(m[2]) - Number(m[5]), op: '−', unit: m[3] as string, picture: 'groups vs' };
  }
  return null;
}

function parseEquation(t: string | undefined): { x: number; op: string; y: number; z: number } | null {
  const m = /^(\d+) ([+−]) (\d+) = (\d+)$/.exec(t ?? '');
  return m ? { x: Number(m[1]), op: m[2] as string, y: Number(m[3]), z: Number(m[4]) } : null;
}

function storyCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  let p = q.prompt;
  const asEq = p.endsWith(' 이야기에 맞는 식을 골라 보세요.');
  if (asEq) p = p.slice(0, -' 이야기에 맞는 식을 골라 보세요.'.length);
  let m: RegExpExecArray | null;

  // 처음 수를 찾는 이야기
  m = new RegExp(`^(\\S+) 몇 (${U})(?:이|가) 있었어요\\. (\\d+)\\2(?:을|를|이|가) (더 [^.]+)\\. 이제 모두 (\\d+)\\2예요\\. 처음에는 몇 \\2(?:이|가) 있었을까요\\?$`).exec(p);
  if (m) {
    const b = Number(m[3]);
    const total = Number(m[5]);
    if (a.t !== 'number') return '직접 쓰기가 아님';
    if (total - b < 1) return '처음 수가 1보다 작음';
    return a.correct === total - b ? null : `${total} − ${b} = ${total - b}인데 정답 ${a.correct}`;
  }
  // 덜어 낸 수를 찾는 이야기
  m = new RegExp(`^(\\S+) (\\d+)(${U})(?:이|가) 있었어요\\. 그중 몇 \\3(?:을|를) 먹었더니 (\\d+)\\3(?:이|가) 남았어요\\. 먹은 (\\S+?)(?:은|는) 몇 \\3일까요\\?$`).exec(p);
  if (m) {
    const total = Number(m[2]);
    const left = Number(m[4]);
    if (m[1] !== m[5]) return `이야기의 ${m[1]}과 묻는 ${m[5]}이 다름`;
    if (a.t !== 'number') return '직접 쓰기가 아님';
    if (left >= total) return '남은 수가 처음보다 많거나 같음';
    return a.correct === total - left ? null : `${total} − ${left} = ${total - left}인데 정답 ${a.correct}`;
  }

  const f = readStory(p);
  if (f === null) return SKIP;
  if (typeof f === 'string') return f;
  if (f.res < 1) return `결과가 ${f.res}`;
  if (f.op === '−' && f.b >= f.a) return '뺄 수가 처음 수보다 크거나 같음';
  // 그림이 있다면 글과 같아야 한다
  if (v) {
    if (f.picture === 'groups+' || f.picture === 'groups vs') {
      if (v.k !== 'groups' || v.a.n !== f.a || v.b.n !== f.b || v.op !== (f.picture === 'groups+' ? '+' : 'vs')) return '무리 그림이 글과 다름';
    } else if (f.picture === 'crossed') {
      if (v.k !== 'objects' || v.n !== f.a || v.crossed !== f.b) return '지운 그림이 글과 다름';
    }
  }
  if (asEq) {
    if (a.t !== 'choice') return '식 고르기가 아님';
    const right = parseEquation(correctOpt(q).text);
    if (!right || right.x !== f.a || right.y !== f.b || right.z !== f.res || right.op !== f.op) return `이야기의 식은 ${f.a} ${f.op} ${f.b} = ${f.res}인데 정답 보기 ${correctOpt(q).text}`;
    const fam = [f.a, f.b, f.res].sort().join();
    for (const o of wrongOpts(q)) {
      const e = parseEquation(o.text);
      if (!e) return `보기 '${o.text}'를 읽지 못함`;
      const ok = e.op === '+' ? e.x + e.y === e.z : e.x - e.y === e.z;
      if (!ok) return `보기의 식이 계산부터 틀림: ${o.text}`;
      if ([e.x, e.y, e.z].sort().join() === fam) return `오답 보기 ${o.text}도 이야기에 맞음`;
    }
    return null;
  }
  // 결과 구하기
  if (a.t === 'number') return a.correct === f.res ? null : `${f.a} ${f.op} ${f.b} = ${f.res}인데 정답 ${a.correct}`;
  if (a.t !== 'choice') return '정답 모양을 읽지 못함';
  const asUnit = (t: string | undefined): number | null => (t?.endsWith(f.unit) ? num(t.slice(0, -f.unit.length)) : null);
  if (asUnit(correctOpt(q).text) !== f.res) return `답은 ${f.res}${f.unit}인데 정답 보기 ${correctOpt(q).text}`;
  const texts = optsOf(q).map((o) => o.text);
  if (new Set(texts).size !== texts.length) return `보기가 겹침: ${texts}`;
  for (const o of wrongOpts(q)) {
    const w = asUnit(o.text);
    if (w === null || w < 1) return `보기 '${o.text}'가 이상함`;
  }
  return null;
}

describe('이야기 문제', () => {
  for (const id of ['story.add', 'story.sub', 'story.mix', 'game.story.a', 'game.story.b']) it(id, () => run(id, storyCheck, { minChecked: 200 }));
});

// ---------------------------------------------------------------------------
// E. 규칙 찾기: 색·그림·모양·수의 되풀이와 커지고 작아지는 규칙
// ---------------------------------------------------------------------------

// 문제를 만드는 코드와 따로 적은 이름표(풀이 글과 읽어 주는 말을 맞춰 보는 용도)
const KO_NAME: Record<string, string> = {
  tomato: '빨간색', sky: '파란색', sun: '노란색', leaf: '초록색', grape: '보라색', tangerine: '주황색', rose: '분홍색',
  circle: '동그라미', triangle: '세모', square: '네모', star: '별', heart: '하트',
  '🍎': '사과', '🍓': '딸기', '🍪': '쿠키', '🌸': '꽃', '⭐': '별', '🐥': '병아리', '🦋': '나비', '🐟': '물고기', '🎈': '풍선', '🍬': '사탕',
};
const SHAPE_TONE: Record<string, string> = { circle: 'sky', triangle: 'tangerine', square: 'leaf', star: 'sun', heart: 'rose' };

/** 되풀이되는 가장 짧은 덩어리의 길이(규칙이 없으면 0) */
function minPeriod(seq: string[]): number {
  for (let k = 1; k <= Math.floor(seq.length / 2); k++) if (seq.every((t, i) => i < k || t === seq[i - k])) return k;
  return 0;
}
const tokenName = (kind: string, t: string): string | undefined => (kind === 'shape' ? KO_NAME[t.split(':')[0] as string] : KO_NAME[t]);
const withJosa = (w: string): string => `${w}${josa(w, '이/가')}`;

/** 규칙에서 벗어난 칸 하나를 찾는 문제 */
function oddOneProblem(q: Question, a: Extract<AnswerSpec, { t: 'tapTargets' }>): string | null {
  const toks = a.items.map((it) => (it.visual ? JSON.stringify(it.visual) : (it.text ?? '')));
  const found = new Map<number, number>();
  let bestP = 0;
  let bestMajor: string[] = [];
  for (let k = 2; k <= 4; k++) {
    if (toks.length < 2 * k) continue;
    const major: string[] = [];
    let tie = false;
    for (let r = 0; r < k; r++) {
      const cnt = new Map<string, number>();
      for (let i = r; i < toks.length; i += k) cnt.set(toks[i] as string, (cnt.get(toks[i] as string) ?? 0) + 1);
      const best = [...cnt.entries()].sort((x, y) => y[1] - x[1]);
      if (best.length > 1 && (best[0] as [string, number])[1] === (best[1] as [string, number])[1]) tie = true;
      major.push((best[0] as [string, number])[0]);
    }
    if (tie) continue;
    const odd = toks.map((t, i) => (t === major[i % k] ? -1 : i)).filter((i) => i >= 0);
    if (odd.length === 1) {
      found.set(odd[0] as number, k);
      if (!bestP) {
        bestP = k;
        bestMajor = major;
      }
    }
  }
  if (found.size !== 1) return `규칙에서 벗어난 칸이 하나로 정해지지 않음: ${[...found.keys()]}`;
  const odd = [...found.keys()][0] as number;
  if (a.targets.length !== 1 || a.targets[0] !== (a.items[odd] as { key: string }).key) return `벗어난 칸은 ${(a.items[odd] as { key: string }).key}인데 정답 표시 ${a.targets}`;
  const nameOf = (tok: string): string => a.items[toks.indexOf(tok)]?.say ?? '?';
  const mm = /^(.+) 순서가 되풀이돼야 해요\. 이 칸에는 (\S+) 와야 해요\.$/.exec(q.explain ?? '');
  if (!mm) return `풀이 글을 읽지 못함: ${q.explain}`;
  const units = bestMajor.map(nameOf);
  if (mm[1] !== units.join(', ')) return `풀이 글의 덩어리 '${mm[1]}' ≠ ${units.join(', ')}`;
  const fix = nameOf(bestMajor[odd % bestP] as string);
  if (mm[2] !== withJosa(fix)) return `풀이 글의 답 '${mm[2]}' ≠ ${fix}`;
  return null;
}

function patternCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  let m: RegExpExecArray | null;

  if (v?.k !== 'pattern') {
    if (p === '규칙에 맞지 않는 것 하나를 찾아 눌러 보세요.' && a.t === 'tapTargets') return oddOneProblem(q, a);
    return SKIP;
  }
  const seq = v.seq;
  const kind = v.kind;
  if (kind === 'shape') for (const t of seq) if (SHAPE_TONE[t.split(':')[0] as string] !== t.split(':')[1]) return `모양과 색이 정해진 짝이 아님: ${t}`;
  if (kind !== 'text' && kind !== 'shape') for (const t of seq) if (!KO_NAME[t]) return `이름표에 없는 칸: ${t}`;
  if (a.t !== 'choice') return SKIP;

  // 빈칸 채우기
  m = /^규칙에 맞게 빈칸에 알맞은 (색|그림|모양|수)(?:을|를) 골라 보세요\.$/.exec(p);
  if (m) {
    if (m[1] !== { color: '색', emoji: '그림', shape: '모양', text: '수' }[kind]) return '묻는 말과 칸의 종류가 다름';
    if (!v.blanks || v.blanks.length !== 1) return '빈칸이 하나가 아님';
    const b = v.blanks[0] as number;
    const truth = seq[b] as string;
    const keys = optsOf(q).map((o) => o.key);
    if (new Set(keys).size !== keys.length || keys.length !== 3) return `보기가 세 개의 서로 다른 것이 아님: ${keys}`;
    if (correctOpt(q).key !== truth) return `빈칸에는 ${truth}인데 정답 보기 ${correctOpt(q).key}`;
    for (const o of optsOf(q)) {
      const vis = o.visual;
      if (kind === 'color' && !(vis?.k === 'shape' && vis.shape === 'circle' && vis.color === o.key)) return `보기 그림이 ${o.key}가 아님`;
      if (kind === 'shape' && !(vis?.k === 'shape' && `${vis.shape}:${vis.color}` === o.key)) return `보기 그림이 ${o.key}가 아님`;
      if ((kind === 'emoji' || kind === 'text') && o.text !== o.key) return `보기 글자 ${o.text}가 ${o.key}가 아님`;
      if (kind !== 'text' && o.say !== tokenName(kind, o.key)) return `읽어 줄 말 ${o.say} ≠ ${tokenName(kind, o.key)}`;
    }
    const per = minPeriod(seq);
    if (kind !== 'text' || per) {
      if (!per) return '되풀이되는 규칙이 없음';
      if (seq.length < 2 * per) return '두 번 되풀이되지 않음';
      if (!seq.some((t, i) => i !== b && i % per === b % per)) return '빈칸과 같은 자리의 다른 칸이 없어 규칙을 알 수 없음';
      if (kind === 'text') return q.explain === `같은 순서가 되풀이돼요. 그래서 빈칸에는 ${withJosa(truth)} 들어가요.` ? null : `풀이 글: ${q.explain}`;
      const names = seq.slice(0, per).map((t) => tokenName(kind, t));
      if (names.some((n) => !n)) return '이름표에 없는 칸';
      const ans = tokenName(kind, truth) as string;
      return q.explain === `${names.join(', ')} 순서가 되풀이돼요. 그래서 빈칸에는 ${withJosa(ans)} 들어가요.` ? null : `풀이 글이 규칙과 다름: ${q.explain} (덩어리 ${names.join(', ')}, 답 ${ans})`;
    }
    // 같은 수만큼 커지거나 작아지는 줄
    const nums = seq.map(Number);
    const d = (nums[1] as number) - (nums[0] as number);
    if (d === 0 || nums.some((x, i) => i > 0 && x - (nums[i - 1] as number) !== d)) return `같은 간격이 아님: ${seq}`;
    if (nums.some((x) => x < 1)) return '0 이하의 수가 있음';
    if (seq.length < 4) return '규칙을 알기에 수가 모자람';
    for (const o of optsOf(q)) if ((optNum(o) ?? 0) < 0) return `보기 ${o.text}가 이상함`;
    const want = `${Math.abs(d)}씩 ${d > 0 ? '커져요' : '작아져요'}. 그래서 빈칸에는 ${withJosa(truth)} 들어가요.`;
    return q.explain === want ? null : `풀이 글: ${q.explain} ≠ ${want}`;
  }
  // 몇씩 커지고 작아질까요
  m = /^수가 몇씩 (커지고|작아지고) 있을까요\?$/.exec(p);
  if (m) {
    if (kind !== 'text') return '수가 아님';
    const nums = seq.map(Number);
    const d = (nums[1] as number) - (nums[0] as number);
    if (d === 0 || nums.some((x, i) => i > 0 && x - (nums[i - 1] as number) !== d)) return `같은 간격이 아님: ${seq}`;
    if ((m[1] === '커지고') !== d > 0) return `글은 ${m[1]} 있다는데 줄은 ${d > 0 ? '커짐' : '작아짐'}`;
    if (correctOpt(q).text !== `${Math.abs(d)}씩`) return `간격은 ${Math.abs(d)}인데 정답 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (o.text === `${Math.abs(d)}씩`) return '오답 보기도 같은 간격';
    return q.explain === `${Math.abs(d)}씩 ${d > 0 ? '커지는' : '작아지는'} 규칙이에요.` ? null : `풀이 글: ${q.explain}`;
  }
  // 되풀이되는 부분 고르기
  if (p === '이 규칙에서 되풀이되는 부분은 어느 것일까요?') {
    const per = minPeriod(seq);
    if (!per) return '되풀이되는 규칙이 없음';
    if (seq.length < 2 * per) return '두 번 되풀이되지 않음';
    const unit = seq.slice(0, per);
    if (correctOpt(q).key !== unit.join('|')) return `되풀이되는 부분은 ${unit.join('|')}인데 정답 보기 ${correctOpt(q).key}`;
    for (const o of wrongOpts(q)) {
      const u = o.key.split('|');
      if (seq.every((t, i) => t === u[i % u.length])) return `오답 보기 ${o.key}도 규칙이 되풀이되는 덩어리`;
    }
    const names = unit.map((t) => tokenName(kind, t));
    if (names.some((n) => !n)) return '이름표에 없는 칸';
    if (correctOpt(q).say !== names.join(', ')) return `읽어 줄 말 ${correctOpt(q).say} ≠ ${names.join(', ')}`;
    return q.explain === `${names.join(', ')} 순서가 되풀이되는 규칙이에요.` ? null : `풀이 글: ${q.explain}`;
  }
  return SKIP;
}

describe('규칙 찾기', () => {
  for (const id of ['pat.color', 'pat.emoji', 'pat.shape', 'pat.num', 'pat.rule', 'game.pattern.a', 'game.pattern.b', 'game.pattern.c', 'game.pattern.d']) it(id, () => run(id, patternCheck, { minChecked: 200 }));
});

// ---------------------------------------------------------------------------
// F. 분류하기·세어서 비교하기·표·그림그래프
// ---------------------------------------------------------------------------

// 문제를 만드는 코드와 따로 적은 그림 이름표: [그림, 이름, 묶음]
const D_ITEMS: [string, string, string][] = [
  ['🍎', '사과', '과일'], ['🍌', '바나나', '과일'], ['🍇', '포도', '과일'], ['🍓', '딸기', '과일'], ['🍊', '귤', '과일'], ['🍉', '수박', '과일'],
  ['🐶', '강아지', '동물'], ['🐱', '고양이', '동물'], ['🐰', '토끼', '동물'], ['🐻', '곰', '동물'], ['🐸', '개구리', '동물'], ['🐼', '판다', '동물'],
  ['🚗', '자동차', '탈것'], ['🚌', '버스', '탈것'], ['🚲', '자전거', '탈것'], ['✈️', '비행기', '탈것'], ['🚑', '구급차', '탈것'], ['🚂', '기차', '탈것'],
  ['✏️', '연필', '학용품'], ['📏', '자', '학용품'], ['✂️', '가위', '학용품'], ['📚', '책', '학용품'], ['🎒', '가방', '학용품'], ['📒', '공책', '학용품'],
];
const D_NAME = new Map(D_ITEMS.map(([e, n]) => [e, n]));
const D_CAT = new Map(D_ITEMS.map(([e, , c]) => [e, c]));
const D_EMOJI = new Map(D_ITEMS.map(([e, n]) => [n, e]));
const D_CATS = ['과일', '동물', '탈것', '학용품'];
const CAT_COUNTER: Record<string, string> = { 과일: '개', 동물: '마리', 탈것: '대', 학용품: '개' };
const COLOR_KO: Record<string, string> = { tomato: '빨간색', sky: '파란색', sun: '노란색', leaf: '초록색' };
const counterOf = (e: string): string => CAT_COUNTER[D_CAT.get(e) as string] as string;

/** 글자 보기(○개, ○마리)가 정답만 want이고 서로 겹치지 않는지 */
function unitChoiceProblem(q: Question, want: number, unit: string): string | null {
  if (q.answer.t !== 'choice') return '고르기가 아님';
  const parse = (t: string | undefined): number | null => (t?.endsWith(unit) ? num(t.slice(0, -unit.length)) : null);
  if (parse(correctOpt(q).text) !== want) return `답은 ${want}${unit}인데 정답 보기 ${correctOpt(q).text}`;
  const texts = optsOf(q).map((o) => o.text);
  if (new Set(texts).size !== texts.length) return `보기가 겹침: ${texts}`;
  for (const o of wrongOpts(q)) {
    const w = parse(o.text);
    if (w === null) return `보기 '${o.text}'를 읽지 못함`;
    if (w === want) return '오답 보기도 같은 값';
  }
  return null;
}

/** 그림 이름이 붙은 보기(🍊 귤)에서 유일한 가장 많은/적은 것을 고르는 문제 */
function extremeProblem(q: Question, counts: Map<string, number>, most: boolean): string | null {
  const vals = [...counts.values()];
  const best = most ? Math.max(...vals) : Math.min(...vals);
  if (vals.filter((x) => x === best).length !== 1) return `가장 ${most ? '많은' : '적은'} 것이 하나가 아님: ${[...counts]}`;
  const winner = [...counts.entries()].find(([, n]) => n === best)?.[0] as string;
  const c = correctOpt(q);
  if (c.key !== winner) return `가장 ${most ? '많은' : '적은'} 것은 ${winner}인데 정답 보기 ${c.key}`;
  for (const o of optsOf(q)) {
    if (o.text !== `${o.key} ${D_NAME.get(o.key)}` || o.say !== D_NAME.get(o.key)) return `보기 이름이 그림과 다름: ${o.text}`;
    if (!counts.has(o.key)) return `보기 ${o.key}가 그림에 없음`;
  }
  return null;
}

function dataCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  let m: RegExpExecArray | null;
  const bag = flat(v).find((s): s is Extract<Visual, { k: 'bag' }> => s.k === 'bag');
  const table = flat(v).find((s): s is Extract<Visual, { k: 'table' }> => s.k === 'table');
  const picto = v?.k === 'pictograph' ? v : undefined;
  const countOf = (items: string[]): Map<string, number> => {
    const c = new Map<string, number>();
    for (const e of items) c.set(e, (c.get(e) ?? 0) + 1);
    return c;
  };
  for (const e of bag?.items ?? []) if (!D_NAME.has(e)) return `이름표에 없는 그림 ${e}`;

  // --- 눌러서 찾기 / 다른 것 찾기 ---
  if (a.t === 'tapTargets') {
    m = /^(\S+?)(?:을|를) 모두 찾아 눌러 보세요\.$/.exec(p);
    if (m) {
      const word = m[1] as string;
      let want: string[];
      if (D_CATS.includes(word)) {
        if (a.items.some((it) => !D_CAT.has(it.text ?? ''))) return '이름표에 없는 그림';
        want = a.items.filter((it) => D_CAT.get(it.text as string) === word).map((it) => it.key);
        const names = a.items.filter((it) => want.includes(it.key)).map((it) => D_NAME.get(it.text as string));
        if (a.items.some((it) => it.say !== D_NAME.get(it.text as string))) return '읽어 줄 이름이 그림과 다름';
        const mm = /^(\S+?)(?:은|는) (.+) (\d+)가지예요\.$/.exec(q.explain ?? '');
        if (!mm || mm[1] !== word || Number(mm[3]) !== names.length || (mm[2] as string).split(', ').sort().join() !== [...names].sort().join()) return `풀이 글: ${q.explain} (찾을 것 ${names.join(', ')})`;
      } else {
        const tone = Object.entries(COLOR_KO).find(([, ko]) => ko === word)?.[0];
        if (!tone) return `알 수 없는 묶음 '${word}'`;
        if (a.items.some((it) => it.visual?.k !== 'shape')) return '모양 그림이 아님';
        want = a.items.filter((it) => it.visual?.k === 'shape' && it.visual.color === tone).map((it) => it.key);
        if (q.explain !== `${word} 모양은 모두 ${want.length}개예요.`) return `풀이 글: ${q.explain}`;
      }
      if (want.length < 1 || want.length >= a.items.length) return `찾을 것이 ${want.length}/${a.items.length}`;
      if (a.need !== 'all') return '모두 찾기인데 need가 all이 아님';
      return [...a.targets].sort().join() === [...want].sort().join() ? null : `찾을 것은 ${want}인데 정답 표시 ${a.targets}`;
    }
    if (p === '다른 것 하나를 찾아 눌러 보세요.') {
      if (a.items.some((it) => !D_CAT.has(it.text ?? ''))) return '이름표에 없는 그림';
      const cats = a.items.map((it) => D_CAT.get(it.text as string) as string);
      const cnt = countOf(cats);
      if (cnt.size !== 2 || ![...cnt.values()].includes(1)) return `하나만 다른 모양이 아님: ${[...cnt]}`;
      const majority = [...cnt.entries()].find(([, n]) => n > 1)?.[0] as string;
      const oddIdx = cats.findIndex((c) => c !== majority);
      const odd = a.items[oddIdx] as { key: string; text?: string };
      if (a.targets.length !== 1 || a.targets[0] !== odd.key) return `다른 것은 ${odd.key}인데 정답 표시 ${a.targets}`;
      const nm = D_NAME.get(odd.text as string) as string;
      const oc = cats[oddIdx] as string;
      return q.explain === `나머지는 모두 ${majority}인데 ${nm}${josa(nm, '은/는')} ${oc}${josa(oc, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
    }
    return SKIP;
  }
  if (a.t !== 'choice') return SKIP;

  // --- 무엇끼리 모아 놓은 것 ---
  if (p === '무엇끼리 모아 놓은 것일까요?') {
    if (!bag) return '그림 더미가 없음';
    const cats = new Set(bag.items.map((e) => D_CAT.get(e)));
    if (cats.size !== 1) return `한 묶음이 아님: ${[...cats]}`;
    const cat = [...cats][0] as string;
    if (correctOpt(q).text !== cat) return `모아 놓은 것은 ${cat}인데 정답 보기 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (o.text === cat) return '오답 보기도 같은 묶음';
    return q.explain === `모두 ${cat}${josa(cat, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  // --- 묶음이나 그림 하나가 모두 몇 개 ---
  m = /^(\S+?)(?:은|는) 모두 몇 (\S+)일까요\?$/.exec(p);
  if (m && bag) {
    const word = m[1] as string;
    let n: number;
    let unit: string;
    if (D_CATS.includes(word)) {
      n = bag.items.filter((e) => D_CAT.get(e) === word).length;
      unit = CAT_COUNTER[word] as string;
    } else {
      const e = D_EMOJI.get(word);
      if (!e) return `이름표에 없는 이름 ${word}`;
      n = bag.items.filter((x) => x === e).length;
      unit = counterOf(e);
    }
    if (m[2] !== unit) return `세는 말은 ${unit}인데 글은 ${m[2]}`;
    if (n < 1) return `${word}가 하나도 없음`;
    if (q.explain !== `${word}${josa(word, '은/는')} 모두 ${n}${unit}예요.`) return `풀이 글: ${q.explain}`;
    return unitChoiceProblem(q, n, unit);
  }
  // --- 가장 많은 것·적은 것 (그림 더미) ---
  m = /^(?:표에서 )?가장 (많은|적은) 것은 무엇일까요\?$/.exec(p);
  if (m && bag) return extremeProblem(q, countOf(bag.items), m[1] === '많은');
  if (m && picto) return extremeProblem(q, new Map(picto.rows.map((r) => [r.emoji, r.n])), m[1] === '많은') ?? pictoLabelProblem(picto);
  if (m && table) {
    const rows = tableRows(table);
    if (typeof rows === 'string') return rows;
    return extremeProblem(q, rows.counts, m[1] === '많은') ?? tableExplainProblem(q, rows, m[1] === '많은');
  }
  // --- 두 가지 비교 / 합 (그림 더미, 표, 그림그래프) ---
  m = /^(\S+?)(?:은|는) (\S+?)보다 몇 (\S+) 더 많을까요\?$/.exec(p);
  if (m) {
    const get = bagTableOrPicto(bag, table, picto);
    if (typeof get === 'string') return get;
    const x = get.byName(m[1] as string);
    const y = get.byName(m[2] as string);
    if (x === null || y === null) return `그림에 ${m[1]}나 ${m[2]}가 없음`;
    if (x <= y) return `${m[1]} ${x}가 ${m[2]} ${y}보다 많지 않음`;
    const e = D_EMOJI.get(m[1] as string) as string;
    if (m[3] !== counterOf(e)) return `세는 말은 ${counterOf(e)}인데 글은 ${m[3]}`;
    const why = q.explain === `${m[1]} ${x}${m[3]}, ${m[2]} ${y}${m[3]}이니까 ${x - y}${m[3]} 더 많아요.` || q.explain === `${x} − ${y} = ${x - y}이니까 ${x - y}${m[3]} 더 많아요.`;
    if (!why) return `풀이 글: ${q.explain}`;
    return unitChoiceProblem(q, x - y, m[3] as string);
  }
  m = /^(\S+?)(?:와|과) (\S+?)(?:은|는) 모두 몇 (\S+)일까요\?$/.exec(p);
  if (m && bag) {
    const e1 = D_EMOJI.get(m[1] as string);
    const e2 = D_EMOJI.get(m[2] as string);
    if (!e1 || !e2) return '이름표에 없는 이름';
    const x = bag.items.filter((e) => e === e1).length;
    const y = bag.items.filter((e) => e === e2).length;
    if (x < 1 || y < 1) return '둘 중 하나가 없음';
    if (m[3] !== counterOf(e1)) return `세는 말은 ${counterOf(e1)}인데 글은 ${m[3]}`;
    if (q.explain !== `${m[1]} ${x}${m[3]}와 ${m[2]} ${y}${m[3]}를 합치면 ${x + y}${m[3]}예요.` && q.explain !== `${m[1]} ${x}${m[3]}과 ${m[2]} ${y}${m[3]}를 합치면 ${x + y}${m[3]}예요.`) return `풀이 글: ${q.explain}`;
    return unitChoiceProblem(q, x + y, m[3] as string);
  }
  // --- 표 읽기 ---
  m = /^표를 보고 (\S+?)(?:은|는) 몇 (\S+)인지 골라 보세요\.$/.exec(p);
  if (m && table) {
    const rows = tableRows(table);
    if (typeof rows === 'string') return rows;
    const n = rows.byName.get(m[1] as string);
    if (n === undefined) return `표에 ${m[1]}가 없음`;
    const e = D_EMOJI.get(m[1] as string) as string;
    if (m[2] !== counterOf(e)) return `세는 말은 ${counterOf(e)}인데 글은 ${m[2]}`;
    if (q.explain !== `${m[1]}${josa(m[1] as string, '은/는')} ${n}${m[2]}예요.`) return `풀이 글: ${q.explain}`;
    return unitChoiceProblem(q, n, m[2] as string);
  }
  m = /^표를 보고 모두 몇 (\S+)인지 골라 보세요\.$/.exec(p);
  if (m && table) {
    const rows = tableRows(table);
    if (typeof rows === 'string') return rows;
    const vals = [...rows.byName.values()];
    const total = sumOf(vals);
    if (q.explain !== `${vals.join(' + ')} = ${total}이니까 모두 ${total}${m[1]}예요.`) return `풀이 글: ${q.explain} (식 ${vals.join(' + ')})`;
    return unitChoiceProblem(q, total, m[1] as string);
  }
  if (p === '그림을 세어서 표의 물음표에 알맞은 수를 골라 보세요.' && table && bag) {
    const rows = table.rows.filter((r) => r[1] === null);
    if (rows.length !== 1) return '물음표 칸이 하나가 아님';
    const [e] = String((rows[0] as (string | number | null)[])[0]).split(' ');
    const n = bag.items.filter((x) => x === e).length;
    for (const r of table.rows) {
      if (r[1] === null) continue;
      const [re] = String(r[0]).split(' ');
      if (bag.items.filter((x) => x === re).length !== r[1]) return `표의 ${r[0]} ${r[1]}이 그림의 개수와 다름`;
    }
    if (n < 1) return '그림에 없는 것을 물음';
    return unitChoiceProblem(q, n, counterOf(e as string));
  }
  // --- 그림그래프 읽기 ---
  m = /^(\S+?)(?:은|는) 몇 (\S+)일까요\?$/.exec(p);
  if (m && picto) {
    const row = picto.rows.find((r) => r.label === m?.[1]);
    if (!row) return `그림그래프에 ${m[1]}가 없음`;
    if (m[2] !== counterOf(row.emoji)) return `세는 말은 ${counterOf(row.emoji)}인데 글은 ${m[2]}`;
    return pictoLabelProblem(picto) ?? unitChoiceProblem(q, row.n, m[2] as string);
  }
  m = /^그림이 모두 몇 (\S+)일까요\?$/.exec(p);
  if (m && picto) {
    const vals = picto.rows.map((r) => r.n);
    if (q.explain !== `${vals.join(' + ')} = ${sumOf(vals)}이니까 모두 ${sumOf(vals)}${m[1]}예요.`) return `풀이 글: ${q.explain}`;
    return pictoLabelProblem(picto) ?? unitChoiceProblem(q, sumOf(vals), m[1] as string);
  }
  m = /^(\S+)수가 다른 한 줄을 골라 보세요\.$/.exec(p);
  if (m && picto) {
    const ns = picto.rows.map((r) => r.n);
    const cnt = countOf(ns.map(String));
    if (cnt.size !== 2 || ![...cnt.values()].includes(1)) return `한 줄만 다른 모양이 아님: ${ns}`;
    const odd = picto.rows.find((r) => cnt.get(String(r.n)) === 1) as { emoji: string; label: string; n: number };
    if (correctOpt(q).key !== odd.emoji) return `다른 줄은 ${odd.label}인데 정답 보기 ${correctOpt(q).text}`;
    const same = picto.rows.filter((r) => r.n !== odd.n);
    const unit = counterOf(odd.emoji);
    if (q.explain !== `${same[0]?.label}${josa(same[0]?.label ?? '', '과/와')} ${same[1]?.label}${josa(same[1]?.label ?? '', '은/는')} ${same[0]?.n}${unit}로 같고, ${odd.label}${josa(odd.label, '은/는')} ${odd.n}${unit}로 달라요.`) return `풀이 글: ${q.explain}`;
    return pictoLabelProblem(picto);
  }
  return SKIP;
}

/** 그림그래프 줄의 이름표가 그림과 맞는지 */
function pictoLabelProblem(g: Extract<Visual, { k: 'pictograph' }>): string | null {
  for (const r of g.rows) if (D_NAME.get(r.emoji) !== r.label) return `줄 이름 ${r.label}이 그림 ${r.emoji}와 다름`;
  return null;
}

/** 표의 줄을 읽는다: 줄 이름은 '그림 이름' 모양이어야 한다 */
function tableRows(t: Extract<Visual, { k: 'table' }>): { counts: Map<string, number>; byName: Map<string, number> } | string {
  const counts = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const r of t.rows) {
    const [e, ...rest] = String(r[0]).split(' ');
    const name = rest.join(' ');
    if (D_NAME.get(e as string) !== name) return `표의 줄 이름 '${r[0]}'이 그림과 다름`;
    if (typeof r[1] !== 'number') return '표에 숫자가 아닌 칸이 있음';
    counts.set(e as string, r[1]);
    byName.set(name, r[1]);
  }
  return { counts, byName };
}

function tableExplainProblem(q: Question, rows: { counts: Map<string, number> }, most: boolean): string | null {
  const best = most ? Math.max(...rows.counts.values()) : Math.min(...rows.counts.values());
  const e = [...rows.counts.entries()].find(([, n]) => n === best)?.[0] as string;
  const nm = D_NAME.get(e) as string;
  return q.explain === `${nm}${josa(nm, '이/가')} ${best}${counterOf(e)}로 가장 ${most ? '많아요' : '적어요'}.` ? null : `풀이 글: ${q.explain}`;
}

/** 이름으로 개수를 찾아 주는 도구(그림 더미, 표, 그림그래프 어느 쪽이든) */
function bagTableOrPicto(bag: Extract<Visual, { k: 'bag' }> | undefined, table: Extract<Visual, { k: 'table' }> | undefined, picto: Extract<Visual, { k: 'pictograph' }> | undefined): { byName: (n: string) => number | null } | string {
  if (bag) return { byName: (n) => (D_EMOJI.has(n) ? bag.items.filter((e) => e === D_EMOJI.get(n)).length : null) };
  if (table) {
    const rows = tableRows(table);
    if (typeof rows === 'string') return rows;
    return { byName: (n) => rows.byName.get(n) ?? null };
  }
  if (picto) {
    const bad = pictoLabelProblem(picto);
    if (bad) return bad;
    return { byName: (n) => picto.rows.find((r) => r.label === n)?.n ?? null };
  }
  return '세어 볼 그림이 없음';
}

describe('분류하기·표·그림그래프', () => {
  for (const id of ['data.sort', 'data.count', 'data.table', 'data.picto', 'game.sort.a', 'game.sort.b', 'game.sort.c']) it(id, () => run(id, dataCheck, { minChecked: 200 }));
});

// ---------------------------------------------------------------------------
// G. 학교 생활: 시간표, 하루 계획표, 줄 세우기 말(몇째·사이·왼쪽 오른쪽), 낱말
// ---------------------------------------------------------------------------

const SUBJECT_EMOJI: Record<string, string> = { 국어: '📖', 수학: '🔢', 통합: '🌱', 음악: '🎵', 미술: '🎨', 체육: '🏃' };
/** 일과마다 쓰는 그림(학교 가기는 두 곳에서 다른 그림을 쓴다) */
const ROUTINE_EMOJI: Record<string, string[]> = {
  일어나기: ['⏰'],
  세수하기: ['🧼'],
  '아침밥 먹기': ['🍚'],
  '학교 가기': ['🚌', '🎒'],
  '공부 시작': ['📚'],
  '점심 먹기': ['🍱'],
  '학교 마치기': ['🏠'],
  '놀이터에서 놀기': ['🛝'],
  '저녁밥 먹기': ['🍲'],
  목욕하기: ['🛁'],
  잠자기: ['🛌'],
};
/** 아침부터 밤까지 일과를 먼저 하는 순서로 늘어놓은 전체 순서(학교 가는 날의 일과와 보통 하루의 일과가 모두 이 순서를 따른다) */
const ROUTINE_ORDER = ['일어나기', '세수하기', '아침밥 먹기', '학교 가기', '공부 시작', '점심 먹기', '학교 마치기', '놀이터에서 놀기', '저녁밥 먹기', '목욕하기', '잠자기'];
const DAY_SET = ['일어나기', '세수하기', '아침밥 먹기', '학교 가기', '점심 먹기', '놀이터에서 놀기', '저녁밥 먹기', '목욕하기', '잠자기'];
const SCHOOL_SET = ['일어나기', '아침밥 먹기', '학교 가기', '공부 시작', '점심 먹기', '학교 마치기'];
/** 일과마다 사람이 보기에 자연스러운 시각의 범위(24시간제 분). 시계 글자 '1시'가 낮 1시인지 새벽 1시인지 가르는 데 쓴다 */
const ROUTINE_WINDOW: Record<string, [number, number]> = {
  일어나기: [5 * 60 + 30, 8 * 60],
  세수하기: [6 * 60, 8 * 60 + 30],
  '아침밥 먹기': [6 * 60 + 30, 9 * 60],
  '학교 가기': [7 * 60 + 30, 9 * 60 + 30],
  '공부 시작': [8 * 60 + 30, 10 * 60],
  '점심 먹기': [11 * 60 + 30, 13 * 60 + 30],
  '학교 마치기': [12 * 60 + 30, 15 * 60],
  '놀이터에서 놀기': [14 * 60 + 30, 17 * 60],
  '저녁밥 먹기': [16 * 60 + 30, 19 * 60 + 30],
  목욕하기: [18 * 60 + 30, 21 * 60],
  잠자기: [19 * 60 + 30, 22 * 60 + 30],
};
const ANIMAL: Record<string, string> = { '🐼': '판다', '🦊': '여우', '🐸': '개구리', '🐶': '강아지', '🐰': '토끼', '🐯': '호랑이', '🐱': '고양이', '🐥': '병아리', '🐻': '곰' };
const ORDINAL = ['첫', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const COUNT_WORD = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const ORD_RE = ORDINAL.join('|');
const ordWord = (n: number): string => `${ORDINAL[n - 1]}째`;
const OBJ_COUNTER: Record<string, string> = { 사과: '개', 물고기: '마리', 별: '개', 풍선: '개', 쿠키: '개', 꽃: '송이', 병아리: '마리', 자동차: '대', 공: '개', 딸기: '개', 나비: '마리', 사탕: '개' };

const withP = (w: string, kind: Parameters<typeof josa>[1]): string => `${w}${josa(w, kind)}`;

/** 선택지의 글(예: '🔢 수학')을 읽어 이름만 돌려준다 */
const subjectOf = (o: Option): string => (o.text ?? '').split(' ').slice(1).join(' ');

function timetableCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  if (v?.k !== 'timetable' || a.t !== 'choice') return SKIP;
  const per = v.periods;
  let m: RegExpExecArray | null;
  for (let i = 0; i < per.length; i++) {
    const x = per[i] as { label: string; subject: string; emoji: string };
    if (x.label !== `${i + 1}교시`) return `교시 이름 ${x.label}이 ${i + 1}번째 줄이 아님`;
    if (SUBJECT_EMOJI[x.subject] !== x.emoji) return `수업 ${x.subject}의 그림 ${x.emoji}이 맞지 않음`;
  }
  const subs = per.map((x) => x.subject);
  if (new Set(subs).size !== subs.length) return '같은 수업이 두 번 나옴';
  const idxOf = (s: string): number => subs.indexOf(s);
  for (const o of optsOf(q)) if (o.visual === undefined && o.text !== undefined && /^[^\d]/.test(o.text) && SUBJECT_EMOJI[subjectOf(o)] !== o.text.split(' ')[0]) return `보기 ${o.text}의 그림이 이름과 맞지 않음`;

  /** 정답이 수업 이름일 때 */
  const subjectAnswer = (want: string): string | null => {
    if (subjectOf(correctOpt(q)) !== want) return `답은 ${want}인데 정답 보기 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (subjectOf(o) === want) return '오답 보기도 같은 수업';
    const names = optsOf(q).map(subjectOf);
    return new Set(names).size === names.length ? null : '보기가 겹침';
  };
  /** 정답이 ○교시·○번일 때 */
  const unitAnswer = (want: number, unit: string): string | null => {
    const parse = (t: string | undefined): number | null => (t?.endsWith(unit) ? num(t.slice(0, -unit.length)) : null);
    if (parse(correctOpt(q).text) !== want) return `답은 ${want}${unit}인데 정답 보기 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (parse(o.text) === null || parse(o.text) === want) return `오답 보기 ${o.text}가 이상함`;
    return null;
  };

  m = /^(\d+)교시에는 무슨 수업을 할까요\?$/.exec(p);
  if (m) {
    const n = Number(m[1]);
    if (n < 1 || n > per.length) return `${n}교시가 시간표에 없음`;
    const subj = (per[n - 1] as { subject: string }).subject;
    return subjectAnswer(subj) ?? (q.explain === `${n}교시는 ${withP(subj, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\S+?)(?:은|는) 몇 교시일까요\?$/.exec(p);
  if (m) {
    const i = idxOf(m[1] as string);
    if (i < 0) return `시간표에 ${m[1]}가 없음`;
    return unitAnswer(i + 1, '교시') ?? (q.explain === `${m[1]}${josa(m[1] as string, '은/는')} ${i + 1}교시예요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\S+) (바로 앞|다음) 시간은 무슨 수업일까요\?$/.exec(p);
  if (m) {
    const i = idxOf(m[1] as string);
    if (i < 0) return `시간표에 ${m[1]}가 없음`;
    const j = m[2] === '다음' ? i + 1 : i - 1;
    if (j < 0 || j >= per.length) return '앞이나 뒤에 수업이 없음';
    const subj = (per[j] as { subject: string }).subject;
    return subjectAnswer(subj) ?? (q.explain === `${m[1]} ${m[2]} 시간은 ${withP(subj, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^오늘 (첫 번째로|마지막으로) 하는 수업은 무엇일까요\?$/.exec(p);
  if (m) {
    const subj = (per[m[1] === '첫 번째로' ? 0 : per.length - 1] as { subject: string }).subject;
    return subjectAnswer(subj);
  }
  m = /^(\S+)요일에는 수업이 모두 몇 교시까지 있을까요\?$/.exec(p);
  if (m) {
    if (v.day !== `${m[1]}요일`) return `그림의 요일 ${v.day}이 글과 다름`;
    return unitAnswer(per.length, '교시');
  }
  m = /^(\S+) 시간 전에는 수업을 몇 번 할까요\?$/.exec(p);
  if (m) {
    const i = idxOf(m[1] as string);
    if (i < 1) return `${m[1]} 앞에 수업이 없음`;
    return unitAnswer(i, '번') ?? (q.explain === `${m[1]}${josa(m[1] as string, '은/는')} ${i + 1}교시이니까 그 전에 ${i}번 수업을 해요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\S+?)(?:과|와) (\S+?) 사이에는 수업이 몇 번 있을까요\?$/.exec(p);
  if (m) {
    const i = idxOf(m[1] as string);
    const j = idxOf(m[2] as string);
    if (i < 0 || j < 0 || i === j) return '시간표에서 두 수업을 찾지 못함';
    const between = Math.abs(i - j) - 1;
    if (between < 1) return '두 수업이 붙어 있어 사이가 없음';
    const f = /^(\S+?)(?:은|는) (\d+)교시, (\S+?)(?:은|는) (\d+)교시이니까 그 사이에 수업이 (\d+)번 있어요\.$/.exec(q.explain ?? '');
    if (!f || idxOf(f[1] as string) + 1 !== Number(f[2]) || idxOf(f[3] as string) + 1 !== Number(f[4]) || Number(f[5]) !== between) return `풀이 글: ${q.explain}`;
    return unitAnswer(between, '번');
  }
  m = /^(\S+?)(?:과|와) (\S+?) 사이에 있는 수업은 무엇일까요\?$/.exec(p);
  if (m) {
    const i = idxOf(m[1] as string);
    const j = idxOf(m[2] as string);
    if (i < 0 || j < 0 || Math.abs(i - j) !== 2) return '두 수업 사이에 수업이 하나가 아님';
    const subj = (per[Math.min(i, j) + 1] as { subject: string }).subject;
    return subjectAnswer(subj);
  }
  return SKIP;
}

// 하루 계획표 ----------------------------------------------------------------

/** '7시 30분' + 일과 이름 → 시계 모습(시·분)과 하루 안의 시각(24시간제 분). 일과에 어울리는 시각이 아니면 null */
function routineTime(t: string, label: string): { h: number; m: number; at: number } | null {
  const mm = /^(\d+)시(?: (\d+)분)?$/.exec(t);
  const win = ROUTINE_WINDOW[label];
  if (!mm || !win) return null;
  const h = Number(mm[1]);
  const mi = Number(mm[2] ?? 0);
  if (h < 1 || h > 12) return null;
  const hits = [(h % 12) * 60 + mi, (h % 12) * 60 + mi + 720].filter((x) => x >= win[0] && x <= win[1]);
  return hits.length === 1 ? { h, m: mi, at: hits[0] as number } : null;
}

function clockSayProblem(o: Option): string | null {
  if (o.visual?.k !== 'clock') return '시계 그림이 아님';
  const { h, m } = o.visual;
  const want = m === 0 ? `${nativeCounter(h)} 시` : `${nativeCounter(h)} 시 ${sinoNum(m)} 분`;
  return o.say === want ? null : `읽어 줄 말 '${o.say}' ≠ '${want}'`;
}

const TABLE_WORD = '(?:하루 계획표|계획표|일과표)';

function dayCheck({ q }: Case): string | null {
  const a = q.answer;
  const p = q.prompt;
  const routine = flat(q.visual).find((s): s is Extract<Visual, { k: 'routine' }> => s.k === 'routine');
  let m: RegExpExecArray | null;
  const labelOf = (t: string | undefined): string => (t ?? '').split(' ').slice(1).join(' ');
  const emojiOf = (t: string | undefined): string => (t ?? '').split(' ')[0] as string;
  const optProblem = (o: { key: string; text?: string }): string | null => (ROUTINE_EMOJI[labelOf(o.text)]?.includes(emojiOf(o.text)) ? null : `보기 ${o.text}의 그림이 이름과 맞지 않음`);

  // 표 자체가 맞는지: 그림, 시각이 하루 순서대로 늘어나는지, 일 순서
  const times = new Map<string, { h: number; m: number; at: number }>();
  if (routine) {
    const labels = routine.items.map((x) => x.label);
    if (new Set(labels).size !== labels.length) return '같은 일이 표에 두 번 나옴';
    let prev = -1;
    for (const it of routine.items) {
      if (!ROUTINE_EMOJI[it.label]?.includes(it.emoji)) return `일과 ${it.label}의 그림 ${it.emoji}이 맞지 않음`;
      if (it.time === undefined) continue;
      const t = routineTime(it.time, it.label);
      if (!t) return `${it.label}의 시각 ${it.time}이 읽히지 않거나 그 일과 어울리지 않음`;
      if (t.at <= prev) return `표의 시각이 하루 순서대로 늘어나지 않음: ${routine.items.map((x) => x.time)}`;
      prev = t.at;
      times.set(it.label, t);
    }
    if (routine.items.every((it) => it.time !== undefined)) {
      const idx = labels.map((x) => ROUTINE_ORDER.indexOf(x));
      if (idx.some((x, i) => x < 0 || (i > 0 && x <= (idx[i - 1] as number)))) return '표의 일 순서가 하루 순서와 다름';
    }
  }

  // 먼저 하는 일부터 차례대로 누르기
  if (a.t === 'order' && (p === '학교 가는 날, 먼저 하는 일부터 차례대로 눌러 보세요.' || p === '하루에 하는 일을 먼저 하는 것부터 차례대로 눌러 보세요.')) {
    const set = p.startsWith('학교') ? SCHOOL_SET : DAY_SET;
    const label = (key: string): string => labelOf(a.items.find((it) => it.key === key)?.text);
    const present = a.items.map((it) => labelOf(it.text));
    for (const it of a.items) {
      const bad = optProblem(it);
      if (bad) return bad;
    }
    if (present.some((x) => !set.includes(x))) return `이 문제에 맞지 않는 일이 섞임: ${present}`;
    const want = ROUTINE_ORDER.filter((x) => present.includes(x));
    if (want.length !== present.length || a.correct.length !== a.items.length) return '보기 구성이 맞지 않음';
    const got = a.correct.map(label);
    if (got.join() !== want.join()) return `하루 순서는 ${want}인데 정답 순서 ${got}`;
    return q.explain === `${want.join(', ')} 순서예요.` ? null : `풀이 글: ${q.explain}`;
  }
  // 바로 다음 · 바로 전에 하는 일(보통 하루)
  m = /^(.+) 바로 (다음|전)에 하는 일은 무엇일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const i = DAY_SET.indexOf(m[1] as string);
    const j = i + (m[2] === '다음' ? 1 : -1);
    if (i < 0 || j < 0 || j >= DAY_SET.length) return `${m[1]} ${m[2]}의 일이 없음`;
    const want = DAY_SET[j] as string;
    for (const o of optsOf(q)) {
      const bad = optProblem(o);
      if (bad) return bad;
      if (!DAY_SET.includes(labelOf(o.text))) return `보기 ${o.text}는 보통 하루의 일이 아님`;
    }
    if (labelOf(correctOpt(q).text) !== want) return `${m[1]} 바로 ${m[2]}은 ${want}인데 정답 보기 ${correctOpt(q).text}`;
    if (wrongOpts(q).some((o) => labelOf(o.text) === want || labelOf(o.text) === m?.[1])) return '오답 보기가 정답이거나 질문 속 일';
    const labels = optsOf(q).map((o) => labelOf(o.text));
    if (new Set(labels).size !== labels.length) return '보기가 겹침';
    const ex = m[2] === '다음' ? `${m[1]} 다음에는 ${withP(want, '이에요/예요')}.` : `${m[1]} 바로 전에는 ${withP(want, '이에요/예요')}.`;
    return q.explain === ex ? null : `풀이 글: ${q.explain}`;
  }
  // 세 가지 중 가장 먼저 · 가장 나중에 하는 일
  m = /^가장 (먼저|나중에) 하는 일은 무엇일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    if (!routine) return '일과 그림이 없음';
    const labels = routine.items.map((x) => x.label);
    if (labels.length !== 3 || labels.some((x) => !DAY_SET.includes(x))) return `세 가지가 아니거나 보통 하루의 일이 아님: ${labels}`;
    const sorted = [...labels].sort((x, y) => ROUTINE_ORDER.indexOf(x) - ROUTINE_ORDER.indexOf(y));
    const want = m[1] === '먼저' ? (sorted[0] as string) : (sorted[2] as string);
    if (labelOf(correctOpt(q).text) !== want) return `답은 ${want}인데 정답 보기 ${correctOpt(q).text}`;
    const opts = optsOf(q).map((o) => labelOf(o.text));
    if (opts.slice().sort().join() !== labels.slice().sort().join()) return '보기가 그림의 세 가지와 다름';
    for (const o of optsOf(q)) {
      const bad = optProblem(o);
      if (bad) return bad;
    }
    return q.explain === `${sorted.join(', ')} 순서예요. ${m[1] === '먼저' ? '가장 먼저' : '가장 나중에'} 하는 일은 ${withP(want, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  if (!routine && !flat(q.visual).some((s) => s.k === 'clock')) return SKIP;

  m = new RegExp(`^${TABLE_WORD}를 보고 (.+) 시각의 시계를 골라 보세요\\.$`).exec(p);
  if (m && a.t === 'choice') {
    const t = times.get(m[1] as string);
    if (!t) return `표에 ${m[1]}의 시각이 없음`;
    const c = correctOpt(q).visual;
    if (c?.k !== 'clock' || c.h !== t.h || c.m !== t.m) return `${m[1]}는 ${t.h}:${t.m}인데 정답 시계 ${c?.k === 'clock' ? `${c.h}:${c.m}` : '?'}`;
    const keys = optsOf(q).map((o) => (o.visual?.k === 'clock' ? `${o.visual.h}:${o.visual.m}` : '?'));
    if (new Set(keys).size !== keys.length) return `시계가 겹침: ${keys}`;
    for (const o of optsOf(q)) {
      const bad = clockSayProblem(o);
      if (bad) return bad;
    }
    const timeText = routine?.items.find((x) => x.label === m?.[1])?.time as string;
    const ex = `${m[1]}${josa(m[1] as string, '은/는')} ${withP(timeText, '이에요/예요')}.`;
    return q.explain === ex || q.explain === `${ex} 긴바늘과 짧은바늘이 그 시각을 가리키는 시계예요.` ? null : `풀이 글: ${q.explain}`;
  }
  if (/^시계가 가리키는 시각에는 무엇을 할까요\? (?:계획표|일과표)에서 찾아보세요\.$/.test(p) && a.t === 'choice') {
    const clock = flat(q.visual).find((s): s is Extract<Visual, { k: 'clock' }> => s.k === 'clock');
    if (!clock || !routine) return '시계나 표가 없음';
    const hits = routine.items.filter((it) => {
      const t = times.get(it.label);
      return t?.h === clock.h && t.m === clock.m;
    });
    if (hits.length !== 1) return `시계 ${clock.h}:${clock.m}와 같은 시각의 일이 ${hits.length}개`;
    const hit = hits[0] as { label: string; emoji: string; time?: string };
    if (correctOpt(q).text !== `${hit.emoji} ${hit.label}`) return `그 시각의 일은 ${hit.label}인데 정답 보기 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) {
      const lab = labelOf(o.text);
      if (lab === hit.label) return '오답 보기도 같은 일';
      const t = times.get(lab);
      if (t && t.at === times.get(hit.label)?.at) return `오답 보기 ${lab}도 같은 시각`;
      if (!t) return `오답 보기 ${lab}가 표에 없음`;
      const bad = optProblem(o);
      if (bad) return bad;
    }
    return q.explain === `${hit.time}에는 ${withP(hit.label, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^(.+?)(?:와|과) (.+?) 중에서 먼저 하는 일은 무엇일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const x = times.get(m[1] as string);
    const y = times.get(m[2] as string);
    if (!x || !y || x.at === y.at) return '표에서 두 일의 시각을 찾지 못함';
    const first = x.at < y.at ? (m[1] as string) : (m[2] as string);
    if (labelOf(correctOpt(q).text) !== first) return `먼저 하는 일은 ${first}인데 정답 보기 ${correctOpt(q).text}`;
    if (optsOf(q).length !== 2 || wrongOpts(q).some((o) => labelOf(o.text) === first)) return '보기가 두 일이 아님';
    const tx = routine?.items.find((it) => it.label === m?.[1])?.time as string;
    const ty = routine?.items.find((it) => it.label === m?.[2])?.time as string;
    return q.explain === `${m[1]}${josa(m[1] as string, '은/는')} ${tx}, ${m[2]}${josa(m[2] as string, '은/는')} ${withP(ty, '이에요/예요')}. 시각이 더 이른 ${withP(first, '이/가')} 먼저예요.` ? null : `풀이 글: ${q.explain}`;
  }
  if (new RegExp(`^${TABLE_WORD}를 보고 하는 일과 알맞은 시계를 이어 보세요\\.$`).test(p) && a.t === 'match') {
    if (!routine) return '표가 없음';
    for (const pr of a.pairs) {
      const label = labelOf(pr.a.text);
      const t = times.get(label);
      const c = pr.b.visual;
      if (!t) return `표에 ${label}의 시각이 없음`;
      if (!ROUTINE_EMOJI[label]?.includes(emojiOf(pr.a.text))) return `${pr.a.text}의 그림이 이름과 맞지 않음`;
      if (c?.k !== 'clock' || c.h !== t.h || c.m !== t.m) return `${label}는 ${t.h}:${t.m}인데 이은 시계 ${c?.k === 'clock' ? `${c.h}:${c.m}` : '?'}`;
    }
    const keys = a.pairs.map((pr) => (pr.b.visual?.k === 'clock' ? `${pr.b.visual.h}:${pr.b.visual.m}` : '?'));
    if (new Set(keys).size !== keys.length) return '같은 시각의 시계가 둘 이상';
    return a.pairs.length === routine.items.length ? null : '표의 일과 이을 짝의 수가 다름';
  }
  return SKIP;
}

// 줄 세우기 말 ----------------------------------------------------------------

function queueCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  let m: RegExpExecArray | null;
  if (a.t !== 'choice') return SKIP;

  // 순서를 나타내는 말과 개수를 나타내는 말
  m = /^(줄에서 몇 번째 자리인지, 순서|모두 몇인지, 개수)를 나타내는 말은 어느 것일까요\?$/.exec(p);
  if (m) {
    const wantOrd = m[1]?.startsWith('줄에서');
    const ord = optsOf(q).find((o) => o.key === 'ord');
    const cnt = optsOf(q).find((o) => o.key === 'cnt');
    if (!ord || !cnt || optsOf(q).length !== 2) return '보기가 순서말과 개수말 둘이 아님';
    const n = ORDINAL.findIndex((w) => `${w}째` === ord.text) + 1;
    const mm = /^(\S+) (?:명|개|마리)$/.exec(cnt.text ?? '');
    const c = COUNT_WORD.indexOf(mm?.[1] ?? '?');
    if (n < 1 || c < 1 || n !== c) return `순서말 ${ord.text}와 개수말 ${cnt.text}가 같은 수가 아님`;
    if (correctOpt(q).key !== (wantOrd ? 'ord' : 'cnt')) return `${wantOrd ? '순서' : '개수'}말을 묻는데 정답 ${correctOpt(q).text}`;
    const w = correctOpt(q).text as string;
    return q.explain === `${w}${josa(w, '이에요/예요')}. ${wantOrd ? '순서' : '개수'}를 나타내는 말이에요.` ? null : `풀이 글: ${q.explain}`;
  }
  if (v?.k !== 'queue') return SKIP;
  const items = v.items;
  const len = items.length;
  if (new Set(items).size !== len) return '같은 그림이 줄에 둘 이상';
  for (const e of items) if (!ANIMAL[e]) return `이름표에 없는 그림 ${e}`;
  const nameOf = (e: string): string => ANIMAL[e] as string;
  const optName = (o: Option): string => (o.text ?? '').split(' ').slice(1).join(' ');
  const optEmoji = (o: Option): string => (o.text ?? '').split(' ')[0] as string;
  const friendAnswer = (idx: number): string | null => {
    if (idx < 0 || idx >= len) return '줄 밖의 자리';
    const e = items[idx] as string;
    if (correctOpt(q).key !== e) return `답은 ${nameOf(e)}인데 정답 보기 ${correctOpt(q).text}`;
    for (const o of optsOf(q)) {
      if (optEmoji(o) !== o.key || optName(o) !== ANIMAL[o.key] || o.say !== ANIMAL[o.key]) return `보기 ${o.text}의 그림과 이름이 맞지 않음`;
      if (o !== correctOpt(q) && o.key === e) return '오답 보기도 같은 친구';
    }
    const keys = optsOf(q).map((o) => o.key);
    return new Set(keys).size === keys.length ? null : '보기가 겹침';
  };
  const ordAnswer = (n: number): string | null => {
    const want = `${ordWord(n)}`;
    if (correctOpt(q).text !== want || correctOpt(q).key !== String(n)) return `답은 ${want}인데 정답 보기 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (o.text === want || o.key === String(n) || o.text !== `${ordWord(Number(o.key))}`) return `오답 보기 ${o.text}가 이상함`;
    return null;
  };
  const markIdx = (): number => (v.mark === undefined ? -1 : v.mark);

  m = new RegExp(`^(왼쪽|오른쪽)에서 (${ORD_RE})째 친구는 누구일까요\\?$`).exec(p);
  if (m) {
    const n = ORDINAL.indexOf(m[2] as string) + 1;
    const idx = m[1] === '왼쪽' ? n - 1 : len - n;
    const bad = friendAnswer(idx);
    if (bad) return bad;
    const nm = nameOf(items[idx] as string);
    return q.explain === `${m[1]}에서 ${ordWord(n)} 친구는 ${withP(nm, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^표시한 친구는 (왼쪽|오른쪽)에서 몇째일까요\?$/.exec(p);
  if (m) {
    if (markIdx() < 0) return '표시한 친구가 없음';
    const n = m[1] === '왼쪽' ? markIdx() + 1 : len - markIdx();
    return ordAnswer(n) ?? (q.explain === `${m[1]}에서부터 차례로 세면 ${withP(ordWord(n), '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  m = new RegExp(`^(\\S+?)(?:은|는) (왼쪽|오른쪽)에서 (${ORD_RE})째예요\\. (왼쪽|오른쪽)에서는 몇째일까요\\?$`).exec(p);
  if (m) {
    const e = Object.entries(ANIMAL).find(([, nm]) => nm === m?.[1])?.[0];
    const idx = e ? items.indexOf(e) : -1;
    if (idx < 0) return `줄에 ${m[1]}가 없음`;
    if (v.mark !== idx) return '표시한 친구가 글의 친구와 다름';
    const given = ORDINAL.indexOf(m[3] as string) + 1;
    if ((m[2] === '왼쪽' ? idx + 1 : len - idx) !== given) return `${m[1]}는 ${m[2]}에서 ${given}째가 아님`;
    if (m[2] === m[4]) return '같은 쪽을 다시 물음';
    const n = m[4] === '왼쪽' ? idx + 1 : len - idx;
    return ordAnswer(n) ?? (q.explain === `${m[4]}에서부터 차례로 세면 ${withP(ordWord(n), '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^표시한 친구의 바로 (왼쪽|오른쪽)에 있는 친구는 누구일까요\?$/.exec(p);
  if (m) {
    if (markIdx() < 0) return '표시한 친구가 없음';
    const idx = markIdx() + (m[1] === '왼쪽' ? -1 : 1);
    const bad = friendAnswer(idx);
    if (bad) return bad;
    return q.explain === `바로 ${m[1]}에 있는 친구는 ${withP(nameOf(items[idx] as string), '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^(\S+?)(?:와|과) (\S+?) 사이에 있는 친구는 누구일까요\?$/.exec(p);
  if (m) {
    const find = (nm: string): number => items.indexOf(Object.entries(ANIMAL).find(([, n]) => n === nm)?.[0] ?? '?');
    const i = find(m[1] as string);
    const j = find(m[2] as string);
    if (i < 0 || j < 0 || Math.abs(i - j) !== 2) return '두 친구 사이에 친구가 하나가 아님';
    const idx = Math.min(i, j) + 1;
    const bad = friendAnswer(idx);
    if (bad) return bad;
    return q.explain === `${m[1]}${josa(m[1] as string, '과/와')} ${m[2]} 사이에는 ${withP(nameOf(items[idx] as string), '이/가')} 있어요.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^가장 (왼쪽|오른쪽)에 있는 친구는 누구일까요\?$/.exec(p);
  if (m) {
    const idx = m[1] === '왼쪽' ? 0 : len - 1;
    const bad = friendAnswer(idx);
    if (bad) return bad;
    return q.explain === `가장 ${m[1]}에 있는 친구는 ${withP(nameOf(items[idx] as string), '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^표시한 친구의 (왼쪽|오른쪽)에는 모두 몇 (\S+)가 있을까요\?$/.exec(p);
  if (m) {
    if (markIdx() < 0) return '표시한 친구가 없음';
    if (m[2] !== '마리') return `세는 말이 ${m[2]}`;
    const n = m[1] === '왼쪽' ? markIdx() : len - 1 - markIdx();
    if (n < 1) return '세어 볼 친구가 없음';
    const parse = (t: string | undefined): number | null => (t?.endsWith('마리') ? num(t.slice(0, -2)) : null);
    if (parse(correctOpt(q).text) !== n) return `답은 ${n}마리인데 정답 보기 ${correctOpt(q).text}`;
    for (const o of wrongOpts(q)) if (parse(o.text) === null || parse(o.text) === n) return `오답 보기 ${o.text}가 이상함`;
    return q.explain === `표시한 친구의 ${m[1]}에는 ${n}마리가 있어요.` ? null : `풀이 글: ${q.explain}`;
  }
  return SKIP;
}

// 낱말: 모두·남은·같은 수·더하기와 빼기 말 --------------------------------------

const ADD_WORDS = /모두|합치|합하|더 받|더 따|더 사|모으/;
const SUB_WORDS = /남|덜어|더 많|더 적|먹고|빼/;

function wordCheck({ q }: Case): string | null {
  const a = q.answer;
  const v = q.visual;
  const p = q.prompt;
  let m: RegExpExecArray | null;

  // 어느 말이 더하기/빼기 질문인지
  m = /^(더하기|빼기)로 풀어야 하는 질문은 어느 것일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const wantSub = m[1] === '빼기';
    const kind = (t: string | undefined): 'add' | 'sub' | '?' => {
      const sub = SUB_WORDS.test(t ?? '');
      const add = ADD_WORDS.test(t ?? '');
      return sub && !add ? 'sub' : add && !sub ? 'add' : '?';
    };
    if (kind(correctOpt(q).text) !== (wantSub ? 'sub' : 'add')) return `정답 보기 '${correctOpt(q).text}'는 ${m[1]} 질문이 아님`;
    for (const o of wrongOpts(q)) if (kind(o.text) !== (wantSub ? 'add' : 'sub')) return `오답 보기 '${o.text}'가 ${wantSub ? '더하기' : '빼기'} 질문이거나 알 수 없음`;
    return q.explain?.includes(`“${correctOpt(q).text}”`) ? null : `풀이 글: ${q.explain}`;
  }
  // 낱말과 어울리는 그림 잇기
  if (p === '낱말과 어울리는 그림을 이어 보세요.' && a.t === 'match') {
    for (const pr of a.pairs) {
      const w = pr.a.text;
      const g = pr.b.visual;
      if (w === '모두' && !(g?.k === 'groups' && g.op === '+')) return '“모두”가 합친 그림이 아님';
      else if (w === '남은' && !(g?.k === 'objects' && (g.crossed ?? 0) >= 1 && (g.crossed ?? 0) < g.n)) return '“남은”이 지우고 남은 그림이 아님';
      else if (w === '같은 수' && !(g?.k === 'groups' && g.op === 'vs' && g.a.n === g.b.n)) return '“같은 수”가 양쪽이 같은 그림이 아님';
      else if (!['모두', '남은', '같은 수'].includes(w ?? '')) return `알 수 없는 낱말 ${w}`;
    }
    const ws = a.pairs.map((pr) => pr.a.text);
    return new Set(ws).size === ws.length ? null : '같은 낱말이 두 번 나옴';
  }
  // 더 많은 쪽 · 더 적은 쪽
  m = /^왼쪽과 오른쪽 중 어느 쪽이 더 (많을|적을)까요\? 같으면 ‘같아요’를 눌러요\.$/.exec(p);
  if (m && a.t === 'choice') {
    if (v?.k !== 'groups' || v.op !== 'vs') return '견주는 그림이 아님';
    const [x, y] = [v.a.n, v.b.n];
    const want = x === y ? 'same' : (m[1] === '많을' ? x > y : x < y) ? 'left' : 'right';
    if (correctOpt(q).key !== want) return `${x}와 ${y}에서 정답은 ${want}인데 정답 보기 ${correctOpt(q).key}`;
    const labels: Record<string, string> = { left: '왼쪽', right: '오른쪽', same: '같아요' };
    for (const o of optsOf(q)) if (o.text !== labels[o.key]) return `보기 ${o.text}가 ${o.key}가 아님`;
    if (optsOf(q).length !== 3) return '보기가 셋이 아님';
    const unit = /^(\d+)(\S+)로 같아요/.exec('');
    void unit;
    if (x === y) return /^양쪽 모두 \d+\S+로 같아요\.$/.test(q.explain ?? '') && q.explain?.includes(`${x}`) ? null : `풀이 글: ${q.explain}`;
    const e = /^왼쪽은 (\d+)(\S+), 오른쪽은 (\d+)\2예요\. 더 (적은|많은) 쪽은 (왼쪽|오른쪽)이에요\.$/.exec(q.explain ?? '');
    if (!e || Number(e[1]) !== x || Number(e[3]) !== y || e[4] !== (m[1] === '많을' ? '많은' : '적은') || e[5] !== labels[want]) return `풀이 글: ${q.explain}`;
    return null;
  }
  // 모두 몇 개 / 남은 것
  m = new RegExp(`^(\\S+) (\\d+)(${U})와 (\\S+) (\\d+)\\3가 있어요\\. 모두 몇 \\3일까요\\?$`).exec(p) ?? new RegExp(`^(\\S+) (\\d+)(${U})과 (\\S+) (\\d+)\\3가 있어요\\. 모두 몇 \\3일까요\\?$`).exec(p);
  if (m) {
    const [x, y] = [Number(m[2]), Number(m[5])];
    if (v?.k !== 'groups' || v.a.n !== x || v.b.n !== y || v.op !== '+') return '무리 그림이 글과 다름';
    if (OBJ_COUNTER[m[1] as string] !== m[3] || OBJ_COUNTER[m[4] as string] !== m[3]) return `세는 말 ${m[3]}이 ${m[1]}·${m[4]}와 맞지 않음`;
    return answerWithUnit(q, x + y, m[3] as string);
  }
  m = new RegExp(`^(\\S+) (\\d+)(${U}) 중에서 (\\d+)\\3(?:를|을) 먹었어요\\. 남은 (\\S+?)(?:은|는) 몇 \\3일까요\\?$`).exec(p);
  if (m) {
    const [x, y] = [Number(m[2]), Number(m[4])];
    if (m[1] !== m[5]) return `이야기의 ${m[1]}과 묻는 ${m[5]}이 다름`;
    if (v?.k !== 'objects' || v.n !== x || v.crossed !== y) return '지운 그림이 글과 다름';
    if (OBJ_COUNTER[m[1] as string] !== m[3]) return `세는 말 ${m[3]}이 ${m[1]}와 맞지 않음`;
    if (y >= x) return '먹은 수가 처음 수보다 많거나 같음';
    if (q.explain !== `남은 것은 처음에서 먹은 만큼을 뺀 거예요. ${x} − ${y} = ${x - y}이니까 ${x - y}${m[3]}예요.`) return `풀이 글: ${q.explain}`;
    return answerWithUnit(q, x - y, m[3] as string);
  }
  return SKIP;
}

function answerWithUnit(q: Question, want: number, unit: string): string | null {
  if (q.answer.t !== 'choice') return '고르기가 아님';
  const parse = (t: string | undefined): number | null => (t?.endsWith(unit) ? num(t.slice(0, -unit.length)) : null);
  if (parse(correctOpt(q).text) !== want) return `답은 ${want}${unit}인데 정답 보기 ${correctOpt(q).text}`;
  const texts = optsOf(q).map((o) => o.text);
  if (new Set(texts).size !== texts.length) return `보기가 겹침: ${texts}`;
  for (const o of wrongOpts(q)) if (parse(o.text) === null || parse(o.text) === want || (parse(o.text) as number) < 1) return `오답 보기 ${o.text}가 이상함`;
  return null;
}

describe('학교 생활', () => {
  for (const id of ['school.timetable', 'game.school.a']) it(id, () => run(id, timetableCheck, { minChecked: 200 }));
  for (const id of ['school.day', 'game.school.b', 'life.routine', 'life.routineTime', 'game.routineMatch']) it(id, () => run(id, dayCheck, { minChecked: 100 }));
  for (const id of ['term.ord', 'term.pos']) it(id, () => run(id, queueCheck, { minChecked: 200 }));
  it('term.word', () => run('term.word', wordCheck, { minChecked: 200 }));
});

// ---------------------------------------------------------------------------
// H. 시계: 정각·30분·디지털·5분 단위·1시간(60분)·몇 시간 뒤·바늘 돌리기·짝 맞추기·아침낮저녁
// ---------------------------------------------------------------------------

interface HM {
  h: number;
  m: number;
}
const hmText = (t: HM): string => (t.m === 0 ? `${t.h}시` : `${t.h}시 ${t.m}분`);
const hmKeyOf = (t: HM | null): string => (t ? `${t.h}:${t.m}` : '?');
const hmFromText = (s: string | undefined): HM | null => {
  const mm = /^(\d+)시(?: (\d+)분)?$/.exec(s ?? '');
  return mm ? { h: Number(mm[1]), m: Number(mm[2] ?? 0) } : null;
};
const hmFromVisual = (v: Visual | undefined): HM | null => (v?.k === 'clock' || v?.k === 'digital' ? { h: v.h, m: v.m } : null);
const hmFromOption = (o: Option): HM | null => hmFromVisual(o.visual) ?? hmFromText(o.text);
const hmSay = (t: HM): string => (t.m === 0 ? `${nativeCounter(t.h)} 시` : `${nativeCounter(t.h)} 시 ${sinoNum(t.m)} 분`);
const wrap12 = (x: number): number => ((((x - 1) % 12) + 12) % 12) + 1;
const TIME_RE = '(\\d+)시(?: (\\d+)분)?';
const hmFrom = (a: string | undefined, b: string | undefined): HM => ({ h: Number(a), m: Number(b ?? 0) });
const sameHM = (a: HM | null | undefined, b: HM | null | undefined): boolean => !!a && !!b && a.h === b.h && a.m === b.m;
const lastWord = (t: string | undefined): string => (t ?? '').split(' ').slice(-1)[0] as string;

/** 질문·도움말·보기·짝 속의 모든 그림 */
function allVisuals(q: Question): Visual[] {
  const out: (Visual | undefined)[] = [q.visual, q.hint?.visual];
  const a = q.answer;
  if (a.t === 'choice') out.push(...a.options.map((o) => o.visual));
  else if (a.t === 'tapTargets' || a.t === 'order') out.push(...a.items.map((i) => i.visual));
  else if (a.t === 'match') for (const p of a.pairs) out.push(p.a.visual, p.b.visual);
  return out.flatMap(flat);
}

/** 모든 시계 그림의 시(1~12)와 분(0~59)이 정수이고 범위 안인지 */
function clockRangeProblem(q: Question): string | null {
  for (const s of allVisuals(q)) {
    if ((s.k === 'clock' || s.k === 'digital') && (!Number.isInteger(s.h) || s.h < 1 || s.h > 12 || !Number.isInteger(s.m) || s.m < 0 || s.m > 59)) return `시계 범위 밖: ${s.h}:${s.m}`;
  }
  return null;
}

/** 시각을 고르는 문제의 보기: 모두 읽을 수 있고, 겹치지 않고, 종류가 같고, 읽어 줄 말이 맞다 */
function timeOptionsProblem(q: Question): string | null {
  const os = optsOf(q);
  const hms = os.map(hmFromOption);
  if (hms.some((x) => x === null)) return `시각이 아닌 보기가 있음: ${os.map((o) => o.text ?? o.visual?.k)}`;
  const keys = hms.map(hmKeyOf);
  if (new Set(keys).size !== keys.length) return `같은 시각의 보기가 겹침: ${keys}`;
  if (new Set(os.map((o) => o.visual?.k ?? 'text')).size !== 1) return '보기의 종류(글·시계·디지털)가 섞임';
  for (const [i, o] of os.entries()) if (o.say !== hmSay(hms[i] as HM)) return `읽어 줄 말 '${o.say}' ≠ '${hmSay(hms[i] as HM)}'`;
  return null;
}

/** 정답 보기가 want와 같은 시각이고 보기가 깨끗한지 */
function pickTimeProblem(q: Question, want: HM): string | null {
  const got = hmFromOption(correctOpt(q));
  if (!sameHM(got, want)) return `답은 ${hmText(want)}인데 정답 보기 ${got ? hmText(got) : '?'}`;
  return timeOptionsProblem(q);
}

/** 보기가 모두 한 가지 종류의 그림(analog 시계 또는 디지털)인지 */
function optionKindProblem(q: Question, kind: 'clock' | 'digital' | 'text'): string | null {
  for (const o of optsOf(q)) if ((o.visual?.k ?? 'text') !== kind) return `보기가 ${kind}가 아님: ${o.visual?.k ?? o.text}`;
  return null;
}

/** 도움말 그림이 있으면 문제의 시각과 같은 시계인지 */
function hintClockProblem(q: Question, want: HM): string | null {
  const hc = flat(q.hint?.visual).find((s) => s.k === 'clock' || s.k === 'digital');
  if (!hc) return null;
  return sameHM(hmFromVisual(hc), want) ? null : `도움말 시계 ${hmKeyOf(hmFromVisual(hc))}가 답 ${hmKeyOf(want)}와 다름`;
}

const modeProblem = (a: { m: number; mode: 'hour' | 'half' | 'five' }): string | null => {
  if (a.mode === 'hour' && a.m !== 0) return `정각 방식인데 분이 ${a.m}`;
  if (a.mode === 'half' && a.m !== 0 && a.m !== 30) return `30분 방식인데 분이 ${a.m}`;
  if (a.mode === 'five' && a.m % 5 !== 0) return `5분 방식인데 분이 ${a.m}`;
  return null;
};

/** 바늘 맞추기 문제의 풀이 글: '세 시는 이렇게 보여요.' 꼴이거나 정각 읽기 풀이 */
function setExplainProblem(q: Question, want: HM): string | null {
  const forms = [`${hmSay(want)}${josa(hmSay(want), '은/는')} 이렇게 보여요.`, `${hmText(want)}${josa(hmText(want), '은/는')} 이렇게 보여요.`, `짧은바늘이 ${want.h}에 있고 긴바늘이 12에 있어서 ${hmSay(want)}예요.`];
  return forms.includes(q.explain ?? '') ? null : `풀이 글: ${q.explain}`;
}

/** 시각을 읽는 문제에서 받아들이는 풀이 글(정각 · 30분 · 5분 단위) */
function readExplainForms(want: HM): string[] {
  const tt = hmText(want);
  const forms: string[] = [];
  if (want.m === 0) forms.push(`짧은바늘이 ${want.h}에 있고 긴바늘이 12에 있어서 ${hmSay(want)}예요.`, `짧은바늘이 ${want.h}에 있고 긴바늘이 12에 있어서 ${withP(tt, '이에요/예요')}.`);
  if (want.m === 30) forms.push(`짧은바늘이 ${want.h}${josa(String(want.h), '과/와')} ${wrap12(want.h + 1)} 사이에 있고 긴바늘이 6에 있어서 ${withP(tt, '이에요/예요')}.`);
  if (want.m !== 0 && want.m % 5 === 0) forms.push(`짧은바늘이 ${want.h}${josa(String(want.h), '을/를')} 지났고 긴바늘이 ${want.m / 5}에 있어서 ${withP(tt, '이에요/예요')}.`);
  return forms;
}

const DIGITAL_MIN = (m: number): string => (m === 0 ? '00' : String(m));
const ANIMAL_NAMES = ['토끼', '곰', '여우', '고양이', '강아지', '다람쥐', '코끼리', '펭귄'];

function clockCheck({ q }: Case): string | null {
  const a = q.answer;
  const p = q.prompt;
  const v = q.visual;
  const bad = clockRangeProblem(q);
  if (bad) return bad;
  let m: RegExpExecArray | null;

  // ---- 시계의 구성 ----
  if (p === '빨간색 바늘의 이름은 무엇일까요?' && a.t === 'choice') {
    if (v?.k !== 'clock' || (v.mark !== 'hour' && v.mark !== 'minute')) return '표시한 바늘이 없음';
    const want = v.mark === 'hour' ? '짧은바늘' : '긴바늘';
    if (correctOpt(q).text !== want) return `빨간 바늘은 ${want}인데 정답 보기 ${correctOpt(q).text}`;
    if (optsOf(q).map((o) => o.text).sort().join() !== ['긴바늘', '짧은바늘'].join()) return '보기가 두 바늘 이름이 아님';
    return q.explain === `빨간색 바늘은 ${withP(want, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '빨간색으로 표시한 숫자는 무엇일까요?' && a.t === 'choice') {
    if (v?.k !== 'clock' || typeof v.mark !== 'number') return '표시한 숫자가 없음';
    if (correctOpt(q).text !== String(v.mark)) return `표시한 숫자는 ${v.mark}인데 정답 보기 ${correctOpt(q).text}`;
    const texts = optsOf(q).map((o) => o.text);
    if (new Set(texts).size !== texts.length) return '보기가 겹침';
    for (const o of optsOf(q)) if (!/^(?:[1-9]|1[0-2])$/.test(o.text ?? '') || o.say !== krSino(Number(o.text))) return `보기 ${o.text}가 이상함`;
    return q.explain === `빨간색 숫자는 ${v.mark}${josa(String(v.mark), '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^시계에서 (맨 위에|맨 아래에|가장 오른쪽에|가장 왼쪽에) 있는 숫자는 무엇일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const want = ({ '맨 위에': 12, '맨 아래에': 6, '가장 오른쪽에': 3, '가장 왼쪽에': 9 } as Record<string, number>)[m[1] as string] as number;
    if (v?.k !== 'clock' || v.hands !== 'none') return '바늘 없는 시계가 아님';
    if (correctOpt(q).text !== String(want)) return `답은 ${want}인데 정답 보기 ${correctOpt(q).text}`;
    const texts = optsOf(q).map((o) => o.text);
    if (new Set(texts).size !== texts.length) return '보기가 겹침';
    return q.explain === `정답은 ${want}${josa(String(want), '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '짧은바늘이 가리키는 숫자는 무엇일까요?' && a.t === 'choice') {
    if (v?.k !== 'clock' || v.m !== 0 || v.mark !== 'hour') return '짧은바늘을 표시한 정각 시계가 아님';
    if (correctOpt(q).text !== String(v.h)) return `짧은바늘은 ${v.h}인데 정답 보기 ${correctOpt(q).text}`;
    const texts = optsOf(q).map((o) => o.text);
    if (new Set(texts).size !== texts.length) return '보기가 겹침';
    return q.explain === `짧은바늘은 ${v.h}${josa(String(v.h), '을/를')} 가리켜요.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^짧은바늘이 (\d+)(을|를) 가리키는 시계는 어느 것일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const n = Number(m[1]);
    if (m[2] !== josa(m[1] as string, '을/를')) return `조사 ${m[2]}가 틀림`;
    const bad2 = pickTimeProblem(q, { h: n, m: 0 });
    if (bad2) return bad2;
    return optionKindProblem(q, 'clock') ?? (optsOf(q).every((o) => (o.visual as { m: number }).m === 0) ? null : '보기에 정각이 아닌 시계가 있음');
  }

  // ---- 읽기 ----
  m = /^지금은 몇 시(?: (\d+)분)?일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    if (v?.k !== 'clock') return '시계 그림이 없음';
    if (m[1] !== undefined && (Number(m[1]) !== 30 || v.m !== 30)) return `글에 쓴 분 ${m[1]}과 시계 ${v.m}분`;
    if (v.m !== 0 && v.m !== 30) return `정각·30분이 아닌 시계 ${v.h}:${v.m}`;
    const want = { h: v.h, m: v.m };
    const bad2 = pickTimeProblem(q, want) ?? optionKindProblem(q, 'text') ?? hintClockProblem(q, want);
    if (bad2) return bad2;
    return readExplainForms(want).includes(q.explain ?? '') ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '지금은 몇 시 몇 분일까요?' && a.t === 'choice') {
    if (v?.k !== 'clock') return '시계 그림이 없음';
    if (v.m % 5 !== 0 || v.m === 0 || v.m === 30) return `5분 단위 문제인데 시계 ${v.h}:${v.m}`;
    const want = { h: v.h, m: v.m };
    const bad2 = pickTimeProblem(q, want) ?? optionKindProblem(q, 'text') ?? hintClockProblem(q, want);
    if (bad2) return bad2;
    const tt = hmText(want);
    return q.explain === `짧은바늘이 ${v.h}${josa(String(v.h), '을/를')} 지났고 긴바늘이 ${v.m / 5}에 있어서 ${withP(tt, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^디지털 시계가 나타내는 시각은 (몇 시|무엇)일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    if (v?.k !== 'digital') return '디지털 시계 그림이 없음';
    if (m[1] === '몇 시' && v.m !== 0) return `'몇 시'인데 분이 ${v.m}`;
    if (v.m !== 0 && v.m !== 30) return `디지털 시계 ${v.h}:${v.m}`;
    const want = { h: v.h, m: v.m };
    const bad2 = pickTimeProblem(q, want) ?? optionKindProblem(q, 'text') ?? hintClockProblem(q, want);
    if (bad2) return bad2;
    if (m[1] === '몇 시' && optsOf(q).some((o) => hmFromOption(o)?.m !== 0)) return '정각 문제에 정각이 아닌 보기';
    const tt = hmText(want);
    const ex = v.m === 0 ? `앞의 숫자가 ${v.h}, 뒤의 숫자가 00이니까 ${tt} 정각이에요.` : `앞의 숫자가 ${v.h}, 뒤의 숫자가 30이니까 ${withP(tt, '이에요/예요')}.`;
    return q.explain === ex ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '숫자가 없는 시계예요. 몇 시일까요?' && a.t === 'choice') {
    if (v?.k !== 'clock' || v.numbers !== false || (v.m !== 0 && v.m !== 30)) return '숫자 없는 정각·30분 시계가 아님';
    const want = { h: v.h, m: v.m };
    const bad2 = pickTimeProblem(q, want) ?? optionKindProblem(q, 'text');
    if (bad2) return bad2;
    const hc = flat(q.hint?.visual).find((s) => s.k === 'clock');
    if (hc?.k === 'clock' && hc.numbers === false) return '도움말 시계에도 숫자가 없음';
    return readExplainForms(want).includes(q.explain ?? '') ? null : `풀이 글: ${q.explain}`;
  }
  m = new RegExp(`^${TIME_RE}(을|를) 나타내는 (디지털 )?시계는 어느 것일까요\\?$`).exec(p);
  if (m && a.t === 'choice') {
    const want = hmFrom(m[1], m[2]);
    if (m[3] !== josa(hmText(want), '을/를')) return `조사 ${m[3]}가 틀림`;
    const digital = m[4] !== undefined;
    const bad2 = pickTimeProblem(q, want) ?? optionKindProblem(q, digital ? 'digital' : 'clock') ?? hintClockProblem(q, want);
    if (bad2) return bad2;
    if (v) return '이 질문에는 그림이 없어야 함';
    if (digital) {
      const tt = hmText(want);
      const forms = [`앞의 숫자가 ${want.h}, 뒤의 숫자가 ${DIGITAL_MIN(want.m)}이니까 ${want.m === 0 ? `${tt} 정각이에요.` : `${withP(tt, '이에요/예요')}.`}`, `${tt}${josa(tt, '은/는')} 앞의 숫자가 ${want.h}이고 뒤의 숫자가 ${DIGITAL_MIN(want.m)}인 시계예요.`];
      return forms.includes(q.explain ?? '') ? null : `풀이 글: ${q.explain}`;
    }
    return readExplainForms(want).includes(q.explain ?? '') ? null : `풀이 글: ${q.explain}`;
  }
  m = /^(디지털 )?시계와 같은 시각을 나타내는 (디지털 )?시계는 어느 것일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const fromDigital = m[1] !== undefined;
    if (fromDigital === (m[2] !== undefined)) return '문장이 이상함';
    if (v?.k !== (fromDigital ? 'digital' : 'clock')) return `문제 그림이 ${fromDigital ? '디지털' : '아날로그'} 시계가 아님`;
    const want = { h: v.h, m: v.m };
    const bad2 = pickTimeProblem(q, want) ?? optionKindProblem(q, fromDigital ? 'clock' : 'digital') ?? hintClockProblem(q, want);
    if (bad2) return bad2;
    const tt = hmText(want);
    const forms = [`${tt}${josa(tt, '은/는')} 디지털 시계로 ${want.h}:${DIGITAL_MIN(want.m)}이라고 써요.`, ...readExplainForms(want)];
    return forms.includes(q.explain ?? '') ? null : `풀이 글: ${q.explain}`;
  }
  m = /^(정각|30분)인 (디지털 )?시계를 모두 (찾아 눌러|터뜨려) 보세요\.$/.exec(p);
  if (m && a.t === 'tapTargets') {
    const wantMin = m[1] === '정각' ? 0 : 30;
    const kind = m[2] ? 'digital' : 'clock';
    const hms = a.items.map((it) => hmFromVisual(it.visual));
    if (hms.some((x) => x === null) || a.items.some((it) => it.visual?.k !== kind)) return '시계 그림이 아닌 칸이 있음';
    if (hms.some((x) => (x as HM).m !== 0 && (x as HM).m !== 30)) return '정각·30분이 아닌 시계';
    const keys = hms.map(hmKeyOf);
    if (new Set(keys).size !== keys.length) return `같은 시각이 겹침: ${keys}`;
    const got = [...a.targets].sort().join();
    const want = a.items.filter((_, i) => (hms[i] as HM).m === wantMin).map((it) => it.key).sort().join();
    if (got !== want || a.targets.length < 1 || a.targets.length >= a.items.length) return `${m[1]}인 시계는 ${want}인데 정답 ${got}`;
    for (const [i, it] of a.items.entries()) if (it.say !== hmSay(hms[i] as HM)) return `읽어 줄 말 ${it.say}`;
    if (a.need !== 'all') return '모두 찾기가 아님';
    return null;
  }
  if (p === '긴바늘은 어느 숫자를 가리키고 있을까요?' && a.t === 'choice') {
    if (v?.k !== 'clock' || v.mark !== 'minute' || (v.m !== 0 && v.m !== 30)) return '긴바늘을 표시한 정각·30분 시계가 아님';
    const want = v.m === 30 ? '6' : '12';
    if (correctOpt(q).text !== want) return `긴바늘은 ${want}을 가리키는데 정답 보기 ${correctOpt(q).text}`;
    if (optsOf(q).map((o) => o.text).sort().join() !== ['12', '6'].sort().join()) return '보기가 12와 6이 아님';
    return q.explain === (v.m === 30 ? '긴바늘이 6을 가리켜요. 긴바늘이 6이면 30분이에요.' : '긴바늘이 12를 가리켜요. 긴바늘이 12이면 정각이에요.') ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '이 시계는 정각일까요, 30분일까요?' && a.t === 'choice') {
    if (v?.k !== 'clock' || (v.m !== 0 && v.m !== 30)) return '정각·30분 시계가 아님';
    const want = v.m === 30 ? '30분' : '정각';
    if (correctOpt(q).text !== want) return `${want}인데 정답 보기 ${correctOpt(q).text}`;
    if (optsOf(q).map((o) => o.text).sort().join() !== ['30분', '정각'].sort().join()) return '보기가 정각과 30분이 아님';
    return q.explain === (v.m === 30 ? '긴바늘이 6을 가리켜요. 긴바늘이 6이면 30분이에요.' : '긴바늘이 12를 가리켜요. 긴바늘이 12이면 정각이에요.') ? null : `풀이 글: ${q.explain}`;
  }
  // 5분 단위: 긴바늘이 N을 가리켜요
  m = /^긴바늘이 (\d+)(을|를) 가리켜요\. 몇 분일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const k = Number(m[1]);
    if (m[2] !== josa(m[1] as string, '을/를')) return `조사 ${m[2]}가 틀림`;
    if (v?.k !== 'clock' || v.m !== k * 5 || v.mark !== 'minute') return `긴바늘이 ${k}인 시계가 아님: ${v?.k === 'clock' ? v.m : '?'}`;
    const parse = (t: string | undefined): number | null => (t?.endsWith('분') ? num(t.slice(0, -1)) : null);
    if (parse(correctOpt(q).text) !== k * 5) return `답은 ${k * 5}분인데 정답 보기 ${correctOpt(q).text}`;
    const texts = optsOf(q).map((o) => o.text);
    if (new Set(texts).size !== texts.length) return '보기가 겹침';
    for (const o of optsOf(q)) if (parse(o.text) === null || (parse(o.text) as number) < 1 || (parse(o.text) as number) > 59 || o.say !== o.text) return `보기 ${o.text}가 이상함`;
    return q.explain === `긴바늘이 ${k}에 있으면 5씩 ${k}번 뛰어 세어서 ${k * 5}분이에요.` ? null : `풀이 글: ${q.explain}`;
  }

  // ---- 바늘 맞추기 ----
  if (a.t === 'clockSet') {
    const badMode = modeProblem(a);
    if (badMode) return badMode;
    const want = { h: a.h, m: a.m };
    const bad2 = /시간 (뒤|전)(으로|로) 시계를 맞춰 보세요\.$/.test(p) ? null : hintClockProblem(q, want);
    if (bad2) return bad2;
    m = new RegExp(`^${TIME_RE}(이|가) 되도록 (시계를 맞춰|짧은바늘을 움직여) 보세요\\.$`).exec(p);
    if (m) {
      const t = hmFrom(m[1], m[2]);
      if (!sameHM(t, want)) return `글은 ${hmText(t)}인데 정답 ${hmText(want)}`;
      if (m[3] !== josa(hmText(t), '이/가')) return `조사 ${m[3]}가 틀림`;
      if (m[4] === '짧은바늘을 움직여' && (a.mode !== 'hour' || a.m !== 0)) return '짧은바늘만 움직이는 문제는 정각이어야 함';
      if (v && !(v.k === 'digital' && sameHM(hmFromVisual(v), want))) return `그림 ${hmKeyOf(hmFromVisual(v))}이 글과 다름`;
      return setExplainProblem(q, want);
    }
    if (p === '디지털 시계와 같은 시각이 되도록 아날로그 시계를 맞춰 보세요.' || p === '디지털 시계가 알려 주는 시각에 맞게 바늘을 돌려 보세요.') {
      if (v?.k !== 'digital' || !sameHM(hmFromVisual(v), want)) return `디지털 ${hmKeyOf(hmFromVisual(v))}이 정답 ${hmText(want)}와 다름`;
      return setExplainProblem(q, want);
    }
    m = new RegExp(`^(\\S+?)(이|가) ${TIME_RE}에 (.+)\\. 시계를 ${TIME_RE}(으로|로) 맞춰 보세요\\.$`).exec(p);
    if (m) {
      const t1 = hmFrom(m[3], m[4]);
      const t2 = hmFrom(m[6], m[7]);
      if (!sameHM(t1, want) || !sameHM(t2, want)) return `글의 시각 ${hmText(t1)}·${hmText(t2)}과 정답 ${hmText(want)}이 다름`;
      if (!ANIMAL_NAMES.includes(m[1] as string)) return `알 수 없는 이름 ${m[1]}`;
      if (m[2] !== josa(m[1] as string, '이/가')) return `이름 조사 ${m[2]}가 틀림`;
      if (m[8] !== josa(hmText(want), '으로/로')) return `조사 ${m[8]}가 틀림`;
      if (v) return '이 질문에는 그림이 없어야 함';
      return setExplainProblem(q, want);
    }
    m = /^짧은바늘이 (\d+)(을|를) 가리키게 돌려 보세요\.$/.exec(p);
    if (m) {
      if (Number(m[1]) !== a.h || a.m !== 0 || a.mode !== 'hour') return `글 ${m[1]}과 정답 ${hmText(want)}이 다름`;
      if (m[2] !== josa(m[1] as string, '을/를')) return `조사 ${m[2]}가 틀림`;
      return q.explain === `짧은바늘이 ${a.h}에 오도록 맞추면 돼요.` ? null : `풀이 글: ${q.explain}`;
    }
    m = new RegExp(`^${TIME_RE}에서 (\\d+)시간 (뒤|전)(으로|로) 시계를 맞춰 보세요\\.$`).exec(p);
    if (m) {
      const start = hmFrom(m[1], m[2]);
      const n = Number(m[3]);
      const later = m[4] === '뒤';
      const end = { h: wrap12(start.h + (later ? n : -n)), m: start.m };
      if (v?.k !== 'clock' || !sameHM(hmFromVisual(v), start)) return `그림 ${hmKeyOf(hmFromVisual(v))}이 글 ${hmText(start)}과 다름`;
      if (!sameHM(end, want)) return `${hmText(start)}에서 ${n}시간 ${m[4]}는 ${hmText(end)}인데 정답 ${hmText(want)}`;
      if (m[5] !== josa(m[4] as string, '으로/로')) return `조사 ${m[5]}가 틀림`;
      if (n < 1 || n > 3) return `시간 ${n}`;
      const hc = flat(q.hint?.visual).filter((s) => s.k === 'clock');
      if (hc.length !== 2 || !sameHM(hmFromVisual(hc[0]), start) || !sameHM(hmFromVisual(hc[1]), end)) return '도움말 그림이 시작·끝 시각과 다름';
      return q.explain === `${hmText(start)}에서 ${n}시간 ${m[4]}${josa(m[4] as string, '은/는')} ${withP(hmText(end), '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
    }
    return SKIP;
  }

  // ---- 짝 맞추기 ----
  if (a.t === 'match' && (p === '아날로그 시계와 같은 시각의 디지털 시계를 이어 보세요.' || p === '시계와 시각을 알맞게 이어 보세요.' || p === '아날로그 시계와 디지털 시계를 알맞게 이어 보세요.')) {
    const seen: string[] = [];
    for (const pr of a.pairs) {
      const x = hmFromVisual(pr.a.visual);
      if (!x || pr.a.visual?.k !== 'clock') return '왼쪽이 아날로그 시계가 아님';
      let y: HM | null;
      if (p.startsWith('아날로그 시계와 같은')) y = pr.b.visual?.k === 'digital' ? hmFromVisual(pr.b.visual) : null;
      else if (p === '시계와 시각을 알맞게 이어 보세요.') y = hmFromText(pr.b.text);
      else {
        const mm = /^(\d+):(00|30)$/.exec(pr.b.text ?? '');
        y = mm ? { h: Number(mm[1]), m: Number(mm[2]) } : null;
      }
      if (!sameHM(x, y)) return `시계 ${hmKeyOf(x)}에 이은 짝 ${hmKeyOf(y)}`;
      if (x.m !== 0 && x.m !== 30) return `정각·30분이 아님: ${hmKeyOf(x)}`;
      if (pr.key !== `t${x.h}-${x.m}`) return `짝 이름 ${pr.key}`;
      seen.push(hmKeyOf(x));
    }
    if (new Set(seen).size !== seen.length) return `같은 시각이 겹침: ${seen}`;
    if (a.pairs.length < 3 || a.pairs.length > 5) return `짝 수 ${a.pairs.length}`;
    return null;
  }

  // ---- 1시간은 60분 ----
  if (p === '1시간은 몇 분일까요?' && a.t === 'choice') {
    if (v?.k !== 'clock' || v.m !== 0 || v.mark !== 'minute') return '긴바늘을 표시한 정각 시계가 아님';
    if (correctOpt(q).text !== '60분') return `정답 보기 ${correctOpt(q).text}`;
    if (wrongOpts(q).some((o) => !/^\d+분$/.test(o.text ?? '') || o.text === '60분')) return '오답 보기가 이상함';
    return q.explain === '긴바늘이 한 바퀴 도는 데 60분이 걸려요. 60분이 1시간이에요.' ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '긴바늘이 한 바퀴 돌면 시간이 얼마나 지났을까요?' && a.t === 'choice') {
    if (v?.k !== 'row' || v.items.length !== 3) return '그림이 시계-화살표-시계가 아님';
    const [c1, mid, c2] = v.items as [Visual, Visual, Visual];
    if (c1.k !== 'clock' || c2.k !== 'clock' || mid.k !== 'big' || c1.m !== 0 || c2.m !== 0 || c2.h !== wrap12(c1.h + 1)) return `한 시간 뒤 모습이 아님: ${JSON.stringify([c1, c2])}`;
    if (correctOpt(q).key !== 'one' || correctOpt(q).text !== '1시간') return `정답 보기 ${correctOpt(q).text}`;
    const texts = optsOf(q).map((o) => o.text);
    if (new Set(texts).size !== texts.length || texts.sort().join() !== ['1시간', '2시간', '30분'].sort().join()) return `보기 ${texts}`;
    return q.explain === '긴바늘이 한 바퀴 돌면 60분, 곧 1시간이 지난 거예요.' ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '30분과 30분을 합치면 모두 몇 분일까요?' && a.t === 'choice') {
    if (v?.k !== 'row' || v.items.length !== 3) return '그림이 시계+시계가 아님';
    const [c1, mid, c2] = v.items as [Visual, Visual, Visual];
    if (c1.k !== 'clock' || c2.k !== 'clock' || mid.k !== 'big' || mid.text !== '+' || c1.m !== 30 || c2.m !== 30) return `30분 시계 둘이 아님: ${JSON.stringify([c1, c2])}`;
    if (correctOpt(q).text !== '60분') return `정답 보기 ${correctOpt(q).text}`;
    if (wrongOpts(q).some((o) => !/^\d+분$/.test(o.text ?? '') || o.text === '60분')) return '오답 보기가 이상함';
    return q.explain === '30분 + 30분 = 60분이고, 60분은 1시간이에요.' ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '60분은 몇 시간일까요?' && a.t === 'choice') {
    if (v?.k !== 'clock' || v.m !== 0 || v.mark !== 'minute') return '긴바늘을 표시한 정각 시계가 아님';
    if (correctOpt(q).text !== '1시간') return `정답 보기 ${correctOpt(q).text}`;
    const texts = optsOf(q).map((o) => o.text);
    if (new Set(texts).size !== texts.length || texts.sort().join() !== ['1시간', '2시간', '30분'].sort().join()) return `보기 ${texts}`;
    if (q.say !== '육십 분은 몇 시간일까요?') return `읽어 줄 말 ${q.say}`;
    return q.explain === '60분은 1시간이에요.' ? null : `풀이 글: ${q.explain}`;
  }
  m = /^(1시간은 몇 분일까요|긴바늘이 한 바퀴를 도는 데 걸리는 시간은 몇 분일까요|긴바늘이 (\d+)에서 출발해 한 바퀴를 돌아 다시 \2에 왔어요\. 몇 분이 지났을까요)\? 숫자를 눌러 알려 주세요\.$/.exec(p);
  if (m && a.t === 'number') {
    if (a.correct !== 60 || a.maxDigits < 2) return `정답 ${a.correct}, 자릿수 ${a.maxDigits}`;
    if (v?.k !== 'clock' || v.mark !== 'minute') return '긴바늘을 표시한 시계가 아님';
    if (m[2] !== undefined && v.m !== (Number(m[2]) % 12) * 5) return `긴바늘이 ${m[2]}에서 출발했는데 시계 분 ${v.m}`;
    if (m[2] === undefined && v.m !== 0) return `정각 시계가 아님: ${v.m}`;
    return q.explain === '1시간은 60분이에요.' ? null : `풀이 글: ${q.explain}`;
  }

  // ---- 몇 시간 뒤·전 ----
  m = new RegExp(`^${TIME_RE}에서 (\\d+)시간 (뒤|전)(은|는) 몇 시(?: 몇 분)?일까요\\?$`).exec(p);
  if (m && a.t === 'choice') {
    const start = hmFrom(m[1], m[2]);
    const n = Number(m[3]);
    const later = m[4] === '뒤';
    const end = { h: wrap12(start.h + (later ? n : -n)), m: start.m };
    if (m[5] !== josa(m[4] as string, '은/는')) return `조사 ${m[5]}가 틀림`;
    if (n !== 1) return `시간 ${n}`;
    if ((start.m === 30) !== p.endsWith('몇 시 몇 분일까요?')) return '묻는 말과 시각 모양이 맞지 않음';
    if (v?.k !== 'clock' || !sameHM(hmFromVisual(v), start)) return `그림 ${hmKeyOf(hmFromVisual(v))}이 글 ${hmText(start)}과 다름`;
    const bad2 = pickTimeProblem(q, end) ?? optionKindProblem(q, 'text');
    if (bad2) return bad2;
    const hc = flat(q.hint?.visual).filter((s) => s.k === 'clock');
    if (hc.length !== 2 || !sameHM(hmFromVisual(hc[0]), start) || !sameHM(hmFromVisual(hc[1]), end)) return '도움말 그림이 시작·끝 시각과 다름';
    return q.explain === `${hmText(start)}에서 ${n}시간 ${m[4]}${josa(m[4] as string, '은/는')} ${withP(hmText(end), '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  return SKIP;
}

// 아침·낮·저녁 --------------------------------------------------------------

const DAYPART_OF: Record<string, string> = {
  '알람 소리에 일어나요': '아침',
  '아침밥을 먹어요': '아침',
  '학교에 가요': '아침',
  '점심을 먹어요': '낮',
  '운동장에서 놀아요': '낮',
  '해가 하늘 높이 떠 있어요': '낮',
  '저녁밥을 먹어요': '저녁',
  '해가 져요': '저녁',
  '달과 별이 떠요': '밤',
  '잠을 자요': '밤',
};
const PART_EMOJI: Record<string, string> = { 아침: '🌅', 낮: '☀️', 저녁: '🌇', 밤: '🌙' };

function daypartCheck({ q }: Case): string | null {
  const a = q.answer;
  const p = q.prompt;
  const v = q.visual;
  let m: RegExpExecArray | null;
  if (a.t === 'order' && p === '하루는 어떤 순서로 지나갈까요? 먼저인 것부터 눌러 보세요.') {
    const names = a.correct.map((k) => lastWord(a.items.find((it) => it.key === k)?.text));
    if (names.join() !== '아침,낮,저녁') return `순서 ${names}`;
    for (const it of a.items) if (it.text !== `${PART_EMOJI[lastWord(it.text)]} ${lastWord(it.text)}` || it.say !== lastWord(it.text)) return `보기 ${it.text}`;
    return a.items.length === 3 && q.explain === '아침, 낮, 저녁 순서로 하루가 지나가요.' ? null : `풀이 글: ${q.explain}`;
  }
  m = /^(아침|낮|저녁) (다음에는 언제가 올까요|바로 앞은 언제일까요)\?$/.exec(p);
  if (m && a.t === 'choice') {
    const seq = ['아침', '낮', '저녁'];
    const i = seq.indexOf(m[1] as string);
    const j = i + (m[2]?.startsWith('다음') ? 1 : -1);
    if (j < 0 || j > 2) return '앞이나 뒤가 없음';
    const want = seq[j] as string;
    if (v?.k !== 'big' || v.text !== PART_EMOJI[m[1] as string] || v.sub !== m[1]) return `그림 ${JSON.stringify(v)}`;
    if (lastWord(correctOpt(q).text) !== want) return `답은 ${want}인데 정답 보기 ${correctOpt(q).text}`;
    for (const o of optsOf(q)) if (o.text !== `${PART_EMOJI[lastWord(o.text)]} ${lastWord(o.text)}` || o.say !== lastWord(o.text)) return `보기 ${o.text}`;
    if (optsOf(q).map((o) => lastWord(o.text)).sort().join() !== [...seq].sort().join()) return '보기가 아침·낮·저녁이 아님';
    return q.explain === `${want}${josa(want, '이에요/예요')}. 아침, 낮, 저녁 순서예요.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^(.+)\. 하루 중 언제일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const want = DAYPART_OF[m[1] as string];
    if (!want) return `알 수 없는 활동 ${m[1]}`;
    if (v?.k !== 'big' || v.sub !== m[1]) return `그림 ${JSON.stringify(v)}`;
    if (correctOpt(q).text !== want) return `${m[1]}은 ${want}인데 정답 보기 ${correctOpt(q).text}`;
    const names = optsOf(q).map((o) => o.text);
    const level3 = q.level === 3;
    if (names.sort().join() !== (level3 ? ['낮', '밤', '아침', '저녁'] : ['낮', '아침', '저녁']).join()) return `보기 ${names}`;
    if (!level3 && want === '밤') return '1·2단계에 밤 문제가 나옴';
    return q.explain === `${want}${josa(want, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  return SKIP;
}

// 하루 카드 ------------------------------------------------------------------

const CARD_ORDER = ['일어나요', '아침밥을 먹어요', '학교에 가요', '점심을 먹어요', '친구와 놀아요', '집에 돌아와요', '저녁밥을 먹어요', '씻어요', '잠을 자요'];
const CARD_EMOJI: Record<string, string> = { 일어나요: '⏰', '아침밥을 먹어요': '🍚', '학교에 가요': '🎒', '점심을 먹어요': '🍱', '친구와 놀아요': '⚽', '집에 돌아와요': '🏠', '저녁밥을 먹어요': '🍲', 씻어요: '🛁', '잠을 자요': '😴' };

function dayCardsCheck({ q }: Case): string | null {
  const a = q.answer;
  if (a.t !== 'order' || q.prompt !== '하루에 일어나는 일을 먼저 하는 것부터 차례대로 눌러 보세요.') return SKIP;
  const label = (t: string | undefined): string => (t ?? '').split(' ').slice(1).join(' ');
  for (const it of a.items) if (CARD_EMOJI[label(it.text)] !== (it.text ?? '').split(' ')[0] || it.say !== label(it.text)) return `카드 ${it.text}의 그림이 이름과 맞지 않음`;
  const present = a.items.map((it) => label(it.text));
  const want = CARD_ORDER.filter((x) => present.includes(x));
  if (want.length !== present.length || a.correct.length !== present.length) return '카드 구성이 맞지 않음';
  const got = a.correct.map((k) => label(a.items.find((it) => it.key === k)?.text));
  if (got.join() !== want.join()) return `하루 순서는 ${want}인데 정답 ${got}`;
  if (![3, 4, 5].includes(present.length)) return `카드 수 ${present.length}`;
  return q.explain === `${want.join(', ')} 순서예요.` ? null : `풀이 글: ${q.explain}`;
}

/** 시각을 고르거나 맞추는 문제의 정답 시(1~12) */
function mainHours(q: Question): number[] {
  const a = q.answer;
  if (a.t === 'clockSet') return [a.h];
  if (a.t === 'choice') {
    const t = hmFromOption(correctOpt(q));
    return t ? [t.h] : [];
  }
  if (a.t === 'match') return a.pairs.map((pr) => hmFromVisual(pr.a.visual)?.h ?? -1);
  return [];
}

/** 어느 단계에서도 스킬이 정한 시(時) 범위 안의 시각만 나오는지 */
const withHours = (hours: number[], check: Check): Check => (c) => {
  const r = check(c);
  if (r !== null) return r;
  const out = mainHours(c.q).filter((h) => !hours.includes(h));
  return out.length ? `이 스킬의 시각(${hours[0]}~${hours[hours.length - 1]}시)이 아닌 ${out}시` : null;
};

describe('시계', () => {
  const H = (a: number, b: number): number[] => range(a, b);
  it('clk.parts', () => run('clk.parts', clockCheck));
  it('clk.hourHand', () => run('clk.hourHand', clockCheck));
  for (const [id, hours] of [['clk.hour.a', H(1, 3)], ['clk.hour.b', H(4, 6)], ['clk.hour.c', H(7, 12)]] as [string, number[]][]) it(id, () => run(id, withHours(hours, clockCheck)));
  for (const [id, hours] of [['game.hands.time.a', H(1, 3)], ['game.hands.time.b', H(4, 6)], ['game.hands.time.c', H(7, 12)], ['game.hands.point.a', [12, 3, 6, 9]], ['game.hands.point.b', H(1, 12)]] as [string, number[]][]) it(id, () => run(id, withHours(hours, clockCheck)));
  for (const [id, hours] of [['game.hands.half.a', H(1, 6)], ['game.hands.half.b', H(7, 12)], ['game.clockMatch.b', H(1, 6)], ['game.clockMatch.half.a', H(1, 6)], ['game.clockMatch.half.b', H(1, 12)]] as [string, number[]][]) it(id, () => run(id, withHours(hours, clockCheck)));
  it('time.daypart', () => run('time.daypart', daypartCheck));
  it('game.dayCards', () => run('game.dayCards', dayCardsCheck, { minChecked: 200 }));
  for (const id of ['clk.digital.hour', 'clk.digital.half', 'clk.digital.pick', 'clk.match.mix', 'clk.set.digital', 'game.balloons.digital', 'game.clockMatch.digital', 'game.hands.digital']) it(id, () => run(id, clockCheck));
  for (const id of ['clk.five.read', 'clk.five.set', 'game.hands.five', 'time.hour60', 'time.after']) it(id, () => run(id, clockCheck));
  for (const id of ['clk.total.hour', 'clk.total.half', 'clk.total.set', 'game.hands.total', 'game.clockMatch.total', 'clk.set.half', 'clk.half.see', 'game.balloons.halfSee']) it(id, () => run(id, clockCheck));
});

// ---------------------------------------------------------------------------
// I. 달력: 요일·열두 달·달력 구조·일주일/한 달/일 년·기념일·며칠 뒤·날짜 보물찾기·기차
// ---------------------------------------------------------------------------

const WD_SHORT = ['일', '월', '화', '수', '목', '금', '토'];
const WD_LONG = WD_SHORT.map((x) => `${x}요일`);
/** 그 달의 날수·요일은 생성기와 따로 JS Date로 센다 */
const dimOf = (y: number, mo: number): number => new Date(y, mo, 0).getDate();
const wdAt = (y: number, mo: number, d: number): number => new Date(y, mo - 1, d).getDay();
const HOLIDAY_DATES: Record<string, [number, number]> = { 삼일절: [3, 1], 어린이날: [5, 5], 광복절: [8, 15], 개천절: [10, 3], 한글날: [10, 9], 크리스마스: [12, 25] };
/** 오늘보다 이른 달은 내년 달력을 쓴다 */
const calYear = (env: Env, mo: number): number => (mo >= env.today.m ? env.today.y : env.today.y + 1);
const wrapM = (x: number): number => ((((x - 1) % 12) + 12) % 12) + 1;

/** 행사 이름 → [월, 일] (가족 행사 먼저, 없으면 기본 기념일) */
function eventDate(env: Env, label: string): [number, number] | null {
  const fam = env.events.find((e) => e.label.trim().slice(0, 10) === label);
  if (fam) return [fam.month, fam.day];
  return HOLIDAY_DATES[label] ?? null;
}

function wdChoiceProblem(q: Question, want: number): string | null {
  if (correctOpt(q).text !== WD_LONG[want]) return `답은 ${WD_LONG[want]}인데 정답 보기 ${correctOpt(q).text}`;
  const texts = optsOf(q).map((o) => o.text);
  if (new Set(texts).size !== texts.length) return `보기가 겹침: ${texts}`;
  for (const o of optsOf(q)) if (!WD_LONG.includes(o.text ?? '') || o.say !== o.text || o.key !== String(WD_LONG.indexOf(o.text ?? ''))) return `보기 ${o.text}가 이상함`;
  return null;
}

function monthChoiceProblem(q: Question, want: number): string | null {
  const parse = (t: string | undefined): number | null => (/^\d+월$/.test(t ?? '') ? num((t as string).slice(0, -1)) : null);
  if (parse(correctOpt(q).text) !== want) return `답은 ${want}월인데 정답 보기 ${correctOpt(q).text}`;
  const texts = optsOf(q).map((o) => o.text);
  if (new Set(texts).size !== texts.length) return `보기가 겹침: ${texts}`;
  for (const o of optsOf(q)) {
    const n = parse(o.text);
    if (n === null || n < 1 || n > 12 || o.key !== String(n)) return `보기 ${o.text}가 이상함`;
  }
  return null;
}

function dayChoiceProblem(q: Question, want: number, dim: number): string | null {
  const parse = (t: string | undefined): number | null => (/^\d+일$/.test(t ?? '') ? num((t as string).slice(0, -1)) : null);
  if (parse(correctOpt(q).text) !== want) return `답은 ${want}일인데 정답 보기 ${correctOpt(q).text}`;
  const texts = optsOf(q).map((o) => o.text);
  if (new Set(texts).size !== texts.length) return `보기가 겹침: ${texts}`;
  for (const o of optsOf(q)) {
    const n = parse(o.text);
    if (n === null || n < 1 || n > dim || o.key !== String(n)) return `보기 ${o.text}가 이상함(이 달은 ${dim}일까지)`;
  }
  return null;
}

function countChoiceProblem(q: Question, want: number, unit: string): string | null {
  const parse = (t: string | undefined): number | null => (t?.endsWith(unit) ? num(t.slice(0, -unit.length)) : null);
  if (parse(correctOpt(q).text) !== want) return `답은 ${want}${unit}인데 정답 보기 ${correctOpt(q).text}`;
  const texts = optsOf(q).map((o) => o.text);
  if (new Set(texts).size !== texts.length) return `보기가 겹침: ${texts}`;
  for (const o of optsOf(q)) if (parse(o.text) === null || (parse(o.text) as number) < 1) return `보기 ${o.text}가 이상함`;
  return null;
}

/** 달력을 눌러 답하는 문제: 해·달·눌러야 할 날·표시가 맞는지 */
function calTapProblem(q: Question, want: { year: number; month: number; targets: number[]; need: 'one' | 'all'; marks?: Record<number, string> }): string | null {
  const a = q.answer;
  if (a.t !== 'calTap') return '달력 누르기가 아님';
  if (a.year !== want.year || a.month !== want.month) return `달력 ${a.year}-${a.month}인데 ${want.year}-${want.month}이어야 함`;
  const dim = dimOf(a.year, a.month);
  if (a.targets.some((d) => d < 1 || d > dim)) return `눌러야 할 날 ${a.targets}이 이 달(${dim}일까지) 밖`;
  if ([...a.targets].sort((x, y) => x - y).join() !== [...want.targets].sort((x, y) => x - y).join()) return `눌러야 할 날은 ${want.targets}인데 정답 ${a.targets}`;
  if (a.need !== want.need) return `need ${a.need}`;
  const marks = (a.marks ?? {}) as Record<number, string>;
  if (want.marks) {
    for (const [d, k] of Object.entries(want.marks)) if (marks[Number(d)] !== k) return `${d}일의 표시 ${marks[Number(d)]}이 ${k}이어야 함`;
  }
  for (const d of Object.keys(marks)) if (Number(d) < 1 || Number(d) > dim) return `표시한 날 ${d}이 달 밖`;
  return null;
}

function calendarCheck({ q, env }: Case): string | null {
  const a = q.answer;
  const p = q.prompt;
  const v = q.visual;
  const T = env.today;
  let m: RegExpExecArray | null;
  const cal = flat(v).find((s): s is Extract<Visual, { k: 'calendar' }> => s.k === 'calendar');
  const wk = v?.k === 'weekdays' ? v : undefined;
  const mo = v?.k === 'months' ? v : undefined;
  const josaP = (w: string, kind: Parameters<typeof josa>[1]): string => `${w}${josa(w, kind)}`;

  // ---- 요일 이름 ----
  if (p === '빨간 칸은 무슨 요일일까요?' && a.t === 'choice') {
    if (wk?.highlight === undefined || wk.names !== 'short') return '요일 줄이 없음';
    const i = wk.highlight;
    return wdChoiceProblem(q, i) ?? (q.explain === `${WD_SHORT[i]}에 요일을 붙여서 ${WD_LONG[i]}이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\S+요일)을 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'tapTargets') {
    const i = WD_LONG.indexOf(m[1] as string);
    if (i < 0) return `알 수 없는 요일 ${m[1]}`;
    if (a.items.length !== 7 || a.items.some((it) => it.text !== WD_SHORT[Number(it.key)] || it.say !== WD_LONG[Number(it.key)])) return '요일 칸이 이상함';
    if (new Set(a.items.map((it) => it.key)).size !== 7) return '요일 칸이 겹침';
    if (a.targets.join() !== String(i) || a.need !== 'one') return `정답 ${a.targets}`;
    if (q.hint?.say !== `${WD_LONG[i]}은 ${WD_SHORT[i]}${josa(WD_SHORT[i] as string, '이라고/라고')} 써요.`) return `도움말 ${q.hint?.say}`;
    return q.explain === `${WD_LONG[i]}은 ${WD_SHORT[i]}${josa(WD_SHORT[i] as string, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`;
  }
  m = /^(\S+요일)과 (\S+요일)을 모두 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'tapTargets') {
    const i = WD_LONG.indexOf(m[1] as string);
    const j = WD_LONG.indexOf(m[2] as string);
    if (i < 0 || j < 0 || i === j) return '요일 이름이 이상함';
    if (a.items.length !== 7 || a.items.some((it) => it.text !== WD_LONG[Number(it.key)] || it.say !== WD_LONG[Number(it.key)])) return '요일 칸이 이상함';
    if ([...a.targets].sort().join() !== [String(i), String(j)].sort().join() || a.need !== 'all') return `정답 ${a.targets}`;
    return q.explain === `${m[1]}과 ${m[2]}이에요.` ? null : `풀이 글: ${q.explain}`;
  }

  // ---- 요일 순서 ----
  m = /^(\S+요일) 다음 날은 무슨 요일일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const i = WD_LONG.indexOf(m[1] as string);
    if (wk?.highlight !== i) return `그림의 표시 ${wk?.highlight}가 글 ${m[1]}과 다름`;
    const j = (i + 1) % 7;
    const forms = [`${WD_LONG[i]} 다음 날은 ${josaP(WD_LONG[j] as string, '이에요/예요')}.`, `정답은 ${josaP(WD_LONG[j] as string, '이에요/예요')}.`];
    return wdChoiceProblem(q, j) ?? (forms.includes(q.explain ?? '') ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '빈칸에 들어갈 요일은 무엇일까요?' && a.t === 'choice') {
    if (wk?.hide?.length !== 1) return '빈칸이 하나가 아님';
    const i = wk.hide[0] as number;
    return wdChoiceProblem(q, i) ?? (q.explain === `빈칸은 ${josaP(WD_LONG[i] as string, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\S+요일) 바로 전 날은 무슨 요일일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const i = WD_LONG.indexOf(m[1] as string);
    if (wk?.highlight !== i) return `그림의 표시 ${wk?.highlight}가 글 ${m[1]}과 다름`;
    const j = (i + 6) % 7;
    return wdChoiceProblem(q, j) ?? (q.explain === `정답은 ${josaP(WD_LONG[j] as string, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\S+요일)에서 이틀 뒤는 무슨 요일일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const i = WD_LONG.indexOf(m[1] as string);
    if (wk?.highlight !== i) return `그림의 표시 ${wk?.highlight}가 글 ${m[1]}과 다름`;
    const j = (i + 2) % 7;
    return wdChoiceProblem(q, j) ?? (q.explain === `정답은 ${josaP(WD_LONG[j] as string, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }

  // ---- 열두 달 ----
  if (p === '표시된 달은 몇 월일까요?' && a.t === 'choice') {
    if (mo?.highlight === undefined) return '표시한 달이 없음';
    return monthChoiceProblem(q, mo.highlight) ?? (q.explain === `${mo.highlight}월이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '빈칸에 들어갈 달은 몇 월일까요?' && a.t === 'choice') {
    if (mo?.hide?.length !== 1) return '빈칸이 하나가 아님';
    const x = mo.hide[0] as number;
    return monthChoiceProblem(q, x) ?? (q.explain === `빈칸은 ${x}월이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월(의)? (바로 )?(다음|전) 달은 몇 월일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const base = Number(m[1]);
    const next = m[4] === '다음';
    if (mo?.highlight !== base) return `그림의 표시 ${mo?.highlight}가 글 ${base}월과 다름`;
    const ans = wrapM(base + (next ? 1 : -1));
    const dir = `${m[3] ?? ''}${m[4]}`;
    const forms = [`${base}월 ${dir} 달은 ${ans}월이에요.`, `${base}월의 ${m[4]} 달은 ${ans}월이에요.`];
    return monthChoiceProblem(q, ans) ?? (forms.includes(q.explain ?? '') ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '일 년은 모두 몇 개월일까요?' && a.t === 'choice') {
    return countChoiceProblem(q, 12, '개월') ?? (q.explain === '일 년은 열두 개월이에요.' ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '일 년은 몇 개월일까요?' && a.t === 'choice') {
    return countChoiceProblem(q, 12, '개월') ?? (q.explain === '1월부터 12월까지 12개월이에요. 12개월이 일 년이에요.' ? null : `풀이 글: ${q.explain}`);
  }
  m = /^지금은 (\d+)월이에요\. 12월이 되려면 몇 개월이 더 지나야 할까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const x = Number(m[1]);
    if (mo?.highlight !== x) return `그림의 표시 ${mo?.highlight}가 글 ${x}월과 다름`;
    return countChoiceProblem(q, 12 - x, '개월') ?? (q.explain === `${x}월에서 12월까지는 ${12 - x}개월이 남았어요.` ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '기간과 알맞은 길이를 이어 보세요.' && a.t === 'match') {
    const got = a.pairs.map((pr) => `${pr.a.text}=${pr.b.text}`).sort().join();
    return got === ['일주일=7일', '한 달=30일쯤', '일 년=12개월'].sort().join() ? null : `짝 ${got}`;
  }

  // ---- 달력의 구조 ----
  if (p === '달력에서 일요일은 어느 쪽 끝에 있을까요?' && a.t === 'choice') {
    if (cal?.year !== T.y || cal.month !== T.m) return '오늘 달의 달력이 아님';
    if (correctOpt(q).text !== '왼쪽 끝' || optsOf(q).map((o) => o.text).sort().join() !== ['오른쪽 끝', '왼쪽 끝'].sort().join()) return `정답 보기 ${correctOpt(q).text}`;
    return q.explain === '일요일은 왼쪽 끝, 토요일은 오른쪽 끝에 있어요.' ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '달력의 한 줄에는 요일이 몇 개 있을까요?' && a.t === 'choice') {
    if (cal?.year !== T.y || cal.month !== T.m) return '오늘 달의 달력이 아님';
    return countChoiceProblem(q, 7, '개') ?? (q.explain === '한 줄에는 일곱 개의 요일이 있어요.' ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월 (\d+)일을 달력에서 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    if (Number(m[1]) !== T.m) return `글의 달 ${m[1]}이 오늘 달 ${T.m}과 다름`;
    return calTapProblem(q, { year: T.y, month: T.m, targets: [Number(m[2])], need: 'one' }) ?? (q.explain === `${m[2]}일은 여기에 있어요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월 (\d+)일은 무슨 요일일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const [mm, dd] = [Number(m[1]), Number(m[2])];
    if (cal?.year !== T.y || cal.month !== mm || mm !== T.m) return `달력 ${cal?.year}-${cal?.month}과 글 ${mm}월이 다름`;
    if (dd < 1 || dd > dimOf(cal.year, mm) || cal.marks?.[dd] !== 'target') return `달력의 표시가 ${dd}일이 아님`;
    const wd = wdAt(cal.year, mm, dd);
    return wdChoiceProblem(q, wd) ?? (q.explain === `${dd}일은 ${josaP(WD_LONG[wd] as string, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }

  // ---- 일주일은 7일 ----
  if (a.t === 'choice' && (p === '일주일은 며칠일까요?' || p === '일요일부터 토요일까지는 모두 며칠일까요?' || p === '달력의 가로 한 줄에는 며칠이 있을까요?')) {
    const okVisual = p.startsWith('달력의') ? cal?.year === T.y && cal.month === T.m : v?.k === 'weekdays';
    if (!okVisual) return '그림이 질문과 맞지 않음';
    const ex = p === '달력의 가로 한 줄에는 며칠이 있을까요?' ? '한 줄에 일요일부터 토요일까지 7칸이 있어요. 한 줄이 일주일이에요.' : '일요일부터 토요일까지 7일이에요. 이 7일을 일주일이라고 해요.';
    return countChoiceProblem(q, 7, '일') ?? (q.explain === ex ? null : `풀이 글: ${q.explain}`);
  }
  m = /^오늘이 (\S+요일)이에요\. 일주일 (뒤|전)(은|는) 무슨 요일일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const i = WD_LONG.indexOf(m[1] as string);
    if (m[3] !== josa(m[2] as string, '은/는')) return `조사 ${m[3]}가 틀림`;
    if (wk?.highlight !== i) return `그림의 표시 ${wk?.highlight}가 글 ${m[1]}과 다름`;
    return wdChoiceProblem(q, i) ?? (q.explain === `일주일 ${m[2]}${josa(m[2] as string, '은/는')} 같은 ${josaP(WD_LONG[i] as string, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '2주일은 며칠일까요? 숫자를 눌러 알려 주세요.' && a.t === 'number') {
    return a.correct === 14 && a.maxDigits >= 2 && q.explain === '일주일이 두 번이면 7 + 7 = 14, 모두 14일이에요.' ? null : `정답 ${a.correct}`;
  }
  m = /^(\d+)월 (\d+)일에서 일주일 (뒤|전)(은|는) 며칠일까요\? 달력에서 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    const [mm, dd] = [Number(m[1]), Number(m[2])];
    if (mm !== T.m || m[4] !== josa(m[3] as string, '은/는')) return `달 ${mm}이나 조사 ${m[4]}가 틀림`;
    const target = m[3] === '뒤' ? dd + 7 : dd - 7;
    return calTapProblem(q, { year: T.y, month: mm, targets: [target], need: 'one', marks: { [dd]: 'start' } }) ?? (q.explain === `일주일 ${m[3]}${josa(m[3] as string, '은/는')} ${target}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }

  // ---- 한 달은 28~31일 ----
  m = /^(\d+)월은 며칠까지 있을까요\? 달력의 마지막 날을 읽어 보세요\.$/.exec(p);
  if (m && a.t === 'choice') {
    const mm = Number(m[1]);
    const y = calYear(env, mm);
    if (cal?.year !== y || cal.month !== mm) return `달력 ${cal?.year}-${cal?.month}이 ${y}-${mm}이 아님`;
    const dim = dimOf(y, mm);
    return countChoiceProblem(q, dim, '일') ?? (q.explain === `${mm}월의 마지막 날은 ${dim}일이니까 ${mm}월은 ${dim}일까지 있어요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)일까지 있는 달은 어느 달일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const n = Number(m[1]);
    const right = optNum({ key: correctOpt(q).key });
    const dims = optsOf(q).map((o) => ({ mo: Number(o.key), dim: dimOf(calYear(env, Number(o.key)), Number(o.key)) }));
    if (dims.filter((x) => x.dim === n).length !== 1 || dims.find((x) => x.dim === n)?.mo !== right) return `${n}일까지 있는 달이 정답 하나가 아님: ${JSON.stringify(dims)}`;
    return monthChoiceProblem(q, right as number) ?? (q.explain === `${right}월은 ${n}일까지 있어요.` ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '한 달은 며칠쯤일까요?' && a.t === 'choice') {
    return correctOpt(q).text === '30일쯤' && q.explain === '한 달은 28일에서 31일까지로, 30일쯤이에요.' ? null : `정답 보기 ${correctOpt(q).text}`;
  }
  if (p === '날수가 가장 적은 달은 어느 달일까요?' && a.t === 'choice') {
    return monthChoiceProblem(q, 2) ?? (q.explain === `2월은 ${dimOf(calYear(env, 2), 2)}일까지라서 날수가 가장 적어요.` ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '2월은 며칠까지 있을까요?' && a.t === 'choice') {
    const y = calYear(env, 2);
    if (cal?.year !== y || cal.month !== 2) return `달력 ${cal?.year}-${cal?.month}`;
    return countChoiceProblem(q, dimOf(y, 2), '일') ?? (q.explain === `2월의 마지막 날은 ${dimOf(y, 2)}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }

  // ---- 오늘 달 달력에서 날짜 찾기 ----
  m = /^(\d+)월의 (첫째|마지막) 날을 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    if (Number(m[1]) !== T.m) return `글의 달 ${m[1]}이 오늘 달 ${T.m}과 다름`;
    const dim = dimOf(T.y, T.m);
    const first = m[2] === '첫째';
    return calTapProblem(q, { year: T.y, month: T.m, targets: [first ? 1 : dim], need: 'one', marks: { [T.d]: 'today' } }) ?? (q.explain === (first ? '첫째 날은 1일이에요.' : `마지막 날은 ${dim}일이에요.`) ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월 (\d+)일을 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    if (Number(m[1]) !== T.m) return `글의 달 ${m[1]}이 오늘 달 ${T.m}과 다름`;
    return calTapProblem(q, { year: T.y, month: T.m, targets: [Number(m[2])], need: 'one', marks: { [T.d]: 'today' } }) ?? (q.explain === `${m[2]}일은 여기에 있어요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월의 (첫|두) 번째 (\S+요일)을 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    if (Number(m[1]) !== T.m) return `글의 달 ${m[1]}이 오늘 달 ${T.m}과 다름`;
    const wd = WD_LONG.indexOf(m[3] as string);
    if (wd < 0) return `알 수 없는 요일 ${m[3]}`;
    const days: number[] = [];
    for (let d = 1; d <= dimOf(T.y, T.m); d++) if (wdAt(T.y, T.m, d) === wd) days.push(d);
    const nth = m[2] === '첫' ? 1 : 2;
    const target = days[nth - 1] as number;
    return calTapProblem(q, { year: T.y, month: T.m, targets: [target], need: 'one', marks: { [T.d]: 'today' } }) ?? (q.explain === `${m[2]} 번째 ${m[3]}은 ${target}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월 (\d+)일과 같은 요일인 날을 모두 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    const [mm, dd] = [Number(m[1]), Number(m[2])];
    if (mm !== T.m) return `글의 달 ${mm}이 오늘 달 ${T.m}과 다름`;
    const wd = wdAt(T.y, T.m, dd);
    const same: number[] = [];
    for (let d = 1; d <= dimOf(T.y, T.m); d++) if (d !== dd && wdAt(T.y, T.m, d) === wd) same.push(d);
    return calTapProblem(q, { year: T.y, month: T.m, targets: same, need: 'all', marks: { [dd]: 'start' } }) ?? (q.explain === `같은 요일인 날은 ${same.join(', ')}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }

  // ---- 가족 기념일 ----
  m = /^(\d+)월 달력에 (.+?)(이|가) 표시되어 있어요\. 며칠일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const mm = Number(m[1]);
    const label = m[2] as string;
    const ev = eventDate(env, label);
    if (!ev || ev[0] !== mm) return `${label}의 달은 ${ev?.[0]}인데 글 ${mm}월`;
    if (m[3] !== josa(label, '이/가')) return `조사 ${m[3]}가 틀림`;
    const y = calYear(env, mm);
    if (cal?.year !== y || cal.month !== mm) return `달력 ${cal?.year}-${cal?.month}`;
    const marked = Object.entries(cal.marks ?? {}).filter(([, k]) => k === 'event');
    if (marked.length !== 1 || Number(marked[0]?.[0]) !== ev[1]) return `표시한 날 ${marked.map((x) => x[0])}이 ${label}(${ev[1]}일)과 다름`;
    return dayChoiceProblem(q, ev[1], dimOf(y, mm)) ?? (q.explain === `${label}${josa(label, '은/는')} ${mm}월 ${ev[1]}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  // "<행사>은/는 M월 D일이에요. …" 로 시작하는 세 가지 문제
  const evHead = /^(.+?)(은|는) (\d+)월 (\d+)일이에요\. (.+)$/.exec(p);
  if (evHead) {
    const label = evHead[1] as string;
    const [mm, dd] = [Number(evHead[3]), Number(evHead[4])];
    const tail = evHead[5] as string;
    const nearM = /^그 (다음|전) 날을 찾아 눌러 보세요\.$/.exec(tail);
    const tapN = /^달력에서 (\d+)일을 찾아 눌러 보세요\.$/.exec(tail);
    const kind = tail === '달력에서 그날을 찾아 눌러 보세요.' || tapN ? 'tap' : tail === '그날은 무슨 요일일까요?' ? 'wd' : nearM ? 'near' : null;
    if (kind === null) return SKIP;
    if (tapN && Number(tapN[1]) !== dd) return `글의 날짜 ${dd}일과 찾으라는 ${tapN[1]}일이 다름`;
    const ev = eventDate(env, label);
    if (!ev || ev[0] !== mm || ev[1] !== dd) return `${label}은 ${ev?.join('/')}인데 글 ${mm}/${dd}`;
    if (evHead[2] !== josa(label, '은/는')) return `조사 ${evHead[2]}가 틀림`;
    const y = calYear(env, mm);
    const dim = dimOf(y, mm);
    if (kind === 'tap') {
      if (a.t !== 'calTap') return '달력 누르기가 아님';
      return calTapProblem(q, { year: y, month: mm, targets: [dd], need: 'one' }) ?? (q.explain === `${dd}일은 여기에 있어요.` ? null : `풀이 글: ${q.explain}`);
    }
    if (kind === 'wd') {
      if (a.t !== 'choice') return '고르기가 아님';
      if (cal?.year !== y || cal.month !== mm || cal.marks?.[dd] !== 'event') return `달력이 ${y}-${mm}의 ${dd}일 표시가 아님`;
      const wd = wdAt(y, mm, dd);
      return wdChoiceProblem(q, wd) ?? (q.explain === `${label}${josa(label, '은/는')} ${josaP(WD_LONG[wd] as string, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
    }
    if (a.t !== 'calTap') return '달력 누르기가 아님';
    const after = nearM?.[1] === '다음';
    const target = dd + (after ? 1 : -1);
    if (target < 1 || target > dim) return `${dd}일의 ${nearM?.[1]} 날 ${target}이 달 밖`;
    return calTapProblem(q, { year: y, month: mm, targets: [target], need: 'one', marks: { [dd]: 'event' } }) ?? (q.explain === `${nearM?.[1]} 날은 ${target}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(.+?)(과|와) 같은 요일인 날을 모두 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    const label = m[1] as string;
    const ev = eventDate(env, label);
    if (!ev) return `알 수 없는 행사 ${label}`;
    if (m[2] !== josa(label, '과/와')) return `조사 ${m[2]}가 틀림`;
    const y = calYear(env, ev[0]);
    const same: number[] = [];
    for (let d = 1; d <= dimOf(y, ev[0]); d++) if (d !== ev[1] && wdAt(y, ev[0], d) === wdAt(y, ev[0], ev[1])) same.push(d);
    return calTapProblem(q, { year: y, month: ev[0], targets: same, need: 'all', marks: { [ev[1]]: 'event' } }) ?? (q.explain === `같은 요일인 날은 ${same.join(', ')}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '일 년 중에서 어느 날이 더 먼저 올까요?' && a.t === 'choice') {
    const dated = optsOf(q).map((o) => {
      const mm = /^(.+) · (\d+)월 (\d+)일$/.exec(o.text ?? '');
      return mm ? { label: mm[1] as string, month: Number(mm[2]), day: Number(mm[3]), key: o.key } : null;
    });
    if (dated.length !== 2 || dated.some((x) => x === null)) return '보기를 읽지 못함';
    for (const x of dated as NonNullable<(typeof dated)[number]>[]) {
      const ev = eventDate(env, x.label);
      if (!ev || ev[0] !== x.month || ev[1] !== x.day) return `${x.label}의 날짜 ${ev?.join('/')}이 보기 ${x.month}/${x.day}와 다름`;
    }
    const [e1, e2] = dated as NonNullable<(typeof dated)[number]>[];
    if (e1?.month === e2?.month && e1?.day === e2?.day) return '두 날이 같음';
    const first = (e1 as NonNullable<typeof e1>).month < (e2 as NonNullable<typeof e2>).month || ((e1 as NonNullable<typeof e1>).month === (e2 as NonNullable<typeof e2>).month && (e1 as NonNullable<typeof e1>).day < (e2 as NonNullable<typeof e2>).day) ? e1 : e2;
    if (correctOpt(q).key !== first?.key) return `먼저 오는 날은 ${first?.label}인데 정답 보기 ${correctOpt(q).text}`;
    const second = first === e1 ? e2 : e1;
    const txt = (x: NonNullable<typeof e1>): string => `${x.label} · ${x.month}월 ${x.day}일`;
    return q.explain === `${txt(first as NonNullable<typeof e1>)}이 ${txt(second as NonNullable<typeof e1>)}보다 먼저 와요.` ? null : `풀이 글: ${q.explain}`;
  }
  if (p === '일 년 중에서 먼저 오는 날부터 차례대로 눌러 보세요.' && a.t === 'order') {
    const dated = a.items.map((it) => {
      const mm = /^(.+) · (\d+)월 (\d+)일$/.exec(it.text ?? '');
      return mm ? { label: mm[1] as string, month: Number(mm[2]), day: Number(mm[3]), key: it.key } : null;
    }) as ({ label: string; month: number; day: number; key: string } | null)[];
    if (dated.some((x) => x === null) || dated.length !== 3) return '카드를 읽지 못함';
    const ds = dated as { label: string; month: number; day: number; key: string }[];
    for (const x of ds) {
      const ev = eventDate(env, x.label);
      if (!ev || ev[0] !== x.month || ev[1] !== x.day) return `${x.label}의 날짜 ${ev?.join('/')}이 카드 ${x.month}/${x.day}와 다름`;
    }
    const dateKeys = ds.map((x) => `${x.month}-${x.day}`);
    if (new Set(dateKeys).size !== 3) return '같은 날짜의 카드가 있음';
    const sorted = [...ds].sort((x, y) => x.month - y.month || x.day - y.day);
    if (a.correct.join() !== sorted.map((x) => x.key).join()) return `차례는 ${sorted.map((x) => x.label)}인데 정답 ${a.correct}`;
    return q.explain === `${sorted.map((x) => `${x.month}월 ${x.day}일`).join(', ')} 순서예요.` ? null : `풀이 글: ${q.explain}`;
  }

  // ---- 며칠 뒤 ----
  m = /^빨간 칸이 오늘이에요\. (\d+)일 뒤는 며칠일까요\? 달력에서 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    const n = Number(m[1]);
    const todayMark = Object.entries(a.marks ?? {}).filter(([, k]) => k === 'today');
    if (todayMark.length !== 1) return '오늘 표시가 하나가 아님';
    const d = Number(todayMark[0]?.[0]);
    if (n < 1 || n > 3) return `일수 ${n}`;
    return calTapProblem(q, { year: T.y, month: T.m, targets: [d + n], need: 'one', marks: { [d]: 'today' } }) ?? (q.explain === `오늘이 ${d}일이니까 ${n}일 뒤는 ${d + n}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^오늘은 (\d+)일이에요\. (\d+)일 뒤는 며칠일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const [d, n] = [Number(m[1]), Number(m[2])];
    if (cal?.year !== T.y || cal.month !== T.m || cal.marks?.[d] !== 'today') return '달력의 오늘 표시가 글과 다름';
    if (n < 4 || n > 7) return `일수 ${n}`;
    const dim = dimOf(T.y, T.m);
    return dayChoiceProblem(q, d + n, dim) ?? (q.explain === `${d}일에서 ${n}일 뒤는 ${d + n}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^오늘은 (\d+)일 (\S+요일)이에요\. (\d+)일 뒤는 무슨 요일일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const [d, n] = [Number(m[1]), Number(m[3])];
    if (cal?.year !== T.y || cal.month !== T.m || cal.marks?.[d] !== 'today') return '달력의 오늘 표시가 글과 다름';
    const wd = wdAt(T.y, T.m, d);
    if (WD_LONG[wd] !== m[2]) return `${T.m}월 ${d}일은 ${WD_LONG[wd]}인데 글 ${m[2]}`;
    const target = (wd + n) % 7;
    return wdChoiceProblem(q, target) ?? (q.explain === `${m[2]}에서 ${n}일 뒤는 ${josaP(WD_LONG[target] as string, '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^오늘이 (\d+)일이에요\. (모레|그저께)는 며칠일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const d = Number(m[1]);
    if (cal?.year !== T.y || cal.month !== T.m || cal.marks?.[d] !== 'today') return '달력의 오늘 표시가 글과 다름';
    const target = d + (m[2] === '모레' ? 2 : -2);
    return dayChoiceProblem(q, target, dimOf(T.y, T.m)) ?? (q.explain === `${m[2]}는 ${target}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)일에서 (\d+)일 (뒤|전)(은|는) 며칠일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const [d, n] = [Number(m[1]), Number(m[2])];
    if (m[4] !== josa(m[3] as string, '은/는')) return `조사 ${m[4]}가 틀림`;
    if (cal?.year !== T.y || cal.month !== T.m || cal.marks?.[d] !== 'start') return '달력의 시작 표시가 글과 다름';
    const target = m[3] === '뒤' ? d + n : d - n;
    return dayChoiceProblem(q, target, dimOf(T.y, T.m)) ?? (q.explain === `${d}일에서 ${n}일 ${m[3]}${josa(m[3] as string, '은/는')} ${target}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월 (\d+)일에서 (\d+)일 (뒤|전)(을|를) 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    const [mm, d, n] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mm !== T.m || m[5] !== josa(m[4] as string, '을/를')) return `달 ${mm}이나 조사 ${m[5]}가 틀림`;
    const target = m[4] === '뒤' ? d + n : d - n;
    return calTapProblem(q, { year: T.y, month: mm, targets: [target], need: 'one', marks: { [d]: 'start' } }) ?? (q.explain === `${n}일 ${m[4]}${josa(m[4] as string, '은/는')} ${target}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }

  // ---- 날짜 보물찾기 ----
  const near = (year: number, month: number): boolean => Math.abs(year * 12 + month - (T.y * 12 + T.m)) <= 1;
  m = /^보물은 (\d+)월 (\d+)일에 숨어 있어요\. (\d+)일을 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    if (m[2] !== m[3] || !near(a.year, a.month) || Number(m[1]) !== a.month) return `달 ${m[1]}과 달력 ${a.year}-${a.month}`;
    return calTapProblem(q, { year: a.year, month: a.month, targets: [Number(m[2])], need: 'one' }) ?? (q.explain === `${m[2]}일은 여기예요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^보물은 (\S+요일)에 숨어 있어요\. (\d+)월의 (\S+요일)을 모두 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    const wd = WD_LONG.indexOf(m[1] as string);
    if (m[1] !== m[3] || wd < 0 || Number(m[2]) !== a.month || !near(a.year, a.month)) return `요일·달이 글과 다름: ${m[1]} ${m[2]} / ${a.year}-${a.month}`;
    const targets: number[] = [];
    for (let d = 1; d <= dimOf(a.year, a.month); d++) if (wdAt(a.year, a.month, d) === wd) targets.push(d);
    return calTapProblem(q, { year: a.year, month: a.month, targets, need: 'all' }) ?? (q.explain === `${m[1]}은 모두 ${targets.length}번 있어요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월 (\d+)일에서 일주일 뒤는 며칠일까요\? 그 날짜를 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    const [mm, d] = [Number(m[1]), Number(m[2])];
    if (mm !== a.month || !near(a.year, a.month)) return `달 ${mm}과 달력 ${a.year}-${a.month}`;
    return calTapProblem(q, { year: a.year, month: mm, targets: [d + 7], need: 'one', marks: { [d]: 'start' } }) ?? (q.explain === `일주일 뒤는 ${d + 7}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월 (\d+)일 (다음 날|바로 전 날)은 며칠일까요\? 그 날짜를 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'calTap') {
    const [mm, d] = [Number(m[1]), Number(m[2])];
    if (mm !== a.month || !near(a.year, a.month)) return `달 ${mm}과 달력 ${a.year}-${a.month}`;
    const target = d + (m[3] === '다음 날' ? 1 : -1);
    return calTapProblem(q, { year: a.year, month: mm, targets: [target], need: 'one', marks: { [d]: 'start' } }) ?? (q.explain === `${m[3] === '다음 날' ? '다음 날' : '전 날'}은 ${target}일이에요.` ? null : `풀이 글: ${q.explain}`);
  }

  // ---- 기차(순서 맞추기) ----
  const trainOrder = (keys: string[], texts: string[], says: string[]): string | null => {
    if (!(a.t === 'order')) return '순서 맞추기가 아님';
    if (a.style !== 'train') return '기차 모양이 아님';
    if (a.correct.join() !== keys.join()) return `정답 순서 ${a.correct}이 ${keys}와 다름`;
    if ([...a.items.map((it) => it.key)].sort().join() !== [...keys].sort().join()) return '카드가 정답 칸과 다름';
    for (const it of a.items) {
      const i = keys.indexOf(it.key);
      if (it.text !== texts[i] || it.say !== says[i]) return `카드 ${it.text}/${it.say}`;
    }
    return null;
  };
  if (p === '요일 기차의 칸을 앞에서부터 차례대로 눌러 보세요.' && a.t === 'order') {
    const idx = a.correct.map((k) => Number(k.slice(1)));
    if (![3, 5, 7].includes(idx.length) || idx.some((x, i) => x !== (idx[0] as number) + i) || (idx[0] as number) < 0 || (idx[idx.length - 1] as number) > 6) return `연속된 요일이 아님: ${idx}`;
    return trainOrder(idx.map((x) => `w${x}`), idx.map((x) => WD_SHORT[x] as string), idx.map((x) => WD_LONG[x] as string)) ?? (q.explain === `${idx.map((x) => WD_LONG[x]).join(', ')} 순서예요.` ? null : `풀이 글: ${q.explain}`);
  }
  if (p === '달 기차의 칸을 앞에서부터 차례대로 눌러 보세요.' && a.t === 'order') {
    const idx = a.correct.map((k) => Number(k.slice(1)));
    if (![3, 5, 7].includes(idx.length) || idx.some((x, i) => x !== (idx[0] as number) + i) || (idx[0] as number) < 1 || (idx[idx.length - 1] as number) > 12) return `연속된 달이 아님: ${idx}`;
    return trainOrder(idx.map((x) => `m${x}`), idx.map((x) => `${x}월`), idx.map((x) => a.items.find((it) => it.key === `m${x}`)?.say as string)) ?? (q.explain === `${idx.map((x) => `${x}월`).join(', ')} 순서예요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\S+요일)부터 시작하는 기차예요\. 칸을 앞에서부터 차례대로 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'order') {
    const start = WD_LONG.indexOf(m[1] as string);
    const len = a.correct.length;
    if (![4, 5, 7].includes(len) || start < 0) return `칸 수 ${len}`;
    const idx = Array.from({ length: len }, (_, i) => (start + i) % 7);
    return trainOrder(idx.map((x) => `w${x}`), idx.map((x) => WD_SHORT[x] as string), idx.map((x) => WD_LONG[x] as string)) ?? (q.explain === `${idx.map((x) => WD_LONG[x]).join(', ')} 순서예요.` ? null : `풀이 글: ${q.explain}`);
  }
  m = /^(\d+)월부터 시작하는 기차예요\. 칸을 앞에서부터 차례대로 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'order') {
    const start = Number(m[1]);
    const len = a.correct.length;
    if (![4, 5, 7].includes(len)) return `칸 수 ${len}`;
    const idx = Array.from({ length: len }, (_, i) => wrapM(start + i));
    return trainOrder(idx.map((x) => `m${x}`), idx.map((x) => `${x}월`), idx.map((x) => a.items.find((it) => it.key === `m${x}`)?.say as string)) ?? (q.explain === `${idx.map((x) => `${x}월`).join(', ')} 순서예요.` ? null : `풀이 글: ${q.explain}`);
  }
  return SKIP;
}

describe('달력', () => {
  for (const id of ['cal.weekdayName', 'cal.weekdayOrder', 'cal.months', 'cal.grid', 'cal.weekLen', 'cal.monthLen', 'cal.yearLen']) it(id, () => run(id, calendarCheck));
  for (const id of ['cal.event', 'cal.later', 'game.dateHunt.a', 'game.dateHunt.event', 'game.dateHunt.later']) it(id, () => run(id, calendarCheck));
  for (const id of ['game.weekTrain.a', 'game.monthTrain', 'game.weekLoop', 'game.monthLoop']) it(id, () => run(id, calendarCheck));
});


describe('가르기·모으기(1단계)', () => {
  for (const id of ['num.split5', 'num.merge5', 'num.split10', 'num.merge10']) it(id, () => run(id, calcCheck, { minChecked: 300 }));
});

// ---------------------------------------------------------------------------
// K. 모양: 입체(상자·둥근 기둥·공), 평면(네모·세모·동그라미), 풍선 놀이, 숫자 따라 쓰기
// ---------------------------------------------------------------------------

type SolidId = 'box' | 'cylinder' | 'ball';
const SOLID_TEXT: Record<SolidId, string> = { box: '상자 모양', cylinder: '둥근 기둥 모양', ball: '공 모양' };
/** 물건 이름 → [그림, 모양] */
const SOLID_THING: Record<string, [string, SolidId]> = {
  '택배 상자': ['📦', 'box'], '선물 상자': ['🎁', 'box'], 텔레비전: ['📺', 'box'], 책: ['📚', 'box'],
  통조림: ['🥫', 'cylinder'], 북: ['🥁', 'cylinder'], 드럼통: ['🛢️', 'cylinder'], 양초: ['🕯️', 'cylinder'],
  축구공: ['⚽', 'ball'], 농구공: ['🏀', 'ball'], 지구본: ['🌍', 'ball'], 테니스공: ['🎾', 'ball'],
};
const THING_OF_EMOJI = new Map(Object.entries(SOLID_THING).map(([name, [emoji, solid]]) => [emoji, { name, solid }]));
const SOLID_BY_TEXT = new Map((Object.entries(SOLID_TEXT) as [SolidId, string][]).map(([id, t]) => [t, id]));
type FlatName = '네모' | '세모' | '동그라미';
const FLAT_OF_SHAPE: Record<string, FlatName> = { square: '네모', rect: '네모', triangle: '세모', circle: '동그라미' };
const flatOf = (v: Visual | undefined): FlatName | null => (v?.k === 'shape' ? FLAT_OF_SHAPE[v.shape] ?? null : null);

/** 입체 보기(그림+글)가 서로 맞고 하나만 정답인지 */
function solidOptionsProblem(q: Question, want: SolidId): string | null {
  const opts = optsOf(q);
  if (opts.length !== 3 || new Set(opts.map((o) => o.key)).size !== 3) return '입체 보기가 세 가지 서로 다른 모양이 아님';
  for (const o of opts) {
    const id = SOLID_BY_TEXT.get(o.text ?? '');
    if (!id || o.key !== id || o.say !== o.text) return `보기 ${o.text}/${o.key}가 이상함`;
    if (o.visual?.k !== 'solid' || o.visual.solid !== id) return `보기 그림이 ${o.text}와 다름`;
  }
  return correctOpt(q).key === want ? null : `정답은 ${want}인데 정답 보기 ${correctOpt(q).key}`;
}

function shapeCheck({ q, level }: Case): string | null {
  const a = q.answer;
  const p = q.prompt;
  const v = q.visual;
  let m: RegExpExecArray | null;

  // ---- 입체 ----
  m = /^(.+?)(은|는) 어떤 모양일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const name = m[1] as string;
    const thing = SOLID_THING[name];
    if (!thing) return `알 수 없는 물건 ${name}`;
    if (m[2] !== particleFor(name, '은/는')) return `조사 ${m[2]}가 틀림`;
    if (v?.k !== 'big' || v.text !== thing[0] || v.sub !== name) return `그림 ${JSON.stringify(v)}가 ${name}과 다름`;
    return solidOptionsProblem(q, thing[1]) ?? (q.explain === `${name}${particleFor(name, '은/는')} ${SOLID_TEXT[thing[1]]}${particleFor(SOLID_TEXT[thing[1]], '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  const FACT: Record<string, SolidId> = {
    '어느 쪽으로든 잘 굴러가고 쌓기 어려워요.': 'ball',
    '평평한 면이 있어서 잘 쌓을 수 있고, 굴러가지 않아요.': 'box',
    '세우면 쌓을 수 있고, 눕히면 굴러가요.': 'cylinder',
  };
  m = /^(.+) 어떤 모양일까요\?$/.exec(p);
  if (m && a.t === 'choice' && FACT[m[1] as string]) {
    const want = FACT[m[1] as string] as SolidId;
    return solidOptionsProblem(q, want) ?? (q.explain === `${SOLID_TEXT[want]}${particleFor(SOLID_TEXT[want], '이에요/예요')}.` ? null : `풀이 글: ${q.explain}`);
  }
  // 눌러서 찾기 / 풍선 터뜨리기 (입체)
  const solidTap = (want: SolidId, all: boolean, nTargets: number | null): string | null => {
    if (a.t !== 'tapTargets') return '누르기가 아님';
    const things = a.items.map((it) => ({ it, th: THING_OF_EMOJI.get(it.key) }));
    for (const { it, th } of things) if (!th || it.text !== it.key || it.say !== th.name) return `칸 ${it.key}/${it.say}가 이상함`;
    if (new Set(a.items.map((it) => it.key)).size !== a.items.length) return '칸이 겹침';
    const hit = things.filter((x) => x.th?.solid === want).map((x) => x.it.key);
    if ([...a.targets].sort().join() !== [...hit].sort().join()) return `${SOLID_TEXT[want]}은 ${hit}인데 정답 ${a.targets}`;
    if (a.need !== (all ? 'all' : 'one') || (nTargets !== null && hit.length !== nTargets)) return `정답 ${hit.length}개, need ${a.need}`;
    const names = hit.map((k) => THING_OF_EMOJI.get(k)?.name ?? '?');
    // 풀이 글에는 정답 물건의 이름이 (보이는 순서와 무관하게) 모두 들어 있어야 한다
    if (!names.every((n) => (q.explain ?? '').includes(n))) return `풀이 글에 정답 물건이 빠짐: ${q.explain}`;
    if (q.hint?.visual?.k !== 'solid' || q.hint.visual.solid !== want) return '도움말 그림이 모양과 다름';
    return null;
  };
  m = /^(.+ 모양)을 모두 찾아 눌러 보세요\.$/.exec(p);
  if (m && a.t === 'tapTargets' && SOLID_BY_TEXT.has(m[1] as string)) {
    const want = SOLID_BY_TEXT.get(m[1] as string) as SolidId;
    const bad = solidTap(want, true, 2);
    if (bad) return bad;
    const names = a.targets.map((k) => THING_OF_EMOJI.get(k)?.name);
    const okExplain = [names, [...names].reverse()].some((order) => q.explain === `${SOLID_TEXT[want]}은 ${order.join(', ')} 두 가지예요.`);
    return a.items.length === 6 && okExplain ? null : `풀이 글/칸 수: ${a.items.length} ${q.explain}`;
  }
  m = /^(.+ 모양) 물건이 담긴 풍선을 (터뜨려|모두 터뜨려) 보세요\.$/.exec(p);
  if (m && a.t === 'tapTargets' && SOLID_BY_TEXT.has(m[1] as string)) {
    const want = SOLID_BY_TEXT.get(m[1] as string) as SolidId;
    const n = level === 1 ? 1 : level === 2 ? 2 : 3;
    const total = level === 1 ? 4 : level === 2 ? 6 : 8;
    if ((m[2] === '터뜨려') !== (n === 1)) return `말 '${m[2]}'과 정답 수 ${n}가 맞지 않음`;
    const bad = solidTap(want, n > 1, n);
    if (bad) return bad;
    if (a.items.length !== total) return `풍선 ${a.items.length}개`;
    const names = a.targets.map((k) => THING_OF_EMOJI.get(k)?.name as string);
    const tail = (q.explain ?? '').replace(`${SOLID_TEXT[want]} 물건은 `, '');
    const set = new Set(tail.replace(/(이에요|예요)\.$/, '').split(', '));
    return names.every((x) => set.has(x)) && set.size === names.length && q.explain?.startsWith(`${SOLID_TEXT[want]} 물건은 `) ? null : `풀이 글: ${q.explain}`;
  }

  // ---- 평면 ----
  if (p === '이 모양의 이름은 무엇일까요?' && a.t === 'choice') {
    const f = flatOf(v);
    if (!f || v?.k !== 'shape' || (v.size ?? 0) < 100) return '모양 그림이 없음';
    const texts = optsOf(q).map((o) => o.text);
    if (texts.slice().sort().join() !== ['네모', '동그라미', '세모'].sort().join() || optsOf(q).some((o) => o.key !== o.text || o.say !== o.text)) return `보기 ${texts}`;
    return correctOpt(q).text === f ? (q.explain === `${f} 모양이에요.` ? null : `풀이 글: ${q.explain}`) : `그림은 ${f}인데 정답 보기 ${correctOpt(q).text}`;
  }
  m = /^(네모|세모|동그라미) 모양은 어느 것일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const f = m[1] as FlatName;
    const kinds = optsOf(q).map((o) => flatOf(o.visual));
    if (new Set(kinds).size !== 3 || kinds.includes(null)) return `보기 그림의 종류 ${kinds}`;
    if (optsOf(q).some((o) => o.key !== flatOf(o.visual) || o.say !== o.key)) return '보기 키·읽기가 그림과 다름';
    return flatOf(correctOpt(q).visual) === f ? (q.explain === `${f} 모양은 이거예요.` ? null : `풀이 글: ${q.explain}`) : `${f}인데 정답 보기 그림은 ${flatOf(correctOpt(q).visual)}`;
  }
  const flatTap = (f: FlatName, total: number | null, need: 'one' | 'all', suffix: (n: number) => string): string | null => {
    if (a.t !== 'tapTargets') return '누르기가 아님';
    if (a.items.some((it) => flatOf(it.visual) === null || it.say !== flatOf(it.visual))) return '칸의 그림과 읽기가 맞지 않음';
    if (new Set(a.items.map((it) => it.key)).size !== a.items.length) return '칸이 겹침';
    const hit = a.items.filter((it) => flatOf(it.visual) === f).map((it) => it.key);
    if (hit.length === 0 || hit.length === a.items.length) return `${f} 모양이 ${hit.length}개`;
    if ([...a.targets].sort().join() !== [...hit].sort().join()) return `${f}은 ${hit}인데 정답 ${a.targets}`;
    if (total !== null && a.items.length !== total) return `칸 수 ${a.items.length}`;
    if (a.need !== need) return `need ${a.need}`;
    return q.explain === suffix(hit.length) ? null : `풀이 글: ${q.explain}`;
  };
  m = /^(네모|세모|동그라미) 모양을 모두 찾아 눌러 보세요\.$/.exec(p);
  if (m) {
    const f = m[1] as FlatName;
    const hits = a.t === 'tapTargets' ? a.targets.length : 0;
    if (hits < 2 || hits > 3) return `정답 ${hits}개`;
    return flatTap(f, 8, 'all', (n) => `${f} 모양은 모두 ${n}개예요.`);
  }
  m = /^(네모|세모|동그라미) 풍선을 (터뜨려|모두 터뜨려) 보세요\.$/.exec(p);
  if (m) {
    const f = m[1] as FlatName;
    const total = level === 1 ? 4 : level === 2 ? 6 : 8;
    const n = a.t === 'tapTargets' ? a.targets.length : 0;
    if ((m[2] === '터뜨려') !== (n === 1) || (level === 1) !== (n === 1)) return `말 '${m[2]}'과 정답 수 ${n}가 맞지 않음`;
    if (level === 2 && (n < 2 || n > 3)) return `2단계 정답 ${n}개`;
    if (level === 3 && (n < 2 || n > 4)) return `3단계 정답 ${n}개`;
    return flatTap(f, total, n === 1 ? 'one' : 'all', (k) => `${f} 모양은 모두 ${COUNT_WORD[k]} 개예요.`);
  }
  m = /^(네모|세모|동그라미) 모양은 모두 몇 개일까요\?$/.exec(p);
  if (m && a.t === 'choice') {
    const f = m[1] as FlatName;
    if (v?.k !== 'row') return '모양 줄이 없음';
    if (v.items.some((x) => flatOf(x) === null)) return '줄 안에 모양이 아닌 것이 있음';
    const n = v.items.filter((x) => flatOf(x) === f).length;
    if (v.items.length < 6 || v.items.length > 9 || n < 2 || n > 5) return `줄 ${v.items.length}개 중 ${n}개`;
    const bad = countChoiceProblem(q, n, '개');
    return bad ?? (q.explain === `${f} 모양은 모두 ${n}개예요.` ? null : `풀이 글: ${q.explain}`);
  }

  // ---- 숫자 따라 쓰기 ----
  m = /^숫자 (\d+) 따라 쓰기$/.exec(p);
  if (m && a.t === 'trace') {
    const n = Number(m[1]);
    if (n < 1 || n > 10 || a.glyph !== m[1]) return `글자 ${a.glyph}가 ${m[1]}과 다름`;
    const w = krSino(n);
    return q.say === `숫자 ${w}${particleFor(w, '을/를')} 손가락으로 따라 써 봐요.` ? null : `읽는 말: ${q.say}`;
  }
  return SKIP;
}

describe('모양과 숫자 쓰기', () => {
  for (const id of ['geo.solid', 'geo.shape2d', 'game.balloons.solid', 'game.balloons.shape']) it(id, () => run(id, shapeCheck, { minChecked: 300 }));
  it('num.write', () => run('num.write', shapeCheck, { minChecked: 300 }));
});

// ---------------------------------------------------------------------------
// J. 종합 모험: 여러 스킬을 섞어 내므로, 이미 만든 검사기들에 차례로 맡긴다
// ---------------------------------------------------------------------------

/** 처음으로 문제 모양을 이해한 검사기의 판정을 쓴다(아무도 이해하지 못하면 건너뜀) */
const firstOf =
  (...checks: Check[]): Check =>
  (c) => {
    for (const ch of checks) {
      const r = ch(c);
      if (r !== SKIP) return r;
    }
    return SKIP;
  };

describe('종합 모험', () => {
  const numberAdventure = firstOf(compareCheck, placeCheck, calcCheck, storyCheck);
  const timeAdventure = firstOf(clockCheck, dayCheck, timetableCheck);
  const timeCalendarAdventure = firstOf(clockCheck, calendarCheck, timetableCheck);
  it('adv.num', () => run('adv.num', numberAdventure, { minChecked: 400 }));
  it('game.adventure.num', () => run('game.adventure.num', numberAdventure, { minChecked: 400 }));
  it('adv.time', () => run('adv.time', timeAdventure, { minChecked: 400 }));
  it('adv.cal', () => run('adv.cal', calendarCheck, { minChecked: 400 }));
  it('game.adventure.time', () => run('game.adventure.time', timeCalendarAdventure, { minChecked: 400 }));
});

// ---------------------------------------------------------------------------
// 등록 현황
// ---------------------------------------------------------------------------

describe('도구 점검', () => {
  it('등록된 스킬 수가 맞다', () => {
    expect(allSkills().length).toBeGreaterThan(150);
  });
});
