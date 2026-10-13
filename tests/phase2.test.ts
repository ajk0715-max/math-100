import { describe, expect, it } from 'vitest';
import type { AttemptRec, SessionRec } from '../src/db/db';
import { lastReadyDay, lessonFor } from '../src/core/curriculum';
import {
  DIAG_ITEMS,
  PASS_PER_TIER,
  applyPlacement,
  diagSeed,
  nextIndex,
  suggestBlock,
  summarize,
  tiersPassed,
  type DiagAnswer,
} from '../src/core/diagnostic';
import { EXTRA_GAMES, buildExtraPlan, unlockedGames } from '../src/core/extra';
import { EXTRA_MIN_MS, extraAvailable, extraBudgetMs, gate, hmText, parseHm } from '../src/core/limits';
import { newProfile, type Profile } from '../src/core/model';
import { blockState, canSkip, moveToBlock } from '../src/core/progress';
import { attemptsToCsv, dayReport, rangeReport, weakRows } from '../src/core/report';
import { generate } from '../src/core/question';
import { finishBoss, type BossOutcome } from '../src/core/session';
import { getSkill } from '../src/core/skills';
import { SLOTS, VILLAGE_ITEMS, buyItem, canBuy, emptySlots, itemById, layout, villageStage } from '../src/core/village';
import { cancelWish, decideWish, normalizeReward, pendingWishes, requestWish, type RewardDef } from '../src/core/wishes';
import { toParts } from '../src/core/dates';
import { questionProblems } from '../src/core/validate';

const prof = (over: Partial<Profile> = {}): Profile => ({ ...newProfile({ id: 'p1', nickname: '하준', avatar: '🐻', now: 1, seedSalt: 12345 }), ...over });

