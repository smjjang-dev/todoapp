# CVE/CWE 관점 보안 검토 보고서

Supabase 기반 멀티유저 Todo PWA(`day03/todoapp`)를 CVE(Common Vulnerabilities and
Exposures) 관점에서 검토한 결과다. 1~4번 항목은 검토 직후 실제로 수정을 적용했고
(아래 각 항목에 **수정 완료** 표시), 5~6번은 검토 결과 실제 위험이 낮아 코드 변경 없이
기록만 남긴 항목이다.

## 검토 방법

- 클라이언트 JS(인증/XSS 관련)와 정적자산·의존성·RLS(공급망/CSP/Supabase 정책 관련)를
  나눠서 1차 후보를 도출
- 1차 후보 중 실제 코드를 직접 읽어 재검증해 false positive를 제거
  - `theme.js` FOUC 방지 인라인 스크립트는 이미 화이트리스트 검증
    (`stored === 'light' || stored === 'dark'`)이 있어 XSS 후보에서 제외
  - `sw.js`의 캐시 포이즈닝 후보는 `supabase.co`/`esm.sh` 요청이 캐싱 로직에 들어가기 전에
    `return`되어(`respondWith` 미호출) 애초에 캐싱되지 않으므로 과장된 평가로 판단해 제외

## 1. [중-높음] CDN 공급망 의존성 — 버전 미고정 + SRI 부재 (CWE-829, CWE-1104) — **수정 완료**

```js
// static/js/app.js:1 (수정 전)
import Sortable from 'https://esm.sh/sortablejs';

// static/js/supabaseClient.js:1 (수정 전)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
```

- `sortablejs`는 **버전 지정이 전혀 없어** 항상 latest를 가져온다.
- `supabase-js`는 메이저(`@2`)만 고정되어 마이너/패치는 자동 추적된다.
- Subresource Integrity(SRI) 해시가 없고, `esm.sh`는 제3자 CDN(공식 npm 레지스트리/jsDelivr
  미러가 아님)이다.
- **실제 위험**: esm.sh 자체가 침해되거나 MITM, 또는 `sortablejs` upstream이 침해될 경우
  모든 사용자에게 악성 JS가 자동으로 배포된다. 버전 고정조차 없는 `sortablejs`가 가장 약한
  지점이다.

**수정 내용**: 두 import 모두 정확한 패치 버전까지 고정했다(`sortablejs@1.15.7`,
`@supabase/supabase-js@2.108.2`). 완전한 SRI는 `<script type="module">`의 동적 `import`
구문에는 브라우저가 지원하지 않아(정적 `<script integrity="...">`만 지원) 적용하지
못했고, 그 대신 버전 고정으로 "받아오는 코드가 항상 동일하다"는 보장을 확보했다.

## 2. [중] 로그인/회원가입 에러 메시지 그대로 노출 (CWE-209, 계정 열거 가능성) — **수정 완료**

```js
// static/login.html (수정 전, signup.html도 동일 패턴)
const { error } = await signIn({ email, password });
if (error) {
  errorMessage.textContent = error.message;
  return;
}
```

- Supabase가 반환하는 원본 에러 메시지를 그대로 사용자에게 표시한다.
- "Invalid login credentials"와 이메일 중복/미확인 등 메시지 차이를 이용해 특정 이메일의
  가입 여부를 추측(계정 열거, account enumeration)할 수 있다.

**수정 내용**: 로그인/회원가입/OAuth 각각의 Supabase 응답 에러를 일반화된 한국어
메시지(예: "이메일 또는 비밀번호가 올바르지 않습니다.")로 치환했다(`static/js/loginPage.js`/
`static/js/signupPage.js`). 단, `auth.js`의 `signUp`이 클라이언트 검증으로 던지는 에러
(이메일 형식/비밀번호 정책/닉네임 누락)는 서버 응답이 아니므로 그대로 노출해도 안전해
바꾸지 않았다.

## 3. [중] 약한 비밀번호 정책 (CWE-521) — **수정 완료**

```js
// static/js/validators.js:7-8 (수정 전)
export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}
```

- 최소 6자만 검증하고 복잡도(대문자/숫자/특수문자) 요구가 없다.
- 클라이언트 검증이라 우회 가능하며, 서버(Supabase 기본 정책)도 길이 6자 정도로 약하다.

**수정 내용**: 8자 이상 + 영문/숫자 혼합을 요구하도록 강화했고(`isValidPassword`),
`tests/validators.test.js`에 케이스를 추가했다. `static/signup.html`의 placeholder/안내
문구와 `README.md`도 새 정책에 맞춰 갱신했다.

