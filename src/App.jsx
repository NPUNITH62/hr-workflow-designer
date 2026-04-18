import { useState, useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

// ─────────────────────────────────────────────
// MOCK API LAYER
// ─────────────────────────────────────────────
const MockAPI = {
  getAutomations: async () => {
    await new Promise((r) => setTimeout(r, 300));
    return [
      { id: "send_email", label: "Send Email", params: ["to", "subject", "body"] },
      { id: "generate_doc", label: "Generate Document", params: ["template", "recipient"] },
      { id: "notify_slack", label: "Notify Slack", params: ["channel", "message"] },
      { id: "update_hris", label: "Update HRIS Record", params: ["employee_id", "field", "value"] },
      { id: "create_ticket", label: "Create Ticket", params: ["system", "title", "priority"] },
    ];
  },
  simulate: async (workflow) => {
    await new Promise((r) => setTimeout(r, 800));
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];
    const logs = [];

    const startNodes = nodes.filter((n) => n.type === "startNode");
    const endNodes = nodes.filter((n) => n.type === "endNode");
    if (startNodes.length === 0) return { success: false, error: "No Start Node found.", logs: [] };
    if (endNodes.length === 0) return { success: false, error: "No End Node found.", logs: [] };

    const adjMap = {};
    nodes.forEach((n) => (adjMap[n.id] = []));
    edges.forEach((e) => {
      if (adjMap[e.source]) adjMap[e.source].push(e.target);
    });

    const visited = new Set();
    const queue = [startNodes[0].id];
    let step = 0;

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (visited.has(nodeId)) {
        logs.push({ step: ++step, status: "warning", message: `⚠ Cycle detected at node ${nodeId}` });
        continue;
      }
      visited.add(nodeId);
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const label = node.data?.label || node.type;
      const typeMap = {
        startNode: "🟢 START",
        taskNode: "📋 TASK",
        approvalNode: "✅ APPROVAL",
        automatedNode: "⚡ AUTOMATED",
        endNode: "🔴 END",
      };
      logs.push({
        step: ++step,
        status: "success",
        nodeType: node.type,
        message: `${typeMap[node.type] || "NODE"}: ${label}`,
        detail: getNodeDetail(node),
      });

      adjMap[nodeId].forEach((next) => queue.push(next));
    }

    const unvisited = nodes.filter((n) => !visited.has(n.id));
    if (unvisited.length > 0) {
      logs.push({
        step: ++step,
        status: "warning",
        message: `⚠ Unreachable nodes: ${unvisited.map((n) => n.data?.label || n.id).join(", ")}`,
      });
    }

    return { success: true, logs };
  },
};

function getNodeDetail(node) {
  const d = node.data;
  if (node.type === "taskNode") return d.assignee ? `Assignee: ${d.assignee}` : "";
  if (node.type === "approvalNode") return d.approverRole ? `Approver: ${d.approverRole}` : "";
  if (node.type === "automatedNode") return d.action ? `Action: ${d.action}` : "";
  return "";
}

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const COLORS = {
  bg: "#0f1117",
  surface: "#161b27",
  surfaceAlt: "#1c2333",
  border: "#2a3347",
  borderLight: "#3a4560",
  accent: "#f97316",
  accentDim: "rgba(249,115,22,0.15)",
  blue: "#3b82f6",
  blueDim: "rgba(59,130,246,0.15)",
  green: "#22c55e",
  greenDim: "rgba(34,197,94,0.12)",
  purple: "#a855f7",
  purpleDim: "rgba(168,85,247,0.12)",
  yellow: "#eab308",
  yellowDim: "rgba(234,179,8,0.12)",
  red: "#ef4444",
  redDim: "rgba(239,68,68,0.12)",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textDim: "#94a3b8",
};

const NODE_STYLES = {
  startNode: { color: COLORS.green, dim: COLORS.greenDim, icon: "▶", label: "Start" },
  taskNode: { color: COLORS.blue, dim: COLORS.blueDim, icon: "◈", label: "Task" },
  approvalNode: { color: COLORS.yellow, dim: COLORS.yellowDim, icon: "◉", label: "Approval" },
  automatedNode: { color: COLORS.purple, dim: COLORS.purpleDim, icon: "⚡", label: "Automated" },
  endNode: { color: COLORS.red, dim: COLORS.redDim, icon: "■", label: "End" },
};

