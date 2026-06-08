import json
from openai import AsyncOpenAI

from src.agents.base import BaseAgent
from src.agents.prompts.priority_ranker import PRIORITY_RANKER_SYSTEM_PROMPT
from src.config.settings import settings


class PriorityRankerAgent(BaseAgent):
    name = "priority_ranker"

    def __init__(self, client: AsyncOpenAI):
        super().__init__(client)
        self.system_prompt = self.load_prompt(PRIORITY_RANKER_SYSTEM_PROMPT)

    async def run(self, input_data: dict, session_id: str) -> dict:
        scored_nodes = input_data.get("scored_nodes", [])
        edges = input_data.get("edges", [])
        constraints = input_data.get("constraints", [])

        user_message = json.dumps({
            "scored_nodes": scored_nodes,
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
            return {"ranked_nodes": result.get("ranked_nodes", [])}
        except Exception:
            sorted_nodes = sorted(scored_nodes, key=lambda n: n.get("effort_score", 50), reverse=True)
            return {
                "ranked_nodes": [
                    {"node_id": n["id"], "priority_rank": i + 1, "rank_rationale": "Fallback: ranked by effort_score descending"}
                    for i, n in enumerate(sorted_nodes)
                ]
            }
