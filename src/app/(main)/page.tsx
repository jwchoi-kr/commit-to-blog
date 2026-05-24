import { CreateFlow } from "./_components/CreateFlow";

export default function MyBlogPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-xl font-semibold">My Blog</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section aria-label="Create flow">
          <CreateFlow />
        </section>
        <section
          aria-label="Draft preview"
          className="text-muted-foreground flex min-h-72 items-center justify-center rounded-md border border-dashed text-sm"
        >
          AI 초안 미리보기 자리 (Phase 4)
        </section>
      </div>
    </main>
  );
}
