import { withJosa } from '../ko';
import { chance, int, pick, sample, shuffle } from '../rng';
import type { GenCtx, Option, Question, ShapeKind, Solid, TapItem, Tone, Visual } from '../types';
import { buildChoice, mk, numChoice } from './util';

// ---------------------------------------------------------------------------
// 입체 모양 (상자·둥근 기둥·공)
// ---------------------------------------------------------------------------

export const SOLID_NAME: Record<Solid, string> = { box: '상자 모양', cylinder: '둥근 기둥 모양', ball: '공 모양' };
export const SOLID_ITEMS: Record<Solid, { emoji: string; name: string }[]> = {
  box: [
    { emoji: '📦', name: '택배 상자' },
    { emoji: '🎁', name: '선물 상자' },
    { emoji: '📺', name: '텔레비전' },
    { emoji: '📚', name: '책' },
  ],
  cylinder: [
    { emoji: '🥫', name: '통조림' },
    { emoji: '🥁', name: '북' },
    { emoji: '🛢️', name: '드럼통' },
    { emoji: '🕯️', name: '양초' },
  ],
  ball: [
    { emoji: '⚽', name: '축구공' },
    { emoji: '🏀', name: '농구공' },
    { emoji: '🌍', name: '지구본' },
    { emoji: '🎾', name: '테니스공' },
  ],
};
export const SOLIDS: Solid[] = ['box', 'cylinder', 'ball'];

const solidOpt = (s: Solid): Option => ({
  key: s,
  visual: { k: 'solid', solid: s, size: 64 },
  text: SOLID_NAME[s],
  say: SOLID_NAME[s],
});

export function solidGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  if (L === 1) {
    const s = pick(r, SOLIDS);
    const item = pick(r, SOLID_ITEMS[s]);
    return mk(c, {
      prompt: `${withJosa(item.name, '은/는')} 어떤 모양일까요?`,
      say: `${withJosa(item.name, '은/는')} 어떤 모양일까요?`,
      visual: { k: 'big', text: item.emoji, sub: item.name },
      answer: buildChoice(r, solidOpt(s), SOLIDS.filter((x) => x !== s).map(solidOpt), 3, 3),
      hint: { say: '둥글게 굴러가는지, 평평한 면이 있는지 생각해 봐요.' },
      explain: `${withJosa(item.name, '은/는')} ${SOLID_NAME[s]}이에요.`,
    });
  }
  if (L === 2) {
    const s = pick(r, SOLIDS);
    const targets = sample(r, SOLID_ITEMS[s], 2);
    const rest = shuffle(
      r,
      SOLIDS.filter((x) => x !== s).flatMap((x) => SOLID_ITEMS[x]),
    ).slice(0, 4);
    const items: TapItem[] = shuffle(r, [...targets, ...rest]).map((it) => ({ key: it.emoji, text: it.emoji, say: it.name }));
    return mk(c, {
      prompt: `${SOLID_NAME[s]}을 모두 찾아 눌러 보세요.`,
      say: `${SOLID_NAME[s]}을 모두 찾아 눌러 보세요.`,
      answer: { t: 'tapTargets', items, targets: targets.map((t) => t.emoji), cols: 3, need: 'all' },
      hint: { say: `${SOLID_NAME[s]}과 닮은 물건을 찾아 봐요.`, visual: { k: 'solid', solid: s, size: 96 } },
      explain: `${SOLID_NAME[s]}은 ${targets.map((t) => t.name).join(', ')} 두 가지예요.`,
    });
  }
  const facts: { s: Solid; text: string }[] = [
    { s: 'ball', text: '어느 쪽으로든 잘 굴러가고 쌓기 어려워요.' },
    { s: 'box', text: '평평한 면이 있어서 잘 쌓을 수 있고, 굴러가지 않아요.' },
    { s: 'cylinder', text: '세우면 쌓을 수 있고, 눕히면 굴러가요.' },
  ];
  const f = pick(r, facts);
  return mk(c, {
    prompt: `${f.text} 어떤 모양일까요?`,
    say: `${f.text} 어떤 모양일까요?`,
    answer: buildChoice(r, solidOpt(f.s), SOLIDS.filter((x) => x !== f.s).map(solidOpt), 3, 3),
    hint: { say: '상자, 둥근 기둥, 공을 하나씩 떠올려 봐요.' },
    explain: `${SOLID_NAME[f.s]}이에요.`,
  });
}

