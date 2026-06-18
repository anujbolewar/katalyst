import { useCallback, useState, useEffect } from 'react';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  reconnectEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { flows, phaseColors } from './flowConfig';
import type { Phase, FlowStep, FlowNote } from './flowConfig';

const NODE_W = 260;
const STEP_GAP = 240;

function CustomNode({ data }: { data: { title: string; description: string; phase: Phase; codeRef?: string; example?: string; dataFlow?: string } }) {
  const colors = phaseColors[data.phase];
  return (
    <div className="custom-node" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div className="node-content">
        <div className="node-phase-tag" style={{ backgroundColor: colors.border }}>{colors.label}</div>
        <div className="node-title">{data.title}</div>
        {data.description && <div className="node-description">{data.description}</div>}
        {data.codeRef && <div className="node-code-ref">{data.codeRef}</div>}
        {data.example && <div className="node-example">💡 {data.example}</div>}
        {data.dataFlow && <div className="node-data-flow">↔ {data.dataFlow}</div>}
      </div>
    </div>
  );
}

function NoteNode({ data }: { data: { content: string; color: { bg: string; border: string } } }) {
  return (
    <div className="note-node" style={{ backgroundColor: data.color.bg, borderColor: data.color.border }}>
      <pre>{data.content}</pre>
    </div>
  );
}

const nodeTypes = { custom: CustomNode, note: NoteNode };

function makeStepNode(step: FlowStep, index: number): Node {
  const extra = (step.example ? 28 : 0) + (step.dataFlow ? 28 : 0);
  return {
    id: step.id,
    type: 'custom',
    position: { x: 300, y: index * STEP_GAP + 80 },
    data: {
      title: step.label,
      description: step.description,
      phase: step.phase,
      codeRef: step.codeRef,
      example: step.example,
      dataFlow: step.dataFlow,
    },
    style: { width: NODE_W, height: 88 + extra },
    hidden: false,
  };
}

function makeNoteNode(note: FlowNote): Node {
  return {
    id: note.id,
    type: 'note',
    position: { x: 620, y: note.appearsWithStep * STEP_GAP + 50 },
    data: { content: note.content, color: note.color },
    style: { width: 290 },
    hidden: false,
    draggable: true,
    selectable: false,
    connectable: false,
  };
}

function makeEdge(conn: { source: string; target: string; label?: string }): Edge {
  return {
    id: `e${conn.source}-${conn.target}`,
    source: conn.source,
    target: conn.target,
    animated: true,
    label: conn.label,
    style: { stroke: '#666', strokeWidth: 2 },
    labelStyle: { fill: '#444', fontWeight: 600, fontSize: 13 },
    labelBgStyle: { fill: '#fff', stroke: '#ccc', strokeWidth: 1 },
    labelShowBg: true,
    hidden: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#666' },
  };
}

type TabId = 'system' | 'daemon' | 'goal' | 'agents';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('system');
  const [visibleCount, setVisibleCount] = useState(1);

  const flow = flows[activeTab];
  const { steps, edges: edgeConns, notes } = flow;

  const buildAllNodes = useCallback((): Node[] => {
    return [...steps.map((s, i) => makeStepNode(s, i)), ...notes.map(makeNoteNode)];
  }, [steps, notes]);

  const buildAllEdges = useCallback((): Edge[] => {
    return edgeConns.map(makeEdge);
  }, [edgeConns]);

  const initialNodes = buildAllNodes();
  const initialEdges = buildAllEdges();

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  // Rebuild all nodes/edges when tab or step changes
  useEffect(() => {
    const flow = flows[activeTab];
    const st = flow.steps;
    const nt = flow.notes;
    const ec = flow.edges;

    setNodes([
      ...st.map((s, i) => {
        const extra = (s.example ? 28 : 0) + (s.dataFlow ? 28 : 0);
        const vis = i < visibleCount;
        return {
          id: s.id, type: 'custom',
          position: { x: 300, y: i * STEP_GAP + 80 },
          data: { title: s.label, description: s.description, phase: s.phase, codeRef: s.codeRef, example: s.example, dataFlow: s.dataFlow },
          style: { width: NODE_W, height: 88 + extra, opacity: vis ? 1 : 0, pointerEvents: vis ? 'all' : 'none' },
          hidden: !vis,
        } as Node;
      }),
      ...nt.map((note) => {
        const vis = visibleCount >= note.appearsWithStep;
        return {
          id: note.id, type: 'note',
          position: { x: 620, y: note.appearsWithStep * STEP_GAP + 50 },
          data: { content: note.content, color: note.color },
          style: { width: 290, opacity: vis ? 1 : 0, pointerEvents: vis ? 'all' : 'none' },
          hidden: !vis, draggable: true, selectable: false, connectable: false,
        } as Node;
      }),
    ]);

    setEdges(ec.map((conn) => {
      const srcIdx = st.findIndex((s) => s.id === conn.source);
      const tgtIdx = st.findIndex((s) => s.id === conn.target);
      const vis = srcIdx >= 0 && tgtIdx >= 0 && srcIdx < visibleCount && tgtIdx < visibleCount;
      return {
        id: `e${conn.source}-${conn.target}`,
        source: conn.source, target: conn.target,
        animated: vis, label: vis ? conn.label : undefined,
        style: { stroke: '#666', strokeWidth: 2, opacity: vis ? 1 : 0 },
        labelStyle: { fill: '#444', fontWeight: 600, fontSize: 13 },
        labelBgStyle: { fill: '#fff', stroke: '#ccc', strokeWidth: 1 },
        labelShowBg: true,
        hidden: !vis,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#666' },
      } as Edge;
    }));
  }, [activeTab, visibleCount]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: '#666', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#666' } }, eds));
    },
    [setEdges]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds)),
    [setEdges]
  );

  const handleNext = () => visibleCount < steps.length && setVisibleCount(visibleCount + 1);
  const handlePrev = () => visibleCount > 1 && setVisibleCount(visibleCount - 1);
  const handleReset = () => setVisibleCount(1);

  return (
    <div className="app-container">
      <div className="header">
        <h1>Katalyst — Agent Workflow</h1>
        <p>{flow.description}</p>
      </div>

      <div className="tab-bar">
        {(Object.keys(flows) as TabId[]).map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab); setVisibleCount(1); }}
          >
            {flows[tab].label}
          </button>
        ))}
      </div>

      <div className="phase-legend">
        {Object.entries(phaseColors).map(([key, color]) => (
          <div key={key} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: color.border }} />
            <span className="legend-label">{color.label}</span>
          </div>
        ))}
      </div>

      <div className="flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={true}
          nodesConnectable={true}
          edgesReconnectable={true}
          elementsSelectable={true}
          deleteKeyCode={['Backspace', 'Delete']}
          panOnDrag={true}
          panOnScroll={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={true}
          selectNodesOnDrag={false}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#ddd" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="controls">
        <button onClick={handlePrev} disabled={visibleCount <= 1}>← Previous</button>
        <span className="step-counter">Step {visibleCount} / {steps.length}</span>
        <button onClick={handleNext} disabled={visibleCount >= steps.length}>Next →</button>
        <button onClick={handleReset} className="reset-btn">Reset</button>
      </div>
      <div className="instructions">Click Next to walk through the flow — drag nodes to rearrange</div>
    </div>
  );
}

export default App;
