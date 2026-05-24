type SavePostInput = {
  title: string;
  contentMd: string;
  excerpt: string;
  repoFullName: string;
  branch: string;
  commitShas: string[];
  aiModel: string;
};

export async function savePost(input: SavePostInput): Promise<{ id: string }> {
  const res = await fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `저장 실패 (${res.status})`);
  }
  return res.json() as Promise<{ id: string }>;
}
