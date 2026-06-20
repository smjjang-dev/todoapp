# Todo List 앱을 안드로이드에 설치 가능한 PWA로 만들기

## Context

`day02/todolist`는 Supabase 기반 멀티유저 Todo 앱으로, `static/css/style.css`가 이미
`.app { max-width: 480px }` + 넉넉한 터치 타겟(10px+ padding)으로 모바일 친화적인
레이아웃을 갖고 있고, `viewport` meta도 세 HTML 모두에 들어가 있다. 하지만 실제
안드로이드 폰의 홈 화면에 "설치"해서 네이티브 앱처럼 쓰려면(PWA, standalone 모드)
다음이 빠져 있다:

- **Web App Manifest**(`manifest.json`), **아이콘**, **theme-color** — 브라우저가
  "설치 가능"으로 인식하지 못함
- **Service Worker** — standalone 실행/오프라인 셸 캐싱 없음
- **드래그앤드롭 순서 변경이 안드로이드 터치 브라우저에서 전혀 동작하지 않음** —
  `static/js/app.js`의 현재 구현(`draggable` 속성 + `dragstart`/`dragover`/`dragend`,
  `mousedown`으로 `draggable=true` 토글)은 HTML5 네이티브 Drag-and-Drop API라
  터치 이벤트를 지원하지 않는다. 폰에서 설치해 쓸 거라면 이건 기능이 망가진
  채로 배포하는 셈이라 반드시 고쳐야 한다.
- 아직 실제 배포(HTTPS) 전이다 — PWA 설치 가능 여부는 HTTPS(또는 localhost)
  오리진을 요구하므로, `GitHubPages.md`에 이미 정리된 GitHub Pages 배포 절차를
  최종적으로 따라야 폰에서 설치 테스트가 가능하다.

사용자 결정사항(확인됨):
- 터치 드래그 수정 방식: **SortableJS를 esm.sh CDN으로 import** (이미
  `static/js/supabaseClient.js`가 `esm.sh/@supabase/supabase-js@2`를 쓰는 것과 동일한
  패턴 — npm/번들러 설치 없이 ESM CDN만 쓰는 프로젝트 원칙 유지)
- 아이콘: 기존 버튼 색상(`#2563eb`, `static/css/style.css:92`)을 활용한 간단한
  생성 아이콘을 만든다(사용자가 별도 로고를 제공하지 않음)

## 변경 사항

### 1. `manifest.json` (신규, 루트)
```json
{
  "name": "...",
  "short_name": "...",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#f4f5f7",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "static/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "static/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "static/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
`start_url`/`scope`는 절대경로(`/`)가 아니라 상대경로(`.`)로 — 배포 URL이
`https://smjjang-dev.github.io/todoapp/`처럼 서브패스이기 때문(루트 도메인이 아님).

### 2. 아이콘 (신규, `static/icons/`)
`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`(세이프존 패딩 포함)를
만든다. 환경에 ImageMagick/rsvg-convert/PIL이 없으므로, 1회성으로 `pip install
--user pillow`(런타임 의존성 아님, 아이콘 생성에만 사용) 후 작은 Python 스크립트로
accent color(`#2563eb`) 배경 + 흰색 체크리스트 글리프의 둥근 사각형 아이콘을
래스터화한다. Pillow 설치가 막혀 있으면 fallback으로 `image/svg+xml` 타입의 SVG
아이콘 하나만 manifest에 등록(최신 Android Chrome은 SVG 아이콘도 인식).

### 3. 세 HTML 진입점에 manifest/메타 연결
`index.html`(루트), `static/login.html`, `static/signup.html` 각각에 추가
(기존 CLAUDE.md의 "이 코드가 실제로 어느 페이지에서 실행되는가" 기준 비대칭
상대경로 규칙을 그대로 따른다):
- `index.html`: `<link rel="manifest" href="manifest.json">`
- `static/login.html`/`static/signup.html`: `<link rel="manifest" href="../manifest.json">`
- 공통: `<meta name="theme-color" content="#2563eb">`

### 4. Service Worker (`sw.js`, 신규, 루트)
정적 셸(HTML/CSS/JS/manifest/아이콘)만 cache-first로 캐싱하고, `supabase.co`/
`esm.sh` 요청은 캐시하지 않고 항상 네트워크로 통과시킨다(인증/데이터는 항상
최신이어야 함). 캐시 이름에 버전 문자열을 둬서 배포할 때마다 갱신되도록 하고,
`skipWaiting()`/`clients.claim()`으로 새 버전이 바로 적용되게 한다(흔한 PWA 캐시
고착 문제 방지).

