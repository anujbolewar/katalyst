// ─── Goal Decomposition Prompt ─────────────────────────────────────────────
// Adapted from: reworkd_platform/web/api/agent/prompts.py
// Based on Plan-and-Solve prompting: https://github.com/AGI-Edgerunners/Plan-and-Solve-Prompting

export const START_GOAL_PROMPT = `You are a task creation AI. 
You have the following objective: "{goal}".

Return a list of search queries or subtasks required to accomplish the entirety of the objective.
Limit the list to a maximum of 5 items. Ensure the queries are as succinct as possible.
For simple objectives use a single query.

Return the response as a JSON array of strings. Examples:

query: "Who is considered the best NBA player in the current season?"
answer: ["current NBA MVP candidates"]

query: "How can I create a function to add weight to edges in a digraph?"
answer: ["algorithm to add weight to digraph edge"]

query: "What is the current weather in New York?"
answer: ["current weather in New York"]

query: "5 + 5?"
answer: ["Sum of 5 and 5"]

query: "What are the nutritional values of almond milk and soy milk?"
answer: ["nutritional information of almond milk", "nutritional information of soy milk"]`;

// ─── Task Analysis Prompt ──────────────────────────────────────────────────
export const ANALYZE_TASK_PROMPT = `High level objective: "{goal}"
Current task: "{task}"

Based on this information, use the best approach to make progress or accomplish the task entirely.
Select the correct action by being smart and efficient.

Note you MUST select an action.`;

// ─── Task Execution Prompt ─────────────────────────────────────────────────
export const EXECUTE_TASK_PROMPT = `Given the following overall objective "{goal}" and the following sub-task, "{task}".

Perform the task by understanding the problem, extracting variables, and being smart
and efficient. Write a detailed response that addresses the task.
When confronted with choices, make a decision yourself with reasoning.`;

// ─── Dynamic Task Creation Prompt ──────────────────────────────────────────
export const CREATE_TASKS_PROMPT = `You are an AI task creation agent.
You have the following objective: "{goal}".

You have the following incomplete tasks:
{tasks}

You just completed the following task:
"{lastTask}"

And received the following result:
"{result}".

Based on this, create a single new task to be completed by your AI system such that your goal is closer reached.
If there are no more tasks to be done, return nothing. Do not add quotes to the task.

Examples:
Search the web for NBA news
Create a function to add a new vertex with a specified weight to the digraph.
Search for any additional information on Bertie W.`;

// ─── Goal Tree Decomposition Prompt ────────────────────────────────────────
// Produces a hierarchical task tree instead of a flat list
export const TREE_DECOMPOSE_PROMPT = `You are a task decomposition AI.
You have the following objective: "{goal}".

Break down this objective into a hierarchical task tree. Each node in the tree represents a
specific subtask. Parent tasks represent high-level categories, and child tasks represent
concrete, actionable steps.

Rules:
- Maximum depth of 3 levels (root → category → action)
- Each leaf node must be a single, concrete, executable action
- Each node must have a short, descriptive title (max 80 characters)
- Every node MUST include a "description" field. Leaf descriptions should be 1-2 sentences
- The root node is the goal itself

Return the response as a JSON object with this structure:
{
  "title": "Goal title",
  "description": "Brief description of the overall goal",
  "children": [
    {
      "title": "Category 1",
      "description": "Brief description of this category",
      "children": [
        { "title": "Specific action 1.1", "description": "1-2 sentence explanation of what this task involves" },
        { "title": "Specific action 1.2", "description": "1-2 sentence explanation of what this task involves" }
      ]
    },
    {
      "title": "Category 2",
      "description": "Brief description of this category",
      "children": [
        { "title": "Specific action 2.1", "description": "1-2 sentence explanation of what this task involves" },
        { "title": "Specific action 2.2", "description": "1-2 sentence explanation of what this task involves" }
      ]
    }
  ]
}

Only return the JSON object, no other text.`;

