export const PRIORITY_LABELS = { high: '상', medium: '중', low: '하' };

export function isValidPriority(priority) {
  return Object.prototype.hasOwnProperty.call(PRIORITY_LABELS, priority);
}

export function priorityLabel(priority) {
  return isValidPriority(priority) ? PRIORITY_LABELS[priority] : PRIORITY_LABELS.medium;
}

export function nextPosition(todos) {
  if (todos.length === 0) return 0;
  return Math.max(...todos.map((todo) => todo.position)) + 1;
}

export function reorderByIds(todos, orderedIds) {
  return orderedIds.map((id, index) => ({ id, position: index }));
}

export function withCompletionToggle(completed, now = new Date()) {
  return { completed, completed_at: completed ? now.toISOString() : null };
}
