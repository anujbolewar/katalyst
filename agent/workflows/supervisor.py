import asyncio
import json
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI

from src.agents.triage import TriageProxyAgent
from src.agents.generator import GeneratorAgent
from src.agents.critic import CriticAgent
from src.agents.effort_estimator import EffortEstimatorAgent
from src.agents.priority_ranker import PriorityRankerAgent
from src.agents.base import AgentError
from src.config.settings import settings
from src.database.engine import AsyncSessionLocal
from src.database.models import Session, Constraint, DagSnapshot, AgentRun
from src.utils.sse import (
    emit_agent_thinking,
    emit_agent_complete,
    emit_dag_node_add,
    emit_dag_edge_add,
    emit_dag_ready,
    emit_error_fatal,
    publish,
)
from src.workflows.state_machine import SupervisorState, transition


_hitl_events: dict[str, asyncio.Event] = {}
_hitl_results: dict[str, dict] = {}


def get_or_create_hitl_event(session_id: str) -> asyncio.Event:
    if session_id not in _hitl_events:
        _hitl_events[session_id] = asyncio.Event()
    return _hitl_events[session_id]


def submit_hitl_review(session_id: str, action: str, feedback: str | None = None) -> bool:
    event = _hitl_events.get(session_id)
    if not event:
        return False
    _hitl_results[session_id] = {"action": action, "feedback": feedback}
    event.set()
    return True