// ─────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────
const baseNodeStyle = (type) => ({
  background: NODE_STYLES[type].dim,
  border: `1.5px solid ${NODE_STYLES[type].color}`,
  borderRadius: 12,
  padding: "10px 14px",
  minWidth: 160,
  fontFamily: "'DM Mono', monospace",
  cursor: "pointer",
  boxShadow: `0 0 18px ${NODE_STYLES[type].color}22`,
  transition: "box-shadow 0.2s",
});

// ─────────────────────────────────────────────
// CUSTOM NODES
// ─────────────────────────────────────────────
function NodeShell({ type, data, selected }) {
  const s = NODE_STYLES[type];
  return (
    <div
      style={{
        ...baseNodeStyle(type),
        boxShadow: selected
          ? `0 0 0 2px ${s.color}, 0 0 24px ${s.color}44`
          : `0 0 18px ${s.color}22`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: s.color, fontSize: 16 }}>{s.icon}</span>
        <div>
          <div style={{ fontSize: 9, color: s.color, textTransform: "uppercase", letterSpacing: 1, opacity: 0.8 }}>
            {s.label}
          </div>
          <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, marginTop: 1 }}>
            {data.label || `${s.label} Node`}
          </div>
          {data.assignee && (
            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>👤 {data.assignee}</div>
          )}
          {data.approverRole && (
            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>🔑 {data.approverRole}</div>
          )}
          {data.action && (
            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>⚡ {data.action}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const StartNode = ({ data, selected }) => (
  <>
    <NodeShell type="startNode" data={data} selected={selected} />
    <Handle type="source" position={Position.Bottom} style={{ background: COLORS.green, border: "none" }} />
  </>
);

const TaskNode = ({ data, selected }) => (
  <>
    <Handle type="target" position={Position.Top} style={{ background: COLORS.blue, border: "none" }} />
    <NodeShell type="taskNode" data={data} selected={selected} />
    <Handle type="source" position={Position.Bottom} style={{ background: COLORS.blue, border: "none" }} />
  </>
);

const ApprovalNode = ({ data, selected }) => (
  <>
    <Handle type="target" position={Position.Top} style={{ background: COLORS.yellow, border: "none" }} />
    <NodeShell type="approvalNode" data={data} selected={selected} />
    <Handle type="source" position={Position.Bottom} style={{ background: COLORS.yellow, border: "none" }} />
  </>
);

const AutomatedNode = ({ data, selected }) => (
  <>
    <Handle type="target" position={Position.Top} style={{ background: COLORS.purple, border: "none" }} />
    <NodeShell type="automatedNode" data={data} selected={selected} />
    <Handle type="source" position={Position.Bottom} style={{ background: COLORS.purple, border: "none" }} />
  </>
);

const EndNode = ({ data, selected }) => (
  <>
    <Handle type="target" position={Position.Top} style={{ background: COLORS.red, border: "none" }} />
    <NodeShell type="endNode" data={data} selected={selected} />
  </>
);

const nodeTypes = {
  startNode: StartNode,
  taskNode: TaskNode,
  approvalNode: ApprovalNode,
  automatedNode: AutomatedNode,
  endNode: EndNode,
};

// ─────────────────────────────────────────────
// NODE FORM PANEL
// ─────────────────────────────────────────────
function Label({ children }) {
  return (
    <label style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 4 }}>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        padding: "7px 10px",
        color: COLORS.text,
        fontSize: 13,
        outline: "none",
        fontFamily: "'DM Mono', monospace",
        boxSizing: "border-box",
      }}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value || ""}
      onChange={onChange}
      style={{
        width: "100%",
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        padding: "7px 10px",
        color: COLORS.text,
        fontSize: 13,
        outline: "none",
        fontFamily: "'DM Mono', monospace",
      }}
    >
      <option value="">-- Select --</option>
      {options.map((o) => (
        <option key={o.value || o} value={o.value || o}>
          {o.label || o}
        </option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 38,
          height: 20,
          borderRadius: 10,
          background: checked ? COLORS.accent : COLORS.border,
          cursor: "pointer",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
          }}
        />
      </div>
      <span style={{ fontSize: 12, color: COLORS.textDim }}>{label}</span>
    </div>
  );
}

