import { describe, expect, it } from 'vitest';
import { toParts } from '@/core/dates';
import { generate } from '@/core/question';
import { allSkills } from '@/core/skills';
import { questionProblems } from '@/core/validate';
import type { FamilyEvent, Level } from '@/core/types';

const TODAY = toParts(new Date(2026, 10, 2)); // 2026-11-02 (월)
const EVENTS: FamilyEvent[] = [
  { id: 'e1', label: '엄마 생일', month: 3, day: 14, kind: 'birthday' },
  { id: 'e2', label: '아빠 생일', month: 8, day: 2, kind: 'birthday' },
];
const ENV = { today: TODAY, events: EVENTS };
const LEVELS: Level[] = [1, 2, 3];
const SEEDS = 400;

describe('모든 스킬 × 단계 × 시드', () => {
  for (const skill of allSkills()) {
    it(`${skill.id} (${skill.name}) 검증 통과`, () => {
      const bad: string[] = [];
      for (const level of LEVELS) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          let q;
          try {
            q = generate({ skill: skill.id, level, seed }, ENV);
          } catch (e) {
            bad.push(`L${level} s${seed}: 예외 ${(e as Error).message}`);
            continue;
          }
          const problems = questionProblems(q);
          if (problems.length) bad.push(`L${level} s${seed}: ${problems.join(' | ')} :: ${q.prompt}`);
          if (bad.length > 8) break;
        }
        if (bad.length > 8) break;
      }
      expect(bad).toEqual([]);
    });

    it(`${skill.id} 같은 시드는 같은 문제`, () => {
      for (const level of LEVELS) {
        const a = generate({ skill: skill.id, level, seed: 77 }, ENV);
        const b = generate({ skill: skill.id, level, seed: 77 }, ENV);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    });

    it(`${skill.id} 시드가 달라지면 문제도 다양하다`, () => {
      for (const level of LEVELS) {
        const seen = new Set<string>();
        for (let seed = 1; seed <= 60; seed++) seen.add(JSON.stringify({ ...generate({ skill: skill.id, level, seed }, ENV), id: '' }));
        // 숫자 따라 쓰기처럼 경우의 수가 적은 스킬은 2종 이상이면 충분
        expect(seen.size).toBeGreaterThanOrEqual(skill.game ? 3 : 8);
      }
    });
  }
});
