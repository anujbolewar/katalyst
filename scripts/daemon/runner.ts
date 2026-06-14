import { spawn, execSync, type ChildProcess } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { logger } from "./logger";
import { loadConfig } from "./config";
import { validateBinary, buildSafeEnv, scrubCredentials } from "./security";
import type { SpawnOptions, SpawnResult, ClaudeOutputMeta, ClaudeUsage } from "./types";

// tree-kill for killing process trees on Windows
import treeKill from "tree-kill";

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const MAX_STDOUT_SIZE = 10_000_000; // 10MB max captured output

// ─── Agent Binary Detection ──────────────────────────────────────────────────

interface ResolvedBinary {
  bin: string;
  prefixArgs: string[];
  originalPath: string;
  engineType: "opencode" | "claude" | "custom";
  skipValidation: boolean;
}

let cachedBinary: ResolvedBinary | null = null;

function resolveJsFromCmd(cmdPath: string): string | null {
  try {
    const content = readFileSync(cmdPath, "utf-8");
    const match = content.match(/%dp0%\\([^"]+\.js)/i) ||
                  content.match(/%dp0%\\([^\s"]+\.js)/i);
    if (match) {
      const dir = path.dirname(cmdPath);
      const jsPath = path.join(dir, match[1]);
      if (existsSync(jsPath)) return jsPath;
    }
  } catch { /* couldn't read .cmd file */ }
  const dir = path.dirname(cmdPath);
  const standard = path.join(dir, "node_modules", "@anthropic-ai", "claude-code", "cli.js");
  if (existsSync(standard)) return standard;
  return null;
}

function resolveBinary(name: string): string | null {
  const candidates: string[] = [];
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? "";
    const localAppData = process.env.LOCALAPPDATA ?? "";
    const userProfile = process.env.USERPROFILE ?? "";
    candidates.push(
      path.join(appData, "npm", `${name}.cmd`),
      path.join(appData, "npm", name),
      path.join(localAppData, "pnpm", `${name}.cmd`),
      path.join(localAppData, "pnpm", name),
      path.join(userProfile, ".local", "bin", name),
      path.join(userProfile, ".local", "bin", `${name}.exe`),
    );
  } else {
    const home = process.env.HOME ?? "";
    candidates.push(
      path.join(home, ".local", "bin", name),
      path.join(home, ".npm-global", "bin", name),
      `/usr/local/bin/${name}`,
      `/usr/bin/${name}`,
    );
  }
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

function resolveFromPath(name: string): string | null {
  try {
    const cmd = process.platform === "win32" ? `where ${name}` : `which ${name}`;
    const result = execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim().split("\n")[0].trim();
    if (result) return result;
  } catch { /* not found */ }
  return null;
}

function findAgentBinary(): ResolvedBinary {
  if (cachedBinary) return cachedBinary;

  const config = loadConfig();
  const engineType = config.execution.engineType;

  // 1. Custom engine — requires agentBinaryPath to be set
  if (engineType === "custom") {
    const customPath = config.execution.agentBinaryPath;
    if (customPath) {
      logger.info("runner", `Using custom engine: ${customPath}`);
      cachedBinary = { bin: customPath, prefixArgs: [], originalPath: customPath, engineType: "custom", skipValidation: true };
      return cachedBinary;
    }
    logger.error("runner", "Engine type is 'custom' but no agentBinaryPath configured. Set it in daemon-config.json or switch to auto.");
    throw new Error("Custom engine requires agentBinaryPath to be configured");
  }

  // 2. OpenCode only — skip claude fallback
  if (engineType === "opencode") {
    const opencodePath = resolveBinary("opencode") ?? resolveFromPath("opencode");
    if (opencodePath) {
      logger.info("runner", `Found opencode at: ${opencodePath}`);
      if (opencodePath.endsWith(".cmd")) {
        const jsEntry = resolveJsFromCmd(opencodePath);
        if (jsEntry) {
          logger.info("runner", `Resolved .cmd shim → ${jsEntry} (via node.exe)`);
          cachedBinary = { bin: process.execPath, prefixArgs: [jsEntry], originalPath: opencodePath, engineType: "opencode", skipValidation: false };
          return cachedBinary;
        }
      }
      cachedBinary = { bin: opencodePath, prefixArgs: [], originalPath: opencodePath, engineType: "opencode", skipValidation: false };
      return cachedBinary;
    }
    logger.error("runner", "Engine type is 'opencode' but binary not found.");
    throw new Error("OpenCode binary not found. Install opencode or switch engineType to auto/claude.");
  }

  // 3. Claude only — skip opencode detection
  if (engineType === "claude") {
    const claudePath = resolveBinary("claude") ?? resolveFromPath("claude");
    if (claudePath) {
      logger.info("runner", `Found claude at: ${claudePath}`);
      if (claudePath.endsWith(".cmd")) {
        const jsEntry = resolveJsFromCmd(claudePath);
        if (jsEntry) {
          logger.info("runner", `Resolved .cmd shim → ${jsEntry} (via node.exe)`);
          cachedBinary = { bin: process.execPath, prefixArgs: [jsEntry], originalPath: claudePath, engineType: "claude", skipValidation: false };
          return cachedBinary;
        }
      }
      cachedBinary = { bin: claudePath, prefixArgs: [], originalPath: claudePath, engineType: "claude", skipValidation: false };
      return cachedBinary;
    }
    logger.error("runner", "Engine type is 'claude' but binary not found.");
    throw new Error("Claude Code binary not found. Install claude (npm i -g @anthropic-ai/claude-code) or switch engineType to auto.");
  }

  // 4. Auto-detect — opencode priority, claude fallback
  const opencodePath = resolveBinary("opencode") ?? resolveFromPath("opencode");
  if (opencodePath) {
    logger.info("runner", `Found opencode at: ${opencodePath}`);
    if (opencodePath.endsWith(".cmd")) {
      const jsEntry = resolveJsFromCmd(opencodePath);
      if (jsEntry) {
        logger.info("runner", `Resolved .cmd shim → ${jsEntry} (via node.exe)`);
        cachedBinary = { bin: process.execPath, prefixArgs: [jsEntry], originalPath: opencodePath, engineType: "opencode", skipValidation: false };
        return cachedBinary;
      }
    }
    cachedBinary = { bin: opencodePath, prefixArgs: [], originalPath: opencodePath, engineType: "opencode", skipValidation: false };
    return cachedBinary;
  }

  // Fallback: claude
  const claudePath = resolveBinary("claude") ?? resolveFromPath("claude");
  if (claudePath) {
    logger.info("runner", `Found claude at: ${claudePath}`);
    if (claudePath.endsWith(".cmd")) {
      const jsEntry = resolveJsFromCmd(claudePath);
      if (jsEntry) {
        logger.info("runner", `Resolved .cmd shim → ${jsEntry} (via node.exe)`);
        cachedBinary = { bin: process.execPath, prefixArgs: [jsEntry], originalPath: claudePath, engineType: "claude", skipValidation: false };
        return cachedBinary;
      }
    }
    cachedBinary = { bin: claudePath, prefixArgs: [], originalPath: claudePath, engineType: "claude", skipValidation: false };
    return cachedBinary;
  }

  // Last resort — return "claude" and let spawn fail
  logger.warn("runner", "Could not auto-detect opencode or claude. Set 'agentBinaryPath' in daemon-config.json.");
  return { bin: "claude", prefixArgs: [], originalPath: "claude", engineType: "claude", skipValidation: false };
}

// ─── Claude Code Output Parser ───────────────────────────────────────────────

/**
 * Parse Claude Code's JSON stdout (--output-format json) into structured metadata.
 * Returns null-safe fields for every property. Handles non-JSON gracefully.
 */
export function parseClaudeOutput(stdout: string): ClaudeOutputMeta {
  const empty: ClaudeOutputMeta = {
    totalCostUsd: null,
    numTurns: null,
    subtype: null,
    sessionId: null,
    isError: false,
    usage: null,
  };

  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;

    const meta: ClaudeOutputMeta = {
      totalCostUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : null,
      numTurns: typeof parsed.num_turns === "number" ? parsed.num_turns : null,
      subtype: typeof parsed.subtype === "string" ? parsed.subtype : null,
      sessionId: typeof parsed.session_id === "string" ? parsed.session_id : null,
      isError: parsed.is_error === true,
      usage: null,
    };

    // Parse nested usage object
    if (parsed.usage && typeof parsed.usage === "object") {
      const u = parsed.usage as Record<string, unknown>;
      const usage: ClaudeUsage = {
        inputTokens: typeof u.input_tokens === "number" ? u.input_tokens : 0,
        outputTokens: typeof u.output_tokens === "number" ? u.output_tokens : 0,
        cacheReadInputTokens: typeof u.cache_read_input_tokens === "number" ? u.cache_read_input_tokens : 0,
        cacheCreationInputTokens: typeof u.cache_creation_input_tokens === "number" ? u.cache_creation_input_tokens : 0,
      };
      meta.usage = usage;
    }

    return meta;
  } catch {
    return empty;
  }
}

// ─── Agent Runner ────────────────────────────────────────────────────────────

export class AgentRunner {
  private cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd ?? WORKSPACE_ROOT;
  }

  /**
   * Spawn a Claude Code session with the given prompt.
   * Returns when the process exits or times out.
   */
  async spawnAgent(opts: SpawnOptions): Promise<SpawnResult & { pid: number }> {
    const resolved = findAgentBinary();

    if (!resolved.skipValidation && !validateBinary(resolved.originalPath)) {
      throw new Error(`Security: binary "${resolved.originalPath}" is not in the allowed list`);
    }

    const config = loadConfig();

    // Build args array
    let args: string[];
    if (resolved.engineType === "opencode") {
      args = [
        ...resolved.prefixArgs,
        "run", opts.prompt,
        "--format", "json",
        "--model", config.execution.ollama?.enabled && config.execution.ollama?.model
          ? `opencode-go/${config.execution.ollama.model}`
          : "opencode-go/deepseek-v4-pro",
      ];
    } else {
      args = [
        ...resolved.prefixArgs,
        "-p", opts.prompt,
        "--output-format", "json",
        "--max-turns", String(opts.maxTurns),
      ];

      // Permission/tool flags only apply to claude, not custom engines
      if (resolved.engineType !== "custom") {
        if (opts.skipPermissions) {
          args.push("--dangerously-skip-permissions");
          logger.security("runner", "Spawning with --dangerously-skip-permissions");
        } else if (opts.allowedTools && opts.allowedTools.length > 0) {
          args.push("--allowedTools", ...opts.allowedTools);
          logger.info("runner", `Allowed tools: ${opts.allowedTools.join(", ")}`);
        }
      }
    }

    // Build safe env, injecting Ollama vars if enabled
    let safeEnv = buildSafeEnv({ agentTeams: opts.agentTeams });

    if (config.execution.ollama?.enabled && config.execution.ollama?.model) {
      safeEnv.OPENAI_API_BASE = "http://localhost:11434/v1";
      safeEnv.OPENAI_API_KEY = "ollama";
      logger.info("runner", `Ollama mode: model=${config.execution.ollama.model}`);
    }

    logger.debug("runner", `Spawning (${resolved.engineType}): ${resolved.bin} ...`);
    logger.debug("runner", `CWD: ${opts.cwd || this.cwd}`);

    return new Promise<SpawnResult & { pid: number }>((resolve) => {
      const child: ChildProcess = spawn(resolved.bin, args, {
        cwd: opts.cwd || this.cwd,
        env: safeEnv as NodeJS.ProcessEnv,
        stdio: ["ignore", "pipe", "pipe"] as const,
        windowsHide: true,
      });

      const pid = child.pid ?? 0;

      // Notify caller of PID immediately after spawn (for tracking in respond-runs, etc.)
      opts.onSpawned?.(pid);

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      // Capture stdout with size limit
      child.stdout?.on("data", (chunk: Buffer) => {
        if (stdout.length < MAX_STDOUT_SIZE) {
          stdout += chunk.toString();
        }
      });

      // Capture stderr with size limit
      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderr.length < MAX_STDOUT_SIZE) {
          stderr += chunk.toString();
        }
      });

      // Timeout enforcement
      const timeoutMs = opts.timeoutMinutes * 60 * 1000;
      const timer = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        logger.warn("runner", `Process ${pid} timed out after ${opts.timeoutMinutes} minutes — killing`);

        // Kill the entire process tree (important on Windows)
        treeKill(pid, "SIGTERM", (err?: Error) => {
          if (err) {
            logger.error("runner", `Failed to kill process tree ${pid}: ${err.message}`);
            try { child.kill("SIGKILL"); } catch { /* best effort */ }
          }
        });
      }, timeoutMs);

      // Process exit
      child.on("close", (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        // Diagnostic logging on failure — helps debug silent exit code 1 issues
        if (exitCode !== null && exitCode !== 0 && !timedOut) {
          if (stderr.trim()) {
            logger.error("runner", `Process ${pid} stderr: ${scrubCredentials(stderr.slice(0, 500))}`);
          }
          if (stdout.trim()) {
            logger.debug("runner", `Process ${pid} stdout (first 500 chars): ${scrubCredentials(stdout.slice(0, 500))}`);
          }
          if (!stderr.trim() && !stdout.trim()) {
            logger.warn("runner", `Process ${pid} exited with code ${exitCode} but produced no output`);
          }
        }

        resolve({
          pid,
          exitCode,
          stdout: scrubCredentials(stdout),
          stderr: scrubCredentials(stderr),
          timedOut,
        });
      });

      // Spawn error (binary not found, etc.)
      child.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const binPath = resolved.originalPath;
        if (err.message.includes("ENOENT")) {
          logger.error("runner", `Agent binary not found (${binPath}). Set "agentBinaryPath" in daemon-config.json or install opencode/claude globally.`);
          // Clear cached path so next attempt retries detection
          cachedBinary = null;
        } else {
          logger.error("runner", `Spawn error: ${err.message}`);
        }
        resolve({
          pid,
          exitCode: 1,
          stdout: "",
          stderr: err.message.includes("ENOENT")
            ? `Claude binary not found. Install Claude Code (npm i -g @anthropic-ai/claude-code) or set "claudeBinaryPath" in Daemon config.`
            : scrubCredentials(err.message),
          timedOut: false,
        });
      });
    });
  }

  /**
   * Kill a running agent session by PID.
   */
  killSession(pid: number): Promise<void> {
    return new Promise((resolve) => {
      treeKill(pid, "SIGTERM", (err?: Error) => {
        if (err) {
          logger.error("runner", `Failed to kill session ${pid}: ${err.message}`);
        } else {
          logger.info("runner", `Killed session ${pid}`);
        }
        resolve();
      });
    });
  }
}