등록은 각 HTML의 `<head>`/`</body>` 직전에 작은 인라인 `<script>`로
(`'serviceWorker' in navigator` 체크 후 `register(...)`), manifest와 동일하게
`index.html`은 `'sw.js'`, `static/login.html`/`static/signup.html`은 `'../sw.js'`
경로를 쓴다. 새 모듈 파일을 따로 만들 만큼 복잡하지 않으므로 인라인 스크립트로
충분.

### 5. 드래그앤드롭을 SortableJS로 교체 — `static/js/app.js`
현재 약 192~234줄 부근의 `mousedown`(draggable 토글) + `dragstart`/`dragover`/
`dragend` 핸들러와 `getDragAfterElement` 헬퍼를 제거하고, `https://esm.sh/sortablejs`
에서 `Sortable`을 import해 다음으로 교체:
```js
Sortable.create(list, {
  handle: '.drag-handle',
  animation: 150,
  onEnd: async () => {
    await persistOrder();
    await refresh();
  },
});
```
- `handle: '.drag-handle'`이 기존 "핸들로만 드래그 시작" 규칙(CLAUDE.md 주의사항)을
  네이티브로 보장하므로 `draggable=true/false` 수동 토글이 더는 필요 없다.
- `persistOrder()`(→ `todoLogic.reorderByIds()`로 `position` 일괄 update)와
  `fetchTodos()`/`render()` 재조회 패턴은 그대로 재사용 — 순서 저장 로직 자체는
  변경하지 않는다.
- 마우스 + 터치 모두 SortableJS가 통일 처리하므로 데스크톱 동작도 그대로 유지된다.

### 6. 작은 모바일 UX 보정 — `static/css/style.css`
`body`에 `overscroll-behavior-y: contain;` 한 줄 추가(리스트 상단에서 터치
드래그할 때 브라우저 pull-to-refresh와 충돌 방지). 그 외 레이아웃은 이미
480px 컨테이너 + 충분한 터치 타겟으로 모바일 대응이 되어 있어 미디어쿼리 등
추가 변경 없음(범위 밖).

### 7. OAuth — 코드 변경 없음
`static/js/auth.js`의 `signInWithOAuth`가 `new URL('../index.html',
window.location.href)`로 절대 URL을 만들어 리다이렉트하는 방식은 모바일
브라우저/standalone 컨텍스트에서도 그대로 안전하게 동작함을 확인했다(탐색 완료).
단, Supabase 대시보드 Authentication → URL Configuration → Redirect URLs에
배포된 HTTPS URL이 등록되어 있어야 한다(CLAUDE.md 배포 절차 5번/GitHubPages.md에
이미 문서화된 수동 단계 — 코드 변경 아님).

### 8. 배포 절차 갱신 — `GitHubPages.md`
2번 섹션("별도 저장소로 파일 이전")의 복사 대상 파일 목록에 `manifest.json`,
`sw.js`, `static/icons/`를 추가(현재는 `index.html`/`static/`/`package.json`만
언급됨). 실제 배포(별도 저장소로 push)는 에이전트가 직접 하지 않고 사용자가
이 문서를 따라 수동으로 진행 — PWA 설치 가능 여부는 HTTPS 오리진이 필요하므로
`python3 -m http.server`만으로는 폰에서 "홈 화면에 추가"가 안정적으로 동작하지
않는다(로컬 LAN IP는 HTTP라 신뢰할 수 없음).

### 9. `CLAUDE.md` 문서 갱신
새 파일(`manifest.json`, `sw.js`, `static/icons/`)과 SortableJS CDN 의존성을
기존 파일 구조 설명 스타일에 맞춰 한 단락씩 추가.

## 영향받는 파일
- 신규: `manifest.json`, `sw.js`, `static/icons/icon-192.png`,
  `static/icons/icon-512.png`, `static/icons/icon-512-maskable.png`
- 수정: `index.html`, `static/login.html`, `static/signup.html`,
  `static/js/app.js`, `static/css/style.css`, `GitHubPages.md`, `CLAUDE.md`
- 변경 없음: `static/js/todoLogic.js`, `static/js/validators.js`,
  `static/js/auth.js`, `static/js/supabaseClient.js`, `static/js/config.js`,
  `tests/`

