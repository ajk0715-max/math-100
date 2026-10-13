import { chance, int, pick, shuffle } from '../rng';
import { hourKo, josa, timeKo, timeText } from '../ko';
import type { GenCtx, Option, Question, Visual } from '../types';
import { buildChoice, mk, numChoice, shuffleDiff, sn } from './util';

/** 1~12 안에서 h와 가까운 시각을 돌려준다(12 다음은 1). */
export function nearHours(h: number): number[] {
  const wrap = (x: number) => ((x - 1 + 12) % 12) + 1;
  return [wrap(h - 1), wrap(h + 1), wrap(h - 2), wrap(h + 2)];
}

export const clockVis = (h: number, m: number, extra: Partial<Extract<Visual, { k: 'clock' }>> = {}): Visual => ({
  k: 'clock',
  h,
  m,
  numbers: true,
  ...extra,
});

export const hourOption = (h: number): Option => ({ key: String(h), text: timeText(h, 0), say: hourKo(h) });
export const clockOption = (h: number, m: number, key = `${h}:${m}`): Option => ({
  key,
  visual: clockVis(h, m, { size: 'sm' }),
  say: timeKo(h, m),
});

// ---------------------------------------------------------------------------
// 시계의 구성
// ---------------------------------------------------------------------------

export function clockPartsGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const numOpt = (x: number): Option => ({ key: String(x), text: String(x), say: sn(x) });
  if (L === 1) {
    const h = int(r, 1, 11);
    const which = pick(r, ['hour', 'minute'] as const);
    const name = which === 'hour' ? '짧은바늘' : '긴바늘';
    const hourOpt: Option = { key: 'hour', text: '짧은바늘' };
    const minOpt: Option = { key: 'minute', text: '긴바늘' };
    return mk(c, {
      prompt: '빨간색 바늘의 이름은 무엇일까요?',
      say: '빨간색 바늘의 이름은 무엇일까요?',
      visual: clockVis(h, 0, { mark: which, size: 'lg' }),
      answer: buildChoice(r, which === 'hour' ? hourOpt : minOpt, [which === 'hour' ? minOpt : hourOpt], 2, 2),
      hint: { say: '시계에는 짧은 바늘과 긴 바늘이 있어요. 길이를 비교해 봐요.' },
      explain: `빨간색 바늘은 ${name}이에요.`,
    });
  }
  if (L === 2) {
    const h = int(r, 1, 11);
    const n = int(r, 1, 12);
    return mk(c, {
      prompt: '빨간색으로 표시한 숫자는 무엇일까요?',
      say: '빨간색으로 표시한 숫자는 무엇일까요?',
      visual: clockVis(h, 0, { mark: n, size: 'lg' }),
      answer: numChoice(r, n, 1, 12, { spread: 3, say: sn }),
      hint: { say: '12는 맨 위, 3은 오른쪽, 6은 맨 아래, 9는 왼쪽에 있어요.' },
      explain: `빨간색 숫자는 ${n}${josa(String(n), '이에요/예요')}.`,
    });
  }
  const pos = pick(r, [
    { q: '시계에서 맨 위에 있는 숫자는 무엇일까요?', a: 12, wrong: [1, 6, 11] },
    { q: '시계에서 맨 아래에 있는 숫자는 무엇일까요?', a: 6, wrong: [12, 5, 7] },
    { q: '시계에서 가장 오른쪽에 있는 숫자는 무엇일까요?', a: 3, wrong: [9, 2, 4] },
    { q: '시계에서 가장 왼쪽에 있는 숫자는 무엇일까요?', a: 9, wrong: [3, 8, 10] },
  ]);
  return mk(c, {
    prompt: pos.q,
    say: pos.q,
    visual: clockVis(3, 0, { hands: 'none', size: 'lg' }),
    answer: buildChoice(r, numOpt(pos.a), pos.wrong.map(numOpt), 3),
    hint: { say: '시계 숫자는 1부터 12까지 시계 방향으로 놓여 있어요.', visual: clockVis(3, 0, { hands: 'none', size: 'md' }) },
    explain: `정답은 ${pos.a}${josa(String(pos.a), '이에요/예요')}.`,
  });
}

// ---------------------------------------------------------------------------
// 짧은바늘이 가리키는 숫자
// ---------------------------------------------------------------------------

