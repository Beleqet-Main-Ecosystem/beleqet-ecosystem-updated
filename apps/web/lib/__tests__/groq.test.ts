import { completeWithGroq, GroqError } from "../groq";

function groqReplies(content: string) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
}

function sentBody(fetchMock: jest.Mock) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe("completeWithGroq", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("refuses without a key, so the routes answer 503", async () => {
    delete process.env.GROQ_API_KEY;
    await expect(completeWithGroq([{ role: "user", content: "hi" }])).rejects.toMatchObject({ status: 503 });
  });

  it("keeps gpt-oss's thinking short and leaves room for the answer", async () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.GROQ_MODEL = "";
    const fetchMock = groqReplies(" A summary. ");
    global.fetch = fetchMock as never;

    await expect(completeWithGroq([{ role: "user", content: "hi" }], 180)).resolves.toBe("A summary.");
    expect(sentBody(fetchMock)).toMatchObject({
      model: "openai/gpt-oss-20b",
      reasoning_effort: "low",
      max_completion_tokens: 180 + 256,
    });
  });

  it("sends other models the plain limit and no reasoning setting", async () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
    const fetchMock = groqReplies("Hello");
    global.fetch = fetchMock as never;

    await completeWithGroq([{ role: "user", content: "hi" }], 180);
    const body = sentBody(fetchMock);
    expect(body.max_completion_tokens).toBe(180);
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("treats an empty answer as a failure", async () => {
    process.env.GROQ_API_KEY = "test-key";
    global.fetch = groqReplies("") as never;
    await expect(completeWithGroq([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(GroqError);
  });
});