function KVEditor({ pairs = [], onChange }) {
  const add = () => onChange([...pairs, { key: "", value: "" }]);
  const remove = (i) => onChange(pairs.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = pairs.map((p, idx) => (idx === i ? { ...p, [field]: val } : p));
    onChange(next);
  };
  return (
    <div>
      {pairs.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            value={p.key}
            onChange={(e) => update(i, "key", e.target.value)}
            placeholder="key"
            style={{ flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 5, padding: "5px 8px", color: COLORS.text, fontSize: 12, outline: "none", fontFamily: "inherit" }}
          />
          <input
            value={p.value}
            onChange={(e) => update(i, "value", e.target.value)}
            placeholder="value"
            style={{ flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 5, padding: "5px 8px", color: COLORS.text, fontSize: 12, outline: "none", fontFamily: "inherit" }}
          />
          <button onClick={() => remove(i)} style={{ background: COLORS.redDim, border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 5, padding: "0 8px", cursor: "pointer", fontSize: 13 }}>×</button>
        </div>
      ))}
      <button
        onClick={add}
        style={{ fontSize: 11, color: COLORS.accent, background: "transparent", border: `1px dashed ${COLORS.accent}`, borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}
      >
        + Add field
      </button>
    </div>
  );
}

function NodeFormPanel({ node, automations, onChange, onDelete }) {
  if (!node) {
    return (
      <div style={{ padding: 24, color: COLORS.textMuted, fontSize: 13, textAlign: "center", marginTop: 40 }}>
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>◈</div>
        Select a node on the canvas to configure it
      </div>
    );
  }

  const update = (key, val) => onChange(node.id, { ...node.data, [key]: val });
  const d = node.data;
  const s = NODE_STYLES[node.type];

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 4 }}>{title}</div>
      {children}
    </div>
  );

  const Field = ({ label, children }) => (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );

  return (
    <div style={{ padding: 16, overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 12px", background: s.dim, borderRadius: 8, border: `1px solid ${s.color}33` }}>
        <span style={{ color: s.color, fontSize: 18 }}>{s.icon}</span>
        <div>
          <div style={{ fontSize: 10, color: s.color, textTransform: "uppercase", letterSpacing: 1 }}>{s.label} Node</div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>id: {node.id}</div>
        </div>
      </div>

      {node.type === "startNode" && (
        <Section title="Start Configuration">
          <Field label="Start Title">
            <Input value={d.label} onChange={(e) => update("label", e.target.value)} placeholder="e.g. Onboarding Start" />
          </Field>
          <Field label="Metadata (key-value)">
            <KVEditor pairs={d.metadata || []} onChange={(v) => update("metadata", v)} />
          </Field>
        </Section>
      )}

      {node.type === "taskNode" && (
        <Section title="Task Configuration">
          <Field label="Title *">
            <Input value={d.label} onChange={(e) => update("label", e.target.value)} placeholder="e.g. Collect Documents" />
          </Field>
          <Field label="Description">
            <textarea
              value={d.description || ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Task description..."
              rows={3}
              style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "7px 10px", color: COLORS.text, fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </Field>
          <Field label="Assignee">
            <Input value={d.assignee} onChange={(e) => update("assignee", e.target.value)} placeholder="e.g. hr_team" />
          </Field>
          <Field label="Due Date">
            <Input type="date" value={d.dueDate} onChange={(e) => update("dueDate", e.target.value)} />
          </Field>
          <Field label="Custom Fields">
            <KVEditor pairs={d.customFields || []} onChange={(v) => update("customFields", v)} />
          </Field>
        </Section>
      )}

      {node.type === "approvalNode" && (
        <Section title="Approval Configuration">
          <Field label="Title">
            <Input value={d.label} onChange={(e) => update("label", e.target.value)} placeholder="e.g. Manager Approval" />
          </Field>
          <Field label="Approver Role">
            <Select
              value={d.approverRole}
              onChange={(e) => update("approverRole", e.target.value)}
              options={["Manager", "HRBP", "Director", "VP", "C-Level"]}
            />
          </Field>
          <Field label="Auto-Approve Threshold (days)">
            <Input type="number" value={d.autoApproveThreshold} onChange={(e) => update("autoApproveThreshold", e.target.value)} placeholder="e.g. 3" />
          </Field>
        </Section>
      )}

      {node.type === "automatedNode" && (
        <Section title="Automated Step Configuration">
          <Field label="Title">
            <Input value={d.label} onChange={(e) => update("label", e.target.value)} placeholder="e.g. Send Welcome Email" />
          </Field>
          <Field label="Action">
            <Select
              value={d.action}
              onChange={(e) => {
                const auto = automations.find((a) => a.id === e.target.value);
                update("action", e.target.value);
                if (auto) update("actionParams", auto.params.map((p) => ({ key: p, value: "" })));
              }}
              options={automations.map((a) => ({ value: a.id, label: a.label }))}
            />
          </Field>
          {d.actionParams?.length > 0 && (
            <Field label="Action Parameters">
              {d.actionParams.map((param, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Label>{param.key}</Label>
                  <Input
                    value={param.value}
                    onChange={(e) => {
                      const next = d.actionParams.map((p, idx) => idx === i ? { ...p, value: e.target.value } : p);
                      update("actionParams", next);
                    }}
                    placeholder={`Enter ${param.key}...`}
                  />
                </div>
              ))}
            </Field>
          )}
        </Section>
      )}

      {node.type === "endNode" && (
        <Section title="End Configuration">
          <Field label="End Message">
            <Input value={d.label} onChange={(e) => update("label", e.target.value)} placeholder="e.g. Workflow Complete" />
          </Field>
          <Field label="Show Summary">
            <Toggle checked={!!d.showSummary} onChange={(v) => update("showSummary", v)} label="Display workflow summary on completion" />
          </Field>
        </Section>
      )}

      <button
        onClick={() => onDelete(node.id)}
        style={{ width: "100%", marginTop: 8, padding: "8px", background: COLORS.redDim, border: `1px solid ${COLORS.red}44`, borderRadius: 8, color: COLORS.red, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
      >
        Delete Node
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// SANDBOX PANEL
// ─────────────────────────────────────────────
function SandboxPanel({ nodes, edges, onClose }) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setLogs(null);
    setError(null);
    const result = await MockAPI.simulate({ nodes, edges });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
    } else {
      setLogs(result.logs);
    }
  };

  const statusColor = { success: COLORS.green, warning: COLORS.yellow, error: COLORS.red };
  const nodeColor = { startNode: COLORS.green, taskNode: COLORS.blue, approvalNode: COLORS.yellow, automatedNode: COLORS.purple, endNode: COLORS.red };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, width: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: `0 0 60px rgba(0,0,0,0.6)` }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>⚡ Workflow Sandbox</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{nodes.length} nodes · {edges.length} edges</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: COLORS.textMuted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Serialized Workflow</div>
          <pre style={{ background: COLORS.bg, borderRadius: 8, padding: "10px 12px", fontSize: 10, color: COLORS.textDim, maxHeight: 80, overflowY: "auto", margin: 0, border: `1px solid ${COLORS.border}` }}>
            {JSON.stringify({ nodes: nodes.map(n => ({ id: n.id, type: n.type, data: n.data })), edges: edges.map(e => ({ source: e.source, target: e.target })) }, null, 2)}
          </pre>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
          <button
            onClick={run}
            disabled={loading}
            style={{ background: loading ? COLORS.border : COLORS.accent, color: loading ? COLORS.textMuted : "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", width: "100%", fontFamily: "inherit" }}
          >
            {loading ? "⏳ Simulating..." : "▶  Run Simulation"}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {error && (
            <div style={{ padding: "10px 14px", background: COLORS.redDim, border: `1px solid ${COLORS.red}44`, borderRadius: 8, color: COLORS.red, fontSize: 13 }}>
              ❌ {error}
            </div>
          )}
          {logs && (
            <div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Execution Log</div>
              {logs.map((log, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "8px 12px", marginBottom: 6, background: COLORS.surfaceAlt, borderRadius: 8, borderLeft: `3px solid ${statusColor[log.status] || COLORS.border}` }}>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, minWidth: 20 }}>#{log.step}</div>
                  <div>
                    <div style={{ fontSize: 13, color: nodeColor[log.nodeType] || COLORS.text }}>{log.message}</div>
                    {log.detail && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{log.detail}</div>}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: "8px 12px", background: COLORS.greenDim, borderRadius: 8, border: `1px solid ${COLORS.green}44`, color: COLORS.green, fontSize: 12 }}>
                ✓ Simulation complete · {logs.filter(l => l.status === "success").length} steps executed
              </div>
            </div>
          )}
          {!logs && !error && !loading && (
            <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 12, marginTop: 20 }}>
              Click "Run Simulation" to execute your workflow
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// NODE PALETTE
// ─────────────────────────────────────────────
const PALETTE_ITEMS = [
  { type: "startNode", label: "Start", icon: "▶" },
  { type: "taskNode", label: "Task", icon: "◈" },
  { type: "approvalNode", label: "Approval", icon: "◉" },
  { type: "automatedNode", label: "Automated", icon: "⚡" },
  { type: "endNode", label: "End", icon: "■" },
];

