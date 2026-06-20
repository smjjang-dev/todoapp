import Sortable from 'https://esm.sh/sortablejs@1.15.7';
import { supabase } from './supabaseClient.js';
import { requireSession, signOut } from './auth.js';
import { toggleTheme } from './theme.js';
import {
  PRIORITY_LABELS,
  topPosition,
  reorderByIds,
  withCompletionToggle,
  sortForDisplay,
  formatRelativeTime,
  formatDateTime,
  computeProgress,
} from './todoLogic.js';

const PAGE_SIZE = 15;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const prioritySelect = document.getElementById('priority-select');
const list = document.getElementById('todo-list');
const logoutBtn = document.getElementById('logout-btn');
const greeting = document.getElementById('greeting');
const themeToggle = document.getElementById('theme-toggle');
const submitBtn = form.querySelector('button[type="submit"]');
const clockEl = document.getElementById('current-clock');
const progressText = document.getElementById('progress-text');
const progressBarFill = document.getElementById('progress-bar-fill');

logoutBtn.innerHTML =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
  '<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>' +
  '</svg>';

submitBtn.innerHTML =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<line x1="12" y1="5" x2="12" y2="19"></line>' +
  '<line x1="5" y1="12" x2="19" y2="12"></line>' +
  '</svg>';

let currentUserId = null;
let allTodos = [];
let visibleCount = PAGE_SIZE;

const sentinelObserver = new IntersectionObserver((entries) => {
  if (entries[0]?.isIntersecting) {
    loadMore();
  }
});

async function loadGreeting() {
  const { data: profile } = await supabase
    .from('todo_profiles')
    .select('nickname')
    .eq('id', currentUserId)
    .single();
  greeting.textContent = profile ? `${profile.nickname}님` : '';
}

async function fetchTodos() {
  const { data, error } = await supabase
    .from('todo_todos')
    .select('*')
    .order('position');
  if (error) throw error;
  return data;
}

async function refresh() {
  allTodos = await fetchTodos();
  visibleCount = PAGE_SIZE;
  render();
}

function loadMore() {
  const sorted = sortForDisplay(allTodos);
  if (visibleCount >= sorted.length) return;
  const revealFrom = visibleCount;
  visibleCount = Math.min(sorted.length, visibleCount + PAGE_SIZE);
  render(revealFrom);
}

function renderProgress() {
  const { completed, total, percent } = computeProgress(allTodos);
  progressText.textContent = `${completed}/${total} 완료 (${percent}%)`;
  progressBarFill.style.width = `${percent}%`;
}

