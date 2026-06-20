# OAuth(Google/GitHub) 설정 — 직접 해야 할 작업

**완료됨** — 아래 체크리스트 전부 적용, 로컬·배포 사이트(`https://smjjang-dev.github.io/todoapp/`)
양쪽에서 Google/GitHub 로그인 끝까지 검증 완료.

코드(버튼 UI, `signInWithOAuth`의 `redirectTo`)는 이미 구현 완료. 아래는 Supabase/Google/GitHub
콘솔에서 직접 진행해야 하는 작업이다(에이전트가 대신 할 수 없음).

## 1. Supabase SQL 에디터에서 트리거 갱신 (user_name 대응)

GitHub OAuth로 가입한 사용자가 GitHub 프로필에 "Name"을 설정하지 않은 경우
`full_name`/`name`이 비어있고 `user_name`(GitHub 아이디)만 채워지므로, 아래 SQL을
Supabase SQL 에디터에서 실행해 트리거를 갱신한다.

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

- [x] 위 SQL 실행 완료

## 2. Google OAuth 앱 등록

- [x] Google Cloud Console → OAuth 2.0 Client ID(웹 애플리케이션) 생성
- [x] Authorized redirect URI 등록: `https://mkwodsholwmsgazddrqp.supabase.co/auth/v1/callback`
- [x] 발급된 Client ID/Secret → Supabase 대시보드 Authentication → Providers → Google에 입력 후 활성화
  (Client ID를 중복 입력했던 실수가 있었으나 재입력 후 해결)

## 3. GitHub OAuth 앱 등록

- [x] GitHub Settings → Developer settings → OAuth Apps → New OAuth App
- [x] Authorization callback URL 등록: `https://mkwodsholwmsgazddrqp.supabase.co/auth/v1/callback`
- [x] 발급된 Client ID/Secret → Supabase 대시보드 Authentication → Providers → GitHub에 입력 후 활성화

## 4. Redirect URLs 등록

Supabase 대시보드 Authentication → URL Configuration → Redirect URLs에 추가:

- [x] `http://localhost:8000/index.html` (로컬 테스트용)
- [x] `https://smjjang-dev.github.io/todoapp/index.html` (배포 사이트용)

## 5. 최종 검증

- [x] 로컬(`http://localhost:8000/static/login.html`)에서 "Google로 계속하기" → 동의 화면 → `index.html` 복귀 → 닉네임 정상 표시
- [x] 로컬에서 "GitHub로 계속하기" 동일 시나리오 (닉네임이 `user_name` 기반으로 정상 채워지는지 특히 확인)
- [x] 배포 사이트(`https://smjjang-dev.github.io/todoapp/`)에서 위 두 시나리오 재확인

## 트러블슈팅

- `redirect_uri_mismatch` 에러: Google Cloud Console/GitHub OAuth App에 등록한 콜백 URL이
  `https://mkwodsholwmsgazddrqp.supabase.co/auth/v1/callback`과 정확히 일치하는지 확인
- 로그인 후 `index.html`로 안 돌아오거나 빈 화면: Supabase Redirect URLs에 위 4번 URL이
  등록되어 있는지 확인
- 닉네임이 이메일 앞부분으로만 표시됨(GitHub): 1번 SQL 트리거 갱신을 실행했는지 확인
