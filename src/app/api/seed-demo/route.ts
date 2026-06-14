import { NextResponse } from "next/server";
import { mutateTasks, mutateGoals, mutateGoalTrees,
  mutateProjects, mutateDecisions, mutateAgents, mutateBrainDump,
  mutateActivityLog, mutateInbox } from "@/lib/storage";
import type { BrainDumpFile, InboxFile, ActivityLogFile, GoalTreeNode } from "@/lib/types";

// ─── Helpers ───────────────────────────────────────────────────────────────

function tn(id: string, title: string, description: string, children: GoalTreeNode[] = []): GoalTreeNode {
  return { id, title, description, status: "started", children };
}

export async function POST() {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

  // ─── Agents ──────────────────────────────────────────────────────────
  await mutateAgents(async (data) => {
    data.agents = [
      {
        id: "me", name: "Me", icon: "User", status: "active",
        description: "Tasks I do myself — decisions, approvals, creative direction",
        instructions: "You are the owner/CEO. Your role is to make decisions, give approvals, provide creative direction.",
        capabilities: ["decision-making", "approvals", "creative-direction", "relationship-building"],
        skillIds: ["skill_demo_eisenhower"],
        createdAt: daysAgo(30), updatedAt: daysAgo(30),
      },
      {
        id: "researcher", name: "Researcher", icon: "Search", status: "active",
        description: "Market research, competitive analysis, web scraping, evaluation",
        instructions: "Research Analyst for a solo software entrepreneur.\n\n**Web & Document Reading:** Use `./cli-engine/run-extractor.sh <url_or_path>` for clean Markdown. Do NOT use curl.\n\n**Workflow:** 1. Use extractor to get clean content 2. Analyze findings 3. Cross-reference multiple sources 4. Produce actionable insights.",
        capabilities: ["web-research", "competitive-analysis", "report-writing", "data-gathering"],
        skillIds: ["skill_demo_research"],
        createdAt: daysAgo(30), updatedAt: daysAgo(30),
      },
      {
        id: "developer", name: "Developer", icon: "Code", status: "active",
        description: "Implementation, bug fixes, testing, deployment",
        instructions: "Software Engineer. Write clean, well-tested code. Review existing patterns before writing new code.",
        capabilities: ["full-stack-development", "bug-fixes", "testing", "code-review", "deployment"],
        skillIds: ["skill_demo_task_mgmt"],
        createdAt: daysAgo(30), updatedAt: daysAgo(30),
      },
      {
        id: "marketer", name: "Marketer", icon: "Megaphone", status: "active",
        description: "Copy, growth strategy, content, SEO",
        instructions: "Growth Marketing Specialist.\n\n**Web & Document Reading:** Use `./cli-engine/run-extractor.sh <url_or_path>` for clean Markdown. Do NOT use curl.",
        capabilities: ["copywriting", "growth-strategy", "content-creation", "seo", "positioning"],
        skillIds: [],
        createdAt: daysAgo(30), updatedAt: daysAgo(30),
      },
      {
        id: "business-analyst", name: "Business Analyst", icon: "BarChart3", status: "active",
        description: "Strategy, planning, prioritization, financials",
        instructions: "Business Analyst advising a solo software entrepreneur. Review projects, goals, and priorities before making recommendations.",
        capabilities: ["market-analysis", "feature-prioritization", "business-modeling", "strategic-planning"],
        skillIds: ["skill_demo_eisenhower"],
        createdAt: daysAgo(30), updatedAt: daysAgo(30),
      },
    ];
  });

  // ─── Projects ───────────────────────────────────────────────────────
  await mutateProjects(async (data) => {
    data.projects = [
      { id: "proj_demo_1", name: "SaaS Landing Page", description: "Build a conversion-optimized landing page for our new SaaS product. Includes hero section, features, pricing, testimonials, and CTA.", status: "active", color: "#3b82f6", tags: ["marketing", "web"], teamMembers: ["developer", "marketer"], createdAt: daysAgo(14), deletedAt: null },
      { id: "proj_demo_2", name: "API Integration Layer", description: "Create a unified API layer connecting third-party services with auth, rate limiting, and error handling.", status: "active", color: "#8b5cf6", tags: ["backend", "infrastructure"], teamMembers: ["developer", "researcher"], createdAt: daysAgo(21), deletedAt: null },
      { id: "proj_demo_3", name: "Q4 Marketing Campaign", description: "Multi-channel marketing campaign for Q4 product launch — social media, email, and content marketing.", status: "completed", color: "#10b981", tags: ["marketing", "growth"], teamMembers: ["marketer", "business-analyst"], createdAt: daysAgo(60), deletedAt: null },
    ];
  });

  // ─── Goals ──────────────────────────────────────────────────────────
  await mutateGoals(async (data) => {
    data.goals = [
      { id: "goal_demo_1", title: "Launch SaaS product to first 100 users", type: "long-term", timeframe: "Q2 2026", parentGoalId: null, projectId: "proj_demo_1", status: "in-progress", milestones: ["mile_demo_1", "mile_demo_2", "mile_demo_3"], tasks: ["task_demo_1", "task_demo_2", "task_demo_5", "task_demo_7"], createdAt: daysAgo(30), deletedAt: null },
      { id: "mile_demo_1", title: "Landing page live and collecting signups", type: "medium-term", timeframe: daysAgo(-7), parentGoalId: "goal_demo_1", projectId: "proj_demo_1", status: "in-progress", milestones: [], tasks: ["task_demo_1", "task_demo_2"], createdAt: daysAgo(14), deletedAt: null },
      { id: "mile_demo_2", title: "Beta API ready for testing", type: "medium-term", timeframe: daysAgo(-21), parentGoalId: "goal_demo_1", projectId: "proj_demo_2", status: "in-progress", milestones: [], tasks: ["task_demo_3", "task_demo_4"], createdAt: daysAgo(14), deletedAt: null },
      { id: "mile_demo_3", title: "First 50 beta signups", type: "medium-term", timeframe: daysAgo(-30), parentGoalId: "goal_demo_1", projectId: null, status: "not-started", milestones: [], tasks: ["task_demo_5"], createdAt: daysAgo(10), deletedAt: null },
      { id: "goal_demo_2", title: "Build sustainable content engine", type: "long-term", timeframe: "Q3 2026", parentGoalId: null, projectId: null, status: "not-started", milestones: [], tasks: ["task_demo_6"], createdAt: daysAgo(7), deletedAt: null },
    ];
  });

  // ─── Tasks ──────────────────────────────────────────────────────────
  await mutateTasks(async (data) => {
    data.tasks = [
      {
        id: "task_demo_1", title: "Design hero section for landing page",
        description: "Create a compelling hero section with headline, subheadline, CTA button, and product screenshot. Should communicate value prop in under 5 seconds.",
        importance: "important", urgency: "urgent", kanban: "in-progress",
        projectId: "proj_demo_1", milestoneId: "mile_demo_1", assignedTo: "developer",
        collaborators: ["marketer"], dailyActions: [],
        subtasks: [{ id: "sub_1", title: "Write headline and subheadline copy", done: true },{ id: "sub_2", title: "Design layout in Figma", done: true },{ id: "sub_3", title: "Implement responsive HTML/CSS", done: false },{ id: "sub_4", title: "Add animations and micro-interactions", done: false }],
        blockedBy: [], estimatedMinutes: 180, actualMinutes: null,
        acceptanceCriteria: ["Hero loads in under 2 seconds", "CTA above fold on mobile", "Headline communicates core value prop"],
        comments: [{ id: "cmt_1", author: "me", content: "Focus on 'save time' messaging. Our users care most about efficiency.", createdAt: daysAgo(3) },{ id: "cmt_2", author: "developer", content: "Copy done. Moving to responsive implementation.", createdAt: daysAgo(1) }],
        tags: ["design", "frontend"], notes: "",
        createdAt: daysAgo(7), updatedAt: hoursAgo(6), dueDate: null, completedAt: null, deletedAt: null,
      },
      {
        id: "task_demo_2", title: "Set up email signup form with validation",
        description: "Add an email capture form with client+server validation, duplicate detection, and database storage.",
        importance: "important", urgency: "not-urgent", kanban: "not-started",
        projectId: "proj_demo_1", milestoneId: "mile_demo_1", assignedTo: "developer",
        collaborators: [], dailyActions: [], subtasks: [],
        blockedBy: ["task_demo_1"], estimatedMinutes: 120, actualMinutes: null,
        acceptanceCriteria: ["Client and server validation", "Duplicate email detection", "Success toast"],
        comments: [], tags: ["backend", "forms"], notes: "Consider using a third-party form service to speed this up.",
        createdAt: daysAgo(7), updatedAt: daysAgo(7), dueDate: null, completedAt: null, deletedAt: null,
      },
      {
        id: "task_demo_3", title: "Research competitor API pricing models",
        description: "Analyze how competitors price their API access — rate limits, tiers, and developer experience.",
        importance: "not-important", urgency: "urgent", kanban: "in-progress",
        projectId: "proj_demo_2", milestoneId: "mile_demo_2", assignedTo: "researcher",
        collaborators: ["business-analyst"], dailyActions: [],
        subtasks: [{ id: "sub_5", title: "Identify top 5 competitors", done: true },{ id: "sub_6", title: "Document pricing tiers", done: false },{ id: "sub_7", title: "Analyze developer docs quality", done: false }],
        blockedBy: [], estimatedMinutes: 90, actualMinutes: null,
        acceptanceCriteria: ["Comparison table with 5+ competitors", "Price-per-request analysis"],
        comments: [{ id: "cmt_3", author: "researcher", content: "Found 7 competitors. Most use tiered pricing with free tiers. Full analysis coming tomorrow.", createdAt: hoursAgo(8) }],
        tags: ["research", "pricing"], notes: "",
        createdAt: daysAgo(5), updatedAt: hoursAgo(8), dueDate: null, completedAt: null, deletedAt: null,
      },
      {
        id: "task_demo_4", title: "Design API authentication flow",
        description: "Design the OAuth2 authentication flow for the API. Consider developer experience, security, and token management.",
        importance: "important", urgency: "not-urgent", kanban: "not-started",
        projectId: "proj_demo_2", milestoneId: "mile_demo_2", assignedTo: null,
        collaborators: [], dailyActions: [], subtasks: [],
        blockedBy: ["task_demo_3"], estimatedMinutes: 240, actualMinutes: null,
        acceptanceCriteria: ["OAuth2 flow diagram", "Token rotation strategy", "Rate limiting design"],
        comments: [], tags: ["security", "architecture"], notes: "Depends on competitor research for approach.",
        createdAt: daysAgo(5), updatedAt: daysAgo(5), dueDate: null, completedAt: null, deletedAt: null,
      },
      {
        id: "task_demo_5", title: "Write launch announcement blog post",
        description: "Write a blog post announcing the product launch with screenshots, key features, and early-access signup.",
        importance: "important", urgency: "not-urgent", kanban: "not-started",
        projectId: "proj_demo_1", milestoneId: "mile_demo_3", assignedTo: "marketer",
        collaborators: [], dailyActions: [], subtasks: [],
        blockedBy: ["task_demo_1"], estimatedMinutes: 120, actualMinutes: null,
        acceptanceCriteria: ["1000-1500 words", "3+ product screenshots", "SEO optimized title + meta"],
        comments: [], tags: ["content", "launch"], notes: "",
        createdAt: daysAgo(3), updatedAt: daysAgo(3), dueDate: null, completedAt: null, deletedAt: null,
      },
      {
        id: "task_demo_6", title: "Analyze content marketing strategy options",
        description: "Research and recommend a content strategy: blog, YouTube, Twitter, or newsletter with effort estimates and expected ROI.",
        importance: "not-important", urgency: "not-urgent", kanban: "done",
        projectId: null, milestoneId: null, assignedTo: "business-analyst",
        collaborators: ["researcher"], dailyActions: [],
        subtasks: [{ id: "sub_8", title: "Research channel options", done: true },{ id: "sub_9", title: "Estimate effort per channel", done: true },{ id: "sub_10", title: "Create recommendation doc", done: true }],
        blockedBy: [], estimatedMinutes: 90, actualMinutes: 75,
        acceptanceCriteria: ["4+ channels compared", "ROI estimates per channel", "Clear recommendation"],
        comments: [{ id: "cmt_4", author: "business-analyst", content: "Completed. Recommending blog + Twitter combo. Newsletter after 500+ subs.", createdAt: daysAgo(2) }],
        tags: ["strategy", "content"], notes: "Recommendation: Weekly blog posts + Twitter thread repurposing. Newsletter when audience exceeds 500.",
        createdAt: daysAgo(10), updatedAt: daysAgo(2), dueDate: null, completedAt: daysAgo(2), deletedAt: null,
      },
      {
        id: "task_demo_7", title: "Review and approve landing page design",
        description: "Review the developer's landing page implementation and provide feedback. Approve or request changes.",
        importance: "important", urgency: "urgent", kanban: "not-started",
        projectId: "proj_demo_1", milestoneId: "mile_demo_1", assignedTo: "me",
        collaborators: [], dailyActions: [], subtasks: [],
        blockedBy: ["task_demo_1"], estimatedMinutes: 30, actualMinutes: null,
        acceptanceCriteria: ["Design reviewed against brand", "Mobile responsiveness verified", "CTA placement approved"],
        comments: [], tags: ["review"], notes: "",
        createdAt: daysAgo(5), updatedAt: daysAgo(5), dueDate: null, completedAt: null, deletedAt: null,
      },
    ];
  });

  // ─── Goal Trees ─────────────────────────────────────────────────────

  await mutateGoalTrees(async (data) => {
    data.trees = [
      {
        goalId: "goal_demo_1",
        goalTitle: "Launch SaaS product to first 100 users",
        taskIds: ["task_demo_1", "task_demo_2", "task_demo_5", "task_demo_7"],
        rootNode: tn("root_demo_1",
          "Launch SaaS product to first 100 users",
          "Complete product launch with landing page, email capture, content marketing, and initial user acquisition",
          [
            tn("cat_demo_1a", "Landing Page & Signups", "Build and launch the conversion-optimized web presence",
              [
                tn("leaf_demo_1a1", "Hero section design", "Create compelling hero with headline, subheadline, CTA, and product screenshot"),
                tn("leaf_demo_1a2", "Email signup form", "Add validation-enabled email capture form with duplicate detection"),
              ]),
            tn("cat_demo_1b", "Content & Launch", "Create launch content and marketing materials",
              [
                tn("leaf_demo_1b1", "Launch blog post", "Write 1000-1500 word announcement with screenshots and SEO optimization"),
                tn("leaf_demo_1b2", "Design review & approval", "Review hero implementation for brand alignment and mobile responsiveness"),
              ]),
          ]),
        pipelineData: {
          researcher: {
            brief: "SaaS landing pages need clear value props above the fold. Hero sections with social proof convert 2-3x better. Email capture early in the funnel is critical for nurturing.",
            findings: [
              "Above-the-fold CTA increases conversion by 30%",
              "Mobile-responsive hero is essential — 60%+ of traffic is mobile",
              "SEO-friendly blog content drives organic signups 3-4 weeks post-launch",
            ],
          },
          reviewer: {
            verdict: "PASS",
            notes: "Tasks cover the critical launch path — hero design, email capture, content, and approvals. Good balance of technical and marketing work.",
            suggestions: ["Consider adding an analytics tracking task for post-launch optimization"],
          },
        },
        createdAt: daysAgo(30),
        updatedAt: daysAgo(1),
      },
      {
        goalId: "mile_demo_2",
        goalTitle: "Beta API ready for testing",
        taskIds: ["task_demo_3", "task_demo_4"],
        rootNode: tn("root_demo_2",
          "Beta API ready for testing",
          "Complete API integration layer with competitive pricing research and authentication flow design",
          [
            tn("cat_demo_2a", "Research & Planning", "Understand the competitive landscape and design decisions",
              [
                tn("leaf_demo_2a1", "Competitor pricing research", "Analyze 5+ competitors' API pricing, rate limits, and developer experience"),
                tn("leaf_demo_2a2", "Auth flow design", "Design OAuth2 authentication with token rotation and rate limiting"),
              ]),
          ]),
        pipelineData: {
          researcher: {
            brief: "API pricing models follow industry norms — tiered plans with free tiers are standard. Developer experience (docs, SDKs, onboarding) differentiates the top players.",
            findings: [
              "Most competitors offer free tiers with 1000 req/month",
              "Paid tiers range from $29-$99/month for startups",
              "Clear docs and quickstart guides are the #1 developer ask",
            ],
          },
          reviewer: {
            verdict: "PASS",
            notes: "Research-first approach is correct — pricing decisions should be data-driven. Auth design can proceed in parallel once competitor data is in.",
            suggestions: [],
          },
        },
        createdAt: daysAgo(14),
        updatedAt: daysAgo(7),
      },
    ];
  });

  // ─── Brain Dump ─────────────────────────────────────────────────────
  await mutateBrainDump(async (data: BrainDumpFile) => {
    data.entries = [
      { id: "bd_demo_1", content: "Could we add a referral program? Give users a unique link and reward them for signups.", capturedAt: daysAgo(2), processed: false, convertedTo: null, tags: ["growth", "idea"] },
      { id: "bd_demo_2", content: "Look into Stripe for payment processing. Need to compare with Paddle for international taxes.", capturedAt: daysAgo(1), processed: false, convertedTo: null, tags: ["payments"] },
      { id: "bd_demo_3", content: "Add dark mode toggle to the landing page — match the Katalyst vibe.", capturedAt: hoursAgo(4), processed: false, convertedTo: null, tags: ["design"] },
      { id: "bd_demo_4", content: "Competitor X just raised $5M. Check their new features and positioning.", capturedAt: daysAgo(3), processed: true, convertedTo: "task_demo_3", tags: ["competitive-analysis"] },
      { id: "bd_demo_5", content: "Consider building a CLI onboarding wizard to reduce time-to-first-task.", capturedAt: hoursAgo(2), processed: false, convertedTo: null, tags: ["ux", "idea"] },
    ];
  });

  // ─── Inbox ───────────────────────────────────────────────────────────
  await mutateInbox(async (data: InboxFile) => {
    data.messages = [
      { id: "msg_demo_1", from: "system", to: "developer", type: "delegation", taskId: "task_demo_1", subject: "New assignment: Design hero section for landing page", body: "You have been assigned to: \"Design hero section for landing page\"\n\nCreate a compelling hero section with headline, subheadline, CTA button, and product screenshot.", status: "read", createdAt: daysAgo(7), readAt: daysAgo(7) },
      { id: "msg_demo_2", from: "business-analyst", to: "me", type: "report", taskId: "task_demo_6", subject: "Completed: Analyze content marketing strategy options", body: "Task \"Analyze content marketing strategy options\" has been completed.\n\nRecommendation: Start with weekly blog posts + Twitter thread repurposing. Newsletter when audience exceeds 500 subscribers.", status: "unread", createdAt: daysAgo(2), readAt: null },
      { id: "msg_demo_3", from: "researcher", to: "me", type: "update", taskId: "task_demo_3", subject: "Progress update: API pricing research", body: "Halfway through the competitor API pricing analysis. Found 7 competitors.\n\nMost offer free tier with 1000 requests/month. Paid tiers range from $29-$99/month. Full comparison tomorrow.", status: "unread", createdAt: hoursAgo(8), readAt: null },
      { id: "msg_demo_4", from: "system", to: "marketer", type: "delegation", taskId: "task_demo_5", subject: "New assignment: Write launch announcement blog post", body: "You have been assigned to: \"Write launch announcement blog post\"\n\nInclude product screenshots, key features, and early-access signup link.", status: "unread", createdAt: daysAgo(3), readAt: null },
    ];
  });

  // ─── Activity Log ────────────────────────────────────────────────────
  await mutateActivityLog(async (data: ActivityLogFile) => {
    data.events = [
      { id: "evt_1", type: "task_created", actor: "system", taskId: "task_demo_1", summary: "Task created: Design hero section", details: "Assigned to developer with marketer as collaborator.", timestamp: daysAgo(7) },
      { id: "evt_2", type: "task_delegated", actor: "system", taskId: "task_demo_3", summary: "Delegated to researcher: API pricing", details: "Assigned to researcher with business-analyst collaborating.", timestamp: daysAgo(5) },
      { id: "evt_3", type: "task_updated", actor: "developer", taskId: "task_demo_1", summary: "Started: Design hero section", details: "Copy subtasks completed. Moving to responsive implementation.", timestamp: daysAgo(3) },
      { id: "evt_4", type: "task_completed", actor: "business-analyst", taskId: "task_demo_6", summary: "Completed: Content strategy analysis", details: "Marked as done with recommendation for blog + Twitter combo.", timestamp: daysAgo(2) },
      { id: "evt_5", type: "task_delegated", actor: "system", taskId: "task_demo_5", summary: "Delegated to marketer: Launch blog post", details: "Assigned to marketer.", timestamp: daysAgo(3) },
      { id: "evt_6", type: "agent_checkin", actor: "researcher", taskId: "task_demo_3", summary: "Researcher check-in: API pricing 50%", details: "Found 7 competitors. Compiling comparison table.", timestamp: hoursAgo(8) },
      { id: "evt_7", type: "task_delegated", actor: "system", taskId: "task_demo_7", summary: "Delegated to you: Review landing page", details: "Design review assigned. Developer is waiting on your approval.", timestamp: daysAgo(5) },
    ];
  });

  // ─── Decisions ───────────────────────────────────────────────────────
  await mutateDecisions(async (data) => {
    data.decisions = [
      {
        id: "dec_demo_1", requestedBy: "developer", taskId: "task_demo_1",
        question: "Which animation library should we use for the hero section?",
        options: ["Framer Motion (full-featured, larger bundle)", "CSS animations only (lightweight, limited)", "GSAP (powerful, commercial license)"],
        context: "The hero section needs smooth entrance animations and scroll-triggered effects. Framer Motion integrates well with React but adds ~30kb. CSS-only is lighter but harder to maintain complex sequences.",
        status: "pending", answer: null, answeredAt: null, createdAt: daysAgo(1),
      },
      {
        id: "dec_demo_2", requestedBy: "marketer", taskId: "task_demo_5",
        question: "What tone should the launch blog post use?",
        options: ["Professional/Enterprise (trust-focused)", "Casual/Developer-friendly (approachable)", "Bold/Visionary (thought-leadership)"],
        context: "Our target audience is technical founders and solo developers. The tone will set expectations for all future content.",
        status: "pending", answer: null, answeredAt: null, createdAt: hoursAgo(12),
      },
    ];
  });

  return NextResponse.json({ ok: true, message: "Demo data loaded — agents, projects, goals, tasks, goal trees, inbox, activity, decisions, and brain dump are ready." });
}
