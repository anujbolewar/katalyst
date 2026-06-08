import os
import dspy
from dspy.teleprompt import BootstrapFewShotWithRandomSearch, BootstrapFewShot
from src.dspy.modules import TriageModule, GeneratorModule, CriticModule, EffortModule, RankerModule
from src.dspy.evaluation import constraint_coverage, dag_completeness, objection_validity, effort_accuracy, rank_correlation

async def optimize_all():
    optimizer_tge = BootstrapFewShotWithRandomSearch(metric=constraint_coverage, max_bootstrapped_demos=2, num_candidate_programs=3)
    optimizer_cr = BootstrapFewShot(metric=objection_validity, max_bootstrapped_demos=2)
    
    os.makedirs("backend/prompts/compiled", exist_ok=True)
    
    print("Optimizers configured. Run with actual data to compile prompts.")
