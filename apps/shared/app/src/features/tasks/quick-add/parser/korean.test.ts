import { describe, expect, it } from 'vitest';

import { parseQuickAdd } from './parse';

const parse = (text: string) =>
  parseQuickAdd(text, {
    today: '2026-11-04',
    nowMinutes: 10 * 60,
    projects: [],
    sections: [],
    projectId: null,
  });

describe('Korean dates and times', () => {
  it('reads a date with a time', () => {
    expect(parse('내일 오후 3시 회의')).toMatchObject({
      title: '회의',
      dueDate: '2026-11-05',
      dueTime: 15 * 60,
    });
    expect(parse('11월 20일 오전 9시 30분 발표')).toMatchObject({
      title: '발표',
      dueDate: '2026-11-20',
      dueTime: 9 * 60 + 30,
    });
    expect(parse('모레 저녁 7시 반에 약속')).toMatchObject({
      title: '약속',
      dueDate: '2026-11-06',
      dueTime: 19 * 60 + 30,
    });
  });

  it('reads relative days and weeks', () => {
    expect(parse('오늘 보고서').dueDate).toBe('2026-11-04');
    expect(parse('어제 영수증 정리').dueDate).toBe('2026-11-03');
    expect(parse('글피 장보기').dueDate).toBe('2026-11-07');
    expect(parse('금요일 치과').dueDate).toBe('2026-11-06');
    expect(parse('수요일 치과').dueDate).toBe('2026-11-11');
    expect(parse('이번주 일요일 청소').dueDate).toBe('2026-11-08');
    expect(parse('다음주 금요일 치과 예약')).toMatchObject({
      title: '치과 예약',
      dueDate: '2026-11-13',
    });
    expect(parse('다음 주 계획').dueDate).toBe('2026-11-09');
    expect(parse('주말 대청소').dueDate).toBe('2026-11-07');
    expect(parse('3일 후 답장').dueDate).toBe('2026-11-07');
    expect(parse('2주 뒤 검진').dueDate).toBe('2026-11-18');
  });

  it('reads day parts and clock words', () => {
    expect(parse('내일 아침 운동')).toMatchObject({
      title: '운동',
      dueDate: '2026-11-05',
      dueTime: 9 * 60,
    });
    expect(parse('밤 11시 정리').dueTime).toBe(23 * 60);
    expect(parse('낮 12시 점심').dueTime).toBe(12 * 60);
    expect(parse('새벽 12시 배포').dueTime).toBe(0);
    expect(parse('정오 회의').dueTime).toBe(12 * 60);
    expect(parse('15시 회의').dueTime).toBe(15 * 60);
    expect(parse('2시간 후 전화')).toMatchObject({
      title: '전화',
      dueDate: '2026-11-04',
      dueTime: 12 * 60,
    });
  });

  it('leaves words that only contain a date in the title', () => {
    expect(parse('오늘의 할 일').title).toBe('오늘의 할 일');
    expect(parse('아침밥 먹기').dueTime).toBeUndefined();
    expect(parse('3시간 공부').dueTime).toBeUndefined();
  });
});
