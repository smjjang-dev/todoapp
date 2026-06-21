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
const statusMessage = document.getElementById('status-message');

// Supabase 원본 에러 메시지(스키마/내부 정보를 포함할 수 있음)는 화면에 그대로
// 노출하지 않고, 콘솔에만 남기고 사용자에게는 일반화된 한국어 메시지를 보여준다.
function showError(message, error) {
  if (error) console.error(message, error);
  statusMessage.textContent = message;
}

function clearError() {
  statusMessage.textContent = '';
}

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
  const { data: profile, error } = await supabase
    .from('todo_profiles')
    .select('nickname')
    .eq('id', currentUserId)
    .single();
  if (error) {
    console.error('프로필 조회 실패', error);
    greeting.textContent = '';
    return;
  }
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
  // topPosition은 이미 메모리에 있는 allTodos(직전 refresh() 결과)로 계산한다 —
  // 폼 submit 핸들러가 곧이어 refresh()로 서버 상태를 다시 가져오므로, 추가 전용
  // fetchTodos() 왕복을 따로 만들 필요가 없다(네트워크 1회 절감).
  const { error } = await supabase.from('todo_todos').insert({
    text,
    priority,
    position: topPosition(allTodos),
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

  const updates = reorderByIds(visibleIncompleteIds).map(({ id, position }) => ({
    id,
    position: position + offset,
  }));
  const results = await Promise.all(
    updates.map(({ id, position }) =>
      supabase
        .from('todo_todos')
        .update({ position })
        .eq('id', id)
        .then(({ error }) => ({ id, error }))
    )
  );
  const failed = results.filter((result) => result.error);
  if (failed.length > 0) {
    // 일부만 실패해도 reject하지 않고 끝까지 시도한 뒤, 호출부(Sortable onEnd)가
    // 항상 refresh()로 서버 실제 상태를 다시 그릴 수 있도록 에러를 모아 던진다 —
    // DOM(SortableJS가 이미 재배치)과 서버 상태가 어긋난 채로 멈추는 것을 방지.
    throw new Error(`순서 저장 중 ${failed.length}건 실패`);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  clearError();
  submitBtn.disabled = true;
  try {
    await addTodo(text, prioritySelect.value);
    input.value = '';
    input.focus();
    await refresh();
  } catch (error) {
    showError('할 일을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.', error);
  } finally {
    submitBtn.disabled = false;
  }
});

// 같은 항목에 대해 토글/삭제/우선순위 변경이 진행 중인 동안 중복 요청을 막기 위한
// 가드 — id별로 진행 중 여부만 추적한다(전체 폼을 잠그면 다른 항목 조작까지
// 막혀버리므로 항목 단위로 좁힌다).
const pendingItemIds = new Set();

function isItemPending(id) {
  return pendingItemIds.has(id);
}

// item(.todo-item DOM 노드)이 살아있는 동안에만 "처리 중" 표시를 입힌다 — 액션이
// 끝나면 항상 refresh()가 list.innerHTML을 새로 그리므로 별도로 클래스를 벗겨낼
// 필요는 없지만, 실패 시에도 일관되게 정리되도록 finally에서 명시적으로 제거한다.
async function withItemLock(id, item, action) {
  if (isItemPending(id)) return;
  pendingItemIds.add(id);
  item.classList.add('is-pending');
  try {
    await action();
    await refresh();
  } finally {
    pendingItemIds.delete(id);
    item.classList.remove('is-pending');
  }
}

list.addEventListener('click', async (event) => {
  const item = event.target.closest('.todo-item');
  if (!item) return;

  const deleteBtn = event.target.closest('.delete-btn');
  if (deleteBtn) {
    const id = item.dataset.id;
    if (isItemPending(id)) return;
    clearError();
    deleteBtn.disabled = true;
    try {
      await withItemLock(id, item, () => deleteTodo(id));
    } catch (error) {
      showError('삭제하지 못했습니다. 잠시 후 다시 시도해주세요.', error);
      deleteBtn.disabled = false;
    }
  }
});

list.addEventListener('change', async (event) => {
  const item = event.target.closest('.todo-item');
  if (!item) return;
  const id = item.dataset.id;

  if (event.target.classList.contains('toggle-checkbox')) {
    if (isItemPending(id)) return;
    clearError();
    const checkbox = event.target;
    checkbox.disabled = true;
    try {
      await withItemLock(id, item, () => toggleTodo(id, checkbox.checked));
    } catch (error) {
      showError('완료 상태를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.', error);
      checkbox.disabled = false;
    }
  } else if (event.target.classList.contains('priority-select')) {
    if (isItemPending(id)) return;
    clearError();
    const select = event.target;
    select.disabled = true;
    try {
      await withItemLock(id, item, () => updatePriority(id, select.value));
    } catch (error) {
      showError('중요도를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.', error);
      select.disabled = false;
    }
  }
});

Sortable.create(list, {
  handle: '.drag-handle',
  animation: 150,
  onEnd: async () => {
    clearError();
    try {
      await persistOrder();
    } catch (error) {
      showError('순서를 저장하지 못했습니다. 화면을 새로고침합니다.', error);
    } finally {
      // persistOrder가 일부만 실패했더라도, SortableJS가 이미 재배치한 DOM과
      // 서버 상태가 어긋나지 않도록 항상 서버 실제 상태로 다시 그린다.
      try {
        await refresh();
      } catch (error) {
        showError('목록을 새로고침하지 못했습니다. 페이지를 새로고침해주세요.', error);
      }
    }
  },
});

logoutBtn.addEventListener('click', async () => {
  clearError();
  try {
    await signOut();
    window.location.href = 'static/login.html';
  } catch (error) {
    showError('로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.', error);
  }
});

themeToggle.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));

themeToggle.addEventListener('click', () => {
  const next = toggleTheme();
  themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
});

function tickClock() {
  clockEl.textContent = formatDateTime(new Date());
}

// 사용자가 목록 내부 컨트롤(우선순위 select 등)에 포커스를 두고 있거나 텍스트를
// 드래그 선택 중이면 60초 주기 재렌더를 건너뛴다 — list.innerHTML 재생성이 열려
// 있는 select를 닫거나 포커스/선택을 끊어버리는 것을 방지(다음 60초 주기에
// 다시 시도되므로 상대시간 표시가 한 번 갱신을 놓치는 정도로 그친다).
function isUserInteractingWithList() {
  if (list.contains(document.activeElement) && document.activeElement !== list) {
    return true;
  }
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && list.contains(selection.anchorNode));
}

(async function init() {
  try {
    const session = await requireSession();
    if (!session) return;
    currentUserId = session.user.id;
    await loadGreeting();
    await refresh();

    tickClock();
    setInterval(tickClock, 1000);
    // 등록시간 상대표시("n분 전" 등)가 시간이 지나도 갱신되도록 재조회 없이 주기적으로 다시 그린다.
    setInterval(() => {
      if (isUserInteractingWithList()) return;
      render();
    }, 60000);
  } catch (error) {
    showError('초기 로딩에 실패했습니다. 페이지를 새로고침해주세요.', error);
  }
})();
