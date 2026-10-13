import { BLOCKS, BLOCK_DAYS, blockOf, firstDayOf, lastReadyDay } from './curriculum';
import type { Profile } from './model';

export type BlockState = 'gold' | 'passed' | 'skipped' | 'current' | 'upcoming' | 'moved' | 'soon';

/** 진도 지도에서 블록 하나의 상태 */
export function blockState(p: Pick<Profile, 'day' | 'blocks' | 'stickers'>, n: number): BlockState {
  const def = BLOCKS[n - 1];
  if (!def || !def.ready) return 'soon';
  const r = p.blocks[n];
  if (r?.passedAt || p.stickers[n]) {
    if (r?.skipped) return 'skipped';
    return p.stickers[n] === 'gold' ? 'gold' : 'passed';
  }
  const cur = Math.min(blockOf(p.day), BLOCKS.length);
  if (n === cur) return 'current';
  return n < cur ? 'moved' : 'upcoming';
}

export const STATE_LABEL: Record<BlockState, string> = {
  gold: '금 스티커',
  passed: '통과',
  skipped: '건너뜀',
  current: '지금 여기',
  upcoming: '아직 안 함',
  moved: '옮겨서 지나감',
  soon: '준비 중',
};

/** 지금 하고 있는 블록의 번호 */
export const currentBlock = (p: Pick<Profile, 'day'>): number => Math.min(blockOf(p.day), BLOCKS.length);

/** 부모가 진도를 그 블록의 첫 날로 되돌리거나 옮긴다. 이미 얻은 별·스티커·기록은 그대로 둔다. */
export function moveToBlock(p: Profile, block: number, today: string): Profile {
  const day = Math.min(firstDayOf(block), lastReadyDay());
  return { ...p, day, extraLessonDate: today };
}

/** 건너뛰기 도전을 할 수 있는 블록인가: 지금 하는 블록이고 보스전이 열려 있어야 한다 */
export function canSkip(p: Pick<Profile, 'day' | 'blocks' | 'stickers'>, block: number): boolean {
  if (block < 1 || block > BLOCKS.length || block * BLOCK_DAYS > lastReadyDay()) return false;
  return blockState(p, block) === 'current' || blockState(p, block) === 'moved';
}

export const BACKUP_DAYS = 7;

/** 마지막 백업(없으면 프로필을 만든 날)으로부터 일주일이 지났고 쌓인 기록이 있으면 true */
export function backupDue(p: Pick<Profile, 'createdAt' | 'doneDays' | 'starsTotal'>, lastBackupAt: number, now: number): boolean {
  if (p.doneDays.length === 0 && p.starsTotal === 0) return false;
  const base = Math.max(lastBackupAt, p.createdAt);
  return now - base > BACKUP_DAYS * 86_400_000;
}