function NodePalette({ onAddNode }) {
  return (
    <div style={{ padding: "12px 10px" }}>
      <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, paddingLeft: 4 }}>Node Types</div>
      {PALETTE_ITEMS.map((item) => {
        const s = NODE_STYLES[item.type];
        return (
          <button
            key={item.type}
            onClick={() => onAddNode(item.type)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 6, background: s.dim, border: `1px solid ${s.color}44`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
          >
            <span style={{ color: s.color, fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// INITIAL DATA
// ─────────────────────────────────────────────
const INITIAL_NODES = [
  { id: "n1", type: "startNode", position: { x: 260, y: 40 }, data: { label: "Onboarding Start", metadata: [] } },
  { id: "n2", type: "taskNode", position: { x: 200, y: 160 }, data: { label: "Collect Documents", assignee: "hr_team", description: "Gather ID and contracts", dueDate: "", customFields: [] } },
  { id: "n3", type: "approvalNode", position: { x: 220, y: 290 }, data: { label: "Manager Approval", approverRole: "Manager", autoApproveThreshold: 3 } },
  { id: "n4", type: "automatedNode", position: { x: 200, y: 420 }, data: { label: "Send Welcome Email", action: "send_email", actionParams: [{ key: "to", value: "" }, { key: "subject", value: "Welcome!" }, { key: "body", value: "" }] } },
  { id: "n5", type: "endNode", position: { x: 255, y: 545 }, data: { label: "Onboarding Complete", showSummary: true } },
];

const INITIAL_EDGES = [
  { id: "e1-2", source: "n1", target: "n2", markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.green }, style: { stroke: COLORS.green, strokeWidth: 1.5 } },
  { id: "e2-3", source: "n2", target: "n3", markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.blue }, style: { stroke: COLORS.blue, strokeWidth: 1.5 } },
  { id: "e3-4", source: "n3", target: "n4", markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.yellow }, style: { stroke: COLORS.yellow, strokeWidth: 1.5 } },
  { id: "e4-5", source: "n4", target: "n5", markerEnd: { type: MarkerType.ArrowClosed, color: COLORS.purple }, style: { stroke: COLORS.purple, strokeWidth: 1.5 } },
];

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
let nodeIdCounter = 10;

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [automations, setAutomations] = useState([]);
  const [showSandbox, setShowSandbox] = useState(false);
  const [activeTab, setActiveTab] = useState("palette");
  const [exportJSON, setExportJSON] = useState(null);

  useEffect(() => {
    MockAPI.getAutomations().then(setAutomations);
  }, []);

  useEffect(() => {
    if (selectedNode) {
      const updated = nodes.find((n) => n.id === selectedNode.id);
      if (updated) setSelectedNode(updated);
    }
  }, [nodes]);

  const onConnect = useCallback(
    (params) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const color = sourceNode ? NODE_STYLES[sourceNode.type]?.color : COLORS.accent;
      setEdges((eds) =>
        addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed, color }, style: { stroke: color, strokeWidth: 1.5 } }, eds)
      );
    },
    [nodes, setEdges]
  );

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setActiveTab("properties");
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setActiveTab("palette");
  }, []);

  const handleAddNode = (type) => {
    const id = `n${++nodeIdCounter}`;
    const defaults = {
      startNode: { label: "Start", metadata: [] },
      taskNode: { label: "New Task", assignee: "", description: "", dueDate: "", customFields: [] },
      approvalNode: { label: "Approval", approverRole: "Manager", autoApproveThreshold: 3 },
      automatedNode: { label: "Automated Step", action: "", actionParams: [] },
      endNode: { label: "End", showSummary: false },
    };
    const newNode = {
      id,
      type,
      position: { x: 150 + Math.random() * 200, y: 150 + Math.random() * 200 },
      data: defaults[type],
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
    setActiveTab("properties");
  };

  const handleNodeDataChange = (id, data) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data } : n)));
  };

  const handleDeleteNode = (id) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
    setActiveTab("palette");
  };

  const handleExport = () => {
    setExportJSON(JSON.stringify({
      nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target }))
    }, null, 2));
  };

  const handleImport = () => {
    if (!exportJSON) return;
    try {
      const parsed = JSON.parse(exportJSON);
      if (parsed.nodes) setNodes(parsed.nodes);
      if (parsed.edges) setEdges(parsed.edges.map(e => ({
        ...e,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: COLORS.accent, strokeWidth: 1.5 },
      })));
      setExportJSON(null);
    } catch (err) {
      alert("Invalid JSON");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: COLORS.bg, fontFamily: "'DM Mono', 'Courier New', monospace", color: COLORS.text, overflow: "hidden" }}>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');`}</style>

      {/* LEFT SIDEBAR */}
      <div style={{ width: 220, background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, letterSpacing: 0.5 }}>⬡ HR Workflow</div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>Designer · Tredence Studio</div>
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}` }}>
          {["palette", "properties"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: "9px 4px", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, background: "transparent", border: "none", cursor: "pointer", color: activeTab === tab ? COLORS.accent : COLORS.textMuted, borderBottom: activeTab === tab ? `2px solid ${COLORS.accent}` : "2px solid transparent" }}
            >
              {tab === "palette" ? "Nodes" : "Config"}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "palette" && <NodePalette onAddNode={handleAddNode} />}
          {activeTab === "properties" && (
            <NodeFormPanel
              node={selectedNode}
              automations={automations}
              onChange={handleNodeDataChange}
              onDelete={handleDeleteNode}
            />
          )}
        </div>

        <div style={{ padding: "10px", borderTop: `1px solid ${COLORS.border}` }}>
          <button
            onClick={() => setShowSandbox(true)}
            style={{ width: "100%", padding: "9px", background: COLORS.accentDim, border: `1px solid ${COLORS.accent}55`, borderRadius: 8, color: COLORS.accent, fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginBottom: 6 }}
          >
            ▶  Test Workflow
          </button>
          <button
            onClick={handleExport}
            style={{ width: "100%", padding: "8px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.textDim, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
          >
            ↓ Export JSON
          </button>
        </div>
      </div>

      {/* CANVAS */}
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, height: 44, background: `${COLORS.surface}ee`, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, backdropFilter: "blur(8px)" }}>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Canvas</span>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {["startNode", "taskNode", "approvalNode", "automatedNode", "endNode"].map((t) => {
              const s = NODE_STYLES[t];
              const count = nodes.filter((n) => n.type === t).length;
              return (
                <div key={t} style={{ fontSize: 10, color: s.color, background: s.dim, border: `1px solid ${s.color}33`, borderRadius: 5, padding: "2px 7px" }}>
                  {s.icon} {count}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 8 }}>{edges.length} connections</div>
        </div>

        <div style={{ paddingTop: 44, height: "100%" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            style={{ background: COLORS.bg }}
            deleteKeyCode="Delete"
          >
            <Background color={COLORS.border} gap={28} size={1} />
            <Controls style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />
            <MiniMap
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}
              nodeColor={(n) => NODE_STYLES[n.type]?.color || COLORS.textMuted}
              maskColor={`${COLORS.bg}cc`}
            />
            <Panel position="bottom-center">
              <div style={{ fontSize: 10, color: COLORS.textMuted, background: `${COLORS.surface}cc`, padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                Click node to edit · Drag to connect · Delete key removes selection
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* EXPORT MODAL */}
      {exportJSON && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, width: 560, maxHeight: "70vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Export / Import JSON</span>
              <button onClick={() => setExportJSON(null)} style={{ background: "transparent", border: "none", color: COLORS.textMuted, fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <textarea
              value={exportJSON}
              onChange={(e) => setExportJSON(e.target.value)}
              style={{ flex: 1, background: COLORS.bg, border: "none", padding: 16, color: COLORS.textDim, fontSize: 11, fontFamily: "inherit", resize: "none", outline: "none" }}
            />
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 8 }}>
              <button onClick={handleImport} style={{ flex: 1, padding: "8px", background: COLORS.accentDim, border: `1px solid ${COLORS.accent}55`, borderRadius: 8, color: COLORS.accent, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                ↑ Import this JSON
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(exportJSON); }}
                style={{ padding: "8px 16px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.textDim, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SANDBOX */}
      {showSandbox && (
        <SandboxPanel nodes={nodes} edges={edges} onClose={() => setShowSandbox(false)} />
      )}
    </div>
  );
}