import { describe, expect, it } from 'vitest';
import { toParts } from '@/core/dates';
import {
  BLOCKS,
  OPTIONAL_OFF,
  allocate,
  authoredDays,
  blockOf,
  bossSpec,
  firstDayOfSkill,
  idxInBlock,
  lastReadyDay,
  lessonFor,
  referencedSkills,
  skillsBefore,
  type DayBody,
  type IntroCard,
  type OptionalOn,
} from '@/core/curriculum';
import { generate } from '@/core/question';
import { getSkill, hasSkill } from '@/core/skills';
import { questionProblems } from '@/core/validate';
import { speak } from '@/core/ko';

const ENV = { today: toParts(new Date(2026, 10, 2)), events: [] };
const ENV_EVENTS = { today: toParts(new Date(2027, 0, 31)), events: [{ id: 'e1', label: '엄마 생일', month: 3, day: 14, kind: 'birthday' as const }] };
const ALL_ON: OptionalOn = { clock5: true, hour60: true, carry: true };
const SETTINGS: [string, OptionalOn][] = [
  ['모두 꺼짐', OPTIONAL_OFF],
  ['모두 켜짐', ALL_ON],
];
/** 선택 과제가 걸린 날의 본 수업과 꺼졌을 때의 수업을 모두 돌려준다 */
const bodiesOf = (d: (typeof authoredDays extends () => (infer T)[] ? T : never)): { tag: string; body: DayBody }[] => [{ tag: '켜짐', body: d }, ...(d.off ? [{ tag: '꺼짐', body: d.off.body }] : [])];

describe('블록 표', () => {
  it('20개 블록, 번호가 1부터 이어진다', () => {
    expect(BLOCKS).toHaveLength(20);
    BLOCKS.forEach((b, i) => expect(b.n).toBe(i + 1));
  });
  it('ready는 앞에서부터 연속', () => {
    let seenFalse = false;
    for (const b of BLOCKS) {
      if (!b.ready) seenFalse = true;
      else expect(seenFalse).toBe(false);
    }
  });
  it('스티커 이모지가 겹치지 않는다', () => {
    const e = BLOCKS.map((b) => b.sticker.emoji);
    expect(new Set(e).size).toBe(e.length);
  });
});

describe('날짜 계산', () => {
  it('블록·일차', () => {
    expect(blockOf(1)).toBe(1);
    expect(blockOf(5)).toBe(1);
    expect(blockOf(6)).toBe(2);
    expect(blockOf(100)).toBe(20);
    expect(idxInBlock(5)).toBe(5);
    expect(idxInBlock(6)).toBe(1);
  });
  it('allocate는 합이 quota', () => {
    expect(allocate(3, [10])).toEqual([3]);
    expect(allocate(2, [8, 2])).toEqual([2, 0]);
    expect(allocate(3, [5, 5])).toEqual([2, 1]);
    for (const q of [2, 3, 4]) {
      const r = allocate(q, [7, 3, 2]);
      expect(r.reduce((a, b) => a + b, 0)).toBe(q);
    }
  });
});

