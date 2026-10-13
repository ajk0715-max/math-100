// 한국어 읽기 도우미. 음성(TTS)에 넘길 문장은 숫자를 한글로 풀어 써야 읽는 방식이 흔들리지 않는다.

const NATIVE_ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_ONES_MOD = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const SINO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

/** 하나, 둘, … 열, 열하나, … (1~99) */
export function nativeNum(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new RangeError(`nativeNum: ${n}`);
  const t = Math.floor(n / 10);
  const o = n % 10;
  return (NATIVE_TENS[t] as string) + (NATIVE_ONES[o] as string);
}

/** 단위 앞에서 쓰는 형태: 한, 두, 세, 네, … 열, 열한, 열두, 스무 (1~99) */
export function nativeCounter(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new RangeError(`nativeCounter: ${n}`);
  if (n === 20) return '스무';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return (NATIVE_TENS[t] as string) + (NATIVE_ONES_MOD[o] as string);
}

/** 일, 이, 삼 … 십, 십일, 이십 … 백 … (0~9999) */
export function sinoNum(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new RangeError(`sinoNum: ${n}`);
  if (n === 0) return '영';
  const th = Math.floor(n / 1000);
  const h = Math.floor((n % 1000) / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  let s = '';
  if (th) s += (th === 1 ? '' : (SINO[th] as string)) + '천';
  if (h) s += (h === 1 ? '' : (SINO[h] as string)) + '백';
  if (t) s += (t === 1 ? '' : (SINO[t] as string)) + '십';
  if (o) s += SINO[o] as string;
  return s;
}

/** 세 개, 열두 마리 */
export function countKo(n: number, counter: string): string {
  return `${nativeCounter(n)} ${counter}`;
}

/** 한 시, 두 시, … 열두 시 */
export function hourKo(h: number): string {
  const hh = ((h - 1 + 12) % 12) + 1;
  return `${nativeCounter(hh)} 시`;
}

export function minuteKo(m: number): string {
  return m === 0 ? '' : `${sinoNum(m)} 분`;
}

/** 읽어 주는 시각: 세 시, 세 시 삼십 분 */
export function timeKo(h: number, m: number): string {
  return m === 0 ? hourKo(h) : `${hourKo(h)} ${minuteKo(m)}`;
}

/** 화면에 쓰는 시각: 3시, 3시 30분 */
export function timeText(h: number, m: number): string {
  const hh = ((h - 1 + 12) % 12) + 1;
  return m === 0 ? `${hh}시` : `${hh}시 ${m}분`;
}

export function digitalText(h: number, m: number): string {
  const hh = ((h - 1 + 12) % 12) + 1;
  return `${hh}:${m < 10 ? '0' : ''}${m}`;
}

const MONTHS_KO = ['', '일월', '이월', '삼월', '사월', '오월', '유월', '칠월', '팔월', '구월', '시월', '십일월', '십이월'];

export function monthKo(m: number): string {
  if (m < 1 || m > 12) throw new RangeError(`monthKo: ${m}`);
  return MONTHS_KO[m] as string;
}

export function dayKo(d: number): string {
  return `${sinoNum(d)}일`;
}

export function dateKo(m: number, d: number): string {
  return `${monthKo(m)} ${dayKo(d)}`;
}

export function dateText(m: number, d: number): string {
  return `${m}월 ${d}일`;
}

const ORDINALS = ['', '첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];

export function ordinalKo(n: number): string {
  if (n < 1 || n > 10) throw new RangeError(`ordinalKo: ${n}`);
  return ORDINALS[n] as string;
}

export function wonKo(n: number): string {
  return `${sinoNum(n)} 원`;
}

export function wonText(n: number): string {
  return `${n}원`;
}

// ---- 조사 ----

// 숫자를 읽을 때의 받침 (한자어 읽기 기준): 영·일·삼·육·칠·팔은 받침이 있다.
const DIGIT_JONG: Record<string, number> = { '0': 21, '1': 8, '2': 0, '3': 16, '4': 0, '5': 0, '6': 1, '7': 8, '8': 8, '9': 0 };

function finalJong(word: string): number | null {
  for (let i = word.length - 1; i >= 0; i--) {
    const ch = word.charAt(i);
    const c = word.charCodeAt(i);
    if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28;
    if (ch in DIGIT_JONG) return DIGIT_JONG[ch] as number;
    if (ch === ' ' || ch === ')' || ch === ']' || ch === '"' || ch === "'") continue;
    return null;
  }
  return null;
}

export type JosaKind = '이/가' | '은/는' | '을/를' | '과/와' | '으로/로' | '이에요/예요' | '이랑/랑' | '이라고/라고';

export function josa(word: string, kind: JosaKind): string {
  const jong = finalJong(word);
  const has = jong !== null && jong > 0;
  switch (kind) {
    case '이/가':
      return has ? '이' : '가';
    case '은/는':
      return has ? '은' : '는';
    case '을/를':
      return has ? '을' : '를';
    case '과/와':
      return has ? '과' : '와';
    case '으로/로':
      return !has || jong === 8 ? '로' : '으로';
    case '이에요/예요':
      return has ? '이에요' : '예요';
    case '이랑/랑':
      return has ? '이랑' : '랑';
    case '이라고/라고':
      return has ? '이라고' : '라고';
  }
}

export function withJosa(word: string, kind: JosaKind): string {
  return word + josa(word, kind);
}

// ---- 음성용 변환 ----

// 숫자 뒤에 오면 고유어 수(한, 두, 세 …)로 읽는 단위
const NATIVE_UNIT = ['시간', '켤레', '묶음', '조각', '송이', '마리', '바구니', '접시', '봉지', '상자', '군데', '가지', '개', '대', '명', '권', '장', '번', '살', '자루', '그루', '병', '칸', '줄', '쪽', '시', '달', '판', '통', '잔', '벌', '채', '자리', '모둠'];
// 숫자 뒤에 오면 한자어 수(일, 이, 삼 …)로 읽는 단위
const SINO_UNIT = ['개월', '주일', '학년', '교시', '번째', '분', '초', '월', '일', '원', '층', '호', '년', '주', '반', '점', '번지'];

const UNIT_RE = new RegExp(`(\\d+)\\s?(${[...NATIVE_UNIT, ...SINO_UNIT].sort((a, b) => b.length - a.length).join('|')})`, 'g');

function readNumber(n: number): string {
  return n <= 9999 ? sinoNum(n) : String(n);
}

/**
 * 화면에 쓰는 글(숫자 포함)을 읽어 주는 글로 바꾼다. 소리 내어 읽을 문장은 항상 이 함수를 거친다.
 * 단위에 따라 고유어(세 개, 열두 시) 또는 한자어(삼 분, 오백 원)로 읽는다.
 */
export function speak(text: string): string {
  let s = text;
  // 3:30 → 세 시 삼십 분
  s = s.replace(/(\d{1,2}):(\d{2})/g, (_m, h: string, mm: string) => timeKo(Number(h), Number(mm)));
  s = s.replace(UNIT_RE, (_m, num: string, unit: string) => {
    const n = Number(num);
    if (unit === '월' && n >= 1 && n <= 12) return monthKo(n);
    if (unit === '번째') {
      if (n === 1) return '첫 번째';
      if (n >= 2 && n <= 99) return `${nativeCounter(n)} 번째`;
    }
    if (NATIVE_UNIT.includes(unit)) {
      if (n >= 1 && n <= 99) return `${nativeCounter(n)} ${unit}`;
      return `${readNumber(n)} ${unit}`;
    }
    return `${readNumber(n)}${unit === '일' || unit === '월' ? '' : ' '}${unit}`;
  });
  s = s.replace(/\d+/g, (num) => readNumber(Number(num)));
  s = s.replace(/\s*\+\s*/g, ' 더하기 ').replace(/\s*[−–]\s*/g, ' 빼기 ').replace(/\s*[×x]\s*(?=\S)/g, ' 곱하기 ');
  // 5 − 2 = 3 → "오 빼기 이는 삼": 등호 앞 말에 은/는을 붙여 읽는다
  s = s.replace(/(\S+?)\s*=\s*/g, (_m, a: string) => `${a}${josa(a, '은/는')} `);
  return s.replace(/\s{2,}/g, ' ').trim();
}
