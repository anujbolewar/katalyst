import json
from collections import defaultdict, deque
from openai import AsyncOpenAI

from src.agents.base import BaseAgent
from src.agents.prompts.critic import CRITIC_SYSTEM_PROMPT
from src.config.settings import settings


import re

class CriticAgent(BaseAgent):
    name = "critic"

    def __init__(self, client: AsyncOpenAI):
        super().__init__(client)
        self.system_prompt = self.load_prompt(CRITIC_SYSTEM_PROMPT)

    async def run(self, input_data: dict, session_id: str) -> dict:
        dag_proposal = input_data.get("dag_proposal", {})
        constraints = input_data.get("constraints", [])

        user_content = json.dumps({"dag_proposal": dag_proposal, "constraints": constraints})

        async def call_llm():
            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.0
            )
            content = response.choices[0].message.content
            return self._parse_json(content)

        dag_snapshot = dag_proposal
        nodes = dag_snapshot.get("nodes", [])
        edges = dag_snapshot.get("edges", [])

        objections = []
        objections.extend(self._check_constraint_coverage(nodes, constraints))
        objections.extend(self._check_orphans(nodes, edges))
        if self._detect_cycles(nodes, edges):
            objections.append({
                "check_id": 3,
                "severity": "BLOCKING",
                "message": "DAG contains cycles and is not acyclic",
                "node_ids": [],
            })
        objections.extend(self._check_effort_bounds(nodes))
        objections.extend(self._check_single_root(nodes, edges))
        objections.extend(self._check_layer_balance(nodes))
        objections.extend(self._check_risk_propagation(nodes, edges))
        objections.extend(self._check_owner_assignment(nodes))
        objections.extend(self._check_description_quality(nodes))

        duplicates = self._detect_duplicates(nodes)
        if duplicates:
            objections.append({
                "check_id": 10,
                "severity": "BLOCKING",
                "message": f"Duplicate labels found: {', '.join(duplicates)}",
                "node_ids": [],
            })

        has_blocking = any(o["severity"] == "BLOCKING" for o in objections)
        passed = not has_blocking

        suggested_additions = []
        if not passed:
            suggested_additions = await self._get_suggested_additions(
                nodes, edges, constraints, objections
            )

        return {
            "passed": passed,
            "objections": objections,
            "suggested_additions": suggested_additions,
        }

    def _check_constraint_coverage(
        self, nodes: list[dict], constraints: list[dict]
    ) -> list[dict]:
        objections = []
        node_text = " ".join(
            f"{n.get('label', '')} {n.get('description', '')}" for n in nodes
        ).lower()

        for c in constraints:
            label_value = f"{c.get('label', '')} {c.get('value', '')}".lower()
            words = set(w for w in re.split(r'\W+', label_value) if len(w) > 3)
            if not words:
                continue
            if not any(w in node_text for w in words):
                objections.append({
                    "check_id": 1,
                    "severity": "BLOCKING",
                    "message": f"Constraint '{c.get('label', '')}' ({c.get('category', '')}) is not covered by any DAG node",
                    "node_ids": [],
                })
        return objections

    def _check_orphans(
        self, nodes: list[dict], edges: list[dict]
    ) -> list[dict]:
        orphans = self._detect_orphans(nodes, edges)
        if not orphans:
            return []
        return [{
            "check_id": 2,
            "severity": "BLOCKING",
            "message": f"Orphan nodes detected (no edges): {', '.join(orphans)}",
            "node_ids": orphans,
        }]

    def _check_effort_bounds(self, nodes: list[dict]) -> list[dict]:
        flagged = []
        for n in nodes:
            score = n.get("effort_score", 50)
            if score < 10 or score > 90:
                flagged.append(n.get("id", ""))
        if not flagged:
            return []
        return [{
            "check_id": 4,
            "severity": "WARNING",
            "message": f"Effort scores outside [10, 90] range",
            "node_ids": flagged,
        }]

    def _check_single_root(
        self, nodes: list[dict], edges: list[dict]
    ) -> list[dict]:
        if not nodes:
            return []
        targets = {e.get("target") for e in edges}
        roots = [n["id"] for n in nodes if n.get("id") not in targets]
        if len(roots) != 1:
            return [{
                "check_id": 5,
                "severity": "WARNING",
                "message": f"Expected exactly 1 root node, found {len(roots)}",
                "node_ids": roots,
            }]
        return []

    def _check_layer_balance(self, nodes: list[dict]) -> list[dict]:
        if not nodes:
            return []
        layer_counts: dict[str, int] = defaultdict(int)
        for n in nodes:
            layer_counts[n.get("layer", "unknown")] += 1
        total = len(nodes)
        for layer, count in layer_counts.items():
            if count / total > 0.6:
                return [{
                    "check_id": 6,
                    "severity": "WARNING",
                    "message": f"Layer '{layer}' contains {count}/{total} nodes ({count*100//total}%), exceeding 60% threshold",
                    "node_ids": [n["id"] for n in nodes if n.get("layer") == layer],
                }]
        return []

    def _check_risk_propagation(
        self, nodes: list[dict], edges: list[dict]
    ) -> list[dict]:
        node_map = {n["id"]: n for n in nodes}
        downstream: dict[str, list[str]] = defaultdict(list)
        for e in edges:
            downstream[e.get("source", "")].append(e.get("target", ""))

        flagged = []
        for n in nodes:
            if n.get("risk_flags"):
                visited = set()
                queue = deque(downstream.get(n["id"], []))
                while queue:
                    dep_id = queue.popleft()
                    if dep_id in visited:
                        continue
                    visited.add(dep_id)
                    dep = node_map.get(dep_id, {})
                    if not dep.get("risk_flags"):
                        flagged.append(dep_id)
                    queue.extend(downstream.get(dep_id, []))

        if not flagged:
            return []
        return [{
            "check_id": 7,
            "severity": "BLOCKING",
            "message": "Downstream nodes do not inherit risk awareness from risk-flagged ancestors",
            "node_ids": flagged,
        }]

    def _check_owner_assignment(self, nodes: list[dict]) -> list[dict]:
        missing = [n["id"] for n in nodes if not n.get("owner_tag")]
        if not missing:
            return []
        return [{
            "check_id": 8,
            "severity": "WARNING",
            "message": "Nodes missing owner_tag",
            "node_ids": missing,
        }]

    def _check_description_quality(self, nodes: list[dict]) -> list[dict]:
        short = [
            n["id"] for n in nodes
            if len(n.get("description", "")) < 20
        ]
        if not short:
            return []
        return [{
            "check_id": 9,
            "severity": "WARNING",
            "message": "Node descriptions shorter than 20 characters",
            "node_ids": short,
        }]

    def _detect_cycles(self, nodes: list[dict], edges: list[dict]) -> bool:
        node_ids = {n["id"] for n in nodes}
        adj: dict[str, list[str]] = defaultdict(list)
        in_degree: dict[str, int] = {nid: 0 for nid in node_ids}

        for e in edges:
            src, tgt = e.get("source", ""), e.get("target", "")
            if src in node_ids and tgt in node_ids:
                adj[src].append(tgt)
                in_degree[tgt] = in_degree.get(tgt, 0) + 1

        queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
        visited = 0
        while queue:
            node = queue.popleft()
            visited += 1
            for neighbor in adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        return visited != len(node_ids)

    def _detect_orphans(
        self, nodes: list[dict], edges: list[dict]
    ) -> list[str]:
        if len(nodes) <= 1:
            return []
        connected = set()
        for e in edges:
            connected.add(e.get("source", ""))
            connected.add(e.get("target", ""))
        return [n["id"] for n in nodes if n["id"] not in connected]

    def _detect_duplicates(self, nodes: list[dict]) -> list[str]:
        seen: dict[str, int] = {}
        for n in nodes:
            label = n.get("label", "")
            seen[label] = seen.get(label, 0) + 1
        return [label for label, count in seen.items() if count > 1]

    async def _get_suggested_additions(
        self,
        nodes: list[dict],
        edges: list[dict],
        constraints: list[dict],
        objections: list[dict],
    ) -> list[dict]:
        coverage_objections = [o for o in objections if o["check_id"] == 1]
        if not coverage_objections:
            return []

        user_message = json.dumps({
            "current_nodes": nodes,
            "current_edges": edges,
            "constraints": constraints,
            "coverage_gaps": [o["message"] for o in coverage_objections],
        }, indent=2)

        async def call_llm():
            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": (
                        "You generate DAGNodeData objects to fill coverage gaps. "
                        "Return JSON: {\"suggested_additions\": [...DAGNodeData]}. "
                        "Each node must have: id (UUID), label, description (>=20 chars), "
                        "effort_score (1-100), priority_rank (0), risk_flags, owner_tag, "
                        "layer, status (\"pending\"), position ({x, y})."
                    )},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.3,
            )
            content = response.choices[0].message.content
            return self._parse_json(content)

        try:
            result = await self._retry(call_llm, max_retries=2)
            return result.get("suggested_additions", [])
        except Exception:
            return []
