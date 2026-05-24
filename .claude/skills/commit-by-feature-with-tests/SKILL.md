---
name: commit-by-feature-with-tests
description: 현재 working tree의 모든 커밋되지 않은 변경(staged/unstaged/untracked)을 기능 단위로 그룹화해서 순차적으로 커밋한 뒤, 각 커밋의 변경 내용에 맞는 테스트(Vitest 단위/Playwright E2E/MSW 모킹)를 작성·실행하는 일괄 워크플로. 사용자가 "변경사항 커밋해줘", "기능별로 쪼개서 커밋해", "커밋 정리하고 테스트도 짜줘", "PR 올리기 전에 커밋 분할+테스트", "지금 작업한 거 커밋하고 검증해줘", "uncommitted 변경 다 정리해" 같은 말을 하면 반드시 이 스킬을 사용하라. "커밋"과 "테스트"가 한 문장에 같이 나오거나, "정리"·"마무리"·"PR 전" 같은 단어로 다중 변경의 일괄 처리를 요청하는 모든 경우에 트리거한다.
---

# Commit by Feature, Then Test

## 목적

흩어진 working tree 변경을 **기능 단위 commit들**로 정리하고, 각 commit에 **그 commit이 만든 책임에 맞는 테스트**를 추가하는 한 번에 끝나는 워크플로.

핵심 두 원칙:

1. **commit과 test는 분리한다** — feature commit들이 먼저 다 들어간 뒤, 그 위에 `test:` commit들이 쌓인다. 이력 추적과 revert가 모두 쉬워짐.
2. **모든 변경을 테스트하지는 않는다** — 이 프로젝트는 컴포넌트 단위 테스트를 하지 않고(CLAUDE.md 정책), 외부 호출은 MSW로 모킹한다. 테스트할 surface가 없는 commit(shadcn 프리미티브 추가, 의존성, 설정)은 건너뛰고 표시만 한다.

## 트리거 시점

- "지금까지 한 거 커밋 정리해줘", "기능별로 쪼개서 커밋해"
- "커밋 다 한 다음 테스트도 짜줘"
- "PR 전에 정리 부탁", "마무리해줘"
- 사용자가 명백히 "commit + test" 둘 다 원하거나, working tree에 여러 기능이 섞여 있어 정리가 필요해 보일 때

단순 "이 변경 뭐야?"는 [[explain-uncommitted-changes]] 쪽이 맞음. 이 스킬은 행동까지 함.

## 워크플로

### Phase 0 — 사전 확인

다음 두 가지가 충족되지 않으면 진행하기 전에 사용자에게 알린다:

- 현재 브랜치가 `main`이면 → 작업 브랜치로 옮길지 물어본다 (실수 방지).
- 변경이 0개면 → "working tree clean입니다" 한 줄로 끝.

### Phase 1 — 변경 수집 (병렬 실행)

- `git status --short`
- `git diff` (unstaged)
- `git diff --cached` (staged)
- `git log --oneline -5` (최근 커밋 스타일 확인용)
- untracked 파일은 `Read`로 직접 보되, lockfile·generated·이미지 등 대용량은 읽지 말고 "추가됨"으로만 인지.

`CLAUDE.md`가 있으면 한 번 훑어 commit 스타일·테스트 정책을 확인한다 (이 스킬은 그 정책의 일부를 인용하지만, 프로젝트가 정책을 갱신했을 수 있음).

### Phase 2 — 기능 단위 그룹화

[[explain-uncommitted-changes]]와 같은 원칙: **폴더가 아니라 책임**으로 묶는다. 다만 이 스킬은 그룹이 곧 **commit 1개**가 된다는 점이 다름.

좋은 그룹 = 좋은 commit:

- 한 commit이 한 가지 변화만 담는다 (단일 책임).
- commit message 한 줄로 요약 가능해야 한다. 안 되면 너무 큰 것.
- revert 했을 때 다른 기능을 깨지 않아야 한다. 깨지면 너무 작거나 잘못 묶인 것.

분할 시 주의할 결합:

