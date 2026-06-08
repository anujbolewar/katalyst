from enum import Enum


class SupervisorState(str, Enum):
    IDLE = "IDLE"
    TRIAGE = "TRIAGE"
    GENERATING = "GENERATING"
    CRITIQUING = "CRITIQUING"
    HITL_REVIEW = "HITL_REVIEW"
    ESTIMATING = "ESTIMATING"
    RANKING = "RANKING"
    COMPLETE = "COMPLETE"
    ERROR = "ERROR"


VALID_TRANSITIONS: dict[SupervisorState, set[SupervisorState]] = {
    SupervisorState.IDLE: {SupervisorState.TRIAGE},
    SupervisorState.TRIAGE: {SupervisorState.GENERATING, SupervisorState.ERROR},
    SupervisorState.GENERATING: {SupervisorState.CRITIQUING, SupervisorState.ERROR},
    SupervisorState.CRITIQUING: {SupervisorState.GENERATING, SupervisorState.HITL_REVIEW, SupervisorState.ERROR},
    SupervisorState.HITL_REVIEW: {SupervisorState.GENERATING, SupervisorState.ESTIMATING, SupervisorState.ERROR},
    SupervisorState.ESTIMATING: {SupervisorState.RANKING, SupervisorState.ERROR},
    SupervisorState.RANKING: {SupervisorState.COMPLETE, SupervisorState.ERROR},
    SupervisorState.COMPLETE: set(),
    SupervisorState.ERROR: set(),
}


def can_transition(from_state: SupervisorState, to_state: SupervisorState) -> bool:
    return to_state in VALID_TRANSITIONS.get(from_state, set())


def transition(supervisor, to_state: SupervisorState) -> None:
    if not can_transition(supervisor.state, to_state):
        raise ValueError(
            f"Invalid transition: {supervisor.state.value} → {to_state.value}"
        )
    supervisor.state = to_state
