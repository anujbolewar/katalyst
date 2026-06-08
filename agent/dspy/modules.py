import dspy
from src.dspy.signatures import (
    TriageSignature, GeneratorSignature, CriticSignature, EffortSignature, RankerSignature
)

class TriageModule(dspy.Module):
    def __init__(self):
        super().__init__()
        self.prog = dspy.Predict(TriageSignature)

    def forward(self, raw_prompt):
        return self.prog(raw_prompt=raw_prompt)

class GeneratorModule(dspy.Module):
    def __init__(self):
        super().__init__()
        self.prog = dspy.Predict(GeneratorSignature)

    def forward(self, prompt, constraints):
        return self.prog(prompt=prompt, constraints=constraints)

class CriticModule(dspy.Module):
    def __init__(self):
        super().__init__()
        self.prog = dspy.Predict(CriticSignature)

    def forward(self, dag_proposal, constraints):
        return self.prog(dag_proposal=dag_proposal, constraints=constraints)

class EffortModule(dspy.Module):
    def __init__(self):
        super().__init__()
        self.prog = dspy.Predict(EffortSignature)

    def forward(self, nodes, edges, constraints):
        return self.prog(nodes=nodes, edges=edges, constraints=constraints)

class RankerModule(dspy.Module):
    def __init__(self):
        super().__init__()
        self.prog = dspy.Predict(RankerSignature)

    def forward(self, scored_nodes, edges, constraints):
        return self.prog(scored_nodes=scored_nodes, edges=edges, constraints=constraints)
