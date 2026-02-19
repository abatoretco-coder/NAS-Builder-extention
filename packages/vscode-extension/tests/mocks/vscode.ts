export const workspace = {
  workspaceFolders: [],
  getConfiguration: () => ({
    get: <T>(_key: string, defaultValue?: T): T | undefined => defaultValue
  })
};
