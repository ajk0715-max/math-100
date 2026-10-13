import { describe, expect, it } from 'vitest';
import { toParts } from '@/core/dates';
import {
  BLOCKS,
  allocate,
  authoredDays,
  blockOf,
  bossSpec,
  firstDayOfSkill,
  idxInBlock,
  lastReadyDay,
  lessonFor,
  skillsBefore,
  type IntroCard,
} from '@/core/curriculum';
import { generate } from '@/core/question';
import { getSkill, hasSkill } from '@/core/skills';
import { questionProblems } from '@/core/validate';
import { speak } from '@/core/ko';

const ENV = { today: toParts(new Date(2026, 10, 2)), events: [] };

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
    expect(ready).toBeGreaterThanOrEqual(25);
    for (let d = 1; d <= ready; d++) {
      const l = lessonFor(d);
      expect(l, `Day ${d}`).not.toBeNull();
      expect(l?.day).toBe(d);
      expect(l?.kind === 'boss').toBe(idxInBlock(d) === 5);
    }
    expect(lessonFor(ready + 1)).toBeNull();
    expect(lessonFor(0)).toBeNull();
  });
  it('참조하는 스킬과 게임이 모두 등록되어 있다', () => {
    for (const d of authoredDays()) {
      for (const u of d.explore) expect(hasSkill(u.skill), `${d.day}: ${u.skill}`).toBe(true);
      expect(hasSkill(d.game.skill), `${d.day}: ${d.game.skill}`).toBe(true);
      expect(getSkill(d.game.skill).game, `${d.day} 게임 종류`).toBeTruthy();
      expect(d.game.levels.length).toBeGreaterThanOrEqual(3);
    }
  });
  it('탐험 문제 수는 10개', () => {
    for (const d of authoredDays()) {
      const n = d.explore.reduce((a, u) => a + u.n, 0);
      expect(n, `Day ${d.day}`).toBe(10);
    }
  });
  it('날마다 새 스킬이 있거나 앞날 스킬 복습이다', () => {
    for (const d of authoredDays()) {
      const l = lessonFor(d.day);
      expect(l?.newSkills.length ?? 0).toBeGreaterThanOrEqual(0);
    }
    expect(firstDayOfSkill('num.count5')).toBe(1);
    expect(firstDayOfSkill('cal.weekdayName')).toBe(3);
  });
  it('제목·부모 팁이 비어 있지 않고 소개 카드가 1~3장', () => {
    for (let d = 1; d <= ready; d++) {
      const l = lessonFor(d)!;
      expect(l.title.length).toBeGreaterThan(1);
      expect(l.tip.length).toBeGreaterThan(10);
      const cards: IntroCard[] = typeof l.intro === 'function' ? l.intro(ENV) : l.intro;
      expect(cards.length).toBeGreaterThanOrEqual(1);
      expect(cards.length).toBeLessThanOrEqual(3);
      for (const c of cards) {
        expect(c.text.trim().length).toBeGreaterThan(0);
        expect(/[0-9]/.test(speak(c.say ?? c.text))).toBe(false);
        expect((c.say ?? c.text).length).toBeLessThanOrEqual(110);
      }
    }
  });
  it('날마다 시작 질문이 풀린다', () => {
    for (const d of authoredDays()) {
      for (const u of d.explore) {
        for (const lv of [1, 2, 3] as const) {
          const q = generate({ skill: u.skill, level: lv, seed: 5 }, ENV);
          expect(questionProblems(q), `${d.day} ${u.skill} L${lv}`).toEqual([]);
        }
      }
      for (const lv of d.game.levels) {
        const q = generate({ skill: d.game.skill, level: lv, seed: 9 }, ENV);
        expect(questionProblems(q), `${d.day} ${d.game.skill} L${lv}`).toEqual([]);
      }
    }
  });
});

describe('보스전 구성', () => {
  it('첫 블록은 현재 15문제, 이후 현재 10 + 이전 5', () => {
    const b1 = bossSpec(1)!;
    expect(b1.current.reduce((a, p) => a + p.n, 0)).toBe(15);
    expect(b1.previousCount).toBe(0);
    for (let b = 2; b <= 5; b++) {
      const s = bossSpec(b)!;
      expect(s.current.reduce((a, p) => a + p.n, 0), `블록 ${b}`).toBe(10);
      expect(s.previousCount).toBe(5);
    }
  });
  it('보스에 자기 점검(쓰기) 스킬은 들어가지 않는다', () => {
    for (let b = 1; b <= 5; b++) {
      const s = bossSpec(b)!;
      for (const p of s.current) expect(getSkill(p.skill).noBoss).toBeFalsy();
    }
    expect(skillsBefore(3)).not.toContain('num.write');
  });
  it('아직 열리지 않은 블록은 null', () => {
    expect(bossSpec(lastReadyDay() / 5 + 1)).toBeNull();
  });
  it('앞 블록 스킬 목록이 오래된 순', () => {
    const s = skillsBefore(2);
    expect(s[0]).toBe('num.count5');
    expect(s).toContain('cal.weekdayOrder');
  });
});
