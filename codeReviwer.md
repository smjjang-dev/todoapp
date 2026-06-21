# todoapp 코드 품질 검토 결과

검토일: 2026-06-21

검토 대상: `static/js/app.js`, `static/js/todoLogic.js`, `static/js/validators.js`,
`static/js/auth.js`, `sw.js`, `index.html`/`static/login.html`/`static/signup.html`의
CSP 관련 스크립트 태그.

## 🔴 높음

### 1. `static/js/app.js:236-240` — `persistOrder()`의 `Promise.all` 부분 실패 시 상태 불일치

드래그 정렬 후 `onEnd: async () => { await persistOrder(); await refresh(); }`(278-281행)에서,
`persistOrder()`가 여러 `update` 쿼리를 `Promise.all`로 동시 실행하다 하나라도 실패하면
즉시 reject되어 뒤따르는 `await refresh()`가 실행되지 않습니다. 하지만 SortableJS는 이미
DOM을 새 순서로 재배치해 둔 상태이므로, 화면(DOM)과 실제 서버/`allTodos` 상태가 어긋난 채로
남습니다. 일부 항목만 DB에 반영된 채 다음 렌더링까지 사용자가 잘못된 순서를 보게 됩니다.

**조치 완료.** `persistOrder()`가 더 이상 첫 실패에서 즉시 reject하지 않고, 각 update를
`.then(({ error }) => ({ id, error }))`로 감싸 `Promise.all`이 항상 전부 완료될 때까지
기다린 뒤 실패 건수를 모아 마지막에 한 번만 throw하도록 변경했습니다. 호출부
`Sortable.onEnd`도 `persistOrder()` 실패 여부와 무관하게 `finally`에서 항상
`await refresh()`를 실행하도록 재구성해, DOM이 이미 재배치된 상태와 서버 실제 상태가
어긋난 채로 멈추지 않고 항상 서버 진실로 재동기화됩니다(`refresh()` 자체가 실패하는
극단적 케이스도 별도 `catch`로 사용자에게 안내). `static/js/app.js`의 `persistOrder`/
`Sortable.create(...).onEnd` 참고.

### 2. `static/js/app.js` 전역 — 비동기 이벤트 핸들러에 에러 처리 전무

`form` submit(243-251), `list` click/change(253-273), `Sortable.onEnd`(278-281),
`logoutBtn` click(284-287), `init()`(300-311) 어디에도 `try/catch`가 없습니다. Supabase
호출(`addTodo`/`deleteTodo`/`toggleTodo`/`updatePriority`/`persistOrder`/`fetchTodos`)이
던지는 에러는 그대로 unhandled rejection이 되어, 사용자에게 아무 피드백 없이 동작이 조용히
중단됩니다(예: 네트워크 끊김 중 "추가" 버튼을 눌러도 입력값이 안 비워지고 그냥 멈춤).
`init()`에서 `requireSession()`/`loadGreeting()`/`refresh()`가 실패하면 화면이 빈 채로
멈춥니다.

**조치 완료.** 모든 비동기 핸들러(`form submit`/`list click`/`list change`/
`Sortable.onEnd`/`logoutBtn click`/`init()`)를 `try/catch`로 감쌌습니다. 사용자에게는
`index.html`에 새로 추가한 `#status-message`(`role="status" aria-live="polite"`, 기존
로그인/회원가입 페이지가 쓰던 `.error-message` 클래스 재사용 — 새 CSS 추가 없음)에
일반화된 한국어 메시지를 보여주고, Supabase의 원본 `error` 객체는
`console.error`로만 남깁니다(로그인/회원가입과 달리 계정 열거 위험은 없지만, 내부
스키마/쿼리 정보가 메시지에 섞여 들어갈 수 있어 동일한 방어 패턴을 적용했습니다).
CSP `script-src` 제약상 새 인라인 스크립트를 추가하지 않고 `app.js`(외부 모듈) 안에만
로직을 둔 점, 변경 후 항상 `fetchTodos()`+`render()`로 재조회하는 기존 관행을 에러
경로에서도 그대로 유지한 점도 확인했습니다.

## 🟡 중간

### 3. `static/js/app.js:310` — 60초 주기 `render()`가 사용자 상호작용 중에도 강제 재생성

`setInterval(() => render(), 60000)`은 모든 `<li>`를 매번 새로 만듭니다(94-184행,
`list.innerHTML = ''` 후 재생성). 사용자가 그 순간 `priority-select`를 열어두었거나
텍스트를 드래그 선택 중이면 끊김/포커스 손실이 발생할 수 있습니다.

