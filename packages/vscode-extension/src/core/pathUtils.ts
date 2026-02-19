import os from 'node:os';
import path from 'node:path';

export function expandTilde(input: string): string {
  if (input === '~') {
    return os.homedir();
  }
  if (input.startsWith('~/')) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

export function defaultStateDir(profileName: string): string {
  return path.join(os.homedir(), '.naas', 'state', profileName);
}
