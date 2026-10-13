import { daysInMonth } from './dates';
import { speak } from './ko';
import type { AnswerSpec, Question, Visual } from './types';

/** 읽어 줄 글에서 speak() 변환 뒤에도 숫자나 기호가 남으면 문제 */
const HAS_DIGIT = {
  test: (t: string): boolean => /[0-9=+×÷]/.test(speak(t)),
};

function visualProblems(v: Visual | undefined, where: string, out: string[]): void {
  if (!v) return;
  switch (v.k) {
    case 'objects':
      if (!v.emoji) out.push(`${where}: objects emoji 없음`);
      if (!Number.isInteger(v.n) || v.n < 0 || v.n > 60) out.push(`${where}: objects n 범위 ${v.n}`);
      if (v.crossed !== undefined && (v.crossed < 0 || v.crossed > v.n)) out.push(`${where}: crossed 범위`);
      break;
    case 'groups':
      if (v.a.n < 0 || v.b.n < 0 || v.a.n > 30 || v.b.n > 30) out.push(`${where}: groups 범위`);
      break;
    case 'clock':
      if (v.h < 1 || v.h > 12 || v.m < 0 || v.m > 59) out.push(`${where}: clock 시각 ${v.h}:${v.m}`);
      break;
    case 'digital':
      if (v.h < 1 || v.h > 12 || v.m < 0 || v.m > 59) out.push(`${where}: digital 시각`);
      break;
    case 'calendar': {
      if (v.month < 0 || v.month > 12) out.push(`${where}: calendar month`);
      if (v.year !== 0 && v.marks) {
        const dim = daysInMonth(v.year, v.month);
        for (const k of Object.keys(v.marks)) if (Number(k) < 1 || Number(k) > dim) out.push(`${where}: calendar mark ${k}`);
      }
      break;
    }
    case 'stones':
      if (v.seq.length < 2 || v.seq.length > 12) out.push(`${where}: stones 길이`);
      break;
    case 'row':
    case 'col':
      v.items.forEach((it, i) => visualProblems(it, `${where}.${i}`, out));
      break;
    case 'bars':
      if (v.items.length < 2) out.push(`${where}: bars 항목`);
      break;
    default:
      break;
  }
}

function optionKeyProblems(a: Extract<AnswerSpec, { t: 'choice' }>, out: string[]): void {
  if (a.options.length < 2 || a.options.length > 6) out.push(`choice 보기 수 ${a.options.length}`);
  const keys = new Set(a.options.map((o) => o.key));
  if (keys.size !== a.options.length) out.push('choice 키 중복');
  if (!(a.correct >= 0 && a.correct < a.options.length)) out.push('choice correct 범위');
  const texts = a.options.filter((o) => o.text !== undefined && !o.visual).map((o) => o.text);
  if (new Set(texts).size !== texts.length) out.push('choice 글자 보기 중복');
  const visuals = a.options.filter((o) => o.visual).map((o) => JSON.stringify(o.visual));
  if (new Set(visuals).size !== visuals.length) out.push('choice 그림 보기 중복');
  for (const o of a.options) if (!o.text && !o.visual) out.push(`choice 보기 ${o.key} 비어 있음`);
}

