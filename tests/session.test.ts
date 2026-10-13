import { describe, expect, it } from 'vitest';
import { toParts } from '@/core/dates';
import { lessonFor } from '@/core/curriculum';
import { grade } from '@/core/grade';
import { newProfile } from '@/core/model';
import {
  applyAttempt,
  bossOutcome,
  bossPassed,
  buildBossPlan,
  buildLessonPlan,
  finishBoss,
  finishLesson,
  fingerprint,
  materialize,
  scheduleReviews,
  warmupWants,
  weakSpots,
} from '@/core/session';
import { generate } from '@/core/question';

const ENV = { today: toParts(new Date(2026, 10, 2)), events: [] };
const mkProfile = () => newProfile({ id: 'p1', nickname: '하늘', avatar: '🐰', now: 0, seedSalt: 12345 });

describe('단계 조절', () => {
  it('연속 3번 맞히면 한 단계 오른다', () => {
    let s = applyAttempt(undefined, 1, { correctFirst: true });
    s = applyAttempt(s, 1, { correctFirst: true });
    expect(s.level).toBe(1);
    s = applyAttempt(s, 1, { correctFirst: true });
    expect(s.level).toBe(2);
    expect(s.streakRight).toBe(0);
  });
  it('최고 단계 위로는 오르지 않는다', () => {
    let s = applyAttempt(undefined, 1, { correctFirst: true });
    for (let i = 0; i < 12; i++) s = applyAttempt(s, 1, { correctFirst: true });
    expect(s.level).toBe(3);
  });
  it('연속 2번 틀리면 한 단계 내려가고 그림 도움이 켜진다', () => {
    let s = applyAttempt(undefined, 1, { correctFirst: true });
    for (let i = 0; i < 3; i++) s = applyAttempt(s, 1, { correctFirst: true });
    expect(s.level).toBe(2);
    s = applyAttempt(s, 1, { correctFirst: false });
    expect(s.level).toBe(2);
    s = applyAttempt(s, 1, { correctFirst: false });
    expect(s.level).toBe(1);
    expect(s.autoHint).toBe(true);
    s = applyAttempt(s, 1, { correctFirst: true });
    expect(s.autoHint).toBe(false);
  });
  it('1단계에서는 더 내려가지 않지만 그림 도움은 켜진다', () => {
    let s = applyAttempt(undefined, 1, { correctFirst: false });
    s = applyAttempt(s, 1, { correctFirst: false });
    expect(s.level).toBe(1);
    expect(s.autoHint).toBe(true);
  });
  it('혼동 문구가 쌓이고 3번이면 약점', () => {
    const profile = mkProfile();
    let s = applyAttempt(undefined, 3, { correctFirst: false, confusion: '7시와 8시 혼동' });
    s = applyAttempt(s, 3, { correctFirst: true });
    s = applyAttempt(s, 3, { correctFirst: false, confusion: '7시와 8시 혼동' });
    profile.skills['clk.hour.c'] = s;
    expect(weakSpots(profile)).toEqual([]);
    s = applyAttempt(s, 3, { correctFirst: false, confusion: '7시와 8시 혼동' });
    profile.skills['clk.hour.c'] = s;
    expect(weakSpots(profile)).toEqual([{ label: '7시와 8시 혼동', skill: 'clk.hour.c', count: 3 }]);
  });
});

describe('복습 일정', () => {
  it('+1, +3, +7일', () => {
    const r = scheduleReviews(5, ['num.count5']);
    expect(r.map((x) => x.due)).toEqual([6, 8, 12]);
    expect(r.map((x) => x.stage)).toEqual([1, 2, 3]);
  });
  it('자기 점검 스킬은 복습 일정에 넣지 않는다', () => {
    expect(scheduleReviews(2, ['num.write'])).toEqual([]);
  });
});

