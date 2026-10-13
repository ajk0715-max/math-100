import type { GameId } from '@/core/types';
import type { Section } from '@/core/session';

export const GAME_TITLE: Record<GameId, string> = {
  fish: '별 낚시',
  stones: '징검다리 건너기',
  jars: '구슬 병',
  balloons: '풍선 터뜨리기',
  hands: '바늘 돌리기',
  clockMatch: '시계 짝 맞추기',
  dayCards: '하루 카드',
  weekTrain: '요일 기차',
  dateHunt: '날짜 보물찾기',
  lineup: '막대 줄 세우기',
  seesaw: '시소 놀이',
  shop: '마을 가게',
  bundle: '선물 포장',
  pattern: '구슬 꿰기',
  sort: '장난감 정리',
  story: '이야기 극장',
  school: '학교 가는 길',
  adventure: '종합 모험',
};

export const GAME_EMOJI: Record<GameId, string> = {
  fish: '🎣',
  stones: '🪨',
  jars: '🫙',
  balloons: '🎈',
  hands: '🕰️',
  clockMatch: '🃏',
  dayCards: '🗂️',
  weekTrain: '🚂',
  dateHunt: '🗺️',
  lineup: '📏',
  seesaw: '⚖️',
  shop: '🏪',
  bundle: '🎁',
  pattern: '🧵',
  sort: '🧺',
  story: '🎭',
  school: '🏫',
  adventure: '🏰',
};

export const SECTION_LABEL: Record<Section, string> = {
  warmup: '워밍업',
  explore: '오늘의 탐험',
  game: '보너스 게임',
  boss: '보스 도전',
};