describe('수업 데이터', () => {
  const ready = lastReadyDay();
  it('열린 날이 모두 수업으로 풀린다', () => {
    expect(ready).toBe(100);
    for (const [name, opt] of SETTINGS) {
      for (let d = 1; d <= ready; d++) {
        const l = lessonFor(d, opt);
        expect(l, `${name} Day ${d}`).not.toBeNull();
        expect(l?.day).toBe(d);
        expect(l?.kind === 'boss').toBe(idxInBlock(d) === 5);
      }
    }
    expect(lessonFor(ready + 1)).toBeNull();
    expect(lessonFor(0)).toBeNull();
  });
  it('참조하는 스킬과 게임이 모두 등록되어 있다', () => {
    for (const d of authoredDays()) {
      for (const { tag, body } of bodiesOf(d)) {
        for (const u of body.explore) expect(hasSkill(u.skill), `${d.day} ${tag}: ${u.skill}`).toBe(true);
        expect(hasSkill(body.game.skill), `${d.day} ${tag}: ${body.game.skill}`).toBe(true);
        expect(getSkill(body.game.skill).game, `${d.day} ${tag} 게임 종류`).toBeTruthy();
        expect(body.game.levels.length).toBeGreaterThanOrEqual(3);
      }
    }
    for (const id of referencedSkills()) expect(hasSkill(id), id).toBe(true);
  });
  it('Day 1~99 중 보스 날을 뺀 80일이 모두 쓰여 있다', () => {
    const days = authoredDays().map((d) => d.day);
    expect(days).toHaveLength(80);
    expect(new Set(days).size).toBe(80);
    for (const d of days) expect(idxInBlock(d)).not.toBe(5);
    // 블록마다 수학 2일 · 생활 2일
    for (let b = 1; b <= 20; b++) {
      const kinds = authoredDays()
        .filter((d) => blockOf(d.day) === b)
        .sort((x, y) => x.day - y.day)
        .map((d) => d.kind);
      expect(kinds, `블록 ${b}`).toEqual(['math', 'math', 'life', 'life']);
    }
  });
  it('탐험 문제 수는 10개', () => {
    for (const d of authoredDays()) {
      for (const { tag, body } of bodiesOf(d)) {
        const n = body.explore.reduce((a, u) => a + u.n, 0);
        expect(n, `Day ${d.day} ${tag}`).toBe(10);
      }
    }
  });
  it('날마다 새 스킬이 있거나 앞날 스킬 복습이다', () => {
    for (const d of authoredDays()) {
      const l = lessonFor(d.day);
      expect(l?.newSkills.length ?? 0).toBeGreaterThanOrEqual(0);
    }
    expect(firstDayOfSkill('num.count5')).toBe(1);
    expect(firstDayOfSkill('cal.weekdayName')).toBe(3);
    expect(firstDayOfSkill('add.pic5')).toBe(26);
    expect(firstDayOfSkill('cmp.length')).toBe(46);
    expect(firstDayOfSkill('num.count20')).toBe(51);
    expect(firstDayOfSkill('clk.digital.hour')).toBe(53);
    expect(firstDayOfSkill('cal.event')).toBe(63);
    expect(firstDayOfSkill('money.coinName')).toBe(68);
    expect(firstDayOfSkill('pat.color')).toBe(76);
    expect(firstDayOfSkill('clk.five.read')).toBe(78);
    expect(firstDayOfSkill('story.add')).toBe(86);
    expect(firstDayOfSkill('term.ord')).toBe(96);
    expect(firstDayOfSkill('adv.money')).toBe(99);
  });
  it('제목·부모 팁이 비어 있지 않고 소개 카드가 1~3장', () => {
    for (const [name, opt] of SETTINGS) {
      for (const env of [ENV, ENV_EVENTS]) {
        for (let d = 1; d <= ready; d++) {
          const l = lessonFor(d, opt)!;
          expect(l.title.length, `${name} Day ${d}`).toBeGreaterThan(1);
          expect(l.tip.length).toBeGreaterThan(10);
          const cards: IntroCard[] = typeof l.intro === 'function' ? l.intro(env) : l.intro;
          expect(cards.length).toBeGreaterThanOrEqual(1);
          expect(cards.length).toBeLessThanOrEqual(3);
          for (const c of cards) {
            expect(c.text.trim().length, `${name} Day ${d}`).toBeGreaterThan(0);
            expect(/[0-9]/.test(speak(c.say ?? c.text)), `${name} Day ${d}: ${c.text}`).toBe(false);
            // 화면 글과 읽어 주는 글이 모두 한 말풍선에 들어갈 길이
            expect(c.text.length, `${name} Day ${d}: ${c.text}`).toBeLessThanOrEqual(110);
            expect((c.say ?? c.text).length, `${name} Day ${d}: ${c.say ?? c.text}`).toBeLessThanOrEqual(130);
            // 새로 쓴 날(51~)은 읽어 줄 때 기호가 남으면 안 된다
            if (d > 50) expect(/[+=−×÷→➜:·…]/.test(speak(c.say ?? c.text)), `${name} Day ${d}: ${c.say ?? c.text}`).toBe(false);
          }
        }
      }
    }
  });
  it('날마다 시작 질문이 풀린다', () => {
    for (const d of authoredDays()) {
      for (const { tag, body } of bodiesOf(d)) {
        for (const u of body.explore) {
          for (const lv of [1, 2, 3] as const) {
            const q = generate({ skill: u.skill, level: lv, seed: 5 }, ENV);
            expect(questionProblems(q), `${d.day} ${tag} ${u.skill} L${lv}`).toEqual([]);
          }
        }
        for (const lv of body.game.levels) {
          const q = generate({ skill: body.game.skill, level: lv, seed: 9 }, ENV);
          expect(questionProblems(q), `${d.day} ${tag} ${body.game.skill} L${lv}`).toEqual([]);
        }
      }
    }
  });
  it('maxLevel을 쓴 곳은 1~3 안', () => {
    for (const d of authoredDays()) for (const { body } of bodiesOf(d)) for (const u of body.explore) if (u.maxLevel !== undefined) expect([1, 2, 3]).toContain(u.maxLevel);
  });
});

