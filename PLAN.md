# Implementation Plan

> **스펙**: GitHub 활동 데이터를 분석해 자동으로 개발 블로그를 생성하는 서비스. 사용자가 저장소·브랜치·커밋을 선택하면 LLM이 변경 사항을 분석해 블로그 초안을 만들고, 사용자가 편집기에서 다듬어 저장/발행한다.

## 결정 사항

| 영역            | 선택                                  | 비고                                                             |
| --------------- | ------------------------------------- | ---------------------------------------------------------------- |
| 인증            | Auth.js v5 (NextAuth) + Prisma 어댑터 | GitHub provider, `access_token` DB 보관                          |
| LLM             | OpenAI                                | Server-only SDK 호출, 응답 스트리밍                              |
| 편집기          | Markdown + 프리뷰                     | `@uiw/react-md-editor` 또는 textarea + `react-markdown` 좌/우 탭 |
| 발행 타깃       | 앱 내부 공개 페이지                   | `/blog/[slug]`, 비인증 접근 허용                                 |
| GitHub OAuth    | `public_repo` 스코프                  | 사용자 public 레포만 분석                                        |
| AI 입력         | 커밋 메시지 + 파일 변경 목록 + stats  | diff 본문은 v2로 미룸                                            |
| OpenAI 키       | 서버 공용 키                          | 사용자별 quota는 DB에서 단순 카운트                              |
| 기본 응답 형식  | Markdown 자유 텍스트                  | 추후 JSON Schema로 제목/본문/태그 분리 가능                      |
| 코드 하이라이트 | `rehype-pretty-code` (shiki)          | 편집기 프리뷰 + 공개 페이지 동일 렌더러                          |
| 폼/검증         | React Hook Form + Zod                 | API 입력 검증도 같은 Zod 스키마 재사용                           |
| 환경 변수 검증  | `@t3-oss/env-nextjs` + Zod            | 빌드 시점에 누락된 env fail-fast                                 |

## 데이터 모델 (Prisma 스키마)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ---- Auth.js v5 표준 ----
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  githubLogin   String?   @unique  // GitHub username (편의)
  accounts      Account[]
  sessions      Session[]
  posts         Post[]
  createdAt     DateTime  @default(now())
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String   // "github"
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

// ---- 도메인 ----
enum PostStatus {
  DRAFT
  PUBLISHED
}

