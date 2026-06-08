# Agent Orchestration & Harness Guide

This folder contains all the critical components related to the agent logic, debate loop orchestration, and DSPy evaluation/optimization harness. These files have been extracted into this `agent/` folder to make it easier to reference and integrate into the main backend application.

## Directory Structure

### 1. `agents/`
This directory holds the individual AgentScope-based agent implementations.
- **`base.py`**: The foundational agent class providing common methods, error handling, and tracing.
- **`triage.py`**: Extracts constraints from raw prompts (scope, tech stack, priorities).
- **`generator.py`**: Generates the Directed Acyclic Graph (DAG) of the tasks based on constraints and user prompt.
- **`critic.py`**: Critiques the generated DAG against constraints and returns objections.
- **`effort_estimator.py`**: Assigns effort scores to each node in the approved DAG.
- **`priority_ranker.py`**: Determines the execution priority/rank of the DAG nodes.

### 2. `workflows/`
This directory contains the orchestration logic that stitches the agents together.
- **`supervisor.py`**: The master loop controller. It runs the entire multi-agent debate loop:
  `IDLE → TRIAGE → GENERATING ↔ CRITIQUING (max 3) → HITL_REVIEW → ESTIMATING → RANKING → COMPLETE`
  It also integrates Server-Sent Events (SSE) updates to push agent progress and handles the human-in-the-loop pause/resume flow.
- **`state_machine.py`**: Tracks the workflow states during the supervisor pipeline execution.

### 3. `dspy/`
The DSPy harness used for prompt optimization and automated evaluation.
- **`signatures.py`**: DSPy Signatures mapping input/output fields for tasks.
- **`modules.py`**: The DSPy modules composed of those signatures.
- **`evaluation.py`**: Logic for measuring agent performance against truth datasets.
- **`optimizer.py`**: Prompt optimization logic using DSPy teleprompters.

### 4. `prompts/`
- **`manifest.json`**: Points to the compiled prompt JSON files for each agent.

## Integration Instructions for Backend

Follow these steps to integrate the agent orchestration into the existing FastAPI backend:

### Step 1: Place Files Correctly
Move the contents of this `agent/` folder into `backend/src/`:
- `agent/agents/` -> `backend/src/agents/`
- `agent/workflows/` -> `backend/src/workflows/`
- `agent/dspy/` -> `backend/src/dspy/`
- *If any pathing issues arise, ensure absolute imports match the structure (e.g., `from src.agents...`).*

### Step 2: Implement FastAPI Endpoints

You need to wire up the API routes in your backend to trigger and interact with the `Supervisor`. 

**1. Start the Session (e.g., POST `/api/v1/sessions`)**
When a user submits a prompt, create a session ID and launch the supervisor in the background.
```python
from fastapi import BackgroundTasks
from src.workflows.supervisor import Supervisor

@app.post("/api/v1/sessions")
async def create_session(request: SessionRequest, background_tasks: BackgroundTasks):
    session_id = generate_uuid()
    # Save initial session state to DB...
    
    # Initialize the supervisor
    supervisor = Supervisor(session_id)
    
    # Run the debate pipeline in the background so the endpoint returns quickly
    background_tasks.add_task(supervisor.run_pipeline, request.prompt)
    
    return {"id": session_id, "status": "running"}
```

**2. Stream Server-Sent Events (e.g., GET `/api/v1/stream/{session_id}`)**
The `supervisor.py` uses functions from `src.utils.sse` to emit agent status updates, DAG modifications, and workflow states. You must expose an SSE endpoint to push these events to the frontend.
```python
from fastapi.responses import StreamingResponse
from src.utils.sse import subscribe

@app.get("/api/v1/stream/{session_id}")
async def stream_events(session_id: str):
    return StreamingResponse(
        subscribe(session_id), 
        media_type="text/event-stream"
    )
```

**3. Human-in-the-Loop Feedback (e.g., POST `/api/v1/sessions/{session_id}/review`)**
When the supervisor reaches the `HITL_REVIEW` state, it pauses execution and waits. Expose an endpoint that calls the unblock function.
```python
from src.workflows.supervisor import submit_hitl_review

@app.post("/api/v1/sessions/{session_id}/review")
async def submit_review(session_id: str, action: str, feedback: str = None):
    # action should be "approve" or "reject"/"revise"
    success = submit_hitl_review(session_id, action, feedback)
    if not success:
        return {"error": "Session is not awaiting review"}
    return {"status": "resumed"}
```

### Step 3: Verify the State Machine
The backend can optionally query the current state of the supervisor (e.g. `IDLE`, `TRIAGE`, `HITL_REVIEW`, `COMPLETE`) by inspecting the `SupervisorState` or tracking the emitted state events over SSE. Ensure that the database reflects these status changes so the frontend can recover state upon a hard refresh.