describe('선택 과제', () => {
  const flagged = authoredDays().filter((d) => d.off);
  it('세 가지 과제가 모두 어떤 날에 걸려 있다', () => {
    expect(flagged.map((d) => d.day)).toEqual([78, 79, 83, 84, 92]);
    expect(new Set(flagged.map((d) => d.off!.flag))).toEqual(new Set(['clock5', 'hour60', 'carry']));
  });
  it('꺼짐이면 복습 수업, 켜짐이면 본 수업이 나온다', () => {
    for (const d of flagged) {
      const flag = d.off!.flag;
      const on = lessonFor(d.day, { ...OPTIONAL_OFF, [flag]: true })!;
      const off = lessonFor(d.day, OPTIONAL_OFF)!;
      expect(on.title, `Day ${d.day}`).toBe(d.title);
      expect(off.title, `Day ${d.day}`).toBe(d.off!.body.title);
      expect(on.optional).toEqual({ flag, on: true });
      expect(off.optional).toEqual({ flag, on: false });
      // 다른 과제를 켜도 이 날은 바뀌지 않는다
      const other = (['clock5', 'hour60', 'carry'] as const).find((f) => f !== flag)!;
      expect(lessonFor(d.day, { ...OPTIONAL_OFF, [other]: true })!.title).toBe(off.title);
    }
    // 걸려 있지 않은 날에는 표시가 없다
    expect(lessonFor(77, ALL_ON)!.optional).toBeUndefined();
    expect(lessonFor(100, ALL_ON)!.optional).toBeUndefined();
  });
  it('꺼짐 수업에는 선택 과제 스킬이 없고 켜짐 수업에는 있다', () => {
    for (const d of flagged) {
      const flag = d.off!.flag;
      for (const u of d.off!.body.explore) expect(getSkill(u.skill).optional, `Day ${d.day} 꺼짐 ${u.skill}`).toBeUndefined();
      expect(getSkill(d.off!.body.game.skill).optional).toBeUndefined();
      expect(d.explore.some((u) => getSkill(u.skill).optional === flag), `Day ${d.day} 켜짐`).toBe(true);
    }
  });
  it('선택 과제 스킬은 걸린 날 밖에서 쓰이지 않는다', () => {
    const allowed = new Set(flagged.map((d) => d.day));
    for (const d of authoredDays()) {
      if (allowed.has(d.day)) continue;
      for (const u of d.explore) expect(getSkill(u.skill).optional, `Day ${d.day} ${u.skill}`).toBeUndefined();
      expect(getSkill(d.game.skill).optional).toBeUndefined();
    }
  });
  it('꺼짐 수업에는 새 스킬이 없다(앞에서 배운 것만 복습)', () => {
    for (const d of flagged) {
      const off = lessonFor(d.day, OPTIONAL_OFF)!;
      if (d.off!.flag !== 'carry') expect(off.newSkills, `Day ${d.day}`).toEqual([]);
    }
  });
  it('보스와 이전 블록 문제에도 꺼진 과제는 들어가지 않는다', () => {
    for (const b of [16, 17, 19, 20]) {
      const off = bossSpec(b, OPTIONAL_OFF)!;
      for (const p of off.current) expect(getSkill(p.skill).optional, `블록 ${b} ${p.skill}`).toBeUndefined();
    }
    for (const sk of skillsBefore(20, OPTIONAL_OFF)) expect(getSkill(sk).optional, sk).toBeUndefined();
    expect(skillsBefore(20, ALL_ON).some((s) => getSkill(s).optional)).toBe(true);
    expect(bossSpec(16, ALL_ON)!.current.some((p) => getSkill(p.skill).optional === 'clock5')).toBe(true);
    expect(bossSpec(17, ALL_ON)!.current.some((p) => getSkill(p.skill).optional === 'hour60')).toBe(true);
    expect(bossSpec(19, ALL_ON)!.current.some((p) => getSkill(p.skill).optional === 'carry')).toBe(true);
  });
});

