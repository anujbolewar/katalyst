import json
from openai import AsyncOpenAI

from src.agents.base import BaseAgent
from src.agents.prompts.effort_estimator import EFFORT_ESTIMATOR_SYSTEM_PROMPT
from src.config.settings import settings


class EffortEstimatorAgent(BaseAgent):
    name = "effort_estimator"

    def __init__(self, client: AsyncOpenAI):
        super().__init__(client)
        self.system_prompt = self.load_prompt(EFFORT_ESTIMATOR_SYSTEM_PROMPT)

    async def run(self, input_data: dict, session_id: str) -> dict:
        nodes = input_data.get("nodes", [])
        edges = input_data.get("edges", [])
        constraints = input_data.get("constraints", [])

        user_message = json.dumps({
            "nodes": nodes,
            "edges": edges,
            "constraints": constraints,
        }, indent=2)

        async def call_llm():
            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.3,
            )
            content = response.choices[0].message.content
            return self._parse_json(content)

        try:
            result = await self._retry(call_llm)
            return {"scores": result.get("scores", [])}
        except Exception:
            return {
                "scores": [
                    {"node_id": n["id"], "effort_score": 50, "reasoning": "Default score (agent unavailable)"}
                    for n in nodes
                ]
            }
