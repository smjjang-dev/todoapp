# 작업 기록 (WORKFLOW)

이 문서는 `day03/todoapp`에서 사용자가 작성한 프롬프트 원문과, 그에 대응해 수행한
작업을 시간순으로 기록한다. 프롬프트는 그대로 인용하고, 작업 내용은 요약한다.
개인정보·키·비밀번호 등 공개되면 안 되는 정보는 리터럴 값을 적지 않고 마스킹해서
기록한다(예: "Supabase 프로젝트 URL", "anon key"처럼 지칭만 하고 실제 값은 생략).

## 1. CVE 관점 보안 검토 요청

> todoapp을 CVE(Common Vulnerabilities and Exposures) 중점으로 검토해줘

- 클라이언트 JS(인증/XSS)와 정적자산·의존성·RLS(공급망/CSP/Supabase 정책)를 나눠
  탐색 에이전트 2개를 병렬 실행해 1차 취약점 후보 도출
- 핵심 파일을 직접 읽어 재검증해 false positive 제거(예: theme.js의 FOUC 스크립트는
  이미 화이트리스트 검증이 있어 XSS 후보에서 제외)
- 결과물 형태를 사용자에게 확인(보고서만 vs 보고서+즉시수정) → "보고서만" 선택받음

## 2. 검토 결과를 문서 뷰어로 저장

> 취약점점검 결과를 CVE.html로 만들어주고 만드는 유형은 CLAUDE.html 와 동일하게 만들어줘

- `CVE.md`(원본)와 `CVE.html`(`CLAUDE.html`과 동일한 다크테마 문서 뷰어 스타일)을 신설
- `README.html`/`CLAUDE.html`/`auth.html`의 상단 docbar·하단 footer에 `CVE.html`
  교차 링크 추가, `README.md`/`README.html` 문서 목록에도 반영
- 로컬 서버로 4개 문서 모두 200 응답 확인

## 3. 커밋 및 배포

> 커밋하고 배포해줘

- 모노레포(`weable-kosa/kosa-vibecoding-2026-3rd`)에 todoapp 관련 파일만 커밋·push
- 배포 저장소(`smjjang-dev/todoapp`)에도 동일 파일을 복사해 커밋·push
- 배포 사이트에서 `CVE.html` 등 주요 페이지 200 응답 확인

## 4. 발견된 취약점 즉시 수정

> 발견된 취약점들도 바로 수정해줘

- CDN 의존성(`sortablejs`, `@supabase/supabase-js`)을 정확한 패치 버전까지 고정
- 로그인/회원가입/OAuth 실패 메시지를 Supabase 원본 메시지 대신 일반화된 한국어
  메시지로 치환(계정 열거 방지). 클라이언트 측 입력 검증 에러는 그대로 유지(안전함)
- 비밀번호 정책을 8자 이상 + 영문/숫자 혼합으로 강화, 단위테스트 케이스 추가
- 3개 HTML에 CSP(Content-Security-Policy) meta 태그 도입. 변동성 있는 로그인/
  회원가입 페이지 로직을 인라인에서 외부 모듈(`loginPage.js`/`signupPage.js`)로
  분리해 CSP 해시 관리 대상을 FOUC 스크립트 하나로 최소화
- `sw.js`의 `SHELL_ASSETS`/`CACHE_VERSION` 갱신
- 단위테스트 전체 통과 + 헤드리스 브라우저로 3개 페이지 CSP violation 없음을 검증
- `CLAUDE.md`/`CLAUDE.html`/`CVE.md`/`CVE.html`에 수정 내용과 "수정 완료" 상태 반영

## 5. 표준 워크플로 확립 + 재적용

> 앞으로 테스트하면 테스트 성공후에는 테스트 데이터는 바로 삭제해주고 단위테스트
> 완료이후 취약점검증(CVE) 단계를 추가해서 매번 수행해줘 다되면 커밋하고 배포해줘

- "테스트 → 테스트 산출물 즉시 정리 → 취약점검증(CVE) 게이트 → 커밋/배포" 순서를
  표준 워크플로로 메모리에 저장(향후 세션에도 적용)
- 이번 변경분에 그 워크플로를 실제 적용: 단위테스트 재실행 → 이전 검증 과정에서
  남은 임시 서버 프로세스/스크립트/로그 정리 → 변경 파일 대상으로
  `innerHTML`/에러 메시지 노출/CSP/하드코딩 시크릿 패턴 재검토(신규 취약점 없음 확인)
  → 모노레포 + 배포 저장소 양쪽 커밋·push
- 배포 저장소에서 발견한 무관한 기존 드리프트(`tests/todoLogic.test.js`의 옛 import
  경로)도 함께 동기화
- 배포 사이트 전체 페이지 200 응답 확인

## 6. 작업 기록 문서화

> 지금까지 내가 작성한 프롬프트와 그와 상응애서 네가 한작업을 정리해서 WORKFLOW.html로
> 저장해줘 프롬프트는 그대로 저장하고 작업내용은 요약해서 작성해주면 돼 이 내용을
> CLAUDE.md 에 반영해서 앞으로 작업시 WORDFLOW.html 를 업데이트해줘 단, 공개되면 안되는
> 정보(개인정보,키,암호등)는 마스킹처리를 해서 진행해줘

- 이 문서(`WORKFLOW.md`)와 동일 내용의 문서 뷰어(`WORKFLOW.html`)를 신설
- `CLAUDE.md`/`CLAUDE.html`에 "앞으로 작업을 처리할 때마다 WORKFLOW.md/.html을
  함께 갱신한다"는 규칙과 마스킹 원칙을 명문화
- 5개 문서(README/CLAUDE/auth/CVE/WORKFLOW)의 docbar·footer 교차 링크 갱신

## 7. 커밋·push·배포 재실행

> commit && push && 배포해줘

- 단위테스트 재실행(todoapp 24개) 통과 확인
- 배포 저장소(`smjjang-dev/todoapp`)가 직전 CVE/CSP 보안 수정 커밋 이후로 push가
  안 되어 있던 것을 발견(로컬에 미반영 커밋 1건 + CVE.md/CVE.html/WORKFLOW.md/
  WORKFLOW.html·CSP meta 태그·외부 모듈 분리 전체가 누락된 상태) → 소스와 배포
  저장소 파일을 전체 동기화 후 커밋
- 같은 모노레포에 같이 있던 `day03/kanban`(백엔드 없음 버전)의 반응형 레이아웃
  CSS 수정도 함께 커밋·push. 다만 이 버전의 배포 사이트는 이후 `kanban_v1`
  (Supabase 멀티유저 버전)으로 교체되어 있고 그쪽 CSS에는 동일한 반응형 수정이
  이미 적용되어 있음을 확인 → 별도 배포 작업 없이 모노레포 커밋만 진행
- 모노레포 + `smjjang-dev/todoapp` 배포 저장소 양쪽 push, 배포 사이트 주요 페이지
  200 응답 확인
