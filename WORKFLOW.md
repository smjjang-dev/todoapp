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

## 8. 이 작업 디렉터리를 배포 저장소와 git 연결

> 앞으로 이프로젝트는 https://github.com/smjjang-dev/todoapp.git 으로 연결해서 관리할꺼야

- 현재 작업 디렉터리가 git 저장소가 아니고 원격에는 이미 커밋 히스토리가 있음을
  확인 → 동기화 방식을 사용자에게 확인("원격 클론으로 교체" 선택받음)
- 원격을 임시 디렉터리에 클론해 `.git` 메타데이터만 작업 디렉터리로 가져와 연결
  (작업 디렉터리의 실제 파일은 그대로 유지)
- 원격에만 있던 todoapp과 무관한 교육자료 폴더(`docs/`)는 작업 디렉터리에 복원해
  그대로 보존, 새로 생긴 `.gitignore`/`auth.md`/`design.md`/`planApp.md`/
  `todoApp.apk`만 커밋
- HTTPS push가 자격증명 미설정으로 막혀 원격 URL을 SSH로 전환한 뒤 push 완료

## 9. Todo 앱 기능 개선 6건(등록시간 표시, 정렬, 인사말, 시계, 진행률, 무한 스크롤)

> todoapp 기능개선을 시작할거야 요구사항에 대한 분석 후 정리해서 알려줘 1. 할일항목
> 등록 후 리스트표시에 완료되면 종료시간 표시처럼 등록하고도 등록시간을 표시해줘
> 등록시간 저장은 완료시간과 동일한 데이타 타입으로 하고 저장한다 단, 화면 표시에서는
> 생성시간만 표시(예: "2시간전")  완료되면 현재처럼 완료시간만 표시 2.할일 등록시
> 최근할일이 제일 상단에 표시되록 정렬변경한다 완료되면 미완료 다음으로 완료시간으로
> 정렬한다. 3.닉네임표시에 "안녕하세요" 문구 삭제 4. 할일등록 라인위에 현재 날짜및
> 시간을 표시(예 2026년 6월 20일 토 20시30분 00초) 시계처럼 자동으로 시간이 증가
> 5. 4번 아래줄에 전체 진행률 "5/10 완료 (50%) 형식 + 프로세스 바로 표시 진행율바는
> 부드러운 전환효과 6.할일리스트는 처음에는 15개표시후 아래스크롤시 추가 자료가
> 있을때 부드럽게 조회해서 표시함

- 요구사항을 분석해 핵심 설계 충돌점 도출: 자동 정렬(요구사항 2)이 기존 SortableJS
  드래그 정렬 기능과 충돌 → 미완료 항목은 드래그 유지 + 새 항목만 최상단 삽입,
  완료 항목만 완료시간 내림차순으로 자동 정렬(드래그 비활성화)하는 절충안으로 plan
  작성 후 사용자 확인(정렬 방향도 "최근 완료가 위"로 확정)
- 무한 스크롤(요구사항 6)은 서버 페이지네이션 대신 전체 목록을 한 번에 조회한 뒤
  클라이언트 메모리에서 정렬·점진 표시하는 방식으로 설계(DB 마이그레이션 없이
  구현 가능, 전체 진행률 계산도 항상 정확)
- `todoLogic.js`에 순수함수 추가/교체: `topPosition`(신규 항목 최상단 배치 — 기존
  `nextPosition` 대체), `sortForDisplay`(미완료 우선 + 완료는 완료시간 내림차순),
  `formatRelativeTime`("n분/시간/일 전"), `formatDateTime`(시계 포맷),
  `computeProgress`(완료/전체/퍼센트) — 단위테스트 신규 작성
- `app.js`에 정렬·페이지네이션(`IntersectionObserver` 기반 스크롤 시 점진 표시,
  새로 드러나는 항목만 fade-in)·1초 간격 실시간 시계·진행률 바·등록시간 상대표시를
  구현하고, 닉네임 인사말에서 "안녕하세요" 문구를 삭제. `persistOrder()`도 페이지네이션
  중에 화면 밖 미완료 항목과 순서가 꼬이지 않도록 보정
- `index.html`/`style.css`에 시계·진행률 바·등록시간·완료 항목 드래그 핸들 숨김·
  fade-in 애니메이션 마크업/스타일 추가, `sw.js`의 `CACHE_VERSION` 갱신,
  `CLAUDE.md`에 신규 함수/동작 문서화
- `node --test`(39개) 전체 통과 확인. 다만 이 샌드박스에는 헤드리스 브라우저 의존
  라이브러리(`libnspr4` 등)가 없고 sudo 권한도 없어 실제 브라우저 인터랙션(시계
  갱신, 드래그, 스크롤 로드, 실제 로그인) 검증은 수행하지 못함 — 정적 서버를 띄워
  변경된 정적 자산이 200으로 서빙되고 새 마크업이 응답에 포함되는 것까지만 확인하고,
  나머지는 사용자에게 직접 확인을 안내

