import json
import re
from openai import AsyncOpenAI

from src.agents.base import BaseAgent, AgentError
from src.agents.prompts.triage import TRIAGE_SYSTEM_PROMPT
from src.config.settings import settings


class TriageProxyAgent(BaseAgent):
    name = "triage_proxy"

    def __init__(self, client: AsyncOpenAI):
        super().__init__(client)
        self.system_prompt = self.load_prompt(TRIAGE_SYSTEM_PROMPT)

    async def run(self, input_data: dict, session_id: str) -> dict:
        raw_prompt = input_data.get("raw_prompt", "")

        self._validate_input(raw_prompt)
        self.validate_user_input(raw_prompt)

        async def call_llm():
            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": raw_prompt},
                ],
                temperature=0.3,
            )
            content = response.choices[0].message.content
            return self._parse_json(content)

        result = await self._retry(call_llm)

        return {
            "constraints": result.get("constraints", []),
            "clarifications": result.get("clarifications", []),
        }

    def _validate_input(self, raw_prompt: str) -> None:
        cleaned = raw_prompt.strip()
        if not cleaned:
            raise AgentError(
                code="K-4220",
                message="Input is empty or whitespace",
                agent_name=self.name,
            )

        if len(cleaned) < 10:
            raise AgentError(
                code="K-4220",
                message="Input is too short to be recognized as a project goal",
                agent_name=self.name,
            )

        # Basic entropy/junk check: check if it's just repeated characters or lacks letters entirely
        if not re.search(r"[a-zA-Z]", cleaned) or len(set(cleaned)) < 3:
            raise AgentError(
                code="K-4220",
                message="Input not recognized as a valid project goal",
                agent_name=self.name,
            )
