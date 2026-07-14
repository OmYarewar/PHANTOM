import { AgentGraph } from './agent-graph.js';

export function renderAnalysisDashboard(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="analysis-dashboard">
      <h3>Multi-Agent Analysis Dashboard</h3>

      <div class="dashboard-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
        <!-- Visualization Panel -->
        <div class="panel visualization-panel" style="background: var(--bg-secondary); padding: 15px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <h4>Agent Topology</h4>
          <canvas id="agent-graph-canvas" style="width: 100%; height: 300px; display: block;"></canvas>
        </div>

        <!-- Status Panel -->
        <div class="panel status-panel" style="background: var(--bg-secondary); padding: 15px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <h4>Active Analysis</h4>
          <div id="active-task-list" style="margin-top: 10px; font-size: 13px;">
            <div style="margin-bottom: 8px;">
              <strong>[Planner]</strong> Decomposing defensive scan request...
            </div>
            <div style="margin-bottom: 8px; color: var(--accent);">
              <strong>[Log Analysis]</strong> Running (60%)...
            </div>
            <div style="margin-bottom: 8px; color: #a1a1aa;">
              <strong>[Threat Modeler]</strong> Pending dependencies
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top: 20px;">
        <button type="button" class="btn btn-primary" id="demo-analysis-btn">Run Demo Analysis</button>
      </div>
    </div>
  `;

  // Initialize graph
  setTimeout(() => {
    const graph = new AgentGraph('agent-graph-canvas');

    // Wire up demo button
    const btn = document.getElementById('demo-analysis-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        // Trigger simulated agent messages
        graph.sendMessage('orchestrator', 'log-analyzer');
        setTimeout(() => graph.sendMessage('log-analyzer', 'orchestrator'), 1000);
        setTimeout(() => graph.sendMessage('orchestrator', 'threat-modeler'), 1500);
      });
    }
  }, 100);
}
