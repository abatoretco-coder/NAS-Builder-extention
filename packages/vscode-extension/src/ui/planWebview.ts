import * as vscode from 'vscode';
import type { PlanOutput } from '../models.js';

export function showPlanWebview(plan: PlanOutput): void {
  const panel = vscode.window.createWebviewPanel('naas.plan', `NAAS Plan (${plan.profile})`, vscode.ViewColumn.Active, {
    enableScripts: false
  });

  const rows = plan.actions
    .map((action, index) => {
      const details = escapeHtml(JSON.stringify(action, null, 2));
      return `<tr><td>${index + 1}</td><td>${escapeHtml(action.kind)}</td><td>${escapeHtml(action.reason)}</td><td><pre>${details}</pre></td></tr>`;
    })
    .join('');

  panel.webview.html = `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<style>
body { font-family: var(--vscode-font-family); padding: 16px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid var(--vscode-panel-border); padding: 8px; vertical-align: top; }
pre { margin: 0; white-space: pre-wrap; }
</style>
</head>
<body>
<h2>Plan Actions (${plan.actions.length})</h2>
<table>
<thead><tr><th>#</th><th>Kind</th><th>Reason</th><th>Details</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
