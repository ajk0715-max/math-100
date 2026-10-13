import { describe, expect, it } from 'vitest';
import type { AttemptRec, SessionRec } from '../src/db/db';
import { CERT_NAME_MAX, certDateText, certificateInfo, cleanCertName, hasCertificate } from '../src/core/certificate';
import { BLOCKS, TOTAL_DAYS } from '../src/core/curriculum';
import { newProfile, type Profile } from '../src/core/model';
import { finalAdvice, finalReport, rangeReport, type RangeReport } from '../src/core/report';
import { finishBoss, type BossOutcome } from '../src/core/session';

const prof = (over: Partial<Profile> = {}): Profile => ({ ...newProfile({ id: 'p1', nickname: '하준', avatar: '🐻', now: 1, seedSalt: 12345 }), ...over });
const pass: BossOutcome = { passed: true, correct: 14, total: 15, wrongBySkill: [] };

describe('수료증', () => {
  it('Day 100 보스를 통과해야 받을 수 있다', () => {
    expect(hasCertificate(prof())).toBe(false);
    expect(hasCertificate(prof({ doneDays: [1, 2, 3, 99] }))).toBe(false);
    expect(hasCertificate(prof({ doneDays: [99, TOTAL_DAYS] }))).toBe(true);
  });

  it('이름은 공백을 다듬고 12글자까지만 남긴다(이모지는 한 글자로 센다)', () => {
    expect(cleanCertName('  김  하준 ')).toBe('김 하준');
    expect(cleanCertName('')).toBe('');
    expect(cleanCertName('   ')).toBe('');
    const long = '가나다라마바사아자차카타파하';
    expect(Array.from(cleanCertName(long)).length).toBe(CERT_NAME_MAX);
    expect(cleanCertName(`🐻${'가'.repeat(20)}`)).toBe(`🐻${'가'.repeat(CERT_NAME_MAX - 1)}`);
    // 잘린 끝이 공백이면 그것도 지운다
    expect(cleanCertName('가나다라마바사아자차카 타')).toBe('가나다라마바사아자차카');
  });

  it('이름이 비어 있으면 별명을, 날짜는 수료한 날 → 마지막 수업일 → 오늘 순으로 쓴다', () => {
    const base = prof({ doneDays: [TOTAL_DAYS] });
    expect(certificateInfo(base, '2026-12-25').name).toBe('하준');
    expect(certificateInfo({ ...base, certName: '김하준' }, '2026-12-25').name).toBe('김하준');
    expect(certificateInfo({ ...base, certName: '   ' }, '2026-12-25').name).toBe('하준');
    expect(certificateInfo(base, '2026-12-25').date).toBe('2026-12-25');
    expect(certificateInfo({ ...base, lastLessonDate: '2026-12-20' }, '2026-12-25').date).toBe('2026-12-20');
    expect(certificateInfo({ ...base, lastLessonDate: '2026-12-20', completedOn: '2026-12-18' }, '2026-12-25').date).toBe('2026-12-18');
    expect(certDateText('2026-03-02')).toBe('2026년 3월 2일');
    expect(certificateInfo({ ...base, completedOn: '2026-10-13' }, '2026-12-25').dateText).toBe('2026년 10월 13일');
  });

  it('통계: 마친 날·모은 별·스티커 수와 금테 수·건너뛴 단계', () => {
    const stickers: Profile['stickers'] = {};
    for (let b = 1; b <= 20; b++) stickers[b] = b % 5 === 0 ? 'gold' : 'normal';
    const p = prof({
      doneDays: Array.from({ length: 96 }, (_, i) => i + 1).concat([97, 98, 99, 100]).filter((d) => d !== 7),
      starsTotal: 480,
      stars: 120,
      stickers,
      blocks: { 3: { tries: 1, best: 0.9, passedAt: 15, gold: false, skipped: true } },
    });
    const info = certificateInfo(p, '2026-10-13');
    expect(info.earned).toBe(true);
    expect(info.days).toBe(99);
    expect(info.stars).toBe(480);
    expect(info.stickerCount).toBe(20);
    expect(info.goldCount).toBe(4);
    expect(info.skipped).toBe(1);
    expect(info.stickers).toHaveLength(BLOCKS.length);
    expect(info.stickers[0]?.emoji).toBe(BLOCKS[0]?.sticker.emoji);
    // 스티커를 못 받은 단계는 빈 칸이다
    const some = certificateInfo(prof({ doneDays: [TOTAL_DAYS], stickers: { 1: 'normal' } }), '2026-10-13');
    expect(some.stickerCount).toBe(1);
    expect(some.stickers.filter((s) => s.kind === null)).toHaveLength(19);
  });

  it('마지막 보스를 처음 통과할 때만 수료한 날이 적힌다', () => {
    const p0 = prof({ day: 100, doneDays: Array.from({ length: 99 }, (_, i) => i + 1) });
    const p1 = finishBoss(p0, 20, pass, 0.93, '2026-10-13');
    expect(p1.doneDays).toContain(TOTAL_DAYS);
    expect(p1.completedOn).toBe('2026-10-13');
    expect(hasCertificate(p1)).toBe(true);
    // 나중에 다시 풀어도 날짜는 그대로
    const p2 = finishBoss(p1, 20, pass, 0.5, '2026-11-01');
    expect(p2.completedOn).toBe('2026-10-13');
    // 다른 단계의 보스는 수료일을 적지 않는다
    const p3 = finishBoss(prof({ day: 95 }), 19, pass, 0.9, '2026-10-10');
    expect(p3.completedOn).toBeUndefined();
    // 진도를 되돌려도 수료증은 남는다
    const moved: Profile = { ...p2, day: 1 };
    expect(hasCertificate(moved)).toBe(true);
  });
});

