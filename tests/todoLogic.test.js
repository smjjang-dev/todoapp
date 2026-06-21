const test = require('node:test');
const assert = require('node:assert/strict');

test('topPosition', async (t) => {
  const { topPosition } = await import('../static/js/todoLogic.js');

  await t.test('빈 배열이면 0을 반환한다', () => {
    assert.equal(topPosition([]), 0);
  });

  await t.test('기존 항목이 있으면 최소 position - 1을 반환한다', () => {
    assert.equal(topPosition([{ position: 0 }, { position: 3 }, { position: 1 }]), -1);
  });
});

test('reorderByIds', async () => {
  const { reorderByIds } = await import('../static/js/todoLogic.js');

  const result = reorderByIds(['b', 'a', 'c']);
  assert.deepEqual(result, [
    { id: 'b', position: 0 },
    { id: 'a', position: 1 },
    { id: 'c', position: 2 },
  ]);
});

test('withCompletionToggle', async (t) => {
  const { withCompletionToggle } = await import('../static/js/todoLogic.js');

  await t.test('completed=true이면 주입한 now 기준 ISO 문자열을 저장한다', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    assert.deepEqual(withCompletionToggle(true, now), {
      completed: true,
      completed_at: '2026-01-01T00:00:00.000Z',
    });
  });

  await t.test('completed=false이면 completed_at이 null이다', () => {
    assert.deepEqual(withCompletionToggle(false), {
      completed: false,
      completed_at: null,
    });
  });
});

test('priorityLabel / isValidPriority', async (t) => {
  const { priorityLabel, isValidPriority } = await import('../static/js/todoLogic.js');

  await t.test('high/medium/low를 상/중/하로 매핑한다', () => {
    assert.equal(priorityLabel('high'), '상');
    assert.equal(priorityLabel('medium'), '중');
    assert.equal(priorityLabel('low'), '하');
  });

  await t.test('알 수 없는 값은 중으로 폴백한다', () => {
    assert.equal(priorityLabel('unknown'), '중');
  });

  await t.test('isValidPriority는 정의된 키만 true를 반환한다', () => {
    assert.equal(isValidPriority('high'), true);
    assert.equal(isValidPriority('unknown'), false);
  });
});

test('sortForDisplay', async (t) => {
  const { sortForDisplay } = await import('../static/js/todoLogic.js');

  await t.test('미완료 항목은 입력 순서를 유지하고 완료 항목보다 앞에 온다', () => {
    const todos = [
      { id: 'a', completed: false },
      { id: 'b', completed: true, completed_at: '2026-01-01T00:00:00.000Z' },
      { id: 'c', completed: false },
    ];
    const result = sortForDisplay(todos).map((t) => t.id);
    assert.deepEqual(result, ['a', 'c', 'b']);
  });

  await t.test('완료 항목은 completed_at 내림차순(최근 완료가 위)으로 정렬한다', () => {
    const todos = [
      { id: 'old', completed: true, completed_at: '2026-01-01T00:00:00.000Z' },
      { id: 'new', completed: true, completed_at: '2026-01-03T00:00:00.000Z' },
      { id: 'mid', completed: true, completed_at: '2026-01-02T00:00:00.000Z' },
    ];
    const result = sortForDisplay(todos).map((t) => t.id);
    assert.deepEqual(result, ['new', 'mid', 'old']);
  });

  await t.test('completed_at이 null인 항목은 NaN 없이 맨 뒤로 정렬된다', () => {
    const todos = [
      { id: 'broken', completed: true, completed_at: null },
      { id: 'new', completed: true, completed_at: '2026-01-03T00:00:00.000Z' },
    ];
    const result = sortForDisplay(todos).map((t) => t.id);
    assert.deepEqual(result, ['new', 'broken']);
  });
});

test('formatRelativeTime', async (t) => {
  const { formatRelativeTime } = await import('../static/js/todoLogic.js');
  const now = new Date('2026-01-01T00:10:00.000Z');

  await t.test('1분 미만이면 방금 전', () => {
    assert.equal(formatRelativeTime(new Date('2026-01-01T00:09:30.000Z'), now), '방금 전');
  });

  await t.test('1시간 미만이면 n분 전', () => {
    assert.equal(formatRelativeTime(new Date('2026-01-01T00:00:00.000Z'), now), '10분 전');
  });

  await t.test('24시간 미만이면 n시간 전', () => {
    assert.equal(formatRelativeTime(new Date('2025-12-31T22:10:00.000Z'), now), '2시간 전');
  });

  await t.test('24시간 이상이면 n일 전', () => {
    assert.equal(formatRelativeTime(new Date('2025-12-29T00:10:00.000Z'), now), '3일 전');
  });
});

test('formatDateTime', async (t) => {
  const { formatDateTime } = await import('../static/js/todoLogic.js');

  await t.test('연/월/일/요일/시/분/초 형식으로 변환한다', () => {
    const date = new Date(2026, 5, 20, 20, 30, 0);
    assert.equal(formatDateTime(date), '2026년 6월 20일 토 20시30분 00초');
  });

  await t.test('분/초는 2자리로 0 패딩한다', () => {
    const date = new Date(2026, 0, 5, 9, 5, 7);
    assert.equal(formatDateTime(date), '2026년 1월 5일 월 09시05분 07초');
  });
});

test('computeProgress', async (t) => {
  const { computeProgress } = await import('../static/js/todoLogic.js');

  await t.test('빈 배열이면 0/0 (0%)', () => {
    assert.deepEqual(computeProgress([]), { completed: 0, total: 0, percent: 0 });
  });

  await t.test('완료/전체 개수와 백분율을 계산한다', () => {
    const todos = [
      { completed: true },
      { completed: true },
      { completed: false },
      { completed: false },
    ];
    assert.deepEqual(computeProgress(todos), { completed: 2, total: 4, percent: 50 });
  });

  await t.test('백분율은 정수로 반올림한다', () => {
    const todos = [{ completed: true }, { completed: false }, { completed: false }];
    assert.deepEqual(computeProgress(todos), { completed: 1, total: 3, percent: 33 });
  });
});