- **Prisma schema 수정 + migration 디렉터리** → 반드시 같은 commit. 따로 가면 빌드 깨짐.
- **shadcn 컴포넌트 추가 + 그것을 처음 쓰는 코드** → 분리해도 OK (shadcn 추가가 자체로 의미 있는 commit). 단 shadcn 추가만 있고 쓰는 곳이 없으면 통합해도 됨.
- **`package.json` + `pnpm-lock.yaml`** → 항상 같은 commit. 어느 한쪽만 들어가면 install 깨짐.

### Phase 3 — 계획 제시 + 단 한 번의 확인

전체 commit 계획을 다음 형식으로 출력하고 사용자에게 OK를 받는다. 받기 전엔 어떤 `git` 변경 명령도 실행하지 않는다.

```
다음 순서로 N개 commit + M개 test commit을 만들 예정입니다.

1. <type>: <subject>
   - file1
   - file2

2. <type>: <subject>
   - file3

...

테스트 예정:
- commit 2에 대해 tests/unit/foo.test.ts (Vitest)
- commit 3에 대해 tests/e2e/login.spec.ts (Playwright)
- commit 1, 4는 테스트 대상 아님 (이유)

진행할까요?
```

사용자가 그룹/순서/메시지 변경을 요구하면 반영 후 다시 확인. 단순 OK면 Phase 4로.

### Phase 4 — Commit 실행

각 commit마다:

1. **선택적 staging**: `git add <path1> <path2> ...`. **절대로 `git add .` / `git add -A` 금지**. 의도하지 않은 파일이 섞일 수 있음.
2. **commit message는 HEREDOC으로 전달** (포맷 깨짐 방지 + Co-Authored-By footer 통일):

   ```bash
   git commit -m "$(cat <<'EOF'
   <type>: <subject>

   <선택: body — 한국어 1~3줄>

   Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
   EOF
   )"
   ```

3. 다음 commit으로 진행.

`type` 선택:

- `feat:` — 새 사용자 기능
- `fix:` — 버그 수정
- `refactor:` — 동작 동일, 구조 변경
- `chore:` — 의존성 / 빌드 / 셋업
- `docs:` — 문서
- `test:` — Phase 6에서만 사용
- `style:` — 포맷팅만

subject는 한국어, 마침표 없이, 동사 또는 명사구. 최근 commit 로그를 한 번 보고 같은 톤 유지.

**Pre-commit 훅 (husky/lint-staged) 실패 시**: `--no-verify`로 우회 금지. lint/format 에러가 났다면 실제 코드 문제일 수 있음. 원인을 파악해 고치고 → 다시 stage → **새 commit 생성** (amend 금지 — system 가이드라인).

### Phase 5 — 테스트 대상 분류 (Phase 6 전 단계)

각 commit을 다음 카테고리로 분류해 테스트 작성 여부와 종류를 결정한다.

**Vitest 단위 테스트를 쓴다** — 다음 중 하나라도 commit에 들어 있으면:

- 순수 함수 / 유틸 / 변환 로직 (`_lib/*.ts`의 헬퍼류)
- Route Handler의 비즈니스 로직 (입력 검증, 권한 체크, 응답 형태)
- 데이터 매핑 (외부 API 응답 → 화면용 shape)
- 명시적 비즈니스 규칙 (slug 생성, 토큰 계산 등)

위치: source 옆 `foo.test.ts` 또는 `tests/unit/`. 둘 다 vitest가 픽업. 외부 HTTP 호출이 있으면 `tests/msw/handlers.ts`에 핸들러 추가하고 테스트별 `server.use(...)`로 오버라이드.

**Playwright E2E를 쓴다** — 다음 중 하나라도 들어 있으면:

- 사용자가 클릭/입력하는 페이지·플로우 변경
- 인증·라우팅·리다이렉트 동작
- 여러 컴포넌트가 협업하는 시나리오

위치: `tests/e2e/*.spec.ts`. 시나리오 단위로 작성 (화면 단위 아님). 외부 호출은 MSW로 모킹된 상태 가정.

