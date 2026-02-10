import { Glob } from "bun";

type FileContent = {
  name: string;
  content: string;
};

async function collectFiles(patterns: string[]): Promise<FileContent[]> {
  const files: FileContent[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const glob = new Glob(pattern);

    for await (const file of glob.scan(".")) {
      // Skip node_modules and .git directories
      if (file.includes("node_modules/") || file.includes(".git/")) {
        continue;
      }

      // Skip if already seen
      if (seen.has(file)) continue;
      seen.add(file);

      const fileHandle = Bun.file(file);
      const content = await fileHandle.text();
      files.push({ name: file, content });
    }
  }

  return files;
}

export { collectFiles };
export type { FileContent };
