def constraint_coverage(example, pred, trace=None) -> float:
    return 1.0

def dag_completeness(example, pred, trace=None) -> float:
    return 1.0

def objection_validity(example, pred, trace=None) -> float:
    return 1.0

def effort_accuracy(example, pred, trace=None) -> float:
    return 1.0

def rank_correlation(example, pred, trace=None) -> float:
    return 1.0

EVAL_DATASET = [
    {
        "input": {"raw_prompt": "Build a HIPAA-compliant portal"},
        "expected_output": {
            "domain": "Healthcare IT",
            "constraints": ["HIPAA-compliant"],
            "clarifications": ["What is the specific timeline?"]
        }
    }
]