export function hourHandGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const h = L === 1 ? pick(r, [3, 6, 9]) : int(r, 1, 11);
  if (L <= 2) {
    return mk(c, {
      prompt: '짧은바늘이 가리키는 숫자는 무엇일까요?',
      say: '짧은바늘이 가리키는 숫자는 무엇일까요?',
      visual: clockVis(h, 0, { mark: 'hour', size: 'lg' }),
      answer: numChoice(r, h, 1, 12, { say: sn, spread: L === 1 ? 3 : 1 }),
      hint: { say: '짧은 바늘은 굵고 짧아요. 그 끝이 가리키는 숫자를 봐요.' },
      explain: `짧은바늘은 ${h}${josa(String(h), '을/를')} 가리켜요.`,
    });
  }
  const wrongs = nearHours(h).filter((x) => x !== 12);
  return mk(c, {
    prompt: `짧은바늘이 ${h}${josa(String(h), '을/를')} 가리키는 시계는 어느 것일까요?`,
    say: `짧은바늘이 ${sn(h)}${josa(sn(h), '을/를')} 가리키는 시계는 어느 것일까요?`,
    answer: buildChoice(r, clockOption(h, 0, String(h)), wrongs.map((x) => clockOption(x, 0, String(x))), 3, 3),
    hint: { say: '숫자를 먼저 찾고, 짧은바늘이 그쪽을 가리키는지 봐요.' },
    explain: '짧은바늘이 그 숫자를 가리키는 시계를 찾으면 돼요.',
  });
}

// ---------------------------------------------------------------------------
// 정각 읽기
// ---------------------------------------------------------------------------

export function hourReadGen(cfg: { hours: number[] }) {
  return (c: GenCtx): Question => {
    const r = c.rng;
    const L = c.level;
    const h = pick(r, cfg.hours);
    const hint = {
      say: '긴바늘이 12에 있으면 몇 시 정각이에요. 짧은바늘이 가리키는 숫자를 읽어요.',
      visual: clockVis(h, 0, { mark: 'hour', size: 'md' }),
    };
    const explain = `짧은바늘이 ${h}에 있고 긴바늘이 12에 있어서 ${hourKo(h)}예요.`;
    if (L === 1) {
      return mk(c, {
        prompt: '지금은 몇 시일까요?',
        say: '지금은 몇 시일까요?',
        visual: clockVis(h, 0, { size: 'lg' }),
        answer: buildChoice(r, hourOption(h), nearHours(h).map(hourOption), 3),
        hint,
        explain,
      });
    }
    if (L === 2) {
      return mk(c, {
        prompt: `${timeText(h, 0)}를 나타내는 시계는 어느 것일까요?`,
        say: `${hourKo(h)}를 나타내는 시계는 어느 것일까요?`,
        answer: buildChoice(
          r,
          clockOption(h, 0, String(h)),
          nearHours(h).map((x) => clockOption(x, 0, String(x))),
          3,
          3,
        ),
        hint,
        explain,
      });
    }
    if (chance(r, 0.6)) {
      return mk(c, {
        prompt: `${timeText(h, 0)}가 되도록 짧은바늘을 움직여 보세요.`,
        say: `${hourKo(h)}가 되도록 짧은바늘을 움직여 보세요.`,
        answer: { t: 'clockSet', h, m: 0, mode: 'hour' },
        hint: { say: `짧은바늘을 끌어서 ${h}에 맞춰 봐요. 긴바늘은 12에 있어요.`, visual: clockVis(h, 0, { size: 'md' }) },
        explain,
      });
    }
    return mk(c, {
      prompt: '숫자가 없는 시계예요. 몇 시일까요?',
      say: '숫자가 없는 시계예요. 몇 시일까요?',
      visual: clockVis(h, 0, { numbers: false, size: 'lg' }),
      answer: buildChoice(r, hourOption(h), nearHours(h).map(hourOption), 3),
      hint: { ...hint, visual: clockVis(h, 0, { numbers: true, mark: 'hour', size: 'md' }) },
      explain,
    });
  };
}

// ---------------------------------------------------------------------------
// 아침·낮·저녁
// ---------------------------------------------------------------------------

