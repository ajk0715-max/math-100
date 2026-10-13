import { describe, expect, it } from 'vitest';
import { countKo, dateKo, hourKo, josa, monthKo, nativeCounter, nativeNum, ordinalKo, sinoNum, timeKo, wonKo, withJosa } from '@/core/ko';

describe('한국어 수 읽기', () => {
  it('고유어 수', () => {
    expect(nativeNum(1)).toBe('하나');
    expect(nativeNum(10)).toBe('열');
    expect(nativeNum(11)).toBe('열하나');
    expect(nativeNum(20)).toBe('스물');
    expect(nativeNum(35)).toBe('서른다섯');
  });
  it('단위 앞 고유어', () => {
    expect(nativeCounter(1)).toBe('한');
    expect(nativeCounter(2)).toBe('두');
    expect(nativeCounter(3)).toBe('세');
    expect(nativeCounter(4)).toBe('네');
    expect(nativeCounter(12)).toBe('열두');
    expect(nativeCounter(20)).toBe('스무');
    expect(nativeCounter(21)).toBe('스물한');
    expect(countKo(3, '개')).toBe('세 개');
  });
  it('한자어 수', () => {
    expect(sinoNum(0)).toBe('영');
    expect(sinoNum(10)).toBe('십');
    expect(sinoNum(15)).toBe('십오');
    expect(sinoNum(30)).toBe('삼십');
    expect(sinoNum(100)).toBe('백');
    expect(sinoNum(500)).toBe('오백');
    expect(sinoNum(1200)).toBe('천이백');
  });
  it('시각·날짜', () => {
    expect(hourKo(12)).toBe('열두 시');
    expect(hourKo(13)).toBe('한 시');
    expect(timeKo(3, 30)).toBe('세 시 삼십 분');
    expect(monthKo(6)).toBe('유월');
    expect(monthKo(10)).toBe('시월');
    expect(dateKo(5, 5)).toBe('오월 오일');
    expect(ordinalKo(3)).toBe('셋째');
    expect(wonKo(500)).toBe('오백 원');
  });
});

describe('조사', () => {
  it('받침 판단', () => {
    expect(withJosa('사과', '이/가')).toBe('사과가');
    expect(withJosa('책', '이/가')).toBe('책이');
    expect(withJosa('책', '은/는')).toBe('책은');
    expect(withJosa('공', '을/를')).toBe('공을');
    expect(withJosa('시계', '을/를')).toBe('시계를');
  });
  it('으로/로: ㄹ 받침은 로', () => {
    expect(josa('연필', '으로/로')).toBe('로');
    expect(josa('책', '으로/로')).toBe('으로');
    expect(josa('사과', '으로/로')).toBe('로');
  });
  it('숫자를 읽는 방식으로 받침 판단', () => {
    expect(josa('1', '이/가')).toBe('이'); // 일
    expect(josa('2', '이/가')).toBe('가'); // 이
    expect(josa('3', '과/와')).toBe('과'); // 삼
    expect(josa('4', '은/는')).toBe('는'); // 사
    expect(josa('5', '을/를')).toBe('를'); // 오
    expect(josa('6', '이/가')).toBe('이'); // 육
    expect(josa('10', '이/가')).toBe('이'); // 십
    expect(josa('0', '이/가')).toBe('이'); // 영
  });
});

import { speak } from '@/core/ko';

describe('speak(): 화면 글 → 읽어 주는 글', () => {
  it('개수 단위는 고유어', () => {
    expect(speak('사과 3개')).toBe('사과 세 개');
    expect(speak('2마리')).toBe('두 마리');
    expect(speak('12개')).toBe('열두 개');
    expect(speak('20개')).toBe('스무 개');
    expect(speak('1명')).toBe('한 명');
    expect(speak('4번째')).toBe('네 번째');
    expect(speak('1번째')).toBe('첫 번째');
  });
  it('시각', () => {
    expect(speak('3시')).toBe('세 시');
    expect(speak('7시 30분')).toBe('일곱 시 삼십 분');
    expect(speak('12시')).toBe('열두 시');
    expect(speak('3:30')).toBe('세 시 삼십 분');
    expect(speak('2시간')).toBe('두 시간');
  });
  it('날짜·돈', () => {
    expect(speak('6월 5일')).toBe('유월 오일');
    expect(speak('10월 10일')).toBe('시월 십일');
    expect(speak('11월')).toBe('십일월');
    expect(speak('500원')).toBe('오백 원');
    expect(speak('1학년 3교시')).toBe('일 학년 삼 교시');
    expect(speak('3개월')).toBe('삼 개월');
    expect(speak('일주일은 7일')).toBe('일주일은 칠일');
  });
  it('단위 없는 수는 한자어', () => {
    expect(speak('3과 4 사이')).toBe('삼과 사 사이');
    expect(speak('5 + 3')).toBe('오 더하기 삼');
    expect(speak('숫자 10 쓰기')).toBe('숫자 십 쓰기');
  });
  it('식은 등호 앞 말에 은/는을 붙여 읽는다', () => {
    expect(speak('2 + 1 = 3')).toBe('이 더하기 일은 삼');
    expect(speak('5 − 2 = 3')).toBe('오 빼기 이는 삼');
    expect(speak('4 + 3 = 7')).toBe('사 더하기 삼은 칠');
    expect(speak('9 − 6 = ?')).toBe('구 빼기 육은 ?');
    expect(speak('3 + ? = 5')).toBe('삼 더하기 ?는 오');
  });
  it('숫자가 남지 않는다', () => {
    expect(/[0-9]/.test(speak('1, 2, 3, 100, 2026'))).toBe(false);
  });
});
