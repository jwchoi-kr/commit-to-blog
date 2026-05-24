import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type CommitContext = {
  sha: string;
  message: string;
  files: Array<{ filename: string; status: string; patch: string | null }>;
};

const SYSTEM_PROMPT = `You are a developer blog writer. Given commit information and code diffs, write a concise developer blog post in Korean.

Structure your response as standard Markdown:
- First line: the post title as \`# Title\`
- Second line: blank
- Third line: a one-sentence excerpt as \`> excerpt\`
- Fourth line: blank
- Then: the blog post body

Length guideline: keep it short — 300 to 500 Korean characters for the body. Use at most one ## heading and a short bullet list if needed. No code blocks unless a snippet is essential to understanding. Skip boilerplate phrases like "안녕하세요" or closing remarks.

Focus on: what changed, why it was done, what problem it solves.`;

const PATCH_LIMIT = 3000;
const MAX_COMMITS = 10;

function buildUserMessage(commits: CommitContext[]): string {
  return commits
    .slice(0, MAX_COMMITS)
    .map((c) => {
      const files = c.files
        .map((f) => {
          const patch = f.patch ? f.patch.slice(0, PATCH_LIMIT) : "(binary or empty)";
          return `--- ${f.status}: ${f.filename}\n${patch}`;
        })
        .join("\n\n");
      return `### Commit: ${c.sha.slice(0, 7)}\nMessage: ${c.message}\n\nDiffs:\n${files}`;
    })
    .join("\n\n---\n\n");
}

export async function createSummarizeStream(
  commits: CommitContext[],
): Promise<{ stream: ReadableStream<Uint8Array>; model: string }> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openaiStream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(commits) },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of openaiStream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return { stream: readable, model };
}