describe('마을 꾸미기', () => {
  it('아이템 id는 겹치지 않고 종류별 자리 수를 넘지 않는다', () => {
    expect(new Set(VILLAGE_ITEMS.map((i) => i.id)).size).toBe(VILLAGE_ITEMS.length);
    expect(new Set(VILLAGE_ITEMS.map((i) => i.emoji)).size).toBe(VILLAGE_ITEMS.length);
    for (const cat of ['house', 'animal', 'garden', 'play'] as const) {
      expect(VILLAGE_ITEMS.filter((i) => i.cat === cat).length).toBeLessThanOrEqual(SLOTS[cat].length);
    }
  });

  it('값은 양수이고 전부 사도 별 총량(약 600개)보다 적다', () => {
    const sum = VILLAGE_ITEMS.reduce((t, i) => t + i.cost, 0);
    expect(VILLAGE_ITEMS.every((i) => i.cost > 0 && i.from >= 1 && i.from <= 100)).toBe(true);
    expect(sum).toBeLessThan(500);
  });

  it('별이 모자라거나 아직 열리지 않았거나 이미 가졌으면 살 수 없다', () => {
    const castle = itemById('castle')!;
    const p = prof({ stars: 100, day: 10 });
    expect(canBuy(p, castle)).toEqual({ ok: false, reason: 'locked', from: 60 });
    expect(canBuy(prof({ stars: 3 }), itemById('hut')!)).toEqual({ ok: false, reason: 'stars', need: 5 });
    const bought = buyItem(prof({ stars: 10 }), 'hut')!;
    expect(bought.stars).toBe(2);
    expect(bought.village).toEqual(['hut']);
    expect(canBuy(bought, itemById('hut')!)).toEqual({ ok: false, reason: 'owned' });
    expect(buyItem(bought, 'hut')).toBeNull();
    expect(buyItem(p, 'nope')).toBeNull();
  });

  it('되돌려도 이미 열린 물건은 계속 살 수 있다', () => {
    const p = prof({ stars: 50, day: 3, doneDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25] });
    expect(canBuy(p, itemById('school')!).ok).toBe(true);
  });

  it('산 순서대로 종류별 자리에 놓이고 같은 자리를 두 번 쓰지 않는다', () => {
    const all = VILLAGE_ITEMS.map((i) => i.id);
    const placed = layout(all);
    expect(placed).toHaveLength(all.length);
    const keys = placed.map((x) => `${x.item.cat}:${x.slot.x},${x.slot.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(emptySlots(all).length).toBe(Object.values(SLOTS).reduce((t, s) => t + s.length, 0) - all.length);
    expect(layout(['unknown'])).toEqual([]);
  });

  it('마을은 Day에 따라 네 단계로 자란다', () => {
    expect([1, 25, 26, 50, 51, 75, 76, 100].map(villageStage)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('실물 보상 요청', () => {
  const def: RewardDef = { id: 'r1', title: '아이스크림 먹기', emoji: '🍦', cost: 30 };

  it('별을 먼저 내고 요청하며, 별이 모자라거나 같은 요청이 대기 중이면 못 한다', () => {
    expect(requestWish(prof({ stars: 29 }), def, 1, 'w1')).toBeNull();
    const p = requestWish(prof({ stars: 40 }), def, 5, 'w1')!;
    expect(p.stars).toBe(10);
    expect(pendingWishes(p)).toHaveLength(1);
    expect(requestWish({ ...p, stars: 99 }, def, 6, 'w2')).toBeNull();
  });

  it('허락하면 별이 그대로 쓰인 것이 되고, 거절하면 돌려 준다', () => {
    const p = requestWish(prof({ stars: 40 }), def, 5, 'w1')!;
    const ok = decideWish(p, 'w1', true, 9);
    expect(ok.stars).toBe(10);
    expect(ok.wishes[0]).toMatchObject({ status: 'approved', decidedAt: 9 });
    const no = decideWish(p, 'w1', false, 9);
    expect(no.stars).toBe(40);
    expect(no.wishes[0]?.status).toBe('declined');
    // 이미 처리한 요청은 다시 바뀌지 않는다
    expect(decideWish(no, 'w1', true, 10)).toBe(no);
  });

  it('기다리는 요청을 취소하면 별을 돌려받고, 이미 처리된 요청은 건드리지 않는다', () => {
    const p = requestWish(prof({ stars: 40 }), def, 5, 'w1')!;
    const c = cancelWish(p, 'w1');
    expect(c.stars).toBe(40);
    expect(c.wishes).toHaveLength(0);
    expect(cancelWish(p, 'nope')).toBe(p);
    const approved = decideWish(p, 'w1', true, 9);
    expect(cancelWish(approved, 'w1')).toBe(approved);
  });

  it('보상 입력값을 정리한다', () => {
    expect(normalizeReward({ title: '  영상   보기 ', emoji: '', cost: 40.4 }, 'x')).toEqual({ id: 'x', title: '영상 보기', emoji: '🎁', cost: 40 });
    expect(normalizeReward({ title: '', emoji: '🍦', cost: 10 }, 'x')).toBeNull();
    expect(normalizeReward({ title: '가', emoji: '🍦', cost: 0 }, 'x')).toBeNull();
    expect(normalizeReward({ title: '가', emoji: '🍦', cost: 5000 }, 'x')).toBeNull();
  });
});

describe('시간 제한', () => {
  const at = (h: number, m = 0, day = 3) => new Date(2026, 9, 6 + (day - 2), h, m); // 2026-10-06은 화요일(2)
  const today = '2026-10-07';

  it('시각 문자열을 읽고 쓴다', () => {
    expect(parseHm('07:30')).toBe(450);
    expect(parseHm('7:05')).toBe(425);
    expect(parseHm('25:00')).toBeNull();
    expect(parseHm('abc')).toBeNull();
    expect(hmText(450)).toBe('07:30');
  });

  it('허용 시간대 밖이면 이유와 함께 닫힌다', () => {
    const p = prof();
    expect(gate(p, at(6, 59), today, 0)).toMatchObject({ open: false, reason: 'before' });
    expect(gate(p, at(7, 0), today, 0).open).toBe(true);
    expect(gate(p, at(20, 59), today, 0).open).toBe(true);
    expect(gate(p, at(21, 0), today, 0)).toMatchObject({ open: false, reason: 'after' });
  });

  it('쉬는 요일과 하루 상한', () => {
    const p = prof({ settings: { ...prof().settings, studyDays: [1, 2, 3, 4, 5] } });
    expect(gate(p, at(10, 0, 3), today, 0).open).toBe(true);
    expect(gate(p, new Date(2026, 9, 11, 10), '2026-10-11', 0)).toMatchObject({ open: false, reason: 'restday' }); // 일요일
    expect(gate(prof(), at(10), today, 20 * 60_000)).toMatchObject({ open: false, reason: 'cap' });
    expect(gate(prof(), at(10), today, 19 * 60_000)).toMatchObject({ open: true, remainMs: 60_000 });
  });

  it('하루 하나 설정과 부모가 열어 준 추가 수업', () => {
    const done = prof({ lastLessonDate: today });
    expect(gate(done, at(10), today, 5 * 60_000)).toMatchObject({ open: false, reason: 'done' });
    expect(gate({ ...done, extraLessonDate: today }, at(10), today, 5 * 60_000).open).toBe(true);
    expect(gate({ ...done, settings: { ...done.settings, oneLessonPerDay: false } }, at(10), today, 5 * 60_000).open).toBe(true);
  });

  it('추가 놀이는 5분까지, 하루 상한을 넘지 않는다', () => {
    const done = prof({ lastLessonDate: today });
    expect(extraBudgetMs(done, 15 * 60_000)).toBe(5 * 60_000);
    expect(extraBudgetMs(done, 18 * 60_000)).toBe(2 * 60_000);
    expect(extraBudgetMs(done, 21 * 60_000)).toBe(0);
    expect(extraAvailable(done, at(10), today, 15 * 60_000)).toBe(true);
    expect(extraAvailable(done, at(10), today, 20 * 60_000)).toBe(false);
    expect(extraAvailable(prof(), at(10), today, 0)).toBe(false); // 아직 수업 전
    expect(extraAvailable(done, at(22), today, 10 * 60_000)).toBe(false); // 시간대 밖
    expect(extraAvailable({ ...done, settings: { ...done.settings, extraMin: 0 } }, at(10), today, 0)).toBe(false);
  });

  it('하루 추가 놀이 시간은 여러 번 나눠 놀아도 합쳐서 extraMin까지다', () => {
    const done = prof({ lastLessonDate: today });
    // 수업 8분 + 추가 놀이 3분을 이미 썼다 → 추가 놀이는 2분 남는다
    expect(extraBudgetMs(done, 11 * 60_000, 3 * 60_000)).toBe(2 * 60_000);
    expect(extraBudgetMs(done, 11 * 60_000, 5 * 60_000)).toBe(0);
    expect(extraAvailable(done, at(10), today, 11 * 60_000, 3 * 60_000)).toBe(true);
    expect(extraAvailable(done, at(10), today, 11 * 60_000, 5 * 60_000)).toBe(false);
    // 하루 상한이 먼저 닫아도 못 논다
    expect(extraAvailable(done, at(10), today, 20 * 60_000 - EXTRA_MIN_MS + 1, 0)).toBe(false);
    expect(extraAvailable(done, at(10), today, 20 * 60_000 - EXTRA_MIN_MS, 0)).toBe(true);
  });
});

describe('추가 놀이 계획', () => {
  const env = { today: toParts(new Date(2026, 9, 13)), events: [] };
  const first5 = [1, 2, 3, 4, 5];

  it('아직 한 날이 없으면 게임이 없다', () => {
    expect(unlockedGames([])).toEqual([]);
    expect(buildExtraPlan(prof(), 0)).toEqual([]);
  });

  it('마친 날의 보너스 게임만 열리고, 같은 게임은 한 번만 나온다', () => {
    const one = unlockedGames([1]);
    expect(one).toHaveLength(1);
    expect(one[0]?.day).toBe(1);
    const lesson = lessonFor(1);
    expect(one[0]?.skill).toBe(lesson?.game?.skill);

    const many = unlockedGames([...first5, 6, 7, 8]);
    expect(new Set(many.map((g) => g.skill)).size).toBe(many.length);
    // 건너뛴 날(3, 4, 5…)의 게임은 열리지 않는다: 1·2·21·22일만 했다면 그 날들에서만 나온다
    const done = [1, 2, 21, 22];
    const fromSkipped = unlockedGames(done).filter((g) => !done.includes(g.day));
    expect(fromSkipped).toEqual([]);
    expect(unlockedGames([26]).every((g) => g.day === 26)).toBe(true);
  });

  it('슬롯은 게임 스킬만 쓰고 열린 게임 중에서 고른다', () => {
    const doneDays = Array.from({ length: 30 }, (_, i) => i + 1);
    const p = prof({ doneDays });
    const open = new Set(unlockedGames(doneDays).map((g) => g.skill));
    const plan = buildExtraPlan(p, 0);
    expect(plan.length).toBeGreaterThan(0);
    for (const s of plan) {
      expect(getSkill(s.skill).game, s.skill).toBeTruthy();
      expect(open.has(s.skill), s.skill).toBe(true);
      expect(s.section).toBe('game');
      expect(s.level).toBeDefined();
    }
    expect(new Set(plan.map((s) => s.skill)).size).toBeLessThanOrEqual(EXTRA_GAMES);
    expect(plan.map((s) => s.id)).toEqual(plan.map((_, i) => i));
  });

  it('같은 run은 같은 계획이고, run이 바뀌면 문제가 달라진다', () => {
    const p = prof({ doneDays: Array.from({ length: 20 }, (_, i) => i + 1) });
    expect(buildExtraPlan(p, 3)).toEqual(buildExtraPlan(p, 3));
    const a = buildExtraPlan(p, 0).map((s) => s.seed).join(',');
    const b = buildExtraPlan(p, 1).map((s) => s.seed).join(',');
    expect(a).not.toBe(b);
  });

  it('만든 문제는 모두 올바르다', () => {
    const p = prof({ doneDays: Array.from({ length: 40 }, (_, i) => i + 1) });
    for (let run = 0; run < 6; run++) {
      for (const s of buildExtraPlan(p, run)) {
        const q = generate({ skill: s.skill, level: s.level ?? 1, seed: s.seed }, env);
        expect(questionProblems(q), `${s.skill} L${s.level} run${run}`).toEqual([]);
      }
    }
  });
});

describe('시작 진단', () => {
  const env = { today: toParts(new Date(2026, 9, 13)), events: [] };

  it('문항은 12개이고 모두 올바른 문제를 만든다', () => {
    expect(DIAG_ITEMS).toHaveLength(12);
    DIAG_ITEMS.forEach((it, i) => {
      for (let k = 0; k < 40; k++) {
        const q = generate({ skill: it.skill, level: it.level, seed: diagSeed(prof(), i) + k }, env);
        expect(questionProblems(q), `${it.skill} ${k}`).toEqual([]);
      }
    });
  });

  it('진단 문항의 스킬은 모두 1~10블록 안에서 가르친다', () => {
    for (const it of DIAG_ITEMS) {
      let found = false;
      for (let d = 1; d <= lastReadyDay() && !found; d++) found = !!lessonFor(d)?.explore.some((u) => u.skill === it.skill);
      expect(found, it.skill).toBe(true);
    }
  });

  const answerAll = (rule: (i: number) => boolean): DiagAnswer[] => {
    const out: DiagAnswer[] = [];
    for (let next = nextIndex(out); next !== null; next = nextIndex(out)) out.push({ index: next, correct: rule(next) });
    return out;
  };

  it('모두 맞히면 열두 문제를 다 풀고 가장 높은 블록을 제안한다', () => {
    const a = answerAll(() => true);
    expect(a).toHaveLength(12);
    const r = summarize(a, 10);
    expect(r).toMatchObject({ asked: 12, right: 12, tiers: 4, suggested: 10 });
    expect(r.byArea.num).toEqual({ asked: 4, right: 4 });
  });

  it('첫 단계에서 두 번 틀리면 거기서 멈추고 1블록부터 시작을 제안한다', () => {
    const a = answerAll((i) => i === 0);
    expect(a).toHaveLength(3);
    expect(summarize(a)).toMatchObject({ asked: 3, tiers: 0, suggested: 1 });
    const early = answerAll(() => false);
    expect(early).toHaveLength(2);
  });

  it('통과한 단계 수에 따라 블록을 제안한다', () => {
    const upTo = (tiers: number) => answerAll((i) => (DIAG_ITEMS[i] as { tier: number }).tier <= tiers);
    expect([0, 1, 2, 3, 4].map((t) => summarize(upTo(t), 10).suggested)).toEqual([1, 3, 6, 8, 10]);
    expect(suggestBlock(4, 20)).toBe(11);
  });

  it('한 단계에서 한 번 틀려도 두 번 맞히면 통과한다', () => {
    const a = answerAll((i) => i !== 1);
    expect(tiersPassed(a)).toBe(4);
    expect(PASS_PER_TIER).toBe(2);
  });

  it('확정한 블록 앞은 건너뜀으로 표시하고 Day를 옮긴다', () => {
    const p = applyPlacement(prof(), 6, { asked: 9, right: 8, tiers: 2, suggested: 6 }, 99);
    expect(p.day).toBe(26);
    expect(p.startBlock).toBe(6);
    for (let b = 1; b <= 5; b++) {
      expect(p.blocks[b]).toMatchObject({ skipped: true, gold: false });
      expect(p.stickers[b]).toBe('normal');
    }
    expect(p.blocks[6]).toBeUndefined();
    expect(p.diagnostic).toMatchObject({ chosen: 6, suggested: 6, tiers: 2 });
    expect(p.stars).toBe(0);
  });

  it('이미 통과한 블록의 기록은 바꾸지 않는다', () => {
    const base = prof({ blocks: { 1: { tries: 2, best: 0.9, passedAt: 5, gold: true } }, stickers: { 1: 'gold' } });
    const p = applyPlacement(base, 3, null, 1);
    expect(p.blocks[1]).toEqual({ tries: 2, best: 0.9, passedAt: 5, gold: true });
    expect(p.stickers[1]).toBe('gold');
    expect(p.blocks[2]?.skipped).toBe(true);
    expect(p.day).toBe(11);
  });

  it('다시 진단하면 다른 문제가 나오고, 같은 진단은 같은 문제가 나온다', () => {
    const p = prof();
    expect(diagSeed(p, 4)).toBe(diagSeed(p, 4, 0));
    expect(diagSeed(p, 4, 1_700_000_000_000)).toBe(diagSeed(p, 4, 1_700_000_000_000));
    for (let i = 0; i < DIAG_ITEMS.length; i++) expect(diagSeed(p, i, 1_700_000_000_000)).not.toBe(diagSeed(p, i));
  });
});

describe('보스 건너뛰기', () => {
  const win: BossOutcome = { correct: 13, total: 15, passed: true, wrongBySkill: [] };
  const today = '2026-10-13';
  const atBlock3 = () => prof({ day: 11, doneDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], blocks: { 1: { tries: 1, best: 1, passedAt: 5, gold: true }, 2: { tries: 1, best: 0.9, passedAt: 10, gold: true } }, stickers: { 1: 'gold', 2: 'gold' } });

  it('건너뛰기로 통과하면 보스 날만 마친 것으로 하고 블록을 건너뜀으로 표시한다', () => {
    const p = finishBoss(atBlock3(), 3, win, 13 / 15, today, true);
    expect(p.doneDays).toContain(15);
    for (const d of [11, 12, 13, 14]) expect(p.doneDays).not.toContain(d);
    expect(p.day).toBe(16);
    expect(p.blocks[3]).toMatchObject({ tries: 1, passedAt: 15, skipped: true, gold: true });
    expect(p.stickers[3]).toBe('gold');
    expect(p.stars).toBe(10);
    expect(p.lastLessonDate).toBe(today);
  });

  it('일반 보스 통과는 건너뜀으로 표시하지 않는다', () => {
    const p = finishBoss(atBlock3(), 3, win, 0, today);
    expect(p.blocks[3]?.skipped).toBeUndefined();
    expect(p.stickers[3]).toBe('normal');
  });

  it('이미 통과한 블록을 건너뛰기로 다시 풀어도 건너뜀으로 바뀌지 않고 별을 또 주지 않는다', () => {
    const once = finishBoss(atBlock3(), 3, win, 0, today);
    const again = finishBoss(once, 3, win, 0, today, true);
    expect(again.blocks[3]?.skipped).toBeUndefined();
    expect(again.stars).toBe(once.stars);
  });

  it('한 번 건너뜀으로 표시된 블록은 나중에 다시 통과해도 건너뜀 표시를 지키고 금 스티커로 올릴 수 있다', () => {
    const skipped = finishBoss(atBlock3(), 3, { ...win, correct: 12 }, 0, today, true);
    expect(skipped.stickers[3]).toBe('normal');
    const again = finishBoss(skipped, 3, win, 0.9, today);
    expect(again.blocks[3]?.skipped).toBe(true);
    expect(again.stickers[3]).toBe('gold');
    expect(again.stars).toBe(skipped.stars);
  });
});

describe('진도 지도', () => {
  it('블록 상태를 구분한다', () => {
    const p = prof({
      day: 12,
      blocks: { 1: { tries: 1, best: 1, passedAt: 5, gold: true }, 2: { tries: 0, best: 0, passedAt: 10, gold: false, skipped: true } },
      stickers: { 1: 'gold', 2: 'normal' },
    });
    expect(blockState(p, 1)).toBe('gold');
    expect(blockState(p, 2)).toBe('skipped');
    expect(blockState(p, 3)).toBe('current');
    expect(blockState(p, 4)).toBe('upcoming');
    expect(blockState(p, 11)).toBe('upcoming');
    expect(blockState(p, 20)).toBe('upcoming');
    expect(blockState({ ...p, day: 22 }, 3)).toBe('moved');
  });

  it('건너뛰기 도전은 지금 하는 블록에만 열린다', () => {
    const p = prof({ day: 12 });
    expect(canSkip(p, 3)).toBe(true);
    expect(canSkip(p, 4)).toBe(false);
    expect(canSkip(p, 11)).toBe(false);
  });

  it('블록의 첫 날로 옮기고 기록은 지키지 않는다', () => {
    const p = prof({ day: 33, stars: 12, stickers: { 1: 'gold' } });
    const q = moveToBlock(p, 4, '2026-10-13');
    expect(q.day).toBe(16);
    expect(q.stars).toBe(12);
    expect(q.stickers).toEqual({ 1: 'gold' });
    expect(q.extraLessonDate).toBe('2026-10-13');
  });
});

describe('리포트', () => {
  const t = (h: number, m = 0) => new Date(2026, 9, 13, h, m).getTime();
  const att = (over: Partial<AttemptRec>): AttemptRec => ({
    profileId: 'p1',
    sessionId: 's1',
    day: 26,
    section: 'explore',
    skill: 'add.eq5',
    level: 1,
    seed: 1,
    correctFirst: true,
    tries: 1,
    hinted: false,
    revealed: false,
    ms: 4200,
    expected: '3',
    given: '3',
    confusion: null,
    ts: t(10),
    ...over,
  });
  const ses = (over: Partial<SessionRec>): SessionRec => ({
    id: 's1',
    profileId: 'p1',
    date: '2026-10-13',
    day: 26,
    kind: 'lesson',
    run: 0,
    startedAt: t(10),
    activeMs: 11 * 60_000,
    plan: { day: 26, kind: 'lesson', run: 0, slots: [] },
    cursor: 0,
    introSeen: true,
    completed: true,
    firstOfDay: true,
    ...over,
  });

  it('하루 리포트: 완료 여부, 시간, 영역별 정답률, 힌트', () => {
    const attempts = [
      att({}),
      att({ correctFirst: false, tries: 2, hinted: true, confusion: '덧셈 하나 차이로 틀림', given: '4' }),
      att({ skill: 'clk.hour.a', correctFirst: true }),
      att({ skill: 'cal.today', correctFirst: false, tries: 3, revealed: true }),
      att({ ts: t(10) - 86_400_000 * 2 }), // 이틀 전
    ];
    const r = dayReport('2026-10-13', [ses({}), ses({ id: 's0', date: '2026-10-12', activeMs: 60_000 })], attempts);
    expect(r).toMatchObject({ sessions: 1, finished: true, minutes: 11, solved: 4, firstRight: 2, hints: 1, revealed: 1 });
    expect(r.areas.find((a) => a.area === 'num')).toMatchObject({ solved: 2, firstRight: 1, label: '수와 연산' });
    expect(r.areas.map((a) => a.area).sort()).toEqual(['cal', 'clock', 'num']);
  });

  it('끝내지 못한 수업과 추가 놀이는 완료로 세지 않는다', () => {
    expect(dayReport('2026-10-13', [ses({ completed: false })], []).finished).toBe(false);
    expect(dayReport('2026-10-13', [ses({ kind: 'extra' })], []).finished).toBe(false);
    expect(dayReport('2026-10-13', [], []).finished).toBe(false);
  });

  it('시작 진단과 추가 놀이는 정답률 통계에 넣지 않고 시간만 센다', () => {
    const attempts = [att({}), att({ section: 'diag', day: 0, correctFirst: false }), att({ section: 'extra', skill: 'clk.hour.a', correctFirst: false })];
    const r = dayReport('2026-10-13', [ses({}), ses({ id: 'x', kind: 'extra', activeMs: 3 * 60_000, completed: true })], attempts);
    expect(r).toMatchObject({ sessions: 2, finished: true, minutes: 14, extraMinutes: 3, solved: 1, firstRight: 1 });
    expect(r.areas.map((a) => a.area)).toEqual(['num']);
    expect(dayReport('2026-10-13', [ses({})], attempts).extraMinutes).toBe(0);
  });

  it('약점 목록은 3번 이상 쌓인 혼동만 보여 주고 유형 이름을 붙인다', () => {
    const p = prof({
      skills: {
        'clk.hour.a': { level: 1, seen: 9, right: 4, streakRight: 0, streakWrong: 0, autoHint: false, lastDay: 3, confusions: { '2시와 3시 혼동': 3, '1시와 2시 혼동': 2 } },
      },
    });
    expect(weakRows(p)).toEqual([{ label: '2시와 3시 혼동', skill: 'clk.hour.a', skillName: '정각 읽기 (1~3시)', count: 3 }]);
  });

  it('구간 리포트는 Day 범위만 모은다', () => {
    const r = rangeReport([att({ day: 3 }), att({ day: 30 }), att({ day: 50, correctFirst: false, hinted: true })], [ses({ day: 3 }), ses({ id: 'b', day: 30 }), ses({ id: 'c', day: 30, kind: 'extra' })], 1, 50);
    expect(r).toMatchObject({ solved: 3, firstRight: 2, hints: 1, days: 2 });
    expect(rangeReport([att({ day: 60 })], [], 1, 50).solved).toBe(0);
  });

  it('구간 리포트도 진단·추가 놀이 풀이는 빼고 센다', () => {
    const r = rangeReport([att({ day: 3 }), att({ day: 3, section: 'extra' }), att({ day: 3, section: 'diag' })], [ses({ day: 3 })], 1, 50);
    expect(r.solved).toBe(1);
  });

  it('CSV는 BOM과 머리글이 있고 쉼표·따옴표를 안전하게 감싼다', () => {
    const csv = attemptsToCsv([att({ expected: '3, 4', given: '말 "A"', confusion: '덧셈 하나 차이로 틀림', ts: t(9, 5) })]);
    expect(csv.startsWith('﻿날짜,시각,Day,구분')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-10-13,09:05,26,탐험,수와 연산,덧셈식 (합 5 이하),1,O,1,X,X,4.2,"3, 4","말 ""A""",덧셈 하나 차이로 틀림');
  });
});
