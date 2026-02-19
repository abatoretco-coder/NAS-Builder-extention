import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

export class Logger {
  constructor(private readonly logsDir: string) {}

  async write(name: string, payload: Record<string, unknown>): Promise<string> {
    await mkdir(this.logsDir, { recursive: true });
    const filePath = path.join(this.logsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${name}.json`);
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
  }

  get directory(): string {
    return this.logsDir;
  }
}
