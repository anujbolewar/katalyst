import json
from openai import AsyncOpenAI

from src.agents.base import BaseAgent
from src.agents.prompts.generator import GENERATOR_SYSTEM_PROMPT
from src.config.settings import settings


class GeneratorAgent(BaseAgent):
    name = "generator"

    def __init__(self, client: AsyncOpenAI):
        super().__init__(client)
        self.system_prompt = self.load_prompt(GENERATOR_SYSTEM_PROMPT)

    async def run(self, input_data: dict, session_id: str) -> dict:
        prompt = input_data.get("prompt", "")
        constraints = input_data.get("constraints", [])
        iteration = input_data.get("iteration", 1)
        objections = input_data.get("objections")

        user_message = self._build_user_message(prompt, constraints, iteration, objections)

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

        result = await self._retry(call_llm)

        nodes = result.get("nodes", [])
        edges = result.get("edges", [])
        
        # Structural validation
        node_ids = set()
        for node in nodes:
            if "id" not in node:
                raise AgentError("K-5002", "Generator produced node without an 'id'", self.name)
            node_ids.add(node["id"])
            
        for edge in edges:
            if edge.get("source") not in node_ids or edge.get("target") not in node_ids:
                raise AgentError("K-5002", f"Generator produced invalid edge: {edge}", self.name)

        return {
            "nodes": nodes,
            "edges": edges,
        }

    def _build_user_message(
        self,
        prompt: str,
        constraints: list[dict],
        iteration: int,
        objections: list[dict] | None,
    ) -> str:
        parts = [
            f"Original User Goal:\n{prompt}\n",
            f"Constraints:\n{json.dumps(constraints, indent=2)}"
        ]

        if iteration > 1 and objections:
            parts.append(f"\nIteration: {iteration}")
            parts.append(f"Critic Objections to address:\n{json.dumps(objections, indent=2)}")
            parts.append("\nRevise the DAG to address ALL objections above.")

        return "\n".join(parts)