**조치 완료.** 가상 DOM 없이 부분 패치를 구현하는 건 이번 범위를 벗어나는 더 큰
리팩터라고 판단해, 대신 `isUserInteractingWithList()`로 "목록 내부 요소에 포커스가 있는
중" 또는 "목록 내부에서 텍스트를 드래그 선택 중"인지 감지해 그 60초 틱만 건너뛰도록
했습니다. 다음 60초 주기에 다시 시도되므로 상대시간 표시가 한 번 정도 갱신을
놓칠 수 있지만, 포커스/선택이 끊기는 문제는 사라집니다. `static/js/app.js`의
`isUserInteractingWithList`/`init()` 내부 `setInterval` 참고.

### 4. `static/js/app.js:217-273` — 연속 클릭에 대한 동시성 가드 없음

체크박스 토글/삭제/우선순위 변경 버튼에 디바운스나 `disabled` 처리가 없어, `await ... ;
await refresh()` 진행 중 같은 항목을 빠르게 다시 클릭하면 중복 요청이 동시에 날아갈 수
있습니다(삭제는 0-row update라 조용히 무시되지만, toggle/priority는 경쟁 상태로 마지막
응답이 이긴 결과가 됩니다).

**조치 완료.** 항목 id 단위로 진행 중 여부를 추적하는 `pendingItemIds`/`withItemLock()`을
추가했습니다. 같은 항목에 대한 토글/삭제/우선순위 변경 요청이 이미 진행 중이면 새 클릭은
조용히 무시되고(전체 폼을 잠그면 다른 항목 조작까지 막혀버리므로 항목 단위로 좁힘),
체크박스/select는 요청이 끝날 때까지 `disabled = true`로 시각적으로도 비활성화됩니다.
디바운스 대신 잠금 방식을 택한 이유는, 사용자가 의도한 마지막 클릭이 무시되지 않고
첫 클릭이 즉시 반영되는 쪽이 todo 앱의 체감 반응성에 더 유리하다고 판단했기 때문입니다.

### 5. `static/js/todoLogic.js:16-18` — `reorderByIds(todos, orderedIds)`의 `todos` 매개변수가 완전히 미사용

```js
export function reorderByIds(todos, orderedIds) {
  return orderedIds.map((id, index) => ({ id, position: index }));
}
```

함수 본문에서 `todos`를 전혀 참조하지 않는데, 호출부(`app.js:232`)도
`reorderByIds([], visibleIncompleteIds)`로 항상 빈 배열을 넘깁니다. 이름과 시그니처가
"기존 todos를 참고해 재정렬한다"는 인상을 주지만 실제로는 `orderedIds`만으로 동작하는
죽은 매개변수입니다 — 시그니처를 `reorderByIds(orderedIds)`로 단순화하는 게 맞습니다.

**조치 완료.** 시그니처를 `reorderByIds(orderedIds)`로 단순화했습니다. 호출부
(`static/js/app.js`의 `persistOrder()`)와 `tests/todoLogic.test.js`도 함께 갱신했고,
`node --test`로 회귀 없음을 확인했습니다.

## 🟢 낮음

### 6. `static/js/todoLogic.js:28` — `sortForDisplay`가 `completed_at`이 `null`인 완료 항목에 취약

`new Date(b.completed_at) - new Date(a.completed_at)`에서 `completed_at`이 `null`이면
`new Date(null)` → `Invalid Date` → `NaN`이 되어 정렬 결과가 불안정해집니다. 현재
`withCompletionToggle`이 항상 `completed_at`을 채워주므로 정상 플로우에서는 발생하지
않지만, 데이터가 외부에서 직접 조작되거나 마이그레이션 누락이 있으면 깨질 수 있는
암묵적 불변조건입니다.

**조치 완료.** `completed_at`이 falsy면 `-Infinity`로 취급해 항상 맨 뒤로 정렬되도록
방어 코드를 추가했습니다(`new Date(...).getTime()` 비교로 변경, `NaN` 비교로 인한
정렬 불안정 제거). `tests/todoLogic.test.js`에 `completed_at`이 `null`인 케이스
테스트를 추가해 회귀를 막았습니다.

### 7. `static/js/app.js:56-63` — `loadGreeting()`의 Supabase 에러 무시

`const { data: profile } = await supabase...` 에서 `error`를 구조분해하지 않고 버립니다.
쿼리 실패 시에도 `data`가 `null`이라 `profile ? ... : ''`로 조용히 빈 인사말만 보여줄 뿐
에러를 인지할 방법이 없습니다.

**조치 완료.** `error`를 구조분해해 실패 시 `console.error`로 남기도록 했습니다.
인사말은 부가 정보이고 실패해도 앱 사용에 지장이 없으므로, 화면에 별도 에러 배너를
띄우지는 않고 빈 문자열로 조용히 폴백하는 기존 동작은 유지했습니다(디버깅 가능성만
확보).

