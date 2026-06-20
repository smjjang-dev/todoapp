# Todo 앱 디자인 개선 — 아이콘 버튼 전환 + 다크모드 토글

## Context

기존 로그인/로그아웃/추가 버튼은 모두 텍스트("로그인"/"로그아웃"/"추가") 버튼이고,
앱 전체에 라이트 모드만 존재했다(`static/css/style.css`에 CSS 변수도, `prefers-color-scheme`/
`data-theme` 같은 다크모드 코드도 전혀 없었음 — 모든 색상이 하드코딩된 hex 값). 직전 커밋
(`db03683`)에서 삭제 버튼을 텍스트→SVG 아이콘으로 바꾼 선례가 있어, 이번에도 같은
feather-style stroke 아이콘 패턴을 로그인/로그아웃/추가 버튼에 확장 적용하고, 여기에 더해
다크모드 토글 기능을 새로 추가한다. 토글 UI는 "TodoList" 제목 앞에 SVG 아이콘 형태로 둔다.

다크모드를 켜려면 사실상 `style.css`의 색상 체계를 CSS 변수로 리팩토링해야 하므로, 이번
작업은 단순 아이콘 교체보다 범위가 크다(색상 변수 도입 + FOUC 방지 + 캐시 버전 갱신 포함).

## 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `static/js/theme.js` | **신규** — 테마 적용/저장/토글 로직 |
| `index.html` | FOUC 방지 스크립트, 헤더 구조 변경(토글 버튼+제목 그룹), 로그아웃/추가 버튼 아이콘화 |
| `static/login.html` | FOUC 방지 스크립트, 로그인 버튼 자물쇠 아이콘화 |
| `static/signup.html` | FOUC 방지 스크립트만 추가(버튼 텍스트는 "회원가입" 그대로 유지 — 범위 밖) |
| `static/css/style.css` | CSS 변수(`:root`/`html[data-theme="dark"]`) 도입, 기존 하드코딩 색상 전체 치환, 신규 버튼/토글 스타일 |
| `static/js/app.js` | 로그아웃/추가 버튼에 SVG `innerHTML` 주입, 테마 토글 버튼 이벤트 연결 |
| `sw.js` | `SHELL_ASSETS`에 `static/js/theme.js` 추가, `CACHE_VERSION` v2→v3 |
| `CLAUDE.md` | 파일 구조/주의사항 섹션에 신규 내용 반영 |

## 1. `static/css/style.css` — CSS 변수 도입

파일 최상단(`* { box-sizing: border-box; }` 앞)에 변수 블록 추가:

```css
:root {
  --color-bg: #f4f5f7;
  --color-surface: #ffffff;
  --color-surface-hover: #f3f4f6;
  --color-text: #1f2933;
  --color-text-muted: #4b5563;
  --color-subtle: #9ca3af;
  --color-border: #d1d5db;
  --color-border-light: #e5e7eb;
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-on-primary: #ffffff;
  --color-danger: #ef4444;
  --color-danger-hover: #b91c1c;
  --color-success: #15803d;
  --color-shadow: rgba(0, 0, 0, 0.08);
}

html[data-theme="dark"] {
  --color-bg: #111827;
  --color-surface: #1f2937;
  --color-surface-hover: #374151;
  --color-text: #f3f4f6;
  --color-text-muted: #d1d5db;
  --color-subtle: #9ca3af;
  --color-border: #374151;
  --color-border-light: #374151;
  --color-primary: #3b82f6;
  --color-primary-hover: #60a5fa;
  --color-on-primary: #ffffff;
  --color-danger: #f87171;
  --color-danger-hover: #fca5a5;
  --color-success: #4ade80;
  --color-shadow: rgba(0, 0, 0, 0.5);
}
```

`html[data-theme="dark"]`인 이유: FOUC 방지 스크립트가 `document.documentElement`(`<html>`)에
`dataset.theme`를 설정하므로 `body`가 아니라 `html`에 맞춘다.