model Post {
  id           String     @id @default(cuid())
  slug         String?    @unique               // 발행 시 생성
  title        String
  contentMd    String                            // 본문 (Markdown)
  excerpt      String?                           // 카드용 미리보기 (자동 생성)
  status       PostStatus @default(DRAFT)
  // GitHub source
  repoFullName String                            // "owner/repo"
  branch       String
  commitShas   String[]                          // 포함된 커밋 SHA들 (Postgres text[])
  // AI 메타
  aiModel      String?                           // e.g., "gpt-4o-mini"
  promptTokens Int?
  outputTokens Int?
  // ownership / 시간
  authorId     String
  author       User       @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  publishedAt  DateTime?

  @@index([authorId, status, updatedAt])
  @@index([status, publishedAt])
}
```

> 추후 확장: `Tag`, `PostTag` (다대다), `AiUsage` (사용량 추적 분리), `RepoCache` (rate-limit 완화용).

## 라우트 매핑

| 경로                              | 종류            | 인증 | 설명                                      |
| --------------------------------- | --------------- | ---- | ----------------------------------------- |
| `/` (`(main)/page.tsx`)           | Server + Client | Y    | My Blog — 생성 플로우 (3단계 폼)          |
| `/saved` (`(main)/saved/`)        | Server          | Y    | 저장된 포스트 카드 그리드                 |
| `/posts/[id]/edit` (`(main)/...`) | Server + Client | Y    | 편집기                                    |
| `/settings` (`(main)/settings/`)  | Server          | Y    | GitHub 연결 상태 / 로그아웃               |
| `/login` (`(auth)/login/`)        | Server          | N    | GitHub OAuth signin                       |
| `/blog/[slug]` (`(public)/...`)   | Server (SSR)    | N    | 발행된 글 공개 페이지                     |
| `/api/auth/[...nextauth]`         | Route Handler   | -    | Auth.js callback                          |
| `/api/github/repos`               | Route Handler   | Y    | 본인 public repos                         |
| `/api/github/branches`            | Route Handler   | Y    | `?owner=&repo=`                           |
| `/api/github/commits`             | Route Handler   | Y    | `?owner=&repo=&branch=&per_page=`         |
| `/api/ai/summarize`               | Route Handler   | Y    | POST 스트리밍 응답                        |
| `/api/posts`                      | Route Handler   | Y    | GET 리스트 / POST 생성(draft)             |
| `/api/posts/[id]`                 | Route Handler   | Y    | GET / PATCH / DELETE                      |
| `/api/posts/[id]/publish`         | Route Handler   | Y    | POST: status=PUBLISHED, slug, publishedAt |

---

## Phase 1 — 인증 (Auth.js v5)

**목표**: GitHub OAuth로 로그인, 세션 보장. 보호된 라우트 자동 리다이렉트.

**의존성 추가**

```
pnpm add next-auth@beta @auth/prisma-adapter
pnpm add -D @types/node
```

**산출물**

- `src/app/_lib/auth.ts` — `NextAuth({...})` 설정, `auth`, `signIn`, `signOut`, `handlers` export
- `src/app/api/auth/[...nextauth]/route.ts` — handlers re-export
- `src/middleware.ts` — `(main)/**` 보호, 미인증 → `/login`
- `src/app/(auth)/login/page.tsx` — GitHub signin 버튼 (Server Component + form action)
- `src/app/_components/UserMenu.tsx` (Client) — avatar/logout, `(main)/layout.tsx`에 끼움
- `prisma/schema.prisma` — Auth.js 4개 모델 추가
- 마이그레이션: `pnpm exec prisma migrate dev --name auth`
- `.env` 추가: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_URL` (개발용)

**DoD**

- 로그인 → `users`/`accounts` 행 생성, GitHub `access_token` 저장 확인
- 미인증으로 `/saved` 접속 → `/login` 리다이렉트
- Header에 본인 avatar 표시, logout 동작

**테스트**

- Playwright: 로그인 우회를 위해 테스트 모드에서 dev signin (또는 MSW로 GitHub OAuth 모킹)
- 단위: `_lib/auth.ts`의 `authorize` 콜백 (있다면) 분기

**커밋 예시**

- `feat: Auth.js v5 GitHub OAuth + Prisma 어댑터 도입`
- `feat: (main) 보호 미들웨어 + 로그인 페이지`

---

## Phase 2 — GitHub 통합

**목표**: 인증된 사용자의 public repo/branch/commit을 가져오는 서버 엔드포인트.

**의존성**

```
pnpm add octokit
pnpm add zod
```

**산출물**

- `src/app/_lib/github.ts`
  - `getOctokitForUser(userId)`: DB에서 `Account.access_token` 꺼내 `Octokit` 인스턴스화
  - `listUserRepos({ q })`, `listBranches`, `listCommits` 헬퍼
- `src/app/api/github/repos/route.ts` (GET)
- `src/app/api/github/branches/route.ts` (GET, `?owner=&repo=`)
- `src/app/api/github/commits/route.ts` (GET, `?owner=&repo=&branch=&per_page=20`)
- Zod 입력 스키마 + 401/400 처리 유틸 `src/app/_lib/api.ts`
- MSW handlers (`tests/msw/handlers.ts`): octokit이 때리는 실제 URL 패턴으로 업데이트

**DoD**

- 로그인 상태에서 `curl /api/github/repos` → 본인 public repo JSON 배열
- rate-limit 응답(403) 시 명확한 에러 메시지

**테스트**

- 단위(Vitest): `listUserRepos`가 octokit 결과를 화면용 shape로 매핑
- 단위: 401(미인증) / 400(zod 검증 실패) 케이스

**커밋 예시**

- `feat: Octokit 기반 GitHub 서버 헬퍼 + repos/branches/commits API`

---

## Phase 3 — 블로그 생성 UI

**목표**: 레퍼런스 좌측 패널 — 레포 검색 → 브랜치 선택 → 커밋 다중선택.

**의존성**

```
pnpm add react-hook-form @hookform/resolvers
pnpm dlx shadcn@latest add input select checkbox button card scroll-area
```

**산출물**

- `src/app/(main)/_components/CreateFlow.tsx` (Client) — 단계별 상태
- `src/app/(main)/_components/RepoSearch.tsx` — debounced 입력 → `/api/github/repos?q=` 호출
- `src/app/(main)/_components/BranchSelect.tsx` — `<Select>` 비동기 옵션
- `src/app/(main)/_components/CommitList.tsx` — 체크박스 리스트, 선택 SHA[] 관리
- `src/app/(main)/page.tsx` — 좌측 `CreateFlow`, 우측 (Phase 4) 패널 자리만 잡기
- 데이터 페치: 클라이언트는 fetch → JSON. 서버 fetch 캐시 키는 `revalidate: 60`.

**DoD**

- 레포 검색 → 결과 표시 → 선택 시 브랜치 로드 → 브랜치 선택 시 커밋 로드 → 커밋 다중선택
- 새로고침해도 step 1로 되돌아감(상태는 메모리만; URL state는 폴리시)

**테스트**

- 단위: 폼 상태 reducer/zod 스키마
- E2E: 로그인 후 레포 검색 박스 표시 (deep 시나리오는 Phase 4 끝나고)

**커밋 예시**

- `feat: 생성 플로우 좌측 패널 (레포/브랜치/커밋 선택)`

---

## Phase 4 — AI 요약 (스트리밍)

**목표**: 선택된 커밋 메시지 + 파일 변경 목록을 OpenAI로 보내 Markdown 초안 생성, 토큰 스트리밍으로 UI에 실시간 렌더.

**의존성**

```
pnpm add openai ai
# 'ai'는 Vercel AI SDK (스트리밍 hook + Response 헬퍼). 선택사항이지만 강추.
```

**산출물**

- `src/app/_lib/ai.ts`
  - `buildPrompt({ repo, branch, commits })`: 각 커밋의 `{ sha, message, author, date, files: [{path, additions, deletions}] }` 직렬화
  - `summarizeCommits(...)`: OpenAI 호출, `ReadableStream` 반환
- `src/app/api/ai/summarize/route.ts` (POST, 입력 Zod 검증)
  - 입력: `{ repo, branch, commitShas: string[] }`
  - 처리: octokit으로 각 SHA의 commit detail + files 조회 (병렬, 동시성 제한 5) → AI에 전달 → 스트리밍 응답
- `src/app/(main)/_components/AiSummaryPanel.tsx` (Client) — Vercel AI SDK의 `useCompletion`/`useChat` 또는 직접 `fetch` + reader
  - "요약 생성" 버튼, 진행 중 토큰 누적 표시, 취소 버튼
  - 완료 후 "초안으로 저장" → POST `/api/posts` (status=DRAFT)
- `src/app/api/posts/route.ts` (POST) — 입력: `{ repo, branch, commitShas, title, contentMd }` → `Post` row 생성

**DoD**

- "요약 생성" 클릭 → 1초 내 첫 토큰 표시, 완료까지 스트림
- 큰 PR(파일 50+개) 입력 시 prompt 길이 경고/잘림 처리
- 저장 후 `posts` 테이블에 DRAFT row, `aiModel`/`promptTokens`/`outputTokens` 채워짐

**테스트**

- 단위: `buildPrompt`의 결정적 출력 snapshot
- 단위: `summarizeCommits` MSW로 OpenAI streaming SSE 모킹
- E2E: 로그인 → 커밋 선택 → "요약 생성" → 토큰 표시 → 저장 → DB row 검증 (test DB)

**커밋 예시**

- `feat: OpenAI 스트리밍 요약 + draft 저장 API`

---

## Phase 5 — 편집기

**목표**: AI 초안을 사용자가 다듬는 화면. Markdown 입력 + 즉시 프리뷰.

**의존성**

```
pnpm add react-markdown remark-gfm rehype-pretty-code shiki
pnpm dlx shadcn@latest add tabs textarea
```

**산출물**

- `src/app/(main)/posts/[id]/edit/page.tsx` (Server) — 본인 Post 로드, 404 처리
- `src/app/(main)/posts/[id]/edit/_components/Editor.tsx` (Client)
  - 좌: `Textarea` (탭) — 추후 CodeMirror로 교체 가능
  - 우: `Preview` — `react-markdown` + `remark-gfm` + `rehype-pretty-code`
  - 자동 저장(debounce 1.5s) → PATCH `/api/posts/[id]`
  - 제목 input, 메타 표시(repo/branch/커밋 수)
- `src/app/api/posts/[id]/route.ts` — GET/PATCH/DELETE, Zod 검증, 본인 소유 확인
- `src/app/_components/Markdown.tsx` — 프리뷰 + 공개 페이지 공통 렌더러
- shiki 빌드 시간 부담 → `next.config.ts`에 `experimental.serverComponentsExternalPackages: ["shiki"]` 검토

**DoD**

- 편집 → 1.5초 후 자동 저장, 토스트로 "저장됨"
- 코드 블록 syntax highlighting 작동
- 다른 사용자의 post id로 접근 → 404 (정보 누설 X)

**테스트**

- 단위: PATCH 입력 zod 검증, 본인 소유 가드
- E2E: 편집 → 새로고침 시 변경 유지

**커밋 예시**

- `feat: Markdown 편집기 + 자동 저장 + 코드 하이라이팅`

---

## Phase 6 — Saved Posts + 발행

**목표**: 저장된 글 카드 그리드, 발행/재편집/삭제.

**의존성**

```
pnpm add slugify
pnpm dlx shadcn@latest add badge dropdown-menu alert-dialog
```

**산출물**

- `src/app/(main)/saved/page.tsx` (Server) — 본인 모든 Post `orderBy: updatedAt desc`
- `src/app/(main)/saved/_components/PostCard.tsx`
  - 브랜치 `<Badge>`, 제목, 발췌, 날짜, 상태 (DRAFT/PUBLISHED)
  - 우상단 `DropdownMenu`: 편집 / 발행 / 삭제 (AlertDialog로 확정)
- `src/app/api/posts/[id]/publish/route.ts` (POST)
  - DRAFT → PUBLISHED 전환, `slug` 생성 (`slugify(title)` + 짧은 hash), `publishedAt = now()`
  - 이미 PUBLISHED인 경우 idempotent
- `Post.excerpt` 자동 생성 로직: `contentMd`의 첫 단락 200자 (PATCH 시마다 업데이트)

**DoD**

- 카드 클릭 → `/posts/[id]/edit`
- 발행 후 카드에 "PUBLISHED" 뱃지 + 공개 URL 링크 노출
- 삭제는 확인 다이얼로그 → cascade로 관련 row 없음 (Post 단독)

**테스트**

- 단위: slug 충돌 시 suffix 추가 동작
- E2E: 발행 → 공개 페이지 200 응답 확인 (Phase 7 완료 후)

**커밋 예시**

- `feat: Saved Posts 카드 그리드 + 발행/삭제 액션`

---

## Phase 7 — 공개 블로그 페이지

**목표**: 발행된 글의 공개 URL. 비로그인도 접근.

**산출물**

- `src/app/(public)/layout.tsx` — `(main)`과 다른 미니멀 layout (로그인 prompt X)
- `src/app/(public)/blog/[slug]/page.tsx` (Server, SSR)
  - `prisma.post.findFirst({ where: { slug, status: PUBLISHED } })`, 없으면 `notFound()`
  - `<Markdown>` 재사용
  - `generateMetadata`: title, description = excerpt, OG image (추후)
- `src/middleware.ts` 매처에서 `/blog/**`, `/api/**`, `/_next/**` 제외 (보호 대상은 `(main)/**`만)

**DoD**

- 발행된 URL이 비인증으로 열림
- DRAFT는 공개 페이지에서 404
- 제목/메타 태그 SEO friendly

**테스트**

- E2E: 비로그인 컨텍스트로 공개 URL 방문 → 본문 렌더 확인
- E2E: DRAFT URL → 404

**커밋 예시**

- `feat: /blog/[slug] 공개 페이지 + SEO 메타`

---

## Phase 8 — 설정 페이지

**목표**: GitHub 연결 상태 + 로그아웃 + 사용량 표시.

**산출물**

- `src/app/(main)/settings/page.tsx` (Server)
  - 본인 GitHub 정보 (`name`, `githubLogin`, `image`)
  - 누적 OpenAI 토큰 사용량 (Post 합산)
  - "GitHub 재연결" 버튼 (refresh) / "로그아웃"
  - **(추후)** 다크모드 토글, BYOK 키 입력

**DoD**

- 본인 데이터만 표시, 로그아웃 동작 정상

**테스트**

- E2E: 설정 페이지 진입 → 로그아웃 → `/login` 리다이렉트

**커밋 예시**

- `feat: 설정 페이지 (프로필 + 사용량 + 로그아웃)`

---

## Phase 9 — 배포 + 운영

**목표**: Vercel 배포 + 환경변수 검증 + CI.

**의존성**

```
pnpm add @t3-oss/env-nextjs
```

**산출물**

- `src/app/_lib/env.ts` — 모든 env Zod로 검증, `env` export
- 코드 전반의 `process.env.X` → `env.X`로 치환
- `next.config.ts`에 `env.ts` import (빌드 fail-fast 트리거)
- Vercel 프로젝트 생성, env 등록:
  - `DATABASE_URL` (Neon main branch)
  - `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_URL`
  - `OPENAI_API_KEY`
- GitHub Actions (`.github/workflows/ci.yml` — 별도 PR로): `pnpm typecheck && pnpm lint && pnpm test:run`
- Playwright E2E in CI는 Neon 테스트 브랜치 + dev signin 모드

**DoD**

- 프로덕션 URL에서 로그인 → 글 작성 → 공개 페이지까지 동작
- env 누락 시 빌드 단계에서 에러

**커밋 예시**

- `feat: t3-env로 환경변수 검증`
- `chore: Vercel 배포 + 프로덕션 env`

---

## AI 프롬프트 설계 (Phase 4 상세)

### 입력 직렬화

```
저장소: {owner/repo}
브랜치: {branch}

커밋 {N}개:

[1] {sha7} — {message_first_line}
작성자: {author} | {date_iso}
파일 ({len} files, +{add} / -{del}):
  - {path1}  (+12 / -3)
  - {path2}  (+0 / -47)
  ...

[2] ...
```

### 시스템 프롬프트 (초안)

````
당신은 시니어 소프트웨어 엔지니어이자 기술 블로거입니다.
주어진 GitHub 커밋들(메시지 + 변경 파일 목록)을 바탕으로 한국어 개발 블로그
초안을 Markdown으로 작성하세요.

요구사항:
- 제목은 변경의 본질을 한 줄로
- 첫 단락은 TL;DR (1~2문장)
- "변경 요약", "주요 변경 사항", "왜 이렇게 했나" 섹션 권장
- 코드 블록 사용 시 ```언어 펜스
- 추측 금지: 메시지/파일 경로에 명시되지 않은 동작은 단정하지 말 것
- 마케팅 톤 X, 회고/노트 톤 O
````

### 모델·튜닝

- 1차: `gpt-4o-mini` (싸고 빠름)
- 품질 부족 시 `gpt-4o`로 폴백 (사용자 토글 또는 자동)
- `temperature: 0.4`, `max_tokens: 1500` 시작점
- 응답 길이 제한 시 "잘림 감지 → 이어쓰기" 두 번째 호출 (Phase 4.5)

### 토큰 보호

- prompt 토큰 > 60K이면 파일 목록 압축 (top 변경량 30개로 자르기)
- 사용자별 일일 토큰 quota: env로 설정 (`USER_DAILY_TOKEN_LIMIT`), 초과 시 429

---

## Open Questions (기본값 채택, 필요 시 재논의)

| 항목                 | 기본값                              | 비고                                                    |
| -------------------- | ----------------------------------- | ------------------------------------------------------- |
| 공개 URL 형태        | `/blog/[slug]` (글로벌 unique slug) | `/u/[username]/[slug]` 더 견고하지만 username 정책 필요 |
| AI 응답 스트리밍     | 사용                                | UX 압도적, 추가 비용 X                                  |
| 모델 기본값          | `gpt-4o-mini`                       | Phase 4에서 실제 출력 보고 4o로 올릴지 결정             |
| 자동 저장 간격       | 1.5s debounce                       | 사용자 피드백 후 조정                                   |
| commit 다중선택 상한 | 20개                                | 토큰 폭발 방지                                          |
| 파일 변경 표시 상한  | 커밋당 30개                         | 가지치기 후 prompt에 포함                               |
| 다크 모드            | 비활성 (light only)                 | `next-themes`로 v2 추가                                 |
| i18n                 | 한국어 단일                         | UI/AI 모두 ko                                           |
| 이미지 업로드        | MVP 제외                            | 발행 글에서 GitHub raw URL 인라인은 허용                |

---

## 진행 순서 권장

1. **Phase 1 (Auth)** — 필수 토대. 1 PR.
2. **Phase 2 (GitHub API)** — Phase 1과 거의 동시에 가능. 1 PR.
3. **Phase 3 (생성 UI)** — Phase 2 완료 후. 1 PR.
4. **Phase 4 (AI 요약)** — Phase 3 완료 후. 가장 큰 PR — 가능하면 (a) prompt/서비스 + API, (b) UI/스트리밍 두 PR로 쪼개기.
5. **Phase 5 (편집기)** — 독립적, Phase 4와 병행 가능.
6. **Phase 6 (Saved + 발행)** — Phase 5와 한 PR로 묶어도 좋음.
7. **Phase 7 (공개 페이지)** — 단독 PR.
8. **Phase 8 (Settings)** — 작음. Phase 7과 묶기 가능.
9. **Phase 9 (배포/CI)** — 마지막. CI는 더 일찍 들어가도 OK.

**MVP 데모 가능 시점**: Phase 7 완료 시 (로그인 → 생성 → 편집 → 발행 → 공개 URL 열람).