### 8. `static/js/app.js:187-196` — `addTodo`가 매번 별도의 `fetchTodos()` 왕복 발생

`topPosition` 계산을 위해 전체 목록을 한 번 더 가져온 뒤(188행), 곧이어 폼 submit
핸들러가 `await refresh()`로 다시 전체를 가져옵니다(250행). 추가 1회당 네트워크 왕복이
2번 발생합니다. 개인용 소규모 앱 전제라 치명적이진 않지만, 직전 `allTodos`(이미 메모리에
있음)에서 최솟값을 구해도 충분합니다.

**조치 완료.** `addTodo`가 별도 `fetchTodos()` 없이 메모리상의 `allTodos`(직전
`refresh()` 결과)로 `topPosition`을 계산하도록 변경해 추가 1회당 네트워크 왕복을
1번으로 줄였습니다. CLAUDE.md의 "변경 핸들러는 로컬 상태를 직접 패치하지 말고 항상
`fetchTodos()` + `render()`로 재조회" 규칙은 그대로 지켰습니다 — 이 규칙은 "쓰기(mutation)
이후 로컬 상태를 신뢰하지 말고 서버를 다시 조회하라"는 것이고, 여기서 줄인 것은
쓰기 *이전*에 위치 계산용으로 했던 중복 읽기이기 때문에 규칙 위반이 아닙니다. 폼
submit 핸들러는 여전히 `addTodo()` 이후 `await refresh()`로 서버 상태를 재조회합니다.

## ✅ 확인된 양호한 부분

- `app.js`의 모든 변경 핸들러가 CLAUDE.md 규칙대로 로컬 상태를 직접 패치하지 않고
  일관되게 `fetchTodos()`(`refresh()` 경유) + `render()`로 재조회합니다.
- 3개 HTML(`index.html`/`static/login.html`/`static/signup.html`) 모두 CSP를 위반하는
  해시 없는 인라인 스크립트가 없습니다(FOUC 스크립트만 해시 허용, 나머지는 전부 외부
  모듈).
- `sw.js`는 `supabase.co`/`esm.sh`를 캐싱 제외하고 동일 출처 GET만 cache-first로
  처리하는 구조적 결함 없음.
- `formatRelativeTime`은 `Math.max(0, ...)`로 미래 시각(시계 오차)을 방어.
- `validators.js`의 순수 함수들은 타입 가드(`typeof === 'string'`)를 빠짐없이 포함.

## 우선 조치 권장 순서

2번(에러 처리) → 1번(persistOrder 부분 실패) → 3·4번(UX 동시성) → 5·6·7·8번(저위험 정리).

## 후속 조치 (2026-06-21, perf-security-optimizer)

1~8번 전체 검증 후 모두 타당한 진단으로 판단해 실제 코드를 수정했습니다(각 항목 본문에
"조치 완료" 단락으로 상세 기록). 동의하지 않거나 보류한 항목은 없었습니다.

- 변경 파일: `static/js/app.js`(에러 처리/동시성 가드/60초 렌더 스킵/`addTodo` 최적화/
  `persistOrder` 부분 실패 복원력), `static/js/todoLogic.js`(`reorderByIds` 시그니처
  단순화, `sortForDisplay`의 `completed_at` null 방어), `index.html`(`#status-message`
  배너 추가, 기존 `.error-message` 클래스 재사용 — 새 CSS 없음), `tests/todoLogic.test.js`
  (`reorderByIds` 호출부 갱신 + `completed_at` null 케이스 테스트 추가), `sw.js`
  (`CACHE_VERSION`을 `v7` → `v8`로 갱신, `SHELL_ASSETS` 목록 자체는 변경 없음 — 기존
  항목들의 내용만 바뀌었기 때문).
- CSP: 새 인라인 `<script>`를 추가하지 않았고, FOUC 방지 인라인 스크립트 내용도 건드리지
  않아 기존 해시(`sha256-qrm+vxc1woHc8ZhJWHNUk0eS0Z4RC1I/j4n/y6HTL9A=`)가 그대로
  유효함을 재계산으로 확인했습니다.
- esm.sh import 버전(`sortablejs@1.15.7`)은 변경하지 않았습니다.
- 사용자에게 노출하는 에러 메시지는 모두 일반화된 한국어 문구이며, Supabase 원본
  `error.message`는 `console.error`로만 남깁니다(로그인/회원가입의 계정 열거 방지
  패턴을 todo CRUD 에러에도 동일하게 적용).
- `node --test` 결과: 40 pass / 0 fail (기존 39개 + `sortForDisplay` null 방어 테스트
  1개 추가).
- 커밋은 수행하지 않았습니다(사용자가 직접 검토 후 커밋).
