import * as vscode from 'vscode';
import type { ResolvedProfile, UnifiedState } from '../models.js';

class NodeItem extends vscode.TreeItem {
  override description?: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children: NodeItem[] = [],
    description?: string
  ) {
    super(label, collapsibleState);
    this.description = description;
  }
}

export class InfrastructureTreeProvider implements vscode.TreeDataProvider<NodeItem> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private state?: UnifiedState;
  private profiles: string[] = [];
  private activeProfile = 'n/a';

  setProfiles(profileNames: string[], activeProfile: string): void {
    this.profiles = profileNames;
    this.activeProfile = activeProfile;
    this.emitter.fire();
  }

  setState(state: UnifiedState | undefined): void {
    this.state = state;
    this.emitter.fire();
  }

  getTreeItem(element: NodeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: NodeItem): NodeItem[] {
    if (element) {
      return element.children;
    }

    const state = this.state;

    const sections: NodeItem[] = [];

    const profileChildren = this.profiles.length
      ? this.profiles.map(
          (name) =>
            new NodeItem(
              name,
              vscode.TreeItemCollapsibleState.None,
              [],
              name === this.activeProfile ? 'active' : undefined
            )
        )
      : [new NodeItem('No profiles configured', vscode.TreeItemCollapsibleState.None)];
    sections.push(new NodeItem('Profiles', vscode.TreeItemCollapsibleState.Expanded, profileChildren));

    if (!state) {
      sections.push(new NodeItem('Proxmox', vscode.TreeItemCollapsibleState.None, [], 'No scan data'));
      sections.push(new NodeItem('Docker', vscode.TreeItemCollapsibleState.None, [], 'No scan data'));
      sections.push(new NodeItem('Observability', vscode.TreeItemCollapsibleState.None, [], 'No scan data'));
      return sections;
    }

    const proxmoxNodes = (state.compute?.nodes ?? []).map((node) => {
      const vms = (state.compute?.vms ?? [])
        .filter((vm) => vm.node === node.name)
        .map((vm) => new NodeItem(`VM ${vm.vmid}: ${vm.name}`, vscode.TreeItemCollapsibleState.None, [], vm.status));
      const cts = (state.compute?.cts ?? [])
        .filter((ct) => ct.node === node.name)
        .map((ct) => new NodeItem(`CT ${ct.vmid}: ${ct.name}`, vscode.TreeItemCollapsibleState.None, [], ct.status));
      return new NodeItem(`Node: ${node.name}`, vscode.TreeItemCollapsibleState.Collapsed, [...vms, ...cts], node.status);
    });

    sections.push(new NodeItem('Proxmox', vscode.TreeItemCollapsibleState.Expanded, proxmoxNodes));

    const dockerHosts = (state.apps?.dockerHosts ?? []).map((host) => {
      const projects = host.composeProjects.map((project) => {
        const containers = host.containers
          .filter((container) => container.composeProject === project.name)
          .map((container) => new NodeItem(`Container: ${container.name}`, vscode.TreeItemCollapsibleState.None, [], container.state));
        return new NodeItem(`Compose: ${project.name}`, vscode.TreeItemCollapsibleState.Collapsed, containers, project.path);
      });
      return new NodeItem(`Host: ${host.host}`, vscode.TreeItemCollapsibleState.Collapsed, projects);
    });

    sections.push(new NodeItem('Docker', vscode.TreeItemCollapsibleState.Expanded, dockerHosts));

    const dashboards = (state.observability?.grafanaDashboards ?? []).map(
      (dashboard) => new NodeItem(`Dashboard: ${dashboard.title}`, vscode.TreeItemCollapsibleState.None, [], dashboard.uid)
    );

    sections.push(new NodeItem('Observability', vscode.TreeItemCollapsibleState.Expanded, dashboards));

    return sections;
  }

  updateFromProfile(profile: ResolvedProfile): void {
    this.activeProfile = profile.activeProfileName;
    this.emitter.fire();
  }
}
