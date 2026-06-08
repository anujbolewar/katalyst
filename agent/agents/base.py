from abc import ABC, abstractmethod
import asyncio
from typing import Any, Callable


class AgentError(Exception):
    def __init__(self, code: str, message: str, agent_name: str = ""):
        self.code = code
        self.message = message
        self.agent_name = agent_name
        super().__init__(message)


import json
import os
import re
from openai import AsyncOpenAI

class BaseAgent(ABC):
    name: str = ""

    def __init__(self, client: AsyncOpenAI):
        self.client = client

    def load_prompt(self, default_prompt: str) -> str:
        manifest_path = "backend/prompts/manifest.json"
        if not os.path.exists(manifest_path):
            raise AgentError("K-5003", f"Prompt manifest not found at {manifest_path}", self.name)
            
        try:
            with open(manifest_path, "r") as f:
                manifest = json.load(f)
            
            if self.name in manifest:
                compiled_path = manifest[self.name]["compiled_path"]
                if os.path.exists(compiled_path):
                    with open(compiled_path, "r") as f:
                        compiled = json.load(f)
                        # Assume compiled prompts are strings; if dict, this handles it cleanly
                        return compiled if isinstance(compiled, str) else json.dumps(compiled)
                else:
                    raise AgentError("K-5003", f"Compiled prompt not found at {compiled_path}", self.name)
        except Exception as e:
            raise AgentError("K-5003", f"Failed to load prompt: {str(e)}", self.name)
            
        return default_prompt

    def _parse_json(self, content: str) -> dict:
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL | re.IGNORECASE)
        try:
            if match:
                return json.loads(match.group(1))
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise AgentError("K-5002", f"Failed to parse LLM JSON output: {str(e)}", self.name)

    def validate_user_input(self, input_text: str) -> None:
        patterns = [
            r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)",
            r"you\s+are\s+now\s+(a|an|the)\s+",
            r"system\s*:\s*",
            r"<\|?(system|im_start|endoftext)\|?>",
            r"\[INST\]|\[\/INST\]|<<SYS>>"
        ]
        for pattern in patterns:
            if re.search(pattern, input_text, re.IGNORECASE):
                raise AgentError("K-5001", "Prompt injection detected in user input", self.name)

    @abstractmethod
    async def run(self, input_data: dict, session_id: str) -> dict:
        pass

    async def _retry(
        self,
        fn: Callable,
        max_retries: int = 3,
        base_delay: float = 1.0,
    ) -> Any:
        last_error = Exception("Retry failed")
        if max_retries <= 0:
            raise ValueError("max_retries must be > 0")
        for attempt in range(max_retries):
            try:
                return await fn()
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    await asyncio.sleep(delay)
        raise last_error
