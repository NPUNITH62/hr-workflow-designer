# HR Workflow Designer
### Tredence Studio — Full Stack Engineering Intern Case Study

A visual drag-and-drop HR workflow builder built with React and React Flow. HR admins can design, configure, and simulate internal workflows like onboarding, leave approval, and document verification.

---

## 🚀 How to Run

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/hr-workflow-designer.git
cd hr-workflow-designer

# 2. Install dependencies
npm install
npm install reactflow

# 3. Start the app
npm run dev

# 4. Open browser
http://localhost:5173
```

---

## 🏗️ Architecture

```
src/
├── App.jsx          # Main app — all components, logic, and mock API
└── main.jsx         # Entry point
```

### Why single file?
This is a time-boxed prototype. Keeping everything in one file makes it easy to review, run, and evaluate. In a production app I would split it as below:

```
src/
├── components/
│   ├── nodes/           # StartNode, TaskNode, ApprovalNode, etc.
│   ├── NodeFormPanel/   # Config forms per node type
│   ├── SandboxPanel/    # Workflow test/simulation panel
│   └── NodePalette/     # Sidebar node picker
├── hooks/
│   ├── useWorkflow.js   # Node/edge state management
│   └── useAutomations.js
├── api/
│   └── mockApi.js       # Mock API layer (GET /automations, POST /simulate)
├── types/
│   └── workflow.ts      # TypeScript interfaces for nodes/edges
└── constants/
    └── nodeStyles.js    # Colors, icons, design tokens
```

---

## ✅ Features Built

### 1. Workflow Canvas (React Flow)
- Drag-and-drop canvas with 5 custom node types
- Connect nodes with typed, colored edges
- Select, edit, delete nodes and edges
- MiniMap, zoom controls, fit view
- Delete key removes selected nodes/edges

### 2. Node Types
| Node | Description |
|------|-------------|
| ▶ Start | Workflow entry point with metadata |
| ◈ Task | Human task with assignee, due date, custom fields |
| ◉ Approval | Manager/HRBP approval with auto-approve threshold |
| ⚡ Automated | System action from mock API with dynamic params |
| ■ End | Workflow completion with summary toggle |

### 3. Node Configuration Forms
- Each node has its own dynamic form panel
- Controlled React components with clean state handling
- Key-value metadata editor for custom fields
- Dynamic action parameters based on selected automation
- Toggle component for boolean fields

### 4. Mock API Layer
Built as local async functions simulating real API calls:

**GET /automations**
```json
[
  { "id": "send_email", "label": "Send Email", "params": ["to", "subject", "body"] },
  { "id": "generate_doc", "label": "Generate Document", "params": ["template", "recipient"] },
  { "id": "notify_slack", "label": "Notify Slack", "params": ["channel", "message"] },
  { "id": "update_hris", "label": "Update HRIS Record", "params": ["employee_id", "field", "value"] },
  { "id": "create_ticket", "label": "Create Ticket", "params": ["system", "title", "priority"] }
]
```

**POST /simulate**
- Accepts full workflow JSON
- Runs BFS graph traversal
- Detects cycles and unreachable nodes
- Returns step-by-step execution log

### 5. Workflow Sandbox / Test Panel
- Serializes full workflow graph to JSON
- Sends to mock /simulate endpoint
- Displays step-by-step execution log with color coding
- Validates structure — missing Start/End, cycles, unreachable nodes

### 6. Bonus Features
- ✅ Export workflow as JSON
- ✅ Import workflow from JSON
- ✅ MiniMap
- ✅ Node count stats in top bar
- ✅ Pre-built sample onboarding workflow on load

---

## 🎨 Design Decisions

**Dark theme** — Professional tool aesthetic matching the Tredence Studio UI reference. Color-coded node types make workflows easy to read at a glance.

**Color per node type** — Each node type has a unique color (green=start, blue=task, yellow=approval, purple=automated, red=end) applied consistently across the node, its handle, its edge, and its form panel badge.

**BFS simulation** — Used Breadth-First Search for workflow execution simulation. This naturally handles branching workflows and clearly detects cycles and unreachable nodes.

**Mock API as async functions** — Instead of JSON Server or MSW (which require extra setup), I used local async functions with artificial delays to simulate real API behavior. This keeps the project zero-dependency-extra and easy to run.

**Single file for prototype** — Keeps setup simple for evaluation. The internal structure still follows clean separation — MockAPI, design tokens, node components, form components, and main App are all clearly separated sections.

---

## 🔮 What I Would Add With More Time

- **TypeScript interfaces** for all node data types
- **Proper folder structure** with separated components and hooks
- **Zustand** for global workflow state management
- **Backend with FastAPI** — real POST /simulate with actual graph validation
- **PostgreSQL** to persist workflows per user
- **Undo/Redo** using command pattern
- **Auto-layout** using Dagre for automatic node positioning
- **Validation errors** shown visually on nodes (red border if misconfigured)
- **Node templates** — save and reuse common workflow patterns
- **E2E tests** with Cypress/Playwright
- **Unit tests** with Jest and React Testing Library

---

## 🛠️ Tech Stack

| Tech | Usage |
|------|-------|
| React 18 | UI framework |
| React Flow | Canvas, nodes, edges |
| Vite | Build tool |
| CSS-in-JS (inline styles) | Styling |
| Mock async functions | API layer |

---

## 📸 Screenshots

> <img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/ed98ee39-d17d-4be1-9ab9-387e7b344283" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/f8ba2b24-1de7-45ec-bbfe-c257c881b4ae" />


---

Built with ❤️ for Tredence Studio — AI Agents Engineering Team
