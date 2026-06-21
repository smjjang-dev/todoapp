export const PRIORITY_LABELS = { high: '상', medium: '중', low: '하' };

export function isValidPriority(priority) {
  return Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, priority);
}

export function priorityLabel(priority) {
  return isValidPriority(priority) ? PRIORITY_LABELS[priority] : PRIORITY_LABELS.medium;
}

export function topPosition(todos) {
  if (todos.length === 0) return 0;
  return Math.min(...todos.map((todo) => todo.position)) - 1;
}

export function reorderByIds(orderedIds) {
  return orderedIds.map((id, index) => ({ id, position: index }));
}

export function withCompletionToggle(completed, now = new Date()) {
  return { completed, completed_at: completed ? now.toISOString() : null };
}

export function sortForDisplay(todos) {
  const incomplete = todos.filter((todo) => !todo.completed);
  const completed = todos
    .filter((todo) => todo.completed)
    .sort((a, b) => {
      // completed_at이 없는(비정상) 항목은 항상 맨 뒤로 보내 NaN 비교로 인한
      // 정렬 불안정을 방지한다 — 정상 플로우에서는 withCompletionToggle이 항상
      // completed_at을 채우므로 발생하지 않지만, 외부 데이터 변형/마이그레이션
      // 누락에 대한 방어.
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : -Infinity;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : -Infinity;
      return bTime - aTime;
    });
  return [...incomplete, ...completed];
}

export function formatRelativeTime(date, now = new Date()) {
  const diffSeconds = Math.max(0, Math.floor((now - date) / 1000));
  if (diffSeconds < 60) return '방금 전';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}분 전`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}시간 전`;
  return `${Math.floor(diffSeconds / 86400)}일 전`;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDateTime(date) {
  const pad2 = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAY_LABELS[date.getDay()];
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  const second = pad2(date.getSeconds());
  return `${year}년 ${month}월 ${day}일 ${weekday} ${hour}시${minute}분 ${second}초`;
}

export function computeProgress(todos) {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}
