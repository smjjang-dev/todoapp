# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Supabase(Postgres + Auth) 기반 멀티유저 Todo List 앱. 이메일/비밀번호로 회원가입·로그인하면
사용자별로 자신의 할 일만 보이며(RLS로 격리), 항목마다 중요도(상/중/하)와 완료 시점을 기록한다.
빌드 도구와 npm 의존성 설치는 여전히 없지만(`<script type="module">` + ESM CDN import만 사용),
ES 모듈과 Supabase 네트워크 호출이 필요하므로 더 이상 `file://`로 직접 열어서는 동작하지 않고
HTTP(S) 서버로 서빙해야 한다. 안드로이드 등에서 홈 화면에 설치해 standalone 앱처럼 쓸 수 있는
PWA(Web App Manifest + Service Worker)이기도 하다.

## 실행 방법

```bash
# 정적 서버로 띄운다 (file://로는 ES 모듈/네트워크 호출이 막혀 동작하지 않는다)
python3 -m http.server 8000
# 이후 http://localhost:8000 접속 → 로그인 안 된 상태면 static/login.html로 리다이렉트
```

`static/js/config.js`에 본인 Supabase 프로젝트의 Project URL과 publishable(anon) key가
채워져 있어야 한다.

## 파일 구조

`index.html`/`manifest.json`/`sw.js`만 저장소 루트에 두고, 서빙 대상 정적 자산
(`login.html`/`signup.html`/`css/`/`js/`/`icons/`)은 모두 `static/` 아래에 모아둔다
(루트는 PWA 진입점 + 문서/설정 파일만 남도록).

- `index.html` — 메인 Todo 화면(루트). `static/css/style.css`/`static/js/app.js`를
  참조하고, `manifest.json`(`rel="manifest"`)과 `sw.js` 등록 인라인 스크립트를
  포함한다. 비로그인 상태면 `static/js/auth.js`의 `requireSession()`이
  `static/login.html`로 리다이렉트한다.
- `static/login.html` / `static/signup.html` — 이메일/비밀번호(+회원가입 시 닉네임) 폼.
  이미 로그인된 상태면 `redirectIfAuthed()`가 (한 단계 위인) 루트의 `index.html`로
  보낸다. `index.html`과 마찬가지로 (상대경로만 다른) manifest link/Service Worker
  등록 스크립트를 포함한다.
- `manifest.json` — Web App Manifest. `start_url`/`scope`를 절대경로(`/`)가 아니라
  상대경로(`.`)로 둔다 — 배포 URL이 루트 도메인이 아니라
  `https://smjjang-dev.github.io/todoapp/`처럼 서브패스이기 때문. 아이콘은
  `static/icons/`를 참조한다.
- `sw.js` — Service Worker(루트). 정적 셸(HTML/CSS/JS/manifest/아이콘)만 cache-first로
  캐싱하고, `supabase.co`/`esm.sh` 요청은 캐싱하지 않고 항상 네트워크로 통과시킨다
  (인증/데이터는 항상 최신이어야 함). 캐시 이름(`CACHE_VERSION`)에 버전 문자열을 두고
  배포 때마다 올려서 갱신하며, `skipWaiting()`/`clients.claim()`으로 새 버전이 바로
  적용되게 한다.
- `static/icons/` — PWA 아이콘(`icon-192.png`/`icon-512.png`/`icon-512-maskable.png`,
  accent color `#2563eb` 배경 + 흰색 체크리스트 글리프). `generate_icons.py`는 Pillow로
  이 아이콘들을 1회성으로 래스터화한 스크립트로, 런타임 의존성이 아니다(재생성이
  필요할 때만 참고).
- `static/css/style.css` — 전체 스타일. CSS 커스텀 프로퍼티(`--color-*`)로 라이트/다크
  테마를 분리한다 — `:root`가 라이트 기본값, `html[data-theme="dark"]`가 다크 오버라이드.
  우선순위 배지(`.priority-select.priority-{high|medium|low}`)와 OAuth 브랜드 버튼
  (`.oauth-btn-google`/`.oauth-btn-github`)은 테마 무관하게 고정 색상을 유지한다(전자는
  의미 색상이라 테마와 무관해야 인식이 일관되고, 후자는 Google/GitHub 브랜드 가이드가
  고정 배색을 요구). 완료 항목은 `.completed`로 취소선 처리, 중요도는
  `.priority-badge.priority-{high|medium|low}`로 배지 색상 구분.