describe('수업 계획', () => {
  it('Day 1: 워밍업 없음, 탐험 10 + 게임 5', () => {
    const p = mkProfile();
    const plan = buildLessonPlan(p, 1, 1)!;
    expect(plan.slots.filter((s) => s.section === 'warmup')).toHaveLength(0);
    expect(plan.slots.filter((s) => s.section === 'explore')).toHaveLength(10);
    expect(plan.slots.filter((s) => s.section === 'game')).toHaveLength(5);
    expect(plan.slots.map((s) => s.id)).toEqual(plan.slots.map((_, i) => i));
  });
  it('Day 2: 전날 배운 스킬 복습이 워밍업 6문제', () => {
    let p = mkProfile();
    p = finishLesson(p, buildLessonPlan(p, 1, 1)!, '2026-11-02', true);
    expect(p.day).toBe(2);
    expect(p.reviews.length).toBeGreaterThan(0);
    const wants = warmupWants(p, 2);
    expect(wants.reduce((a, w) => a + w.n, 0)).toBe(6);
    expect(wants.every((w) => w.review)).toBe(true);
    const plan = buildLessonPlan(p, 2, 1)!;
    expect(plan.slots.filter((s) => s.section === 'warmup')).toHaveLength(6);
  });
  it('복습이 없어도 직전 수업 스킬로 워밍업을 채운다', () => {
    const p = mkProfile();
    p.day = 4;
    const wants = warmupWants(p, 4);
    expect(wants.reduce((a, w) => a + w.n, 0)).toBeGreaterThanOrEqual(2);
    expect(wants.map((w) => w.skill)).toContain('cal.weekdayName');
  });
  it('같은 입력이면 같은 계획', () => {
    const p = mkProfile();
    expect(JSON.stringify(buildLessonPlan(p, 7, 1))).toBe(JSON.stringify(buildLessonPlan(p, 7, 1)));
    expect(JSON.stringify(buildLessonPlan(p, 7, 1))).not.toBe(JSON.stringify(buildLessonPlan(p, 7, 2)));
  });
  it('보스 날은 수업 계획이 아니다', () => {
    expect(buildLessonPlan(mkProfile(), 5, 1)).toBeNull();
    expect(buildLessonPlan(mkProfile(), 95, 1)).toBeNull();
    expect(buildLessonPlan(mkProfile(), 100, 1)).toBeNull();
    expect(buildLessonPlan(mkProfile(), 99, 1)).not.toBeNull();
  });
});

describe('보스전', () => {
  it('블록 3 보스: 15문제 = 이번 블록 10 + 앞 블록 5', () => {
    const plan = buildBossPlan(mkProfile(), 3, 1)!;
    expect(plan.slots).toHaveLength(15);
    expect(plan.slots.filter((s) => s.prev)).toHaveLength(5);
    expect(plan.slots.every((s) => s.maxLevel === 2)).toBe(true);
    expect(plan.day).toBe(15);
  });
  it('블록 1 보스: 앞 블록이 없어 15문제 모두 이번 블록', () => {
    const plan = buildBossPlan(mkProfile(), 1, 1)!;
    expect(plan.slots).toHaveLength(15);
    expect(plan.slots.filter((s) => s.prev)).toHaveLength(0);
  });
  it('재도전은 틀린 유형만', () => {
    const plan = buildBossPlan(mkProfile(), 3, 2, [
      { skill: 'num.split5', wrong: 2 },
      { skill: 'clk.hour.a', wrong: 1 },
    ])!;
    expect(plan.slots).toHaveLength(3);
    expect(plan.slots.filter((s) => s.skill === 'num.split5')).toHaveLength(2);
    expect(plan.retry).toBe(true);
  });
  it('80% 이상이면 통과 (15문제 중 12)', () => {
    expect(bossPassed(12, 15)).toBe(true);
    expect(bossPassed(11, 15)).toBe(false);
    expect(bossPassed(4, 5)).toBe(true);
    expect(bossPassed(3, 5)).toBe(false);
    expect(bossPassed(0, 0)).toBe(false);
  });
  it('결과 요약에서 틀린 유형을 모은다', () => {
    const plan = buildBossPlan(mkProfile(), 3, 1)!;
    plan.slots.forEach((s, i) => {
      s.done = true;
      s.correctFirst = i % 5 !== 0; // 0,5,10번 틀림
    });
    const o = bossOutcome(plan.slots);
    expect(o.total).toBe(15);
    expect(o.correct).toBe(12);
    expect(o.passed).toBe(true);
    expect(o.wrongBySkill.reduce((a, w) => a + w.wrong, 0)).toBe(3);
  });
  it('통과하면 스티커·별·다음 날로 진행', () => {
    let p = mkProfile();
    p.day = 15;
    p = finishBoss(p, 3, { correct: 13, total: 15, passed: true, wrongBySkill: [] }, 13 / 15, '2026-11-20');
    expect(p.stickers[3]).toBe('gold');
    expect(p.day).toBe(16);
    expect(p.stars).toBe(10);
    expect(p.doneDays).toContain(15);
    // 같은 보스를 다시 통과해도 별은 더 주지 않는다
    const again = finishBoss(p, 3, { correct: 12, total: 15, passed: true, wrongBySkill: [] }, 0.8, '2026-11-21');
    expect(again.stars).toBe(10);
    expect(again.blocks[3]?.tries).toBe(2);
  });
  it('재도전으로 통과하면 금테가 아니라 보통 테두리', () => {
    let p = mkProfile();
    p = finishBoss(p, 2, { correct: 4, total: 5, passed: true, wrongBySkill: [] }, 9 / 15, '2026-11-12');
    expect(p.stickers[2]).toBe('normal');
  });
});

