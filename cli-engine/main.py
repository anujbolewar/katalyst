#!/usr/bin/env python3
"""Custom Python Agent Engine for Katalyst daemon.

Usage:
    main.py -p "<prompt>" --output-format json --max-turns <N>

Uses OpenAI-compatible API with a ReAct tool-calling loop.
Outputs JSON matching ClaudeOutputMeta format to stdout.
"""

import argparse
import json
import os
import sys
from typing import Any

# Load .env file if present (secrets written by Settings page)
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from tools import TOOLS, dispatch


# ─── Config ────────────────────────────────────────────────────────────────

MODEL = "deepseek/deepseek-chat"
MAX_TOKENS = 8192
WORKSPACE = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))

SYSTEM_PROMPT = """You are an expert software engineering agent. You have access to tools for:

- bash_command: Run shell commands (git, npm, ls, cat, grep, find, etc.)
- read_file: Read any file in the project
- write_file: Create or overwrite files
- glob_search: Find files by pattern
- grep_search: Search file contents with regex
- task_complete: Signal that the task is finished

IMPORTANT RULES:
1. Work in the project root directory.
2. Read files before editing them.
3. When the task is complete, call task_complete with a summary.
4. If you encounter errors, try alternative approaches.
5. Do not ask questions — make decisions and proceed.
6. Keep responses concise and action-oriented.
"""


# ─── OpenAI Client ─────────────────────────────────────────────────────────

def get_client():
    from openai import OpenAI

    api_key = _resolve_api_key()
    base_url = (
        os.environ.get("CUSTOM_ENGINE_BASE_URL") or
        os.environ.get("OPENAI_API_BASE") or
        "https://openrouter.ai/api/v1"
    )
    return OpenAI(api_key=api_key, base_url=base_url)


def _resolve_api_key() -> str:
    # 1. OPENROUTER_API_KEY env var
    key = os.environ.get("OPENROUTER_API_KEY")
    if key and key not in ("", "your_api_key_here", "sk-your-key-here"):
        return key

    # 2. OPENAI_API_KEY env var
    key = os.environ.get("OPENAI_API_KEY")
    if key and key not in ("", "your_api_key_here", "sk-your-key-here"):
        return key

    # 3. CUSTOM_ENGINE_API_KEY from .env (written by settings page)
    key = os.environ.get("CUSTOM_ENGINE_API_KEY")
    if key:
        return key

    # 4. Read opencode-go key from opencode's auth.json
    key = _read_opencode_key()
    if key:
        return key

    # 5. Read openrouter key from auth.json
    key = _read_openrouter_key()
    if key:
        return key

    raise RuntimeError(
        "No API key found. Set CUSTOM_ENGINE_API_KEY or OPENROUTER_API_KEY "
        "in the Settings page, or configure one in your environment."
    )


def _read_opencode_key() -> str | None:
    import json
    auth_paths = [
        os.path.expanduser("~/.local/share/opencode/auth.json"),
        os.path.expanduser("~/.opencode/auth.json"),
    ]
    for auth_path in auth_paths:
        try:
            with open(auth_path) as f:
                data = json.load(f)
            entry = data.get("opencode-go", {})
            key = entry.get("key")
            if key and key not in ("", "your_api_key_here"):
                return key
        except (FileNotFoundError, KeyError, json.JSONDecodeError):
            continue
    return None


def _read_openrouter_key() -> str | None:
    try:
        with open(os.path.expanduser("~/.local/share/opencode/auth.json")) as f:
            data = json.load(f)
        # OpenRouter credentials are in account.json under the "openrouter" service
        account_path = os.path.expanduser("~/.local/share/opencode/account.json")
        with open(account_path) as f:
            accounts = json.load(f)
        for a in accounts.get("accounts", {}).values():
            if a.get("serviceID") == "openrouter":
                key = a.get("credential", {}).get("key")
                if key and key not in ("", "your_api_key_here"):
                    return key
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        pass
    return None


def call_openai(
    client, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
) -> dict[str, Any]:
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=messages,
        tools=tools,
    )
    choice = response.choices[0]
    msg = choice.message

    tool_calls = []
    if msg.tool_calls:
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                args = {}
            tool_calls.append(
                {
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": args,
                }
            )

    return {
        "content": msg.content or "",
        "tool_calls": tool_calls,
        "finish_reason": choice.finish_reason,
        "usage": {
            "input_tokens": response.usage.prompt_tokens if response.usage else 0,
            "output_tokens": response.usage.completion_tokens if response.usage else 0,
            "cache_read_input_tokens": 0,
            "cache_creation_input_tokens": 0,
        },
    }


# ─── ReAct Loop ────────────────────────────────────────────────────────────

def run_loop(prompt: str, max_turns: int) -> dict[str, Any]:
    client = get_client()

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    total_input = 0
    total_output = 0
    final_result = ""
    subtype = "success"
    is_error = False

    for turn in range(max_turns):
        try:
            response = call_openai(client, messages, TOOLS)
        except Exception as e:
            return {
                "total_cost_usd": 0,
                "num_turns": turn,
                "subtype": "error_api",
                "session_id": None,
                "is_error": True,
                "result": f"API error on turn {turn + 1}: {e}",
                "usage": {
                    "input_tokens": total_input,
                    "output_tokens": total_output,
                    "cache_read_input_tokens": 0,
                    "cache_creation_input_tokens": 0,
                },
            }

        usage = response["usage"]
        total_input += usage["input_tokens"]
        total_output += usage["output_tokens"]

        content = response["content"]
        tool_calls = response["tool_calls"]

        # Append assistant message
        assistant_msg: dict[str, Any] = {"role": "assistant"}
        if content:
            assistant_msg["content"] = content
        if tool_calls:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": json.dumps(tc["arguments"]),
                    },
                }
                for tc in tool_calls
            ]
        messages.append(assistant_msg)

        # If no tool calls, agent is done
        if not tool_calls or response["finish_reason"] == "stop":
            final_result = content
            break

        # Execute tool calls and collect results
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_input = tc["arguments"]
            result_text = dispatch(tool_name, tool_input, WORKSPACE)

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result_text,
                }
            )

            if tool_name == "task_complete":
                final_result = tool_input.get("summary", result_text)
                subtype = "success"
                break

        if any(tc["name"] == "task_complete" for tc in tool_calls):
            break

    else:
        subtype = "error_max_turns"
        is_error = True
        final_result = final_result or "Max turns reached without completion."

    return {
        "total_cost_usd": 0,
        "num_turns": turn + 1,
        "subtype": subtype,
        "session_id": None,
        "is_error": is_error,
        "result": final_result.strip(),
        "usage": {
            "input_tokens": total_input,
            "output_tokens": total_output,
            "cache_read_input_tokens": 0,
            "cache_creation_input_tokens": 0,
        },
    }


# ─── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Katalyst Custom Agent Engine")
    parser.add_argument("-p", "--prompt", required=True, help="Task prompt")
    parser.add_argument(
        "--output-format", default="json", help="Output format (ignored, always JSON)"
    )
    parser.add_argument(
        "--max-turns", type=int, default=25, help="Maximum tool-calling turns"
    )
    args = parser.parse_args()

    result = run_loop(args.prompt, args.max_turns)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
