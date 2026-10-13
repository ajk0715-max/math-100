import { BLOCKS, TOTAL_DAYS } from './curriculum';
import { parseYmd } from './dates';
import type { Profile } from './model';

/** 증서 이름칸에 들어가는 글자 수 */
export const CERT_NAME_MAX = 12;

/** 100일 마지막 보스를 통과해 수료증을 받을 수 있는가 */
export const hasCertificate = (p: Pick<Profile, 'doneDays'>): boolean => p.doneDays.includes(TOTAL_DAYS);

/** 증서에 쓸 이름을 다듬는다: 앞뒤 공백을 지우고, 연속 공백은 하나로, 12글자까지만 */
export function cleanCertName(raw: string): string {
  return Array.from(raw.replace(/\s+/g, ' ').trim())
    .slice(0, CERT_NAME_MAX)
    .join('')
    .trim();
}

export interface CertSticker {
  n: number;
  emoji: string;
  name: string;
  kind: 'normal' | 'gold' | null;
}

export interface CertificateInfo {
  earned: boolean;
  /** 증서에 적는 이름(직접 적은 이름이 없으면 별명) */
  name: string;
  /** 수료한 날(YYYY-MM-DD) */
  date: string;
  /** 2026년 10월 13일 */
  dateText: string;
  /** 마친 수업 날 수 */
  days: number;
  /** 지금까지 모은 별(쓴 별 포함) */
  stars: number;
  stickers: CertSticker[];
  stickerCount: number;
  goldCount: number;
  /** 보스로 건너뛴 단계 수 */
  skipped: number;
}

export function certDateText(ymd: string): string {
  const d = parseYmd(ymd);
  return `${d.y}년 ${d.m}월 ${d.d}일`;
}

export function certificateInfo(p: Profile, today: string): CertificateInfo {
  const date = p.completedOn ?? p.lastLessonDate ?? today;
  const stickers: CertSticker[] = BLOCKS.map((b) => ({ n: b.n, emoji: b.sticker.emoji, name: b.sticker.name, kind: p.stickers[b.n] ?? null }));
  return {
    earned: hasCertificate(p),
    name: cleanCertName(p.certName ?? '') || p.nickname,
    date,
    dateText: certDateText(date),
    days: new Set(p.doneDays).size,
    stars: p.starsTotal,
    stickers,
    stickerCount: stickers.filter((s) => s.kind).length,
    goldCount: stickers.filter((s) => s.kind === 'gold').length,
    skipped: BLOCKS.filter((b) => p.blocks[b.n]?.skipped).length,
  };
}