// ─── Low-Effort Fast Decomposition Prompt ─────────────────────────────────
// Single-step, flat tree — no multi-agent pipeline
export const FAST_DECOMPOSE_PROMPT = `You are a task decomposition AI.
You have the following objective: "{goal}".

Extra user context: "{extraContext}"

Break this objective into a flat hierarchical task tree. Keep it simple and fast.

Rules:
- Maximum depth of 2 levels (root → action)
- Each leaf node must be a single, concrete, executable action
- Every node MUST include a "title" and "description" field
- Generate exactly 3-6 top-level tasks
- Skip research and review — just produce the tree

Return ONLY a JSON object with this exact structure:
{
  "tree": {
    "title": "Goal title",
    "description": "Brief description",
    "children": [
      { "title": "Action 1", "description": "What to do" },
      { "title": "Action 2", "description": "What to do" }
    ]
  }
}`;

// ─── Goal Clarifying Questions Prompt ──────────────────────────────────────
// Agent: Question Framer — explains WHY each question matters
export const CLARIFY_GOAL_PROMPT = `You are a product strategist and requirements analyst (Question Framer Agent).
A user has the following goal: "{goal}".

This goal is vague. Before breaking it down into tasks, you need to understand the user's
intent better. Generate exactly 4 clarifying questions. Each question must have exactly
3 predefined, mutually-exclusive options that cover the most likely scenarios.

Rules:
- Questions should uncover: target audience, core functionality, technical constraints, and success criteria
- Each option must be a short, concrete description (max 60 chars)
- Options must be distinct — no overlap between them
- The 4th option for each question will be "Other (custom)" — handled by the UI
- Questions must be specific to the goal, not generic
- Include a "reasoning" field per question explaining WHY this question matters

Return ONLY a JSON object with this exact structure:
{
  "framingLogic": "One sentence explaining the overall approach to framing these questions",
  "questions": [
    {
      "id": "q1",
      "question": "Who is the primary target audience?",
      "reasoning": "Identifying the audience determines feature scope, pricing model, and go-to-market strategy",
      "options": ["B2B enterprise teams", "Individual consumers (B2C)", "Developers and technical users"]
    }
  ]
}`;

// ─── Multi-Agent Decomposition Prompt ─────────────────────────────────────
// Pipeline: Researcher → Decomposer → Reviewer
export const DECOMPOSE_WITH_PIPELINE_PROMPT = `You are a multi-agent planning system. Execute these stages sequentially:

## STAGE 1 — RESEARCHER AGENT
Analyze the goal and context. Output your findings as a short research brief.
Include: domain context, key constraints, success factors, and risks.

## STAGE 2 — DECOMPOSER AGENT  
Based on the Researcher's brief, break the goal into a hierarchical task tree.
Maximum depth of 3 levels (root → category → action).
Every node MUST include a "description" field. Leaf action descriptions should be 1-2 sentences explaining what to do and why.

## STAGE 3 — REVIEWER AGENT
Review the task tree for completeness, feasibility, and clarity.
Flag any gaps or improvements.

Goal: "{goal}"

Extra user context: "{extraContext}"

Return ONLY a JSON object with this exact structure:
{
  "researcher": {
    "brief": "2-3 sentence research brief about the domain and key considerations",
    "findings": ["finding 1", "finding 2", "finding 3"]
  },
  "decomposer": {
    "tree": {
      "title": "Goal title",
      "description": "Brief description of the overall goal",
      "children": [
        {
          "title": "Category",
          "description": "Brief description of this category's purpose",
          "children": [
            { "title": "Action", "description": "1-2 sentence detailed explanation of what this task involves and why it matters" }
          ]
        }
      ]
    }
  },
  "reviewer": {
    "verdict": "PASS" or "NEEDS_IMPROVEMENT",
    "notes": "Brief review notes about completeness and quality",
    "suggestions": ["suggestion 1 if any"]
  }
}`;

// ─── Prompt Formatter ──────────────────────────────────────────────────────
export function formatPrompt(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}