// ---------------------------------------------------------------------------
// 평면 모양 (네모·세모·동그라미)
// ---------------------------------------------------------------------------

export type Flat = '네모' | '세모' | '동그라미';
export const FLAT_KINDS: Record<Flat, ShapeKind[]> = { 네모: ['square', 'rect'], 세모: ['triangle'], 동그라미: ['circle'] };
export const FLATS: Flat[] = ['네모', '세모', '동그라미'];
export const TONES: Tone[] = ['sky', 'tangerine', 'leaf', 'grape', 'rose', 'sun'];

export function flatVisual(r: GenCtx['rng'], f: Flat, size = 72): Visual {
  const shape = pick(r, FLAT_KINDS[f]);
  const rot = f === '세모' ? pick(r, [0, 0, 12, -12]) : 0;
  return { k: 'shape', shape, color: pick(r, TONES), rot, size };
}

export function shape2dGen(c: GenCtx): Question {
  const r = c.rng;
  const L = c.level;
  const f = pick(r, FLATS);

  if (L === 1) {
    if (chance(r, 0.5)) {
      const opts: Option[] = FLATS.map((x) => ({ key: x, text: x, say: x }));
      return mk(c, {
        prompt: '이 모양의 이름은 무엇일까요?',
        say: '이 모양의 이름은 무엇일까요?',
        visual: flatVisual(r, f, 120),
        answer: buildChoice(r, opts.find((o) => o.key === f) as Option, opts.filter((o) => o.key !== f), 3),
        hint: { say: '뾰족한 곳이 세 개면 세모, 네 개면 네모, 뾰족한 곳이 없으면 동그라미예요.' },
        explain: `${f} 모양이에요.`,
      });
    }
    const toOpt = (x: Flat): Option => ({ key: x, visual: flatVisual(r, x, 72), say: x });
    return mk(c, {
      prompt: `${f} 모양은 어느 것일까요?`,
      say: `${f} 모양은 어느 것일까요?`,
      answer: buildChoice(r, toOpt(f), FLATS.filter((x) => x !== f).map(toOpt), 3, 3),
      hint: { say: '뾰족한 곳이 몇 개인지 세어 봐요.' },
      explain: `${f} 모양은 이거예요.`,
    });
  }

  const count = L === 2 ? 8 : int(r, 6, 9);
  const targetN = L === 2 ? int(r, 2, 3) : int(r, 2, 5);
  const kinds: Flat[] = [];
  for (let i = 0; i < count; i++) kinds.push(i < targetN ? f : pick(r, FLATS.filter((x) => x !== f)));
  const mixed = shuffle(r, kinds);

  if (L === 2) {
    const items: TapItem[] = mixed.map((x, i) => ({ key: `s${i}`, visual: flatVisual(r, x, 56), say: x }));
    const targets = mixed.map((x, i) => (x === f ? `s${i}` : '')).filter(Boolean);
    return mk(c, {
      prompt: `${f} 모양을 모두 찾아 눌러 보세요.`,
      say: `${f} 모양을 모두 찾아 눌러 보세요.`,
      answer: { t: 'tapTargets', items, targets, cols: 4, need: 'all' },
      hint: { say: '뾰족한 곳을 세어 보면서 찾아 봐요.' },
      explain: `${f} 모양은 모두 ${targets.length}개예요.`,
    });
  }

  return mk(c, {
    prompt: `${f} 모양은 모두 몇 개일까요?`,
    say: `${f} 모양은 모두 몇 개일까요?`,
    visual: { k: 'row', items: mixed.map((x) => flatVisual(r, x, 56)), gap: 10, wrap: true },
    answer: numChoice(r, targetN, 1, 7, { say: (n) => `${n}개`, text: (n) => `${n}개` }),
    hint: { say: `${f} 모양만 하나씩 짚으면서 세어 봐요.` },
    explain: `${f} 모양은 모두 ${targetN}개예요.`,
  });
}