- `static/js/theme.js` — 라이트/다크 테마 적용·저장·토글 로직(localStorage 키 `'theme'`):
  `getPreferredTheme`/`applyTheme`/`setTheme`/`toggleTheme`. `document.documentElement`의
  `data-theme` 속성(`'light'`/`'dark'`)을 `static/css/style.css`의
  `html[data-theme="dark"]` CSS 변수 오버라이드와 연결한다. `index.html`/
  `static/login.html`/`static/signup.html` `<head>`의 동기 인라인 스크립트(FOUC 방지용,
  `theme.js`와 별개로 로직이 중복 구현됨 — ES 모듈은 기본 defer라 첫 페인트 전 실행을
  보장 못하므로)가 페이지 로드 직후 저장된 테마를 먼저 적용하고, 토글 UI
  (`index.html`의 `#theme-toggle`, "Todo List" 제목 앞 sun/moon 아이콘)는 `app.js`가
  `theme.js`의 `toggleTheme()`을 import해 연결한다.
- `static/js/config.js` — Supabase Project URL + publishable(anon) key. anon key는 RLS로
  보호되는 공개 가능한 값이라 커밋해도 안전하다.
- `static/js/supabaseClient.js` — `https://esm.sh/@supabase/supabase-js@2`에서
  `createClient`를 ESM CDN import해 공유 `supabase` client를 생성·export.
- `static/js/todoLogic.js` — 순수 함수(Supabase/DOM 비의존, 단위테스트 대상):
  `PRIORITY_LABELS`, `isValidPriority`, `priorityLabel`, `nextPosition`,
  `reorderByIds`, `withCompletionToggle`.
- `static/js/validators.js` — 순수 함수(단위테스트 대상): `isValidEmail`, `isValidPassword`,
  `isValidNickname`.
- `static/js/auth.js` — `signUp`/`signIn`/`signOut`/`getSession`/`requireSession`/
  `redirectIfAuthed`/`signInWithOAuth`. `signInWithOAuth(provider)`는 `redirectTo`를
  루트의 `index.html`로 고정해 호출하며, `static/login.html`/`static/signup.html`의
  "Google로 계속하기"/"GitHub로 계속하기" 버튼이 각각 `'google'`/`'github'`로
  호출한다(실제 로그인은 Supabase 대시보드에서 해당 Provider를 활성화해야 동작).
- `static/js/app.js` — Supabase 쿼리(`todo_todos`/`todo_profiles`)와 DOM 렌더링 오케스트레이션.
  `loadTodos`/`saveTodos`(localStorage)는 더 이상 없고 `fetchTodos`/`addTodo`/`toggleTodo`/
  `updatePriority`/`deleteTodo`/`persistOrder`가 그 자리를 대신한다. 모든 변경 핸들러는
  `async`이며, 변경 후 항상 `fetchTodos()` + `render()`로 서버 상태를 다시 그린다(로컬
  상태를 직접 패치하지 않음).
  - 순서 변경은 `https://esm.sh/sortablejs`에서 ESM CDN import한 `Sortable`로 구현한다
    (`Sortable.create(list, { handle: '.drag-handle', animation: 150, onEnd: ... })`).
    네이티브 HTML5 Drag and Drop API(`draggable` 토글 + `dragstart`/`dragover`/`dragend`)는
    안드로이드 터치 브라우저에서 동작하지 않아 SortableJS로 교체했다 — `handle`
    옵션이 "핸들로만 드래그 시작" 규칙을 마우스/터치 모두에서 보장하므로
    `draggable=true/false` 수동 토글은 더 이상 없다. `onEnd`에서 `persistOrder()`가
    `todoLogic.reorderByIds()` 결과로 `todo_todos.position`을 일괄 update한다.
  - 중요도는 각 항목의 `.priority-select`(`<select>`)로 즉시 변경 가능하다. `change`
    이벤트로 `updatePriority(id, priority)`가 `todo_todos.priority`를 update한 뒤
    `refresh()`로 다시 그린다(생성 시 폼의 우선순위 select와 별개로, 기존 항목도 언제든
    재분류 가능).
  - 로그아웃 버튼(`#logout-btn`)과 추가 버튼(`#todo-form button`)은 텍스트 대신
    `delete-btn`과 동일한 패턴(`innerHTML`로 feather-style SVG 주입)으로 채워지는
    아이콘 버튼이다. 다크모드 토글(`#theme-toggle`)은 `static/js/theme.js`의
    `toggleTheme()`을 호출하고 결과에 맞춰 `aria-pressed`를 동기화한다.
