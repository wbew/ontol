import { homedir } from "node:os";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

// --- Types ---

export type ContentPart = {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  content?: string | ContentPart[];
  tool_use_id?: string;
};

export type SessionMessage = {
  type: "user" | "assistant";
  role: string;
  content: string | ContentPart[];
  timestamp: string;
  uuid: string;
};

export type SessionStats = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalToolCalls: number;
  uniqueTools: string[];
  model: string;
  userTurns: number;
  assistantTurns: number;
  durationMs: number;
};

export type ParsedSession = {
  messages: SessionMessage[];
  stats: SessionStats;
};

export type SessionSummary = {
  id: string;
  slug: string;
  firstMessage: string;
  timestamp: string;
  gitBranch: string;
  messageCount: number;
};

// --- Path encoding ---

export function encodeProjectPath(projectPath: string): string {
  return projectPath.replaceAll("/", "-");
}

export function sessionsDir(projectPath: string): string {
  return join(homedir(), ".claude", "projects", encodeProjectPath(projectPath));
}

// --- Session discovery ---

export function discoverSessions(projectPath: string): SessionSummary[] {
  const dir = sessionsDir(projectPath);

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const jsonlFiles = entries.filter((e) => e.endsWith(".jsonl"));
  const summaries: SessionSummary[] = [];

  for (const file of jsonlFiles) {
    const filePath = join(dir, file);
    const id = file.replace(".jsonl", "");
    const text = readFileSync(filePath, "utf-8");
    const lines = text.split("\n").filter(Boolean);

    let slug = "";
    let firstMessage = "";
    let timestamp = "";
    let gitBranch = "";
    let messageCount = 0;

    for (const line of lines) {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }

      const type = msg.type as string;
      if (type === "file-history-snapshot" || type === "progress") continue;

      messageCount++;

      if (!slug && msg.slug) {
        slug = msg.slug as string;
      }
      if (!timestamp && msg.timestamp) {
        timestamp = msg.timestamp as string;
      }
      if (!gitBranch && msg.gitBranch) {
        gitBranch = msg.gitBranch as string;
      }

      if (!firstMessage && type === "user") {
        const message = msg.message as { content?: string | ContentPart[] } | undefined;
        if (message?.content) {
          const raw =
            typeof message.content === "string"
              ? message.content
              : message.content
                  .filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join(" ");
          firstMessage = raw.slice(0, 100);
        }
      }
    }

    if (messageCount === 0) continue;

    summaries.push({
      id,
      slug: slug || id.slice(0, 8),
      firstMessage,
      timestamp,
      gitBranch,
      messageCount,
    });
  }

  summaries.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
  return summaries;
}

// --- Session parsing ---

export function parseSession(
  projectPath: string,
  sessionId: string,
): ParsedSession {
  const filePath = join(sessionsDir(projectPath), `${sessionId}.jsonl`);
  const text = readFileSync(filePath, "utf-8");
  const lines = text.split("\n").filter(Boolean);
  const messages: SessionMessage[] = [];

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let totalToolCalls = 0;
  const toolSet = new Set<string>();
  let model = "";
  let userTurns = 0;
  let assistantTurns = 0;
  let firstTimestamp = "";
  let lastTimestamp = "";

  for (const line of lines) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(line);
    } catch {
      continue;
    }

    const type = raw.type as string;
    if (type !== "user" && type !== "assistant") continue;

    const message = raw.message as
      | {
          role?: string;
          content?: string | ContentPart[];
          model?: string;
          stop_reason?: string | null;
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
        }
      | undefined;
    if (!message?.content) continue;

    // Skip meta/empty user messages
    if (type === "user" && typeof message.content === "string" && !message.content.trim()) continue;

    // Skip user messages that are just tool results (auto-generated, not real user input)
    if (
      type === "user" &&
      Array.isArray(message.content) &&
      message.content.every((p) => p.type === "tool_result")
    ) continue;

    // Skip assistant messages with no renderable content (e.g. empty thinking blocks)
    if (type === "assistant" && Array.isArray(message.content)) {
      const hasContent = message.content.some(
        (p) =>
          (p.type === "text" && p.text?.trim()) ||
          p.type === "tool_use" ||
          p.type === "tool_result" ||
          (p.type === "thinking" && p.thinking),
      );
      if (!hasContent) continue;
    }


    const ts = (raw.timestamp as string) || "";
    if (ts && !firstTimestamp) firstTimestamp = ts;
    if (ts) lastTimestamp = ts;

    if (type === "user") userTurns++;
    if (type === "assistant") {
      assistantTurns++;
      if (message.model && !model) model = message.model;
      if (message.usage) {
        inputTokens += message.usage.input_tokens || 0;
        outputTokens += message.usage.output_tokens || 0;
        cacheReadTokens += message.usage.cache_read_input_tokens || 0;
        cacheCreationTokens += message.usage.cache_creation_input_tokens || 0;
      }
      if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === "tool_use" && part.name) {
            totalToolCalls++;
            toolSet.add(part.name);
          }
        }
      }
    }

    messages.push({
      type: type as "user" | "assistant",
      role: message.role || type,
      content: message.content,
      timestamp: ts,
      uuid: (raw.uuid as string) || "",
    });
  }

  const durationMs =
    firstTimestamp && lastTimestamp
      ? new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime()
      : 0;

  return {
    messages,
    stats: {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      totalToolCalls,
      uniqueTools: [...toolSet].sort(),
      model,
      userTurns,
      assistantTurns,
      durationMs,
    },
  };
}
