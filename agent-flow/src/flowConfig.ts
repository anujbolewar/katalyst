export type Phase = 'setup' | 'loop' | 'decision' | 'done';

export interface FlowStep {
  id: string;
  label: string;
  description: string;
  phase: Phase;
  position?: { x: number; y: number };
}

export interface FlowEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface FlowNote {
  id: string;
  appearsWithStep: number;
  position?: { x: number; y: number };
  color: { bg: string; border: string };
  content: string;
}

// Phase styling used for the nodes
export const phaseColors: Record<Phase, { bg: string; border: string }> = {
  setup: { bg: '#f0f7ff', border: '#4a90d9' },
  loop: { bg: '#f5f5f5', border: '#666666' },
  decision: { bg: '#fff8e6', border: '#c9a227' },
  done: { bg: '#f0fff4', border: '#38a169' },
};

// Define all agent flow steps here
export const steps: FlowStep[] = [
  // Setup phase
  { id: '1', label: 'User Request', description: 'User inputs a prompt', phase: 'setup' },
  { id: '2', label: 'Context Gathering', description: 'Agent researches repository', phase: 'setup' },
  { id: '3', label: 'Planning', description: 'Creates implementation plan', phase: 'setup' },
  
  // Decision phase
  { id: '4', label: 'User Approval', description: 'Reviews and approves plan', phase: 'decision' },
  
  // Loop phase
  { id: '5', label: 'Execution Loop', description: 'Agent begins executing', phase: 'loop' },
  { id: '6', label: 'Tool Usage', description: 'Reads, edits code, or runs commands', phase: 'loop' },
  { id: '7', label: 'Verification', description: 'Runs tests / verifies changes', phase: 'loop' },
  
  // Decision phase
  { id: '8', label: 'More tasks?', description: 'Checks if tasks remain', phase: 'decision' },
  
  // Exit
  { id: '9', label: 'Walkthrough', description: 'Summarizes work and completes', phase: 'done' },
];

// Define positions mapping for each step ID
export const positions: { [key: string]: { x: number; y: number } } = {
  // Setup phase
  '1': { x: 20, y: 20 },
  '2': { x: 80, y: 130 },
  '3': { x: 60, y: 250 },
  
  // Decision phase
  '4': { x: 40, y: 420 },
  
  // Loop phase
  '5': { x: 450, y: 300 },
  '6': { x: 750, y: 450 },
  '7': { x: 470, y: 520 },
  
  // Decision phase
  '8': { x: 200, y: 620 },
  
  // Exit
  '9': { x: 350, y: 880 },
  
  // Notes positions
  'note-1': { x: 340, y: 20 },
  'note-2': { x: 340, y: 150 },
  'note-3': { x: 800, y: 320 },
};

// Define how nodes connect together
export const edges: FlowEdge[] = [
  // Setup phase
  { source: '1', target: '2', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '2', target: '3', sourceHandle: 'bottom', targetHandle: 'top' },
  { source: '3', target: '4', sourceHandle: 'bottom', targetHandle: 'top' },
  
  // Transition to loop
  { source: '4', target: '5', sourceHandle: 'right', targetHandle: 'left' },
  
  // Execution loop
  { source: '5', target: '6', sourceHandle: 'right', targetHandle: 'top' },
  { source: '6', target: '7', sourceHandle: 'left-source', targetHandle: 'right-target' },
  { source: '7', target: '8', sourceHandle: 'left-source', targetHandle: 'right-target' },
  
  // Loop back or finish
  { source: '8', target: '5', sourceHandle: 'top-source', targetHandle: 'bottom-target', label: 'Yes' },
  { source: '8', target: '9', sourceHandle: 'bottom', targetHandle: 'top', label: 'No' },
];

// Define notes that appear at specific steps
export const notes: FlowNote[] = [
  {
    id: 'note-1',
    appearsWithStep: 1, // Appears when step 1 becomes visible
    color: { bg: '#f5f0ff', border: '#8b5cf6' },
    content: `User: "Add a new feature to the login page"`
  },
  {
    id: 'note-2',
    appearsWithStep: 3,
    color: { bg: '#fdf4f0', border: '#c97a50' },
    content: `# Implementation Plan\n\n- Proposed Changes\n- User Review Required`
  },
  {
    id: 'note-3',
    appearsWithStep: 6,
    color: { bg: '#f0fdf4', border: '#22c55e' },
    content: `tool: write_to_file\ntarget: src/LoginPage.tsx\n...`
  }
];