- `tests/todoLogic.test.js`, `tests/validators.test.js` — 루트의 `tests/`에 그대로 둔다
  (이동 안 함). Node 내장 테스트 러너(`node --test`)로 `../static/js/todoLogic.js`/
  `../static/js/validators.js`만 검증. `app.js`/`auth.js`는 Supabase·DOM 의존이라
  단위테스트 대상에서 제외하고 브라우저 수동 검증으로 커버한다.
- `package.json` — `{ "scripts": { "test": "node --test" } }`만 있는 최소 구성. 번들러나
  설치가 필요한 의존성은 없다.

## 테스트

```bash
npm test
# 또는
node --test
```

## Supabase 스키마

테이블은 모두 `todo_` 접두어를 쓴다(같은 프로젝트를 다른 용도로 재사용할 가능성 대비).

```sql
create table todo_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now()
);
alter table todo_profiles enable row level security;
create policy "select own profile" on todo_profiles for select using (auth.uid() = id);
create policy "update own profile" on todo_profiles for update using (auth.uid() = id);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.todo_profiles (id, nickname)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

GitHub OAuth로 가입한 사용자가 GitHub 프로필에 "Name"을 설정하지 않은 경우
`full_name`/`name`이 비어있고 `user_name`(GitHub 아이디)만 채워지므로, `coalesce`에
`user_name`을 추가해야 닉네임이 이메일 앞부분으로 떨어지지 않는다(Supabase SQL
에디터에서 `create or replace function`으로 갱신):

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.todo_profiles (id, nickname)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'nickname',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'user_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$ language plpgsql security definer;
```

```sql
create table todo_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  text text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table todo_todos enable row level security;
create policy "owner full access" on todo_todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Supabase 대시보드 Authentication → Providers → Email에서 "Confirm email"을 꺼두면
메일 발송 설정 없이 바로 가입·로그인할 수 있다(연습 환경 기준 권장).

## 배포 절차

1. Supabase 프로젝트 생성 → 위 SQL 실행 → "Confirm email" 끄기
2. `static/js/config.js`에 Project URL/publishable key 채워넣고 로컬
   (`python3 -m http.server`, 루트에서 실행)에서 회원가입 → 로그인 → 할 일 추가
   (우선순위 포함) → 완료 토글 → 순서 변경 → 로그아웃까지 수동 검증
3. `smjjang-dev/todoapp` 저장소를 새로 클론, 이 폴더의 파일들을 복사해 커밋/푸시
   (`index.html`/`manifest.json`/`sw.js`/`package.json`은 저장소 루트로, `static/`
   (아이콘 포함)은 통째로 그대로 복사 — GitHubPages.md 참고)
4. 그 저장소 Settings → Pages에서 `main` 브랜치 루트로 배포 활성화 후 배포 URL에서 동일
   시나리오 재검증(`index.html`이 루트에 있으므로 배포 URL은 그대로
   `https://smjjang-dev.github.io/todoapp/`)
