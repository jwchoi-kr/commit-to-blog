---
name: project-tree
description: 현재 프로젝트의 파일 구조를 트리 형태로 보여주되, 테스트 파일·생성 파일·설정 파일 등 부수적인 파일은 제외하고 각 파일/디렉토리 옆에 한 줄 설명 주석을 달아 출력한다. 사용자가 "파일 구조 보여줘", "tree 구조", "프로젝트 구조 알려줘", "어떤 파일 있어", "폴더 구조", "소스 구조", "코드 구조", "구조 파악" 같은 말을 하면 반드시 이 스킬을 사용하라. 단, "파일 읽어줘"처럼 특정 파일 하나를 지칭하는 경우에는 사용하지 않는다.
---

## 목적

노이즈를 걷어낸 핵심 파일 트리에 각 항목의 역할 주석을 달아, 처음 보는 사람도 프로젝트 구조를 한눈에 파악하게 한다.

## 실행 순서

### 1. 파일 목록 수집

아래 명령을 실행해 관련 경로를 가져온다.

```bash
find . \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/.next/*' \
  -not -path '*/src/generated/*' \
  -not -path '*/tests/*' \
  -not -path '*/.husky/*' \
  -not -name '*.test.ts' \
  -not -name '*.test.tsx' \
  -not -name '*.spec.ts' \
  -not -name '*.spec.tsx' \
  -not -name '.gitkeep' \
  -not -name 'pnpm-lock.yaml' \
  -not -name '*.ico' \
  -not -name '*.png' \
  -not -name '*.jpg' \
  -not -name '*.svg' \
  | sort
```

사용자가 "테스트 포함해서" 라고 요청하면 `*.test.*` / `*.spec.*` / `tests/` 제외 조건을 빼고 재실행한다.

### 2. 트리 변환 + 주석 작성

경로 목록을 디렉토리 계층 트리로 변환하면서, 각 항목 오른쪽에 `  # 한 줄 설명` 주석을 달아 출력한다.

주석 작성 방법:

- **파일명·경로만으로 역할이 명확한 경우** (예: `prisma/schema.prisma`, `components.json`, `globals.css`) → 즉시 작성
- **내용을 봐야 알 수 있는 파일** → Read 툴로 짧게 확인 후 작성
- 디렉토리는 디렉토리 전체 역할을 한 줄로 요약
- 설명은 **한국어**, **구체적**으로 ("유틸 함수" 대신 "cn() 클래스 병합 + 공용 유틸")

### 3. 출력 포맷

```
<디렉토리>/                   # 디렉토리 설명
  <하위디렉토리>/              # 하위 디렉토리 설명
    <파일.ts>                  # 파일 역할 설명
```

- 들여쓰기: depth당 스페이스 2개
- 디렉토리명에는 `/` 접미사
- 주석 컬럼은 정렬하지 않아도 됨 — 바로 옆에 붙여도 충분

### 출력 예시

```
src/
  app/
    (main)/                              # 인증 후 메인 영역 라우트 그룹
      _components/
        CreateFlow.tsx                   # 블로그 생성 플로우 전체 컨트롤러 (repo→branch→commit→generate)
        DraftPanel.tsx                   # 우측 AI 초안 패널 (스트리밍 뷰 / 편집 뷰)
        StepCard.tsx                     # 단계별 카드 UI 래퍼 (번호 + 제목)
        createFlow.reducer.ts            # CreateFlow 상태 관리 reducer + parseDraft()
      page.tsx                           # / 홈 페이지
    _components/
      SearchableCombobox.tsx             # 검색 가능한 단일/다중 선택 Combobox 범용 컴포넌트
      ui/                                # shadcn/ui 프리미티브 (button, card, dialog …)
    _lib/
      github.ts                          # 서버 사이드 GitHub API 래퍼 (Octokit) + diff 조회
      github-client.ts                   # 클라이언트 사이드 GitHub fetch 헬퍼 + Zod 스키마
      ai.ts                              # OpenAI 스트리밍 요약 — diff → Markdown 블로그 초안
      prisma.ts                          # PrismaClient 싱글톤 (Neon Postgres 연결)
      auth.ts                            # Auth.js v5 설정 + GitHub OAuth
      api.ts                             # Route Handler 공통 헬퍼 (requireUserId, withRouteHandler)
    api/
      ai/summarize/route.ts              # POST /api/ai/summarize — diff 수집 → OpenAI 스트리밍 응답
      github/                            # GET /api/github/{repos,branches,commits} 프록시
      posts/route.ts                     # POST /api/posts — 블로그 초안 DB 저장
    globals.css                          # Tailwind v4 전역 스타일 (@import "tailwindcss")
prisma/
  schema.prisma                          # DB 스키마 (User, Post, Auth.js 모델)
```

## 주의사항

- 트리 출력 후 **별도 장황한 설명을 추가하지 않는다** — 주석으로 이미 충분하다.
- `src/generated/`, `node_modules/`, `.next/` 는 항상 제외한다.
- 응답은 코드 블록(`\`\`\``) 없이 들여쓰기 텍스트로 출력해도 되고, 가독성을 위해 코드 블록으로 감싸도 된다.