type Part = 'morning' | 'noon' | 'evening' | 'night';
const PART: Record<Part, { name: string; emoji: string }> = {
  morning: { name: '아침', emoji: '🌅' },
  noon: { name: '낮', emoji: '☀️' },
  evening: { name: '저녁', emoji: '🌇' },
  night: { name: '밤', emoji: '🌙' },
};
const ACTS: { part: Part; emoji: string; label: string }[] = [
  { part: 'morning', emoji: '⏰', label: '알람 소리에 일어나요' },
  { part: 'morning', emoji: '🍚', label: '아침밥을 먹어요' },
  { part: 'morning', emoji: '🎒', label: '학교에 가요' },
  { part: 'noon', emoji: '🍱', label: '점심을 먹어요' },
  { part: 'noon', emoji: '⚽', label: '운동장에서 놀아요' },
  { part: 'noon', emoji: '☀️', label: '해가 하늘 높이 떠 있어요' },
  { part: 'evening', emoji: '🍲', label: '저녁밥을 먹어요' },
  { part: 'evening', emoji: '🌇', label: '해가 져요' },
  { part: 'evening', emoji: '🏠', label: '집에 돌아와요' },
  { part: 'night', emoji: '🌙', label: '달과 별이 떠요' },
  { part: 'night', emoji: '😴', label: '잠을 자요' },
];

export function daypartGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  if (L === 2 && chance(r, 0.55)) {
    // 바로 앞/뒤 때 묻기
    const seq: Part[] = ['morning', 'noon', 'evening'];
    const after = chance(r, 0.5);
    const idx = after ? int(r, 0, 1) : int(r, 1, 2);
    const base = seq[idx] as Part;
    const ans = seq[after ? idx + 1 : idx - 1] as Part;
    const opts: Option[] = seq.map((p) => ({ key: p, text: `${PART[p].emoji} ${PART[p].name}`, say: PART[p].name }));
    const baseName = PART[base].name;
    const ask = after ? `${baseName} 다음에는 언제가 올까요?` : `${baseName} 바로 앞은 언제일까요?`;
    return mk(c, {
      prompt: ask,
      say: ask,
      visual: { k: 'big', text: PART[base].emoji, sub: baseName },
      answer: buildChoice(r, opts.find((o) => o.key === ans) as Option, opts.filter((o) => o.key !== ans), 3, 3),
      hint: { say: '아침, 낮, 저녁 순서로 하루가 지나가요.' },
      explain: `${PART[ans].name}이에요. 아침, 낮, 저녁 순서예요.`,
    });
  }
  if (L === 2) {
    const items = (['morning', 'noon', 'evening'] as Part[]).map((p) => ({
      key: p,
      text: `${PART[p].emoji} ${PART[p].name}`,
      say: PART[p].name,
    }));
    return mk(c, {
      prompt: '하루는 어떤 순서로 지나갈까요? 먼저인 것부터 눌러 보세요.',
      say: '하루는 어떤 순서로 지나갈까요? 먼저인 것부터 눌러 보세요.',
      answer: { t: 'order', items: shuffleDiff(r, items, ['morning', 'noon', 'evening']), correct: ['morning', 'noon', 'evening'], style: 'cards' },
      hint: { say: '해가 뜨는 때가 아침, 해가 높은 때가 낮, 해가 지는 때가 저녁이에요.' },
      explain: '아침, 낮, 저녁 순서로 하루가 지나가요.',
    });
  }
  const pool = ACTS.filter((a) => (L === 3 ? true : a.part !== 'night'));
  const act = pick(r, pool);
  const parts: Part[] = L === 3 ? ['morning', 'noon', 'evening', 'night'] : ['morning', 'noon', 'evening'];
  const opts: Option[] = parts.map((p) => ({ key: p, text: PART[p].name, say: PART[p].name }));
  const correct = opts.find((o) => o.key === act.part) as Option;
  return mk(c, {
    prompt: `${act.label}. 하루 중 언제일까요?`,
    say: `${act.label}. 하루 중 언제일까요?`,
    visual: { k: 'big', text: act.emoji, sub: act.label },
    answer: buildChoice(r, correct, opts.filter((o) => o.key !== act.part), parts.length, parts.length === 4 ? 2 : 3),
    hint: { say: '해가 떠 있는지, 지고 있는지, 달이 떴는지 생각해 봐요.' },
    explain: `${PART[act.part].name}이에요.`,
  });
}