5. Google/GitHub 소셜 로그인은 코드상 구현 완료(`static/login.html`/`static/signup.html`의
   버튼, `static/js/auth.js`의 `redirectTo`). 실제 동작하려면 Supabase 대시보드 Authentication →
   Providers에서 Google/GitHub를 각각 활성화하고(Google Cloud Console/GitHub OAuth
   App에서 발급한 Client ID/Secret 입력), Authentication → URL Configuration →
   Redirect URLs에 `.../index.html` 형태로 로컬·배포 URL을 등록해야 한다. 위 SQL의
   `user_name` 대응 트리거도 함께 적용할 것. Kakao는 추후 동일 패턴(Provider 활성화 +
   버튼 추가)으로 확장 가능.

## Android APK 패키징 (TWA)

웹 코드를 전혀 바꾸지 않고, 배포된 PWA(`https://smjjang-dev.github.io/todoapp/`)를 그대로
띄우는 TWA(Trusted Web Activity) 방식으로 `todoApp.apk`를 빌드해 저장소 루트에 포함해
두었다. 패키징 도구는 Google 공식 [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
CLI(`@bubblewrap/cli`).

- `todoApp.apk` — 서명된 설치형 APK. 패키지명 `io.github.smjjang_dev.twa`(호스트
  `smjjang-dev.github.io`에서 Bubblewrap이 자동 생성), 사이드로드(직접 설치) 전용이다.
- `todoApp.keystore` / `todoApp.keystore-password.txt` — APK 서명에 쓴 키스토어와
  평문 비밀번호. **`.gitignore`로 git에서 제외**되어 있다(서명 키 유출 방지). 같은
  패키지명으로 업데이트 버전을 다시 서명하려면 이 키스토어가 반드시 필요하므로
  로컬에서 안전하게 백업해 둘 것 — 분실하면 같은 `applicationId`로는 더 이상
  업데이트 서명이 불가능하다.

### 빌드 전 알아둘 점

- 라이브 사이트가 `manifest.json`/`sw.js`를 서빙하지 않으면(PWA 코드 재배포 전 상태)
  Bubblewrap이 PWA로 인식하지 못한다. APK를 다시 빌드하기 전에 항상 먼저
  `curl -sI https://smjjang-dev.github.io/todoapp/manifest.json`로 200을 확인할 것
  (배포 절차의 3~4단계가 선행되어야 함).
- **Bubblewrap CLI의 대화형 JDK 자동설치 기능에 실제 버그가 있다**: `bubblewrap init`/
  `--version` 최초 실행 시 JDK 17 소스 zip(~190MB, OpenJDK 소스 트리)을 다운로드해
  압축 해제하는 단계에서, 내부적으로 쓰는 `extract-zip` 라이브러리가 대용량/다수
  엔트리 zip을 처리하다가 에러 없이 프로세스를 조용히 종료시켜 버린다(일부만
  풀린 채 exit code 0으로 끝남). `yes |` 같은 stdin 자동응답으로도 해결되지 않는다.
  → 이 환경에서는 JDK 바이너리(Temurin 17, `tar.gz`)와 Android
  `commandlinetools-linux` zip을 **직접 `curl`로 받아 시스템 `tar`/Python
  `zipfile`로 압축 해제**하고, `~/.bubblewrap/config.json`에 `jdkPath`/
  `androidSdkPath`를 직접 써 넣어 자동설치 단계 자체를 우회했다(JDK/Android SDK는
  `~/.bubblewrap/` 아래, 저장소 밖에 머신별로 설치됨 — 새 머신에서는 다시 받아야 함).
- TWA 프로젝트 생성·키스토어 생성도 대화형 prompt(`bubblewrap init`)를 거치지 않고,
  `@bubblewrap/core`가 제공하는 `TwaManifest.fromWebManifest()` /
  `TwaGenerator.createTwaProject()` / `KeyTool.createSigningKey()`를 Node 스크립트로
  직접 호출해 비대화식으로 생성했다.
- 마지막 `gradlew assembleRelease` → `zipalign` 검증 → `apksigner sign`은
  `bubblewrap build`가 하는 것과 동일한 단계를 그대로 따라했다(빌드 자체는 표준
  Android Gradle 빌드라 별다른 우회가 필요 없었다).

### 알려진 한계

- 자체 서명 키라 Play 스토어 업로드는 불가능하고, "출처를 알 수 없는 앱 설치"를
  허용해 사이드로드해야 한다.
- Digital Asset Links(`assetlinks.json`)를 설정하지 않아 앱 실행 시 상단에 주소창이
  보인다(완전 standalone TWA가 아님). 설정하려면 `smjjang-dev.github.io` 계정 루트
  Pages 저장소(`todoapp` 저장소가 아님)에 `.well-known/assetlinks.json`을 올려야
  한다 — 이번 작업 범위 밖.
- 실제 Android 기기 설치 테스트는 하지 않았다(개발 환경에 기기 없음) — 배포 전
  실기기 또는 에뮬레이터에서 설치·실행 확인 필요.

## 주의사항

- 모듈(`import`/`export`)은 ESM CDN(`esm.sh`)으로만 사용하고, npm/번들러 설정을 추가하지
  말 것 — 이 프로젝트는 의도적으로 도구 없는 정적 구성을 유지한다.
- 순서 변경에 네이티브 HTML5 Drag and Drop API(`draggable`/`dragstart`/`dragover`)로
  되돌리지 말 것 — 안드로이드 터치 브라우저에서 전혀 동작하지 않아 SortableJS로
  교체했다(`static/js/app.js`의 `Sortable.create(list, { handle: '.drag-handle', ... })`).
  `handle: '.drag-handle'` 옵션을 제거하면 체크박스 클릭이나 텍스트 선택이 실수로
  드래그를 유발한다.
- `app.js`의 변경 핸들러에서 로컬 상태를 직접 패치하지 말 것 — 항상 `fetchTodos()`로
  서버 값을 다시 가져와 `render()`한다(네트워크 실패/동시성으로 인한 상태 불일치 방지).
- `static/js/config.js`의 publishable(anon) key는 RLS로 보호되므로 커밋해도 안전하지만,
  서비스 role key는 절대 클라이언트 코드에 넣지 말 것.
- `signInWithOAuth`의 `redirectTo`는 루트의 `index.html`로 고정되어 있다 — 다른 페이지로
  바꾸지 말 것(`requireSession()`이 그 페이지에서 정상 동작해야 OAuth 콜백 후
  로그인 상태가 올바르게 인식된다).
- `index.html`만 루트에 있고 `static/js/auth.js`·`static/js/app.js`는 루트(`index.html`)와
  `static/`(`login.html`/`signup.html`) 양쪽에서 로드되므로, 그 안의
  `window.location.href`/`redirectTo` 상대경로 리터럴이 호출 위치별로 다르다
  (`requireSession()`/로그아웃은 `'static/login.html'`, `redirectIfAuthed()`/
  `signInWithOAuth()`는 `'../index.html'`). 파일을 추가로 옮길 때 이 비대칭을 깨지
  말 것 — 항상 "이 코드가 실제로 어느 페이지에서 실행되는가" 기준으로 상대경로를
  계산해야 한다.
- 정적 자산(`static/css/style.css`, `static/js/*.js`, `index.html` 등)을 추가/변경할 때는
  `sw.js`의 `SHELL_ASSETS`에도 반영하고 `CACHE_VERSION` 문자열을 올릴 것 — 안 올리면
  PWA로 설치된 기존 사용자에게 cache-first 정책 때문에 변경 사항이 전달되지 않는다.
- 다크모드 적용 시 `<head>`의 FOUC 방지 인라인 스크립트(비-module, 동기)는
  `localStorage`의 `'theme'` 키를 `static/js/theme.js`와 동일하게 참조해야 한다 —
  3개 HTML(`index.html`/`static/login.html`/`static/signup.html`) 모두에 들어가야
  로그인/회원가입 페이지 진입 시에도 깜빡임 없이 저장된 테마가 유지된다.
- `manifest.json`의 `theme_color`/`background_color`와 각 HTML의
  `<meta name="theme-color">`는 다크모드와 무관하게 정적으로 고정되어 있다(브라우저
  크롬/스플래시 색상이라 런타임 동적 변경이 PWA 표준상 제한적) — 이번 다크모드
  작업 범위에 포함하지 않았다.
