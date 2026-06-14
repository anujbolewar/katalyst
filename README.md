# Katalyst

**Transforming vague goals into structured, actionable workflows.**

When you have a big vision, the hardest part isn't having the idea—it's figuring out exactly where to start. Vague goals lead to overwhelm, and without a clear roadmap, execution stalls.

**Katalyst** is an autonomous workspace designed specifically to solve this problem. It takes your unstructured, high-level ambitions and intelligently decomposes them into a highly manageable matrix of structured tasks. It then assigns those tasks to specialized background agents that actually do the work.

## 🪄 How It Works

1. **Input the Vision:** Give Katalyst a vague goal like *"Launch a landing page for my new SaaS."*
2. **Matrix Decomposition:** The system analyzes your request and transforms it into a structured, manageable workflow matrix—breaking it down by domain (Code, Research, Marketing) and sequence.
3. **Autonomous Execution:** Specialized background agents automatically execute the workflow. They write code, scrape the web, and draft copy, checking in with you only when human review is required.

---

## ⚙️ Under the Hood (For the Geeks)

Katalyst separates the planning interface from the execution engine to maximize performance and flexibility:

- **The Brain (UI & State):** A lightning-fast Next.js 15 web app powered by SQLite and local JSON storage. It provides a real-time, zero-lag window into your structured workflows.
- **The Muscle (Agent Engine):** A headless, sandboxed Python daemon (`/cli-engine`). It uses an intelligent tool-calling loop to safely run terminal commands, browse the web, and process AI logic locally (via Ollama) or remotely (via OpenRouter).
- **The Nervous System:** A Node.js background router that orchestrates the communication between your web dashboard and the Python agents executing your matrix.

## 🚀 Quick Start

Ready to turn your vague goals into reality?

```bash
# 1. Install the workspace
pnpm install

# 2. Launch your dashboard
pnpm dev

# 3. Wake up the background agents
pnpm daemon:start
```

---

### 🗺️ Internal Roadmap
*(What we're building next)*
- **Interactive Brain Graphs:** Visualizing the goal decomposition matrix dynamically.
- **Goal Flow:** Allowing you to drag-and-drop subtasks to restructure workflows on the fly.
- **Smarter Logic:** Upgrading our AI models to decompose complex tasks with zero-shot precision.
- **Command Center 2.0:** Expanding the command interface for faster, friction-free interaction.