export function questionProblems(q: Question): string[] {
  const out: string[] = [];
  if (!q.id || !q.skill) out.push('id/skill 없음');
  if (!q.prompt.trim()) out.push('prompt 비어 있음');
  if (q.prompt.length > 110) out.push(`prompt 너무 김(${q.prompt.length})`);
  if (!q.say.trim()) out.push('say 비어 있음');
  if (HAS_DIGIT.test(q.say)) out.push(`say에 숫자: ${q.say}`);
  if (q.hint && HAS_DIGIT.test(q.hint.say)) out.push(`hint.say에 숫자: ${q.hint.say}`);
  if (q.explain && HAS_DIGIT.test(q.explain)) out.push(`explain에 숫자: ${q.explain}`);
  if (q.answer.t !== 'trace' && !q.hint) out.push('hint 없음');
  if (!q.explain) out.push('explain 없음');
  visualProblems(q.visual, 'visual', out);
  visualProblems(q.hint?.visual, 'hint.visual', out);

  const a = q.answer;
  switch (a.t) {
    case 'choice':
      optionKeyProblems(a, out);
      a.options.forEach((o, i) => {
        visualProblems(o.visual, `option${i}`, out);
        if (o.say && HAS_DIGIT.test(o.say)) out.push(`option say에 숫자: ${o.say}`);
      });
      break;
    case 'number': {
      if (!Number.isInteger(a.correct) || a.correct < 0) out.push('number correct');
      if (String(a.correct).length > a.maxDigits) out.push('number maxDigits 부족');
      break;
    }
    case 'pickN':
      if (a.n < 1 || a.n > a.total || a.total > 20) out.push(`pickN 범위 n=${a.n} total=${a.total}`);
      break;
    case 'gaps': {
      const nulls = a.seq.filter((x) => x === null).length;
      if (nulls !== a.answers.length || nulls === 0) out.push('gaps 빈칸 수');
      for (const x of a.answers) if (!a.tokens.includes(x)) out.push('gaps 토큰에 정답 없음');
      if (new Set(a.tokens).size !== a.tokens.length) out.push('gaps 토큰 중복');
      const filled: number[] = [];
      let k = 0;
      for (const x of a.seq) filled.push(x === null ? (a.answers[k++] as number) : x);
      for (let i = 1; i < filled.length; i++) if ((filled[i] as number) <= (filled[i - 1] as number)) out.push('gaps 순서가 증가하지 않음');
      break;
    }
    case 'order': {
      const keys = a.items.map((i) => i.key);
      if (new Set(keys).size !== keys.length) out.push('order 키 중복');
      if ([...a.correct].sort().join() !== [...keys].sort().join()) out.push('order 정답이 항목과 다름');
      if (a.items.length < 2 || a.items.length > 7) out.push('order 항목 수');
      break;
    }
    case 'clockSet':
      if (a.h < 1 || a.h > 12) out.push('clockSet h');
      if (a.mode === 'hour' && a.m !== 0) out.push('clockSet hour 모드 m');
      if (a.mode === 'half' && a.m !== 30 && a.m !== 0) out.push('clockSet half 모드 m');
      break;
    case 'tapTargets': {
      const keys = a.items.map((i) => i.key);
      if (new Set(keys).size !== keys.length) out.push('tapTargets 키 중복');
      for (const t of a.targets) if (!keys.includes(t)) out.push('tapTargets 정답 키 없음');
      if (a.targets.length === 0) out.push('tapTargets 정답 없음');
      if ((a.need ?? (a.targets.length === 1 ? 'one' : 'all')) === 'one' && a.targets.length !== 1) out.push('tapTargets one인데 정답 여러 개');
      a.items.forEach((it, i) => visualProblems(it.visual, `tap${i}`, out));
      break;
    }
    case 'coins':
      if (a.target % 10 !== 0 || a.target <= 0) out.push('coins 목표');
      break;
    case 'trace':
      if (!a.glyph) out.push('trace glyph');
      break;
    case 'calTap': {
      const dim = daysInMonth(a.year, a.month);
      for (const t of a.targets) if (t < 1 || t > dim) out.push('calTap 날짜 범위');
      break;
    }
    case 'split':
      if (a.left < 1 || a.left >= a.total) out.push('split 범위');
      break;
    case 'match': {
      const keys = a.pairs.map((p) => p.key);
      if (a.pairs.length < 2 || new Set(keys).size !== keys.length) out.push('match 쌍');
      break;
    }
  }

  try {
    const copy = JSON.parse(JSON.stringify(q)) as Question;
    if (JSON.stringify(copy) !== JSON.stringify(q)) out.push('JSON 왕복 불일치');
  } catch {
    out.push('JSON 직렬화 실패');
  }
  return out;
}