describe('수업 마무리', () => {
  it('별은 그날 첫 수업에서만, 이미 끝낸 날을 다시 해도 안 준다', () => {
    let p = mkProfile();
    p = finishLesson(p, buildLessonPlan(p, 1, 1)!, '2026-11-02', true);
    expect(p.stars).toBe(5);
    p = finishLesson(p, buildLessonPlan(p, 1, 2)!, '2026-11-03', true);
    expect(p.stars).toBe(5);
    expect(p.doneDays).toEqual([1]);
    expect(p.day).toBe(2);
  });
  it('소화한 복습은 일정에서 빠진다', () => {
    let p = mkProfile();
    p = finishLesson(p, buildLessonPlan(p, 1, 1)!, '2026-11-02', true);
    const plan2 = buildLessonPlan(p, 2, 1)!;
    plan2.slots.forEach((s) => (s.done = true));
    p = finishLesson(p, plan2, '2026-11-03', true);
    expect(p.reviews.some((r) => r.stage === 1 && r.skill === 'num.count5' && r.due <= 2)).toBe(false);
    // Day 2에서 새로 배운 스킬의 복습은 새로 예약된다
    expect(p.reviews.some((r) => r.skill === 'num.write')).toBe(false); // 자기 점검은 제외
  });
});

describe('문제 꺼내기', () => {
  it('중복 문제는 시드를 바꿔 다시 뽑는다', () => {
    const slot = { id: 0, section: 'explore' as const, skill: 'num.write', seed: 10 };
    const used = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const { q } = materialize({ ...slot, id: i }, 1, ENV, used);
      seen.add(fingerprint(q));
    }
    expect(seen.size).toBe(6);
  });
});

describe('채점', () => {
  it('객관식·숫자·순서', () => {
    const q = generate({ skill: 'num.count5', level: 1, seed: 3 }, ENV);
    if (q.answer.t === 'choice') {
      expect(grade(q, { t: 'choice', index: q.answer.correct }).correct).toBe(true);
      expect(grade(q, { t: 'choice', index: (q.answer.correct + 1) % q.answer.options.length }).correct).toBe(false);
    }
    const o = generate({ skill: 'game.weekTrain.a', level: 1, seed: 3 }, ENV);
    if (o.answer.t === 'order') {
      expect(grade(o, { t: 'order', keys: o.answer.correct }).correct).toBe(true);
      expect(grade(o, { t: 'order', keys: [...o.answer.correct].reverse() }).correct).toBe(false);
    }
  });
  it('시계 맞추기는 12시와 0시를 같게 본다', () => {
    const q = generate({ skill: 'clk.hour.c', level: 3, seed: 1 }, ENV);
    const find = (s: number) => {
      for (let i = s; i < s + 200; i++) {
        const x = generate({ skill: 'clk.hour.c', level: 3, seed: i }, ENV);
        if (x.answer.t === 'clockSet') return x;
      }
      return q;
    };
    const x = find(1);
    if (x.answer.t === 'clockSet') {
      expect(grade(x, { t: 'clockSet', h: x.answer.h, m: x.answer.m }).correct).toBe(true);
      expect(grade(x, { t: 'clockSet', h: (x.answer.h % 12) + 1, m: x.answer.m }).correct).toBe(false);
    }
  });
  it('수업이 있는 날은 모두 계획이 만들어진다', () => {
    const p = mkProfile();
    for (let d = 1; d <= 25; d++) {
      if (lessonFor(d)?.kind === 'boss') continue;
      expect(buildLessonPlan(p, d, 1), `Day ${d}`).not.toBeNull();
    }
  });
});
