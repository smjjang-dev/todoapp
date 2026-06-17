const test = require('node:test');
const assert = require('node:assert/strict');

test('nextPosition', async (t) => {
  const { nextPosition } = await import('../js/todoLogic.js');

  await t.test('빈 배열이면 0을 반환한다', () => {
    assert.equal(nextPosition([]), 0);
  });

  await t.test('기존 항목이 있으면 최대 position + 1을 반환한다', () => {
    assert.equal(nextPosition([{ position: 0 }, { position: 3 }, { position: 1 }]), 4);
  });
});

test('reorderByIds', async () => {
  const { reorderByIds } = await import('../js/todoLogic.js');

  const result = reorderByIds([], ['b', 'a', 'c']);
  assert.deepEqual(result, [
    { id: 'b', position: 0 },
    { id: 'a', position: 1 },
    { id: 'c', position: 2 },
  ]);
});

test('withCompletionToggle', async (t) => {
  const { withCompletionToggle } = await import('../js/todoLogic.js');

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
  const { priorityLabel, isValidPriority } = await import('../js/todoLogic.js');

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