## 10. Todo 화면 헤더/본문/풋터 3단 레이아웃 + 공통 풋터

> TodoList UI개선할꺼야 할일 리스트 화면을 헤더,본문,푸터 3단계로 나누고 헤더는
> 할일입력화면라인까지 본문: 할일리스트 (스크롤대상) 푸터: 제일하단에 "copyleft 2026
> smjjang  / 사용법[링크: README.html"  가운데정렬 로그인화면에도 풋터는 동일하게
> 적용한다
>
> (후속 지시) 푸터 copyleft 2026 smjjang | 사용법 으로 변경해줘

- `index.html`의 `<main class="app">`에 `todo-app` 클래스를 추가하고, `body`를
  `flex-direction: column`(+ `height: 100vh`)으로 바꿔 헤더(타이틀/시계/진행률/입력
  폼)는 고정 높이로 위에 두고, `#todo-list`만 `flex: 1; min-height: 0; overflow-y:
  auto;`로 내부 스크롤 영역이 되도록 변경(무한 스크롤의 `IntersectionObserver`는 기본
  root가 뷰포트라 내부 스크롤 컨테이너로 클리핑돼도 그대로 동작 — JS 변경 없이
  검증됨)
- `<footer class="site-footer">`(`copyleft 2026 smjjang | <a href="...">사용법</a>`,
  링크는 루트의 `README.html`)를 `index.html`/`static/login.html`/
  `static/signup.html` 3곳 모두 `.app` 바깥 형제로 추가. `body`에
  `margin-top: auto`(footer)로 미는 고전적 sticky-footer 패턴을 적용해, 본문이 짧은
  로그인/회원가입 화면에서도 풋터가 항상 화면 최하단·가운데정렬로 고정되게 함
  (회원가입 화면 포함 여부는 사용자에게 확인 후 포함하기로 결정)
- `sw.js`의 `CACHE_VERSION`을 `v6`으로 갱신(`SHELL_ASSETS` 목록 자체는 변경 없음 —
  기존 파일들의 내용만 바뀜)
- 이 샌드박스에 캐시돼 있던 헤드리스 Chromium 우회 환경(`libnspr4`/`libnss3`/
  `libasound2` 추출 라이브러리, Playwright Chromium 바이너리)을 재사용해 실제
  브라우저 스크린샷으로 검증: 처음 시도에서 `body`가 `min-height: 100vh`만 갖고 있어
  내용이 넘치면 `.todo-app`/`#todo-list`가 줄어들지 않고 페이지 전체가 늘어나
  풋터가 화면 밖으로 밀려나는 버그를 발견 → `height: 100vh`(+ 안전장치로
  `overflow-y: auto`)로 고정해 해결. 더미 할일 30개를 주입한 임시 미리보기 HTML(저장소
  미반영, 검증 후 삭제)로 모바일/데스크톱/다크모드/항목 0~30개 범위에서 헤더 고정·
  본문 스크롤·풋터 최하단 고정을 모두 확인(`node --test` 39개도 재통과 확인)

## 11. 헤더/본문/풋터 변경에 대한 추가 CVE 검증

> 추가 CVE 항목이 있는지 추가 검증해줘

- 9~10번 작업 커밋 전에 수행한 기본 게이트(innerHTML/CSP/시크릿/CDN 버전 고정)에 더해
  이번 변경 범위(`index.html`/`static/login.html`/`static/signup.html`/
  `static/css/style.css`/`sw.js`)를 별도로 재검토
- 새로 추가된 `<footer>` 링크(`README.html`, 로그인/회원가입에서는 `../README.html`)는
  `target="_blank"`가 없는 동일 출처 상대경로 링크라 탭내빙(reverse tabnabbing)/오픈
  리다이렉트 해당 없음. CSP의 `default-src 'self'`도 같은 출처 앵커 탐색은 제한하지
  않아 영향 없음
- 풋터 링크로 기존보다 한 클릭 더 가까워진 `README.html` 자체도 같이 점검: 자체 인라인
  `<script>`(사이드 네비 스크롤 하이라이트)가 있지만 정적 마크업만 다루고 사용자 입력·
  `innerHTML`·`location.hash` 파싱이 없어 안전(이 문서는 폼/인증이 없는 정적 안내
  페이지라 애초에 CSP 적용 대상 3개 진입점에서 의도적으로 제외된 범위 — `CLAUDE.md`
  CSP 섹션과 일치)
- CSP meta 태그(3개 진입점 전부 동일 문자열), CDN import 버전 고정(`sortablejs@1.15.7`,
  `supabase-js@2.108.2`), 클라이언트 `priority` 값 DB `check` 제약 의존 등 기존 CVE.md
  1~6번 항목은 이번 변경으로 건드리지 않았음을 재확인
- **결론: 이번 레이아웃/풋터 변경으로 새로 발생한 취약점 없음** — `CVE.md`/`CVE.html`에
  추가할 신규 항목 없이 현재 상태 유지
