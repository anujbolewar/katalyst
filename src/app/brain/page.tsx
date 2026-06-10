"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GraphNode {
  id: string;
  label: string;
  type: "project" | "goal" | "task" | "brain_dump";
  group: number;
  size: number;
  status: string;
  url: string;
  progress?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label?: string;
}

interface BrainData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  treeCount: number;
}

const COLORS: Record<string, string> = {
  project: "#3b82f6",
  goal: "#8b5cf6",
  task: "#f59e0b",
  brain_dump: "#ec4899",
  done: "#10b981",
  "in-progress": "#3b82f6",
  "not-started": "#6b7280",
};

export default function BrainPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/brain");
      if (!res.ok) throw new Error("Failed to load graph data");
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const loadD3 = async () => {
      const d3 = await import("d3");

      const svg = d3.select(svgRef.current!);
      svg.selectAll("*").remove();

      const rect = svgRef.current!.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const defs = svg.append("defs");
      defs.append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#4b5563");

      defs.append("filter").attr("id", "glow")
        .append("feGaussianBlur")
        .attr("stdDeviation", "3")
        .attr("result", "blur");

      const g = svg.append("g");

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.15, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });

      svg.call(zoom);
      svg.call(zoom.translateTo, width / 2, height / 2);

      const simulation = d3.forceSimulation(data.nodes as d3.SimulationNodeDatum[])
        .force("link", d3.forceLink(data.edges).id((d: unknown) => (d as GraphNode).id).distance(120))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius((d: unknown) => (d as GraphNode).size + 10));

      const link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(data.edges)
        .join("line")
        .attr("stroke", "#374151")
        .attr("stroke-width", 1.2)
        .attr("stroke-opacity", 0.4)
        .attr("marker-end", "url(#arrowhead)");

      const node = g.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(data.nodes)
        .join("g")
        .attr("cursor", "pointer")
        .call(
          d3.drag<SVGGElement, GraphNode>()
            .on("start", (_event, d) => {
              if (!_event.active) simulation.alphaTarget(0.3).restart();
              (d as unknown as { fx: number; fy: number }).fx = (d as unknown as { x: number; y: number }).x;
              (d as unknown as { fx: number; fy: number }).fy = (d as unknown as { x: number; y: number }).y;
            })
            .on("drag", (event, d) => {
              (d as unknown as { fx: number; fy: number }).fx = event.x;
              (d as unknown as { fx: number; fy: number }).fy = event.y;
            })
            .on("end", (_event, d) => {
              if (!_event.active) simulation.alphaTarget(0);
              delete (d as unknown as { fx?: number; fy?: number }).fx;
              delete (d as unknown as { fx?: number; fy?: number }).fy;
            }) as unknown as (selection: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>) => void,
        );

      node.append("circle")
        .attr("r", (d) => d.size)
        .attr("fill", (d) => {
          if (d.status === "done") return COLORS.done;
          if (d.status === "in-progress" || d.type === "project") return COLORS[d.type] ?? "#6b7280";
          if (d.status === "not-started") return COLORS["not-started"];
          if (d.status === "processed") return "#9ca3af";
          if (d.status === "unprocessed") return COLORS.brain_dump;
          return COLORS[d.type] ?? "#6b7280";
        })
        .attr("stroke", (d) => {
          if (d.progress && d.progress > 0 && d.type !== "task") return "#fff";
          return "transparent";
        })
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.5)
        .attr("opacity", 0.9);

      node.append("text")
        .text((d) => d.label.length > 30 ? d.label.slice(0, 28) + "..." : d.label)
        .attr("dx", (d) => d.size + 4)
        .attr("dy", ".35em")
        .attr("fill", "#e5e7eb")
        .attr("font-size", 10)
        .attr("font-family", "monospace")
        .attr("pointer-events", "none");

      node.on("mouseenter", function (event: MouseEvent, d: GraphNode) {
        const [mx, my] = d3.pointer(event, svg.node());
        setTooltip({ x: mx, y: my, node: d });
      });

      node.on("mouseleave", () => {
        setTooltip(null);
      });

      node.on("click", (_event, d) => {
        if (d.url) router.push(d.url);
      });

      node.on("dblclick", (_event, d) => {
        if (!d.url) return;
        window.open(d.url, "_blank");
      });

      simulation.on("tick", () => {
        link
          .attr("x1", (d) => (d.source as unknown as { x: number }).x)
          .attr("y1", (d) => (d.source as unknown as { y: number }).y)
          .attr("x2", (d) => (d.target as unknown as { x: number }).x)
          .attr("y2", (d) => (d.target as unknown as { y: number }).y);

        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });
    };

    loadD3();
  }, [data, router]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!fullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    setFullscreen(!fullscreen);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[{ label: "Brain" }]} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[{ label: "Brain" }]} />
        <div className="text-center py-20 text-muted-foreground">{error}</div>
      </div>
    );
  }

  const typeCounts = data
    ? data.nodes.reduce(
        (acc, n) => {
          acc[n.type] = (acc[n.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      )
    : {};

  return (
    <div className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50 bg-background p-4" : "space-y-4"}`}>
      {!fullscreen && <BreadcrumbNav items={[{ label: "Brain" }]} />}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {data?.nodes.length ?? 0} nodes | {data?.edges.length ?? 0} edges
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> Projects ({typeCounts.project ?? 0})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" /> Goals ({typeCounts.goal ?? 0})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Tasks ({typeCounts.task ?? 0})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899]" /> Ideas ({typeCounts.brain_dump ?? 0})
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative border border-border rounded-lg overflow-hidden bg-card" style={{ height: fullscreen ? "calc(100vh - 80px)" : "600px" }}>
        <svg ref={svgRef} className="w-full h-full" />

        {tooltip && (
          <div
            className="absolute pointer-events-none bg-popover border border-border rounded-md px-3 py-2 shadow-lg text-xs z-10"
            style={{ left: tooltip.x + 12, top: tooltip.y - 12 }}
          >
            <div className="font-medium text-foreground">{tooltip.node.label}</div>
            <div className="text-muted-foreground mt-0.5">
              {tooltip.node.type.replace(/_/g, " ")}
              {tooltip.node.progress !== undefined && (
                <span> &middot; {tooltip.node.progress}% done</span>
              )}
            </div>
            {tooltip.node.url && (
              <div className="text-muted-foreground/60 mt-0.5">
                Click to navigate &middot; Double-click for new tab
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
