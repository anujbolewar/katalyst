# Katalyst

**Imagine if your to-do list could actually do the work for you.**

For solo developers, founders, and creators, time is the ultimate bottleneck. You have big ideas, but you're constantly drowning in the day-to-day execution: researching competitors, writing boilerplate code, drafting launch emails, and managing endless tasks.

**Katalyst** changes that. It's not just another project management tool—it is an autonomous workspace that acts as your tireless digital co-founder. You set the high-level goals, and Katalyst's background agents break them down, figure out the steps, and literally execute the work while you sleep.

## 🪄 How It Works

1. **You Dream It:** Type in a massive goal like *"Launch a landing page for my new SaaS."*
2. **Katalyst Plans It:** The system automatically breaks this down into bite-sized tasks, assigns them to specialized AI agents (like a Developer, Researcher, or Marketer), and creates a strategic game plan.
3. **The Agents Build It:** While you focus on the big picture, background agents write the code, browse the web, and draft the copy. They check in with you only when they need a human decision or approval.

---

## ⚙️ Under the Hood (For the Geeks)

While the interface feels like magic, the engine running it is built for serious scale and flexibility:

- **The Brain (UI & State):** A lightning-fast Next.js 15 web app powered by SQLite and local JSON storage. It provides a real-time, zero-lag window into what your agents are doing.
- **The Muscle (Agent Engine):** A headless, sandboxed Python daemon (`/cli-engine`). It uses an intelligent tool-calling loop to safely run terminal commands, scrape websites, and process AI logic locally (via Ollama) or remotely (via OpenRouter).
- **The Nervous System:** A Node.js background router that orchestrates the communication between your web dashboard and the Python agents doing the heavy lifting.

## 🚀 Quick Start

Ready to hire your new digital team?

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
- **Interactive Brain Graphs:** Visualizing your agent's thought process with dynamic graphs.
- **Goal Flow:** Allowing you to drag-and-drop subtasks to restructure goals on the fly.
- **Smarter Logic:** Upgrading our AI models to decompose complex tasks with zero-shot precision.
- **Command Center 2.0:** Expanding the command interface for faster, friction-free interaction.
