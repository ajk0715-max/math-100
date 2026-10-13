import { describe, expect, it } from 'vitest';
import { toParts } from '@/core/dates';
import { generate } from '@/core/question';
import { allSkills } from '@/core/skills';
import type { FamilyEvent, Level, Question, Visual } from '@/core/types';

// 화면에 보이는 글과 읽어 주는 글에서 조사(은/는, 을/를, 이/가, 과/와, (으)로, 이에요/예요, 이라고/라고)가
// 앞 낱말의 받침과 어긋난 곳이 없는지 모든 문제를 만들어 살펴본다. 아이가 그대로 읽고 듣는 글이라서 어색하면 곤란하다.

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
const SEEDS = 70;

/** 낱말이 우연히 조사처럼 끝나는 경우(받침 규칙과 상관없는 말) */
const NOT_JOSA = new Set(['있는', '맞는', '남는', '묻는', '받는', '없는', '않는', '읽는', '붙는', '사과', '차이', '아이', '나이']);

function textsOf(q: Question): string[] {
  const out: string[] = [q.prompt, q.say, q.explain ?? '', q.hint?.say ?? ''];
  const vis = (v?: Visual): void => {
    if (!v) return;
    if (v.k === 'story') out.push(v.text);
    if (v.k === 'big') out.push(v.text, v.sub ?? '');
    if (v.k === 'row' || v.k === 'col') v.items.forEach(vis);
  };
  vis(q.visual);
  vis(q.hint?.visual);
  const a = q.answer;
  if (a.t === 'choice') for (const o of a.options) out.push(o.text ?? '', o.say ?? '');
  if (a.t === 'tapTargets' || a.t === 'order') for (const o of a.items) out.push(o.text ?? '', o.say ?? '');
  if (a.t === 'match') for (const p of a.pairs) out.push(p.a.text ?? '', p.b.text ?? '');
  return out.filter(Boolean);
}

// 숫자를 한자어로 읽었을 때 받침이 있는가(0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔)
const DIGIT_HAS: Record<string, boolean> = { '0': true, '1': true, '2': false, '3': true, '4': false, '5': false, '6': true, '7': true, '8': true, '9': false };
const RIEUL_DIGIT = new Set(['1', '7', '8']);

function jong(ch: string): { has: boolean; rieul: boolean } | null {
  if (/[0-9]/.test(ch)) return { has: DIGIT_HAS[ch] as boolean, rieul: RIEUL_DIGIT.has(ch) };
  const c = ch.charCodeAt(0);
  if (c < 0xac00 || c > 0xd7a3) return null;
  const j = (c - 0xac00) % 28;
  return { has: j !== 0, rieul: j === 8 };
}

const FORMS: { name: string; withB: string; noB: string }[] = [
  { name: '은/는', withB: '은', noB: '는' },
  { name: '을/를', withB: '을', noB: '를' },
  { name: '이/가', withB: '이', noB: '가' },
  { name: '과/와', withB: '과', noB: '와' },
  { name: '이에요/예요', withB: '이에요', noB: '예요' },
  { name: '이랑/랑', withB: '이랑', noB: '랑' },
  { name: '이라고/라고', withB: '이라고', noB: '라고' },
];
const AFTER = '(?=[\\s.,?!)]|$)';

/** 조사가 어긋난 곳의 설명 목록 */
export function josaProblems(t: string): string[] {
  const out: string[] = [];
  for (const f of FORMS) {
    const re = new RegExp(`([가-힣0-9])['’”"]?(${f.withB}|${f.noB})${AFTER}`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const j = jong(m[1] as string);
      if (!j) continue;
      const want = j.has ? f.withB : f.noB;
      if (m[2] === want) continue;
      const start = t.lastIndexOf(' ', m.index) + 1;
      const word = t.slice(start, m.index + 1 + (m[0].length - 1 - (m[2] as string).length > 0 ? 1 : 0) + (m[2] as string).length);
      const bare = t.slice(start, m.index + 2);
      if (NOT_JOSA.has(bare)) continue;
      out.push(`${f.name}: "${word}" → '${want}'이어야 함`);
    }
  }
  // (으)로: 받침이 없거나 ㄹ이면 '로', 그 밖의 받침이면 '으로'
  const re = /([가-힣0-9])['’”"]?(으로|로)(?=[\s.,?!)]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const j = jong(m[1] as string);
    if (!j) continue;
    const want = j.has && !j.rieul ? '으로' : '로';
    if (m[2] !== want) out.push(`(으)로: "${t.slice(t.lastIndexOf(' ', m.index) + 1, m.index + 1 + (m[2] as string).length)}" → '${want}'이어야 함`);
  }
  return out;
}

describe('조사 검사기', () => {
  it('받침에 맞지 않는 조사를 찾아낸다', () => {
    expect(josaProblems('내일는 며칠일까요?')).toHaveLength(1);
    expect(josaProblems('음악를 찾고')).toHaveLength(1);
    expect(josaProblems('4 = 5이에요.')).toHaveLength(1);
    expect(josaProblems('수이에요.')).toHaveLength(1);
    expect(josaProblems('3시에서 1시간 전로 맞춰요')).toHaveLength(1);
    expect(josaProblems('십팔라고 읽어요')).toHaveLength(1);
    expect(josaProblems('짧은바늘은 6를 지나')).toHaveLength(1);
  });
  it('알맞은 조사와 낱말 속 글자는 그냥 둔다', () => {
    expect(josaProblems('내일은 며칠일까요? 어제는 몇 일일까요? 5예요. 6이에요. 월이에요. 수예요.')).toEqual([]);
    expect(josaProblems("'열일곱'을 숫자로 쓰면 '열하나'를 숫자로 써요. 7로 가요. 6으로 가요. 8로 가요.")).toEqual([]);
    expect(josaProblems('사과 2개가 있는 것을 찾아 보세요. 이야기에 맞는 식을 골라요.')).toEqual([]);
    expect(josaProblems('십팔이라고 읽고, 열여덟이라고도 읽어요. 열하나라고 읽어요.')).toEqual([]);
  });
});

describe('모든 문제의 글에 조사 오류가 없다', () => {
  for (const skill of allSkills()) {
    it(`${skill.id}`, () => {
      const bad: string[] = [];
      for (const env of ENVS) {
        for (const level of [1, 2, 3] as Level[]) {
          for (let seed = 1; seed <= SEEDS && bad.length < 5; seed++) {
            const q = generate({ skill: skill.id, level, seed }, env);
            for (const t of textsOf(q)) for (const p of josaProblems(t)) bad.push(`L${level} s${seed}: ${p} :: ${t.slice(0, 60)}`);
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
