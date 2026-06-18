import Sortable from 'https://esm.sh/sortablejs';
import { supabase } from './supabaseClient.js';
import { requireSession, signOut } from './auth.js';
import {
  PRIORITY_LABELS,
  nextPosition,
  reorderByIds,
  withCompletionToggle,
} from './todoLogic.js';

const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const prioritySelect = document.getElementById('priority-select');
const list = document.getElementById('todo-list');
const logoutBtn = document.getElementById('logout-btn');
const greeting = document.getElementById('greeting');

let currentUserId = null;

async function loadGreeting() {
  const { data: profile } = await supabase
    .from('todo_profiles')
    .select('nickname')
    .eq('id', currentUserId)
    .single();
  greeting.textContent = profile ? `${profile.nickname}님 안녕하세요` : '';
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
  const todos = await fetchTodos();
  render(todos);
}

function render(todos) {
  list.innerHTML = '';

  if (todos.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-message';
    empty.textContent = '할 일이 없습니다.';
    list.appendChild(empty);
    return;
  }

  for (const todo of todos) {
    const item = document.createElement('li');
    item.className = 'todo-item' + (todo.completed ? ' completed' : '');
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
  }
}

async function addTodo(text, priority) {
  const todos = await fetchTodos();
  const { error } = await supabase.from('todo_todos').insert({
    text,
    priority,
    position: nextPosition(todos),
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
  const orderedIds = [...list.querySelectorAll('.todo-item')].map((el) => el.dataset.id);
  const updates = reorderByIds([], orderedIds);
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

(async function init() {
  const session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  await loadGreeting();
  await refresh();
})();
