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
    item.draggable = false;

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
    deleteBtn.textContent = '삭제';

    item.appendChild(handle);
    item.appendChild(checkbox);
    item.appendChild(prioritySelectEl);
    item.appendChild(textWrap);
    item.appendChild(deleteBtn);
    list.appendChild(item);
  }
}

function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll('.todo-item:not(.dragging)')];
  return items.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
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

  if (event.target.classList.contains('delete-btn')) {
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

list.addEventListener('mousedown', (event) => {
  const handle = event.target.closest('.drag-handle');
  if (!handle) return;
  const item = handle.closest('.todo-item');
  item.draggable = true;
});

document.addEventListener('mouseup', () => {
  list.querySelectorAll('.todo-item[draggable="true"]').forEach((item) => {
    item.draggable = false;
  });
});

list.addEventListener('dragstart', (event) => {
  const item = event.target.closest('.todo-item');
  if (!item) return;
  item.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', item.dataset.id);
});

list.addEventListener('dragover', (event) => {
  const dragging = list.querySelector('.dragging');
  if (!dragging) return;
  event.preventDefault();
  const afterElement = getDragAfterElement(list, event.clientY);
  if (afterElement == null) {
    list.appendChild(dragging);
  } else {
    list.insertBefore(dragging, afterElement);
  }
});

list.addEventListener('dragend', async (event) => {
  const item = event.target.closest('.todo-item');
  if (!item) return;
  item.classList.remove('dragging');
  item.draggable = false;
  await persistOrder();
  await refresh();
});

logoutBtn.addEventListener('click', async () => {
  await signOut();
  window.location.href = 'login.html';
});

(async function init() {
  const session = await requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  await loadGreeting();
  await refresh();
})();
