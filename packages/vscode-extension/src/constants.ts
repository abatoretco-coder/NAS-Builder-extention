export const EXTENSION_NS = 'naas';

export const COMMANDS = {
  selectProfile: 'naas.selectProfile',
  addOrUpdateCredentials: 'naas.addOrUpdateCredentials',
  setupProxmoxNasParameters: 'naas.setupProxmoxNasParameters',
  deleteCredentials: 'naas.deleteCredentials',
  scanInfrastructure: 'naas.scanInfrastructure',
  showPlan: 'naas.showPlan',
  applyPlan: 'naas.applyPlan',
  validate: 'naas.validate',
  openLogs: 'naas.openLogs'
} as const;

export const VIEW_ID = 'naas.infrastructureView';

export const DEFAULT_PROFILES_PATH = '~/.naas/profiles.yaml';
