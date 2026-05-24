import { CreateFlow } from "./_components/CreateFlow";

export default function MyBlogPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-xl font-semibold">My Blog</h1>
      <CreateFlow />
    </main>
  );
}