const rep = (areas: [string, number, number][], over: Partial<RangeReport> = {}): RangeReport => {
  const list = areas.map(([label, solved, firstRight]) => ({ area: 'num' as const, label, solved, firstRight }));
  const solved = list.reduce((t, a) => t + a.solved, 0);
  const firstRight = list.reduce((t, a) => t + a.firstRight, 0);
  return { solved, firstRight, hints: 0, minutes: 600, days: 100, areas: list, ...over };
};

describe('100일 종합 리포트의 한마디', () => {
  it('기록이 없으면 안내만 한다', () => {
    const none = rep([]);
    expect(finalAdvice(none, none, none)).toHaveLength(1);
  });

  it('높은 정답률은 칭찬하고, 앞뒤 50일 비교와 강약 영역을 말하고, 다음 할 일로 끝난다', () => {
    const all = rep([
      ['수와 연산', 400, 380],
      ['시계', 200, 150],
      ['달력', 100, 90],
    ]);
    const first = rep([['수와 연산', 300, 270]]);
    const second = rep([['수와 연산', 300, 290]]);
    const out = finalAdvice(all, first, second);
    expect(out[0]).toContain('89%');
    expect(out[0]).toContain('잘 자리 잡았어요');
    expect(out.some((t) => t.includes('앞 50일은 90%') && t.includes('뒤 50일은 97%') && t.includes('더 안정적'))).toBe(true);
    const line = out.find((t) => t.includes('가장 안정적인 영역'));
    expect(line).toContain('수와 연산이에요(95%)');
    expect(line).toContain('시계예요(75%)');
    expect(out.some((t) => t.includes('시계 영역은 생활 속에서'))).toBe(true);
    expect(out[out.length - 1]).toContain('더 놀기');
  });

  it('뒤 50일이 많이 낮으면 난이도 때문일 수 있다고 알린다. 비슷하면 비슷하다고만 한다', () => {
    const all = rep([['수와 연산', 400, 300]]);
    const drop = finalAdvice(all, rep([['수와 연산', 200, 180]]), rep([['수와 연산', 200, 120]]));
    expect(drop.some((t) => t.includes('뒤 단계 내용이 더 어렵기 때문'))).toBe(true);
    const same = finalAdvice(all, rep([['수와 연산', 200, 150]]), rep([['수와 연산', 200, 152]]));
    expect(same.some((t) => t.includes('비슷하게 이어졌어요'))).toBe(true);
  });

  it('푼 문제가 적은 영역과 적은 구간은 강약·비교에 넣지 않는다', () => {
    const all = rep([
      ['수와 연산', 100, 60],
      ['모양', 5, 5],
    ]);
    const out = finalAdvice(all, rep([['수와 연산', 10, 9]]), rep([['수와 연산', 10, 3]]));
    expect(out.some((t) => t.includes('앞 50일은'))).toBe(false);
    expect(out.some((t) => t.includes('가장 안정적인 영역'))).toBe(false);
    expect(out[0]).toContain('62%');
    expect(out[0]).toContain('약한 영역');
  });

  it('finalReport는 Day 1~50과 51~100을 나눠 센다', () => {
    const at = (day: number, ok: boolean): AttemptRec => ({
      profileId: 'p1', sessionId: 's', day, section: 'explore', skill: 'num.count', level: 1, seed: 1, correctFirst: ok, tries: ok ? 1 : 2, hinted: false, revealed: false, ms: 1000, expected: '', given: '', confusion: null, ts: day,
    });
    const attempts = [at(10, true), at(20, false), at(60, true), at(61, true), at(100, true)];
    const sessions = [{ day: 10, kind: 'lesson', completed: true, activeMs: 120_000 }, { day: 100, kind: 'boss', completed: true, activeMs: 180_000 }] as unknown as SessionRec[];
    const r = finalReport(attempts, sessions);
    expect(r.all.solved).toBe(5);
    expect(r.first.solved).toBe(2);
    expect(r.second.solved).toBe(3);
    expect(r.all.days).toBe(2);
    expect(r.all.minutes).toBe(5);
    expect(r.second.firstRight).toBe(3);
    expect(rangeReport(attempts, sessions, 1, 50).firstRight).toBe(1);
    expect(r.advice.length).toBeGreaterThan(0);
  });
});