class Supervisor:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.state = SupervisorState.IDLE
        self.iteration = 0
        self.max_iterations = 3
        self.max_retries = 3
        self._dag_version = 0

        self.client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY, 
            base_url=settings.OPENAI_BASE_URL if settings.OPENAI_BASE_URL else None
        )

        self.triage_agent = TriageProxyAgent(self.client)
        self.generator_agent = GeneratorAgent(self.client)
        self.critic_agent = CriticAgent(self.client)
        self.effort_estimator = EffortEstimatorAgent(self.client)
        self.priority_ranker = PriorityRankerAgent(self.client)

    async def run_pipeline(self, raw_prompt: str) -> None:
        self.raw_prompt = raw_prompt
        async with AsyncSessionLocal() as db:
            try:
                await self._run_triage(db, raw_prompt)

                user_feedback = None
                while True:
                    dag_result = await self._run_debate_loop(db, user_feedback)

                    transition(self, SupervisorState.HITL_REVIEW)
                    await self._emit_state("hitl_review")

                    action, feedback = await self._wait_for_hitl_review()
                    if action == "approve":
                        break

                    user_feedback = feedback

                await self._run_estimating(db, dag_result)
                await self._run_ranking(db, dag_result)

                transition(self, SupervisorState.COMPLETE)
                await self._emit_state("complete")
                await self._set_session_status(db, "completed")

            except AgentError as e:
                await self._handle_error(db, e.code, e.message, e.agent_name)
            except Exception as e:
                await self._handle_error(db, "K-5001", str(e))

    async def _run_triage(self, db: AsyncSession, raw_prompt: str) -> None:
        transition(self, SupervisorState.TRIAGE)
        await self._emit_state("triage")

        started = time.perf_counter()
        await emit_agent_thinking(self.session_id, "triage_proxy", 1)

        result = await self.triage_agent.run(
            {"raw_prompt": raw_prompt, "session_id": self.session_id},
            self.session_id,
        )

        duration_ms = int((time.perf_counter() - started) * 1000)
        await emit_agent_complete(
            self.session_id, "triage_proxy", duration_ms,
            f"Extracted {len(result['constraints'])} constraints",
        )

        await self._persist_agent_run(
            db, "triage_proxy", 1, "success",
            {"raw_prompt": raw_prompt}, result, duration_ms,
        )

        constraints = result.get("constraints", [])
        for c in constraints:
            db.add(Constraint(
                session_id=self.session_id,
                category=c.get("category", "scope"),
                label=c.get("label", ""),
                value=c.get("value", ""),
                source="triage",
                confidence=c.get("confidence", 0.0),
            ))
        await db.commit()

        self._constraints = constraints

    async def _run_debate_loop(
        self, db: AsyncSession, initial_objections: list[dict] | None = None
    ) -> dict:
        objections = initial_objections
        dag_result = None

        for iteration in range(1, self.max_iterations + 1):
            self.iteration = iteration

            dag_result = await self._run_generator(db, iteration, objections)
            critic_result = await self._run_critic(db, iteration, dag_result)

            if critic_result.get("passed", False):
                break

            objections = critic_result.get("objections", [])
            
            if iteration == self.max_iterations:
                await self._persist_agent_run(
                    db, "supervisor", iteration, "warning",
                    {"event": "max_iterations_reached", "objections": objections},
                    {"action": "force_pass_to_hitl"},
                    0
                )
                break

        self._dag_version += 1
        await self._persist_dag_snapshot(db, dag_result, self._dag_version)
        await self._emit_dag_events(dag_result)

        return dag_result

    async def _run_generator(
        self, db: AsyncSession, iteration: int, objections: list[dict] | None
    ) -> dict:
        transition(self, SupervisorState.GENERATING)
        await self._emit_state("generating")

        started = time.perf_counter()
        await emit_agent_thinking(self.session_id, "generator", iteration)

        result = await self.generator_agent.run(
            {
                "prompt": self.raw_prompt,
                "constraints": self._constraints,
                "session_id": self.session_id,
                "iteration": iteration,
                "objections": objections,
            },
            self.session_id,
        )

        duration_ms = int((time.perf_counter() - started) * 1000)
        await emit_agent_complete(
            self.session_id, "generator", duration_ms,
            f"Generated {len(result['nodes'])} nodes, {len(result['edges'])} edges",
        )

        await self._persist_agent_run(
            db, "generator", iteration, "success",
            {"constraints": self._constraints, "iteration": iteration, "objections": objections},
            result, duration_ms,
        )

        return result

    async def _run_critic(
        self, db: AsyncSession, iteration: int, dag_result: dict
    ) -> dict:
        transition(self, SupervisorState.CRITIQUING)
        await self._emit_state("critiquing")

        started = time.perf_counter()
        await emit_agent_thinking(self.session_id, "critic", iteration)

        result = await self.critic_agent.run(
            {
                "dag_snapshot": dag_result,
                "constraints": self._constraints,
                "iteration": iteration,
            },
            self.session_id,
        )

        duration_ms = int((time.perf_counter() - started) * 1000)
        status_text = "passed" if result.get("passed") else f"{len(result.get('objections', []))} objections"
        await emit_agent_complete(
            self.session_id, "critic", duration_ms,
            f"Critic review: {status_text}",
        )

        await self._persist_agent_run(
            db, "critic", iteration, "success",
            {"dag_snapshot": dag_result, "iteration": iteration},
            result, duration_ms,
        )

        return result

    async def _wait_for_hitl_review(self) -> tuple[str, str | None]:
        event = get_or_create_hitl_event(self.session_id)
        await event.wait()
        result = _hitl_results.pop(self.session_id, {"action": "approve", "feedback": None})
        _hitl_events.pop(self.session_id, None)
        return result["action"], result.get("feedback")

    async def _run_estimating(self, db: AsyncSession, dag_result: dict) -> None:
        transition(self, SupervisorState.ESTIMATING)
        await self._emit_state("estimating")

        started = time.perf_counter()
        await emit_agent_thinking(self.session_id, "effort_estimator", 1)

        result = await self.effort_estimator.run(
            {
                "nodes": dag_result.get("nodes", []),
                "edges": dag_result.get("edges", []),
                "constraints": self._constraints,
            },
            self.session_id,
        )

        duration_ms = int((time.perf_counter() - started) * 1000)
        await emit_agent_complete(
            self.session_id, "effort_estimator", duration_ms,
            f"Scored {len(result.get('scores', []))} nodes",
        )

        await self._persist_agent_run(
            db, "effort_estimator", 1, "success",
            {"nodes": dag_result.get("nodes", [])}, result, duration_ms,
        )

        score_map = {s["node_id"]: s["effort_score"] for s in result.get("scores", [])}
        for node in dag_result.get("nodes", []):
            if node["id"] in score_map:
                node["effort_score"] = score_map[node["id"]]

        self._effort_result = result

    async def _run_ranking(self, db: AsyncSession, dag_result: dict) -> None:
        transition(self, SupervisorState.RANKING)
        await self._emit_state("ranking")

        started = time.perf_counter()
        await emit_agent_thinking(self.session_id, "priority_ranker", 1)

        result = await self.priority_ranker.run(
            {
                "scored_nodes": dag_result.get("nodes", []),
                "edges": dag_result.get("edges", []),
                "constraints": self._constraints,
            },
            self.session_id,
        )

        duration_ms = int((time.perf_counter() - started) * 1000)
        await emit_agent_complete(
            self.session_id, "priority_ranker", duration_ms,
            f"Ranked {len(result.get('ranked_nodes', []))} nodes",
        )

        await self._persist_agent_run(
            db, "priority_ranker", 1, "success",
            {"scored_nodes": dag_result.get("nodes", [])}, result, duration_ms,
        )

        rank_map = {r["node_id"]: r["priority_rank"] for r in result.get("ranked_nodes", [])}
        for node in dag_result.get("nodes", []):
            if node["id"] in rank_map:
                node["priority_rank"] = rank_map[node["id"]]

        self._dag_version += 1
        await self._persist_dag_snapshot(db, dag_result, self._dag_version)
        await self._emit_dag_events(dag_result)

    async def _emit_dag_events(self, dag_result: dict) -> None:
        for node in dag_result.get("nodes", []):
            await emit_dag_node_add(self.session_id, node)
        for edge in dag_result.get("edges", []):
            await emit_dag_edge_add(self.session_id, edge)
        await emit_dag_ready(
            self.session_id,
            version=self._dag_version,
            node_count=len(dag_result.get("nodes", [])),
            edge_count=len(dag_result.get("edges", [])),
        )

    async def _persist_dag_snapshot(
        self, db: AsyncSession, dag_result: dict, version: int
    ) -> None:
        snapshot = DagSnapshot(
            session_id=self.session_id,
            version=version,
            nodes_json=json.dumps(dag_result.get("nodes", [])),
            edges_json=json.dumps(dag_result.get("edges", [])),
        )
        db.add(snapshot)
        await db.commit()

    async def _persist_agent_run(
        self,
        db: AsyncSession,
        agent_name: str,
        iteration: int,
        status: str,
        input_data: dict,
        output_data: dict,
        duration_ms: int,
    ) -> None:
        run = AgentRun(
            session_id=self.session_id,
            agent_name=agent_name,
            iteration=iteration,
            status=status,
            input_json=json.dumps(input_data, default=str),
            output_json=json.dumps(output_data, default=str),
            duration_ms=duration_ms,
            started_at=datetime.now(timezone.utc),
            ended_at=datetime.now(timezone.utc),
        )
        db.add(run)
        await db.commit()

    async def _emit_state(self, state_name: str) -> None:
        await publish(self.session_id, "supervisor.state", {
            "state": state_name,
            "iteration": self.iteration,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def _set_session_status(self, db: AsyncSession, status: str) -> None:
        result = await db.execute(
            select(Session).where(Session.id == self.session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            session.status = status
            await db.commit()

    async def _handle_error(
        self, db: AsyncSession, code: str, message: str, agent_name: str | None = None
    ) -> None:
        transition(self, SupervisorState.ERROR)
        await emit_error_fatal(self.session_id, code, message, agent_name)

        result = await db.execute(
            select(Session).where(Session.id == self.session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            session.status = "error"
            await db.commit()
