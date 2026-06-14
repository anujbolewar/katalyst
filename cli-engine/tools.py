"""Tools available to the custom Python agent engine.

Each tool is defined with an OpenAI-compatible function calling schema
and dispatched to the corresponding implementation function.
"""

import subprocess
import os
import re
import glob as glob_mod
from typing import Any

TOOL_MAX_OUTPUT = 100_000

# ─── Tool Schemas (OpenAI function format) ────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "bash_command",
            "description": "Execute a shell command. Use for git, npm, ls, cat, grep, find, and other terminal operations. The command runs in the project root and is killed after 30 seconds if it hangs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to run",
                    },
                },
                "required": ["command"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file at the given absolute path. Use offset and limit to read specific line ranges of large files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file to read",
                    },
                    "offset": {
                        "type": "integer",
                        "description": "Line number to start reading from (0-based)",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of lines to read",
                    },
                },
                "required": ["path"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create a new file or completely overwrite an existing file. Creates parent directories automatically.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path where the file should be written",
                    },
                    "content": {
                        "type": "string",
                        "description": "Text content to write to the file",
                    },
                },
                "required": ["path", "content"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "glob_search",
            "description": "Find files matching a glob pattern. Use **/*.ts to recursively find all TypeScript files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern like **/*.ts or src/**/*.jsx",
                    },
                },
                "required": ["pattern"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "grep_search",
            "description": "Search for a regex pattern across files in a directory. Returns matching lines with file paths and line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Regular expression to search for",
                    },
                    "directory": {
                        "type": "string",
                        "description": "Directory to search in (defaults to project root)",
                    },
                    "include": {
                        "type": "string",
                        "description": "Glob pattern to filter files (e.g. *.ts)",
                    },
                },
                "required": ["pattern"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "task_complete",
            "description": "Call this when the task is fully complete. Provide a summary of what was accomplished.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Summary of what was accomplished",
                    },
                },
                "required": ["summary"],
                "additionalProperties": False,
            },
        },
    },
]


# ─── Tool Implementations ────────────────────────────────────────────────

def _safe_path(filepath: str, base_dir: str) -> str:
    resolved = os.path.realpath(os.path.join(base_dir, filepath))
    base_real = os.path.realpath(base_dir)
    if not resolved.startswith(base_real + os.sep) and resolved != base_real:
        raise ValueError(f"Path escapes workspace: {filepath}")
    return resolved


def dispatch(name: str, input_data: dict[str, Any], workspace: str) -> str:
    if name == "bash_command":
        return _bash(input_data["command"], workspace)

    if name == "read_file":
        offset = input_data.get("offset")
        limit = input_data.get("limit")
        return _read(input_data["path"], workspace, offset, limit)

    if name == "write_file":
        return _write(input_data["path"], input_data["content"], workspace)

    if name == "glob_search":
        return _glob(input_data["pattern"], workspace)

    if name == "grep_search":
        return _grep(
            input_data["pattern"],
            workspace,
            input_data.get("directory"),
            input_data.get("include"),
        )

    if name == "task_complete":
        return f"TASK_COMPLETE: {input_data['summary']}"

    return f"Unknown tool: {name}"


def _bash(command: str, workspace: str) -> str:
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=workspace,
        )
        out = result.stdout
        if result.stderr:
            out += "\n[stderr]\n" + result.stderr
        if len(out) > TOOL_MAX_OUTPUT:
            out = out[:TOOL_MAX_OUTPUT] + "\n... (truncated)"
        if result.returncode != 0:
            out += f"\n[exit code: {result.returncode}]"
        return out.strip() or "(no output)"
    except subprocess.TimeoutExpired:
        return "[error] Command timed out after 30 seconds"
    except Exception as e:
        return f"[error] {e}"


def _read(path: str, workspace: str, offset: int | None, limit: int | None) -> str:
    try:
        full = _safe_path(path, workspace)
        with open(full, "r") as f:
            lines = f.readlines()

        if limit is not None and offset is not None:
            lines = lines[offset : offset + limit]
        elif offset is not None:
            lines = lines[offset:]
        elif limit is not None:
            lines = lines[:limit]

        content = "".join(lines)
        if len(content) > TOOL_MAX_OUTPUT:
            content = content[:TOOL_MAX_OUTPUT] + "\n... (truncated)"
        return content or "(empty file)"
    except FileNotFoundError:
        return f"[error] File not found: {path}"
    except ValueError as e:
        return f"[error] {e}"
    except Exception as e:
        return f"[error] {e}"


def _write(path: str, content: str, workspace: str) -> str:
    try:
        full = _safe_path(path, workspace)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w") as f:
            f.write(content)
        return f"File written: {path}"
    except ValueError as e:
        return f"[error] {e}"
    except Exception as e:
        return f"[error] {e}"


def _glob(pattern: str, workspace: str) -> str:
    try:
        matches = glob_mod.glob(pattern, root_dir=workspace, recursive=True)
        matches.sort()
        if not matches:
            return "(no files found)"
        return "\n".join(matches[:200])
    except Exception as e:
        return f"[error] {e}"


def _grep(pattern: str, workspace: str, directory: str | None, include: str | None) -> str:
    try:
        search_dir = os.path.join(workspace, directory) if directory else workspace
        compiled = re.compile(pattern)
        results = []
        target_pattern = include or "*"

        for filepath in glob_mod.glob(
            f"**/{target_pattern}", root_dir=search_dir, recursive=True
        ):
            full = os.path.join(search_dir, filepath)
            if not os.path.isfile(full):
                continue
            try:
                with open(full, "r") as f:
                    for i, line in enumerate(f, 1):
                        if compiled.search(line):
                            results.append(f"{filepath}:{i}: {line.rstrip()}")
                            if len(results) >= 200:
                                break
                if len(results) >= 200:
                    break
            except (UnicodeDecodeError, PermissionError):
                continue

        if not results:
            return "(no matches)"
        return "\n".join(results[:200])
    except Exception as e:
        return f"[error] {e}"