describe('보스전 구성', () => {
  it('첫 블록은 현재 15문제, 이후 현재 10 + 이전 5', () => {
    const b1 = bossSpec(1)!;
    expect(b1.current.reduce((a, p) => a + p.n, 0)).toBe(15);
    expect(b1.previousCount).toBe(0);
    for (const [name, opt] of SETTINGS) {
      for (let b = 2; b <= 20; b++) {
        const s = bossSpec(b, opt)!;
        expect(s.current.reduce((a, p) => a + p.n, 0), `${name} 블록 ${b}`).toBe(10);
        expect(s.previousCount).toBe(5);
      }
    }
  });
  it('보스에 자기 점검(쓰기) 스킬은 들어가지 않는다', () => {
    for (let b = 1; b <= 20; b++) {
      const s = bossSpec(b)!;
      for (const p of s.current) expect(getSkill(p.skill).noBoss).toBeFalsy();
    }
    expect(skillsBefore(3)).not.toContain('num.write');
    for (const sk of skillsBefore(21, ALL_ON)) expect(getSkill(sk).noBoss).toBeFalsy();
  });
  it('보스 문제가 해당 블록 안의 스킬로만 짜인다', () => {
    for (const [name, opt] of SETTINGS) {
      for (let b = 2; b <= 20; b++) {
        const s = bossSpec(b, opt)!;
        const inBlock = new Set<string>();
        for (let k = 0; k < 4; k++) for (const u of lessonFor((b - 1) * 5 + 1 + k, opt)!.explore) inBlock.add(u.skill);
        for (const p of s.current) expect(inBlock.has(p.skill), `${name} 블록 ${b}: ${p.skill}`).toBe(true);
        // 한 날에서 두 문제 이상은 나오지만, 보스에 쓰이는 스킬이 4일 중 3일 이상에서 나오도록 퍼져 있다
        expect(s.current.length, `${name} 블록 ${b}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('보스 문제가 생성되고 검증을 통과한다', () => {
    for (const [name, opt] of SETTINGS) {
      for (let b = 11; b <= 20; b++) {
        const s = bossSpec(b, opt)!;
        for (const p of s.current) {
          for (const lv of [1, 2] as const) {
            const q = generate({ skill: p.skill, level: lv, seed: 31 + b }, ENV);
            expect(questionProblems(q), `${name} 블록 ${b} ${p.skill} L${lv}`).toEqual([]);
          }
        }
      }
    }
  });
  it('Day 50은 중간 점검 보스', () => {
    const l = lessonFor(50)!;
    expect(l.kind).toBe('boss');
    expect(l.title).toContain('중간 점검');
    const intro = typeof l.intro === 'function' ? l.intro(ENV) : l.intro;
    expect(intro[0]!.text).toContain('중간 점검');
  });
  it('없는 블록은 null', () => {
    expect(bossSpec(21)).toBeNull();
    expect(bossSpec(0)).toBeNull();
  });
  it('Day 100은 마지막 보스', () => {
    const l = lessonFor(100)!;
    expect(l.kind).toBe('boss');
    expect(l.title).toContain('100일');
    const intro = typeof l.intro === 'function' ? l.intro(ENV) : l.intro;
    expect(intro[0]!.text).toContain('100일');
  });
  it('앞 블록 스킬 목록이 오래된 순', () => {
    const s = skillsBefore(2);
    expect(s[0]).toBe('num.count5');
    expect(s).toContain('cal.weekdayOrder');
  });
});
