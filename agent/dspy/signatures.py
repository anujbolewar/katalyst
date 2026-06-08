import dspy

class TriageSignature(dspy.Signature):
    """Analyze the raw project prompt and extract domain context, strict constraints, and clarify any ambiguities."""
    raw_prompt = dspy.InputField(desc="Raw user goal or project description")
    domain = dspy.OutputField(desc="Primary business domain or technical category")
    constraints = dspy.OutputField(desc="List of strict technical or business constraints extracted")
    clarifications = dspy.OutputField(desc="List of clarifying questions if the prompt is ambiguous")

class GeneratorSignature(dspy.Signature):
    """Generate a Directed Acyclic Graph (DAG) of tasks to accomplish the scoping goal given constraints."""
    prompt = dspy.InputField(desc="The user goal")
    constraints = dspy.InputField(desc="List of extracted constraints")
    nodes = dspy.OutputField(desc="List of DAG nodes representing distinct tasks/components")
    edges = dspy.OutputField(desc="List of edges defining dependencies between nodes")

class CriticSignature(dspy.Signature):
    """Critique a proposed DAG against the given constraints and identify architectural flaws or missing dependencies."""
    dag_proposal = dspy.InputField(desc="The proposed DAG of tasks")
    constraints = dspy.InputField(desc="Constraints that must be satisfied")
    verdict = dspy.OutputField(desc="Verdict: Pass or Reject")
    issues = dspy.OutputField(desc="List of specific issues found, if any")

class EffortSignature(dspy.Signature):
    """Estimate the effort required for each node in the DAG in person-days."""
    nodes = dspy.InputField(desc="List of DAG nodes")
    edges = dspy.InputField(desc="Dependencies between nodes")
    constraints = dspy.InputField(desc="Constraints that may affect effort")
    scores = dspy.OutputField(desc="Dictionary mapping node IDs to effort scores")

class RankerSignature(dspy.Signature):
    """Rank the tasks by execution priority based on dependencies and effort scores."""
    scored_nodes = dspy.InputField(desc="DAG nodes with effort scores attached")
    edges = dspy.InputField(desc="Dependencies between nodes")
    constraints = dspy.InputField(desc="Project constraints")
    ranked_nodes = dspy.OutputField(desc="Ordered list of node IDs from highest priority to lowest")
