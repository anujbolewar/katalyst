# Katalyst

**Transforming vague goals into structured, actionable workflows.**

When you have a big vision, the hardest part isn't having the idea—it's figuring out exactly where to start. Vague goals lead to overwhelm, and without a clear roadmap, execution stalls.

**Katalyst** is an autonomous workspace designed specifically to solve this problem. It takes your unstructured, high-level ambitions and intelligently decomposes them into a highly manageable matrix of structured tasks. It then assigns those tasks to specialized background agents that actually do the work.

## The Katalyst Advantage

Most AI tools are just glorified chat windows. They can give you advice, but you still have to copy, paste, and do the heavy lifting yourself. Katalyst is fundamentally different because it is built around a powerful, unrestricted execution layer. 

1. **True Autonomous Execution:** Our custom **CLI Engine** isn't trapped in a cloud sandbox. It runs locally on your machine with native shell access. When it writes code, it actually saves the files. When it needs to run a build script, it executes the terminal commands directly. 
2. **Fire-and-Forget Workflows:** Because the execution engine is completely detached from the UI, you don't have to babysit the AI. You can delegate a massive goal, close the dashboard, and go to sleep. The CLI engine runs tirelessly in the background, pausing only if it explicitly needs your human approval.
3. **Pluggable Intelligence:** Not every task requires an expensive frontier model. The CLI engine dynamically routes logic—using OpenRouter (Claude/GPT-4) for complex, high-stakes planning, and local Ollama models for fast, privacy-first data parsing. You retain total control over cost, speed, and security.

## How It Works

1. **Input the Vision:** Give Katalyst a vague goal like *"Launch a landing page for my new SaaS."*
2. **Matrix Decomposition:** The system analyzes your request and transforms it into a structured, manageable workflow matrix—breaking it down by domain (Code, Research, Marketing) and sequence.
3. **The Engine Takes Over:** The Python CLI Engine wakes up, claims the tasks, and begins executing terminal commands, scraping web data, and drafting copy in the background.

## The Digital Team (Agents)

Katalyst doesn't just run one generic AI. It spins up specialized, persona-driven background agents based on the specific domain of your task. This ensures high-quality, specialized execution instead of generic, shallow outputs.

| Agent | Why It's Used | Key Capabilities |
| :--- | :--- | :--- |
| **You (The CEO)** | To provide high-leverage creative direction, make critical decisions, and give final approvals. | Direction, Approvals, Strategy |
| **Developer** | To handle all technical implementation. It reads your codebase and writes clean, tested code. | Full-stack coding, Testing, Deployment |
| **Researcher** | To investigate topics, gather live web data, and produce actionable insights without hallucinating. | Web research, Competitive analysis |
| **Marketer** | To write compelling copy, outline content, and define growth strategies for your product. | Copywriting, SEO, Positioning |
| **Business Analyst** | To advise on strategy, feature prioritization, and business modeling. | Market analysis, Strategic planning |

---

## Under the Hood (For the Geeks)

Katalyst separates the planning interface from the execution engine to maximize performance and flexibility:

- **The Brain (UI & State):** A lightning-fast Next.js 15 web app powered by SQLite and local JSON storage. It provides a real-time, zero-lag window into your structured workflows.
- **The Muscle (Custom CLI Engine):** A headless Python daemon (`/cli-engine`) built from the ground up for raw execution power. It utilizes an intelligent tool-calling loop that directly interfaces with your local operating system.
- **The Nervous System:** A Node.js background router that orchestrates the communication between your web dashboard and the Python agents executing your matrix.

---

### Internal Roadmap
*(What we're building next)*
- **Interactive Brain Graphs:** Visualizing the goal decomposition matrix dynamically.
- **Goal Flow:** Allowing you to drag-and-drop subtasks to restructure workflows on the fly.
- **Smarter Logic:** Upgrading our AI models to decompose complex tasks with zero-shot precision.
- **Command Center 2.0:** Expanding the command interface for faster, friction-free interaction.
