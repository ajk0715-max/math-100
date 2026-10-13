import type { Response } from '@/core/grade';
import type { AnswerSpec, GameId, Question } from '@/core/types';

export type Status = 'ask' | 'wrong' | 'right' | 'reveal';

export interface AnswerProps<K extends AnswerSpec['t']> {
  q: Question;
  spec: Extract<AnswerSpec, { t: K }>;
  status: Status;
  /** 틀린 횟수. 올라갈 때마다 입력 상태를 정리한다 */
  attempt: number;
  onSubmit: (r: Response) => void;
  theme?: GameId;
}
