import * as vscode from 'vscode';

export class StatusBarController {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.item.name = 'NAAS Active Profile';
    this.item.command = 'naas.selectProfile';
    this.item.show();
  }

  update(profile: string, lastScanAt?: string): void {
    const scanPart = lastScanAt ? ` • ${new Date(lastScanAt).toLocaleTimeString()}` : '';
    this.item.text = `$(server) NAAS ${profile}${scanPart}`;
    this.item.tooltip = 'Click to select active NAAS profile';
  }

  dispose(): void {
    this.item.dispose();
  }
}