**변수로 치환**: `body`(bg/text), `.app`(bg/shadow), `.greeting`, `.logout-btn`(+hover),
`#todo-input`/`#priority-select`/`.auth-form input`(border + 신규로 `background`/`color`
명시 추가 — 현재 미지정이라 브라우저 기본 흰색에 의존 중이라 다크모드에서 깨짐),
`#todo-form button`/`.auth-form button`(bg/hover/색), `.todo-item`(border),
`.drag-handle`/`.completed-at`/`.empty-message`/`.oauth-divider`(공통 `#9ca3af`→`--color-subtle`),
`.delete-btn`(+hover), `.error-message`, `.success-message`, `.auth-switch`,
`.oauth-divider::before/::after`(border).

**변수화 제외(고정 유지)**: 우선순위 배지(`.priority-select.priority-{high|medium|low}` —
의미색이라 테마 무관), `.oauth-btn-google`/`.oauth-btn-github`(브랜드 가이드 고정 색상),
`<meta name="theme-color">`/`manifest.json`의 `theme_color`/`background_color`(브라우저
크롬/스플래시 색상, 런타임 동적 변경은 이번 범위 밖).

**신규 스타일 추가**:

```css
.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title h1 {
  margin: 0;
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.theme-toggle:hover {
  background: var(--color-surface-hover);
}

.theme-toggle .icon-moon {
  display: none;
}

html[data-theme="dark"] .theme-toggle .icon-sun {
  display: none;
}

html[data-theme="dark"] .theme-toggle .icon-moon {
  display: inline-flex;
}

.icon-submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

`.logout-btn`은 텍스트가 사라지므로 `font-size: 12px` 제거하고 `padding: 6px 8px`로 조정,
나머지 색상은 변수로 치환(아이콘 버튼 형태는 기존 `.delete-btn`과 동일 컨셉).

## 2. `static/js/theme.js` (신규)

```js
const STORAGE_KEY = 'theme';

export function getPreferredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
```

## 3. FOUC 방지 인라인 스크립트 (3개 HTML 공통)

`<head>`의 `<meta name="viewport">` 다음, `<link rel="stylesheet">` 바로 앞에 추가:

```html
<script>
  (function () {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  })();
</script>
```

`theme.js`와 로직이 중복되지만 의도적이다 — `type="module"` 스크립트는 기본 defer라 첫
페인트 전 실행이 보장되지 않으므로, 동기 인라인 스크립트로 별도 둬야 깜빡임이 없다.
localStorage 키(`'theme'`)만 `theme.js`와 일치시키면 된다. `static/login.html`/
`static/signup.html`도 같은 위치(`<link rel="stylesheet" href="css/style.css">` 앞)에
동일한 스크립트를 넣는다 — 로그인/회원가입 페이지엔 토글 UI가 없어도 저장된 테마를
일관되게 반영해야 한다.

## 4. `index.html` 변경

헤더를 다음으로 교체 — 토글 버튼+제목을 `.header-title`로 묶어 기존 `space-between`
레이아웃(제목 그룹 vs 액션 그룹) 유지:

```html
<header class="app-header">
  <div class="header-title">
    <button id="theme-toggle" type="button" class="theme-toggle" aria-label="다크모드 전환" aria-pressed="false">
      <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
      <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </button>
    <h1>Todo List</h1>
  </div>
  <div class="header-actions">
    <span id="greeting" class="greeting"></span>
    <button id="logout-btn" type="button" class="logout-btn" aria-label="로그아웃"></button>
  </div>
</header>
```

`#logout-btn`의 SVG는 비워두고 `app.js`에서 `innerHTML`로 주입(기존 `delete-btn` 패턴과
동일하게 통일).

추가 버튼은 다음으로 교체:

```html
<button type="submit" class="icon-submit-btn" aria-label="추가"></button>
```

이 SVG도 `app.js`에서 주입.

`<head>`에 3번 항목의 FOUC 방지 스크립트 추가.

## 5. `static/js/app.js` 변경

상단 import에 추가: `import { toggleTheme } from './theme.js';`

DOM 참조 추가(`logoutBtn` 선언부 근처):
```js
const themeToggle = document.getElementById('theme-toggle');
const submitBtn = form.querySelector('button[type="submit"]');
```

정적 아이콘 주입:
```js
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
```
(로그아웃 = feather `unlock`, 열린 자물쇠 — "잠금 해제"의 의미로 닫힌 자물쇠인 로그인과 구분)