**테스트를 건너뛴다** — 다음만 있으면:

- shadcn UI 프리미티브 추가 (`_components/ui/*`)
- 의존성 / lockfile / 설정 파일 (`package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `eslint.config.mjs` 등)
- 단순 문서 (`*.md`)
- 컴포넌트 단위 (CLAUDE.md 정책상 X)
- 자동 생성 산출물 (`src/generated/*`)
- 마이그레이션 SQL 자체 (Prisma가 검증)

건너뛴 commit은 최종 보고에 "테스트 대상 아님 — 이유"를 한 줄로 남긴다.

**판단이 애매할 때**: 그 commit이 깨졌을 때 사용자가 즉시 알아챌 수 있는지 자문. 즉시 안 깨지면 (예: 미들웨어 잘못된 matcher) 테스트로 잡고, 즉시 깨지면 (예: import 오류) 빌드/typecheck가 잡으므로 테스트 불필요.

### Phase 6 — 테스트 작성 + 실행

각 테스트 대상 commit에 대해:

1. 테스트 파일 작성. **실제로 의미 있는 시나리오만** 검증. 코드가 존재한다는 사실을 재확인하는 테스트(예: `expect(Button).toBeDefined()`) 금지.
2. 단위 테스트면 `pnpm test:run`, E2E면 `pnpm test:e2e --grep "<신규 테스트 이름>"`로 즉시 검증.
3. 실패하면:
   - 테스트가 잘못 짜인 경우 → 테스트 수정
   - 실제 코드 버그를 발견한 경우 → **이 스킬의 범위 밖**. 사용자에게 보고하고 별도 fix commit 계획을 제안.
4. 모든 신규 테스트가 통과하면 한 commit으로 묶는다. 테스트가 여러 feature에 걸쳐 있으면 feature별로 `test: ...` commit 분리.

테스트 commit 메시지 예:

```
test: GitHub OAuth 로그인 보호 미들웨어 E2E

미인증 시 (main) 경로 → /login 리다이렉트 시나리오.
```

### Phase 7 — 최종 보고

다음 형식 한 번:

```
완료. 총 N개 feature commit + M개 test commit.

Feature:
- abc1234 feat: ...
- def5678 feat: ...

Tests:
- 7890abc test: ...

테스트 안 함 (이유):
- def5678: shadcn 프리미티브, 컴포넌트 단위 테스트 정책에 따라 제외
- ...

다음 단계 제안 없음 (사용자가 push 여부 결정).
```

**push는 절대 자동으로 하지 않는다**. 사용자가 명시적으로 요청할 때만.

## 안전장치

- 한 commit이 30개 이상 파일을 건드리면 잠시 멈추고 그룹화가 맞는지 사용자에게 확인.
- `prisma/schema.prisma`가 수정됐는데 `prisma/migrations/`에 새 디렉터리가 없으면 → 마이그레이션 누락. 사용자에게 `pnpm exec prisma migrate dev --name <...>` 실행 권유.
- `.env`나 secret 파일이 staged에 있으면 강제 중단하고 경고. (gitignored지만 사용자가 강제 add 했을 수 있음.)
- 테스트가 외부 API를 직접 때리는 코드를 쓰면 안 됨 — MSW 미경유 시 즉시 수정. CLAUDE.md: "테스트에서 진짜 외부 API를 때리지 않는다".

## 하지 말 것

- `git add .` / `git add -A` / `git add -u` 사용 금지.
- `git commit --no-verify` 금지 (husky 우회).
- `git commit --amend` 금지 (가이드라인: 항상 새 commit).
- `git push` 자동 실행 금지.
- 사용자 OK 없이 commit 시작 금지.
- 컴포넌트 단위 테스트 작성 금지 (예: `<Button>` 렌더 스냅샷). CLAUDE.md 명시.
- "이 commit은 트리비얼하니 테스트 생략" 식 자의적 판단 금지. Phase 5 분류표만 따른다.
- 코드 commit이 모두 깨끗이 들어가지 않은 상태에서 테스트 작성 시작 금지.
