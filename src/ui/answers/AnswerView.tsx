'use client';

import type { Response } from '@/core/grade';
import type { GameId, Question } from '@/core/types';
import { CalTap } from './CalTap';
import { Choice } from './Choice';
import { ClockSet } from './ClockSet';
import { Coins } from './Coins';
import { Gaps } from './Gaps';
import { Match } from './Match';
import { NumberPad } from './NumberPad';
import { Order } from './Order';
import { PickN } from './PickN';
import { Split } from './Split';
import { TapTargets } from './TapTargets';
import { Trace } from './Trace';
import type { Status } from './types';

export interface AnswerViewProps {
  q: Question;
  status: Status;
  attempt: number;
  onSubmit: (r: Response) => void;
  theme?: GameId;
}

/** 문제의 답 종류에 맞는 입력 화면을 고른다 */
export function AnswerView(p: AnswerViewProps) {
  const a = p.q.answer;
  const common = { q: p.q, status: p.status, attempt: p.attempt, onSubmit: p.onSubmit, theme: p.theme };
  switch (a.t) {
    case 'choice':
      return <Choice {...common} spec={a} />;
    case 'number':
      return <NumberPad {...common} spec={a} />;
    case 'pickN':
      return <PickN {...common} spec={a} />;
    case 'gaps':
      return <Gaps {...common} spec={a} />;
    case 'order':
      return <Order {...common} spec={a} />;
    case 'clockSet':
      return <ClockSet {...common} spec={a} />;
    case 'tapTargets':
      return <TapTargets {...common} spec={a} />;
    case 'coins':
      return <Coins {...common} spec={a} />;
    case 'trace':
      return <Trace {...common} spec={a} />;
    case 'calTap':
      return <CalTap {...common} spec={a} />;
    case 'split':
      return <Split {...common} spec={a} />;
    case 'match':
      return <Match {...common} spec={a} />;
  }
}