## 4. [낮-중] CSP(Content-Security-Policy) 부재 — **수정 완료**

- `index.html`/`static/login.html`/`static/signup.html` 어디에도 CSP meta 태그가 없다.
- 현재 실제로 악용 가능한 XSS 주입 경로는 발견되지 않았지만(5번 참고), CSP가 없으면 향후
  어떤 XSS든 영향 범위가 최대화된다(2차 방어선 부재).
- 3개 HTML `<head>`에 FOUC 방지 동기 인라인 스크립트가 있어, CSP를 도입하려면 해당
  인라인 스크립트에 nonce/hash를 부여해야 한다 — 같이 검토해야 할 트레이드오프다.

**수정 내용**: 3개 HTML 모두에 동일한 CSP meta 태그를 추가했다
(`default-src 'self'; script-src 'self' https://esm.sh '<FOUC 스크립트 sha256 해시>'; ...`).
정적 호스팅(GitHub Pages)이라 요청마다 nonce를 새로 발급할 수 없으므로, 변동성 없는 FOUC
스크립트는 해시로 허용하고, 변동성이 큰 로그인/회원가입 페이지 로직은 인라인에서
`static/js/loginPage.js`/`static/js/signupPage.js` 외부 모듈로 빼내 해시 관리 대상에서
제외했다. 헤드리스 Chromium으로 3개 페이지 모두 CSP violation 없이 정상 동작하는지
검증했다. 자세한 정책 내용과 해시 재계산 방법은 `CLAUDE.md`의 "CSP" 섹션 참고.

## 5. [참고/실제 위험 낮음] innerHTML 사용 — 현재는 안전

```js
// static/js/app.js:21-25
logoutBtn.innerHTML =
  '<svg viewBox="0 0 24 24" width="16" height="16" ...>' +
  '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
  '<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>' +
  '</svg>';
```

- 로그아웃/추가/삭제 버튼에 `innerHTML`로 SVG를 주입하지만 **하드코딩된 정적 마크업만**
  들어가고 사용자 입력이 섞이지 않는다 → 현재는 XSS가 아니다.
- 다만 패턴 자체가 위험하므로(나중에 누군가 사용자 입력을 같은 함수에 끼워넣기 쉬움), 코드
  리뷰 시 주의가 필요하다.
- todo 텍스트/닉네임은 전부 `textContent`로 렌더링되어 안전하다(false positive).

## 6. [실제 위험 낮음] 클라이언트 측 priority 값 신뢰 (CWE-602)

- `static/js/app.js`에서 `prioritySelect.value`/`event.target.value`를 그대로 서버에 전달한다.
- DB 쪽에 `check (priority in ('high', 'medium', 'low'))` 제약이 있어 서버 단에서 이미
  막혀 있으므로 실질적 악용 가능성은 낮다. 다만 "클라이언트 검증 = 서버 신뢰"로 오인하지
  않도록 기록해 둔다.

## 7. False positive로 제외한 항목

- **OAuth `redirectTo` open redirect (CWE-601)** — `new URL('../index.html', window.location.href)`로
  항상 같은 오리진의 고정 경로로 정규화되어 해당 없음
- **localStorage theme 값 미검증 XSS** — 이미 화이트리스트 검증이 있음(`'light'|'dark'`만 허용)
- **Service Worker 캐시 포이즈닝** — `supabase.co`/`esm.sh` 요청은 캐싱 로직에 들어가기 전에
  `return`되어 애초에 캐싱되지 않음
- **`config.js`의 anon/publishable key 노출** — RLS로 보호되는 설계상 공개 가능한 값, 정상
- **npm 의존성 CVE** — `package.json`에 의존성이 전혀 없어(CDN import만 사용) 해당 없음

## 요약 표

| 항목 | 심각도 | CWE | 위치 | 상태 |
|------|--------|-----|------|------|
| CDN 공급망(버전 미고정, SRI 부재) | 중-높음 | CWE-829, CWE-1104 | `app.js:1`, `supabaseClient.js:1` | 수정 완료 |
| 로그인 에러 메시지 노출 | 중 | CWE-209 | `static/login.html`, `static/signup.html` | 수정 완료 |
| 약한 비밀번호 정책 | 중 | CWE-521 | `static/js/validators.js:7-8` | 수정 완료 |
| CSP 부재 | 낮-중 | - | `index.html` 등 3개 HTML | 수정 완료 |
| innerHTML 패턴(현재 안전) | 참고 | CWE-79 (해당 없음) | `static/js/app.js` | 변경 없음(이미 안전) |
| 클라이언트 priority 값 신뢰 | 낮음 | CWE-602 | `static/js/app.js` | 변경 없음(DB 제약으로 이미 방어) |
