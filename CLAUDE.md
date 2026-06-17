# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Supabase(Postgres + Auth) 기반 멀티유저 Todo List 앱. 이메일/비밀번호로 회원가입·로그인하면
사용자별로 자신의 할 일만 보이며(RLS로 격리), 항목마다 중요도(상/중/하)와 완료 시점을 기록한다.
빌드 도구와 npm 의존성 설치는 여전히 없지만(`<script type="module">` + ESM CDN import만 사용),
ES 모듈과 Supabase 네트워크 호출이 필요하므로 더 이상 `file://`로 직접 열어서는 동작하지 않고
HTTP(S) 서버로 서빙해야 한다.

## 실행 방법

```bash
# 정적 서버로 띄운다 (file://로는 ES 모듈/네트워크 호출이 막혀 동작하지 않는다)
python3 -m http.server 8000
# 이후 http://localhost:8000 접속 → 로그인 안 된 상태면 login.html로 리다이렉트
```

`js/config.js`에 본인 Supabase 프로젝트의 Project URL과 publishable(anon) key가 채워져
있어야 한다.

## 파일 구조

- `index.html` — 메인 Todo 화면. 비로그인 상태면 `js/auth.js`의 `requireSession()`이
  `login.html`로 리다이렉트한다.
- `login.html` / `signup.html` — 이메일/비밀번호(+회원가입 시 닉네임) 폼. 이미 로그인된
  상태면 `redirectIfAuthed()`가 `index.html`로 보낸다.
- `css/style.css` — 전체 스타일. 완료 항목은 `.completed`로 취소선 처리, 중요도는
  `.priority-badge.priority-{high|medium|low}`로 배지 색상 구분.
- `js/config.js` — Supabase Project URL + publishable(anon) key. anon key는 RLS로
  보호되는 공개 가능한 값이라 커밋해도 안전하다.
- `js/supabaseClient.js` — `https://esm.sh/@supabase/supabase-js@2`에서 `createClient`를
  ESM CDN import해 공유 `supabase` client를 생성·export.
- `js/todoLogic.js` — 순수 함수(Supabase/DOM 비의존, 단위테스트 대상):
  `PRIORITY_LABELS`, `isValidPriority`, `priorityLabel`, `nextPosition`,
  `reorderByIds`, `withCompletionToggle`.
- `js/validators.js` — 순수 함수(단위테스트 대상): `isValidEmail`, `isValidPassword`,
  `isValidNickname`.
- `js/auth.js` — `signUp`/`signIn`/`signOut`/`getSession`/`requireSession`/
  `redirectIfAuthed`/`signInWithOAuth`. `signInWithOAuth(provider)`는 `redirectTo`를
  `index.html`로 고정해 호출하며, `login.html`/`signup.html`의 "Google로 계속하기"/
  "GitHub로 계속하기" 버튼이 각각 `'google'`/`'github'`로 호출한다(실제 로그인은
  Supabase 대시보드에서 해당 Provider를 활성화해야 동작).
- `js/app.js` — Supabase 쿼리(`todo_todos`/`todo_profiles`)와 DOM 렌더링 오케스트레이션.
  `loadTodos`/`saveTodos`(localStorage)는 더 이상 없고 `fetchTodos`/`addTodo`/`toggleTodo`/
  `updatePriority`/`deleteTodo`/`persistOrder`가 그 자리를 대신한다. 모든 변경 핸들러는
  `async`이며, 변경 후 항상 `fetchTodos()` + `render()`로 서버 상태를 다시 그린다(로컬
  상태를 직접 패치하지 않음).
  - 순서 변경은 기존과 동일하게 HTML5 Drag and Drop API로 구현하되, 드롭 후
    `persistOrder()`가 `todoLogic.reorderByIds()` 결과로 `todo_todos.position`을 일괄
    update한다. `.todo-item`은 기본 `draggable=false`이며 `.drag-handle`을 `mousedown`했을
    때만 `true`로 바뀐다(이 패턴은 변경 금지 — 아래 주의사항 참고).
  - 중요도는 각 항목의 `.priority-select`(`<select>`)로 즉시 변경 가능하다. `change`
    이벤트로 `updatePriority(id, priority)`가 `todo_todos.priority`를 update한 뒤
    `refresh()`로 다시 그린다(생성 시 폼의 우선순위 select와 별개로, 기존 항목도 언제든
    재분류 가능).
- `tests/todoLogic.test.js`, `tests/validators.test.js` — Node 내장 테스트 러너
  (`node --test`)로 `todoLogic.js`/`validators.js`만 검증. `app.js`/`auth.js`는 Supabase·DOM
  의존이라 단위테스트 대상에서 제외하고 브라우저 수동 검증으로 커버한다.
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
2. `js/config.js`에 Project URL/publishable key 채워넣고 로컬(`python3 -m http.server`)에서
   회원가입 → 로그인 → 할 일 추가(우선순위 포함) → 완료 토글 → 순서 변경 → 로그아웃까지
   수동 검증
3. `smjjang-dev/todoapp` 저장소를 새로 클론, 이 폴더의 파일들을 복사해 커밋/푸시
4. 그 저장소 Settings → Pages에서 `main` 브랜치 루트로 배포 활성화 후 배포 URL에서 동일
   시나리오 재검증
5. Google/GitHub 소셜 로그인은 코드상 구현 완료(`login.html`/`signup.html`의 버튼,
   `js/auth.js`의 `redirectTo`). 실제 동작하려면 Supabase 대시보드 Authentication →
   Providers에서 Google/GitHub를 각각 활성화하고(Google Cloud Console/GitHub OAuth
   App에서 발급한 Client ID/Secret 입력), Authentication → URL Configuration →
   Redirect URLs에 `.../index.html` 형태로 로컬·배포 URL을 등록해야 한다. 위 SQL의
   `user_name` 대응 트리거도 함께 적용할 것. Kakao는 추후 동일 패턴(Provider 활성화 +
   버튼 추가)으로 확장 가능.

## 주의사항

- 모듈(`import`/`export`)은 ESM CDN(`esm.sh`)으로만 사용하고, npm/번들러 설정을 추가하지
  말 것 — 이 프로젝트는 의도적으로 도구 없는 정적 구성을 유지한다.
- `.todo-item`을 항상 `draggable=true`로 바꾸지 말 것 — 핸들 기반 `mousedown`/`mouseup`
  토글 패턴을 깨면 체크박스 클릭이나 텍스트 선택이 실수로 드래그를 유발한다.
- `app.js`의 변경 핸들러에서 로컬 상태를 직접 패치하지 말 것 — 항상 `fetchTodos()`로
  서버 값을 다시 가져와 `render()`한다(네트워크 실패/동시성으로 인한 상태 불일치 방지).
- `js/config.js`의 publishable(anon) key는 RLS로 보호되므로 커밋해도 안전하지만,
  서비스 role key는 절대 클라이언트 코드에 넣지 말 것.
- `signInWithOAuth`의 `redirectTo`는 `index.html`로 고정되어 있다 — 다른 페이지로
  바꾸지 말 것(`requireSession()`이 그 페이지에서 정상 동작해야 OAuth 콜백 후
  로그인 상태가 올바르게 인식된다).
