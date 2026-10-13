import type { DateParts } from './dates';
import { makeRng } from './rng';
import { getSkill } from './skills';
import type { FamilyEvent, Question, QuestionRequest } from './types';

export interface GenEnv {
  today: DateParts;
  events: FamilyEvent[];
}

/** 같은 (스킬, 단계, 시드)면 항상 같은 문제가 나온다. */
export function generate(req: QuestionRequest, env: GenEnv): Question {
  const skill = getSkill(req.skill);
  const rng = makeRng(req.skill, req.level, req.seed);
  return skill.gen({
    rng,
    level: req.level,
    seed: req.seed,
    skillId: req.skill,
    today: env.today,
    events: env.events,
  });
}