function render(revealFrom = -1) {
  sentinelObserver.disconnect();
  list.innerHTML = '';
  renderProgress();

  const sorted = sortForDisplay(allTodos);

  if (sorted.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-message';
    empty.textContent = '할 일이 없습니다.';
    list.appendChild(empty);
    return;
  }

  const visibleTodos = sorted.slice(0, visibleCount);

  visibleTodos.forEach((todo, index) => {
    const item = document.createElement('li');
    item.className = 'todo-item' + (todo.completed ? ' completed' : '');
    if (revealFrom >= 0 && index >= revealFrom) {
      item.classList.add('just-appeared');
    }
    item.dataset.id = todo.id;

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⠿';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'toggle-checkbox';
    checkbox.checked = todo.completed;

    const prioritySelectEl = document.createElement('select');
    prioritySelectEl.className = `priority-select priority-${todo.priority}`;
    for (const [value, label] of Object.entries(PRIORITY_LABELS)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = value === todo.priority;
      prioritySelectEl.appendChild(option);
    }

    const textWrap = document.createElement('span');
    textWrap.className = 'todo-text-wrap';

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;
    textWrap.appendChild(text);

    if (todo.completed && todo.completed_at) {
      const completedAt = document.createElement('span');
      completedAt.className = 'completed-at';
      completedAt.textContent = new Date(todo.completed_at).toLocaleString('ko-KR');
      textWrap.appendChild(completedAt);
    } else if (todo.created_at) {
      const createdAt = document.createElement('span');
      createdAt.className = 'created-at';
      createdAt.textContent = formatRelativeTime(new Date(todo.created_at));
      textWrap.appendChild(createdAt);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', '삭제');
    deleteBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="3 6 5 6 21 6"></polyline>' +
      '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>' +
      '<path d="M10 11v6"></path><path d="M14 11v6"></path>' +
      '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>' +
      '</svg>';

    item.appendChild(handle);
    item.appendChild(checkbox);
    item.appendChild(prioritySelectEl);
    item.appendChild(textWrap);
    item.appendChild(deleteBtn);
    list.appendChild(item);
  });

  if (visibleCount < sorted.length) {
    const sentinel = document.createElement('li');
    sentinel.className = 'scroll-sentinel';
    list.appendChild(sentinel);
    sentinelObserver.observe(sentinel);
  }
}

async function addTodo(text, priority) {
  const todos = await fetchTodos();
  const { error } = await supabase.from('todo_todos').insert({
    text,
    priority,
    position: topPosition(todos),
    user_id: currentUserId,
  });
  if (error) throw error;
}

async function toggleTodo(id, completed) {
  const { error } = await supabase
    .from('todo_todos')
    .update(withCompletionToggle(completed))
    .eq('id', id);
  if (error) throw error;
}

async function updatePriority(id, priority) {
  const { error } = await supabase.from('todo_todos').update({ priority }).eq('id', id);
  if (error) throw error;
}

async function deleteTodo(id) {
  const { error } = await supabase.from('todo_todos').delete().eq('id', id);
  if (error) throw error;
}

async function persistOrder() {
  const visibleIncompleteIds = [...list.querySelectorAll('.todo-item:not(.completed)')].map(
    (el) => el.dataset.id
  );
  if (visibleIncompleteIds.length === 0) return;

  // 페이지네이션으로 화면에 없는 미완료 항목보다 항상 앞에 오도록, 화면 밖 항목의
  // 최소 position보다 작은 값들로 재배치한다(완료 항목은 completed_at으로만 정렬되므로 제외).
  const hiddenIncompletePositions = allTodos
    .filter((todo) => !todo.completed && !visibleIncompleteIds.includes(todo.id))
    .map((todo) => todo.position);
  const offset =
    hiddenIncompletePositions.length > 0
      ? Math.min(...hiddenIncompletePositions) - visibleIncompleteIds.length
      : 0;

  const updates = reorderByIds([], visibleIncompleteIds).map(({ id, position }) => ({
    id,
    position: position + offset,
  }));
  await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('todo_todos').update({ position }).eq('id', id)
    )
  );
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  await addTodo(text, prioritySelect.value);
  input.value = '';
  input.focus();
  await refresh();
});

list.addEventListener('click', async (event) => {
  const item = event.target.closest('.todo-item');
  if (!item) return;

  if (event.target.closest('.delete-btn')) {
    await deleteTodo(item.dataset.id);
    await refresh();
  }
});

list.addEventListener('change', async (event) => {
  if (event.target.classList.contains('toggle-checkbox')) {
    const item = event.target.closest('.todo-item');
    await toggleTodo(item.dataset.id, event.target.checked);
    await refresh();
  } else if (event.target.classList.contains('priority-select')) {
    const item = event.target.closest('.todo-item');
    await updatePriority(item.dataset.id, event.target.value);
    await refresh();
  }
});

Sortable.create(list, {
  handle: '.drag-handle',
  animation: 150,
  onEnd: async () => {
    await persistOrder();
    await refresh();
  },
});

logoutBtn.addEventListener('click', async () => {
  await signOut();
  window.location.href = 'static/login.html';
});

themeToggle.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));

themeToggle.addEventListener('click', () => {
  const next = toggleTheme();
  themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
});

function tickClock() {
  clockEl.textContent = formatDateTime(new Date());
}

(async function init() {
  const session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  await loadGreeting();
  await refresh();

  tickClock();
  setInterval(tickClock, 1000);
  // 등록시간 상대표시("n분 전" 등)가 시간이 지나도 갱신되도록 재조회 없이 주기적으로 다시 그린다.
  setInterval(() => render(), 60000);
})();
