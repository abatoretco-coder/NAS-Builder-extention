import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}