기존 `logoutBtn.addEventListener('click', ...)` 블록 바로 아래에 토글 핸들러 추가:
```js
themeToggle.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));

themeToggle.addEventListener('click', () => {
  const next = toggleTheme();
  themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
});
```
세션 체크(`init()`)와 무관하게 항상 등록 — 다크모드 토글은 인증 상태와 독립적인 기능이다.

## 6. `static/login.html` / `static/signup.html` 변경

`static/login.html` 로그인 버튼을 다음으로 교체:
```html
<button type="submit" class="icon-submit-btn" aria-label="로그인">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
</button>
```
(feather `lock`, 닫힌 자물쇠. 이 페이지는 `app.js`를 안 쓰고 인라인 모듈 스크립트만 쓰는
구조라 SVG를 HTML에 직접 작성 — `index.html`과 다른 페이지 관례를 따른다.)

두 파일 모두 `<head>`에 FOUC 방지 스크립트 추가. `static/signup.html`의 "회원가입" 버튼
텍스트는 그대로 유지(사용자 요청 범위 밖) — 단, 다크모드 일관성을 위해 FOUC 스크립트는
반드시 넣는다(안 넣으면 로그인 페이지는 다크인데 회원가입 페이지만 순간적으로 라이트로
깜빡이는 비일관 버그 발생).

## 7. `sw.js` 변경

`CACHE_VERSION`을 `'todoapp-shell-v2'` → `'todoapp-shell-v3'`로 올리고, `SHELL_ASSETS`
배열에 `'static/js/theme.js'`를 추가. 새 파일을 셸 자산에 추가하고 버전을 올려야 PWA로
설치된 사용자에게 변경 사항이 전달되고(cache-first라 버전 안 올리면 갱신 안 됨), 오프라인
모드에서 `theme.js` 404도 방지된다.

## 8. `CLAUDE.md` 문서 갱신

- "파일 구조" 섹션에 `static/js/theme.js` 항목 신규 추가 — localStorage 키, FOUC
  스크립트와의 관계, `app.js`와의 연결 방식 설명.
- `static/css/style.css` 설명에 CSS 변수 기반 라이트/다크 테마 분리, 우선순위 배지·OAuth
  버튼은 테마 무관 고정이라는 점 추가.
- `static/js/app.js` 설명에 로그아웃/추가 버튼 아이콘화, 다크모드 토글 연결 설명 추가.
- "주의사항" 섹션에 다음 두 항목 추가:
  - 정적 자산 변경 시 `sw.js`의 `SHELL_ASSETS`/`CACHE_VERSION` 갱신 필수.
  - FOUC 방지 인라인 스크립트는 3개 HTML 모두에 동일하게 들어가야 하며 `theme.js`와
    localStorage 키(`'theme'`)를 일치시켜야 함.

## 검증 방법

1. `python3 -m http.server 8000` (시크릿 창 또는 기존 Service Worker 등록 해제 후 테스트
   — `CACHE_VERSION` 변경으로 자동 갱신되지만 최초 확인 시 권장).
2. `static/login.html` 접속 → 로그인 버튼이 자물쇠 아이콘인지, 저장된 테마가 깜빡임 없이
   반영되는지 확인.
3. 로그인 → `index.html`에서 "Todo List" 제목 앞 sun 아이콘 확인 → 클릭 시 dark로 즉시
   전환(배경/텍스트/입력창/버튼 전체) + moon 아이콘 교체 + `localStorage.theme === 'dark'`
   확인 → 새로고침해도 깜빡임 없이 다크 유지 확인.
4. `static/signup.html` 새 탭에서 다크 유지되는지 확인(토글 UI는 없지만 저장값 반영).
5. 로그아웃 버튼(자물쇠-열림 아이콘) 클릭 시 정상 로그아웃, 추가 버튼(+) 클릭/엔터로 정상
   추가되는지 확인.
6. 다크모드에서 우선순위 배지 가독성 육안 확인.
7. `npm test`(`node --test`) 통과 확인 — `todoLogic`/`validators` 순수 함수는 변경 없음.