## 검증 방법
1. `node --test` (또는 `npm test`) — `todoLogic`/`validators` 순수 함수는 손대지
   않으므로 그대로 통과해야 함.
2. 로컬: `python3 -m http.server 8000` → 데스크톱 Chrome DevTools → Application
   탭에서 Manifest 오류 없음, Service Worker 등록 확인, Lighthouse PWA 감사로
   "Installable" 체크.
3. 데스크톱 Chrome에서 회원가입 → 로그인 → 할 일 추가(우선순위) → 완료 토글 →
   **마우스 드래그로 순서 변경**(SortableJS 회귀 확인) → 우선순위 변경 → 삭제 →
   로그아웃까지 기존 시나리오 재검증.
4. `GitHubPages.md` 절차대로 사용자가 직접 `smjjang-dev/todoapp`에 배포 →
   `https://smjjang-dev.github.io/todoapp/`를 안드로이드 Chrome에서 열어:
   - "설치"/"앱 설치" 또는 "홈 화면에 추가" 프롬프트가 뜨는지 확인 후 설치
   - 홈 화면 아이콘으로 실행 → standalone 모드(주소창 없음) 확인
   - 같은 시나리오(가입/로그인/추가/완료/**터치로 드래그 순서 변경**/우선순위
     변경/삭제/로그아웃)를 폰에서 재검증 — 터치 드래그가 핵심 회귀 포인트
   - 소셜 로그인(Google/GitHub) 버튼이 있다면 모바일에서도 정상 리다이렉트되는지 확인

## 10. 후속 작업 — 아이콘 버튼 전환 + 다크모드 토글

위 PWA 작업 이후 추가로 진행한 디자인 개선. 상세 설계는 `design.md`에 별도로
작성했고, 여기서는 이 문서의 흐름에 맞춰 요약만 남긴다.

- 로그인 버튼(`static/login.html`)·로그아웃 버튼(`index.html`)을 텍스트에서
  feather-style 자물쇠 SVG로 교체(로그인=잠긴 자물쇠 `lock`, 로그아웃=열린 자물쇠
  `unlock`). 추가 버튼(`#todo-form button`)도 텍스트 "추가" 대신 `+` SVG로 교체.
  회원가입 버튼은 범위 밖이라 텍스트 그대로 유지.
- `static/css/style.css`에 CSS 커스텀 프로퍼티(`--color-*`)를 도입해 라이트/다크
  테마를 분리(`:root` vs `html[data-theme="dark"]`). 우선순위 배지와 OAuth 브랜드
  버튼(Google/GitHub)은 의미·브랜드 색상이라 테마 무관하게 고정.
- 신규 모듈 `static/js/theme.js`(localStorage 키 `'theme'`, `getPreferredTheme`/
  `applyTheme`/`setTheme`/`toggleTheme`)로 테마를 관리. 토글 UI는 `index.html`의
  "Todo List" 제목 앞 sun/moon SVG 버튼(`#theme-toggle`)이며, `app.js`가
  `toggleTheme()`을 연결한다.
- 세 HTML(`index.html`/`static/login.html`/`static/signup.html`) `<head>`에 FOUC
  방지용 동기 인라인 스크립트를 추가해, 페이지 로드 시 저장된 테마를 깜빡임 없이
  먼저 적용(ES 모듈은 defer라 첫 페인트 전 실행이 보장되지 않으므로 별도 처리).
- 새 파일(`static/js/theme.js`) 추가에 맞춰 `sw.js`의 `SHELL_ASSETS`에 항목을
  추가하고 `CACHE_VERSION`을 `v2`→`v3`로 올림(안 올리면 PWA로 설치된 사용자에게
  cache-first 정책 때문에 변경 사항이 전달되지 않음).
- 검증: `npm test`(22개 통과) + Playwright(Firefox)로 회원가입→자동 로그인→다크모드
  토글→새로고침 후 유지→할 일 추가까지 헤드리스 브라우저 구동, 콘솔 에러 없음과
  다크모드에서 우선순위 배지 가독성을 스크린샷으로 확인.

**영향받는 파일(이번 라운드)**: 신규 `static/js/theme.js`, `design.md`; 수정
`index.html`, `static/login.html`, `static/signup.html`, `static/css/style.css`,
`static/js/app.js`, `sw.js`, `CLAUDE.md`.
