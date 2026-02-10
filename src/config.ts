import { createClient } from "v0-sdk";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, mkdirSync } from "node:fs";

type V0Config = {
  apiKey?: string;
};

type ProjectLink = {
  projectId: string;
};

const CONFIG_DIR = join(homedir(), ".config", "v0");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const PROJECT_FILE = ".v0";

async function readConfig(): Promise<V0Config> {
  const file = Bun.file(CONFIG_FILE);
  if (!(await file.exists())) return {};
  const text = await file.text();
  return JSON.parse(text);
}

async function writeConfig(config: V0Config): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function readProjectLink(): Promise<ProjectLink | null> {
  const file = Bun.file(PROJECT_FILE);
  if (!(await file.exists())) return null;
  const text = await file.text();
  return JSON.parse(text);
}

async function writeProjectLink(projectId: string): Promise<void> {
  await Bun.write(PROJECT_FILE, JSON.stringify({ projectId }, null, 2));
}

async function removeProjectLink(): Promise<void> {
  const file = Bun.file(PROJECT_FILE);
  if (await file.exists()) {
    await Bun.$`rm ${PROJECT_FILE}`;
  }
}

function resolveApiKey(): string {
  const envKey = process.env.V0_API_KEY;
  if (envKey) return envKey;

  throw new Error("No API key found. Run 'v0 login' or set V0_API_KEY.");
}

async function resolveApiKeyWithConfig(): Promise<string> {
  const envKey = process.env.V0_API_KEY;
  if (envKey) return envKey;

  const config = await readConfig();
  if (config.apiKey) return config.apiKey;

  throw new Error("No API key found. Run 'v0 login' or set V0_API_KEY.");
}

async function getClient() {
  const apiKey = await resolveApiKeyWithConfig();
  return createClient({ apiKey });
}

export {
  readConfig,
  writeConfig,
  readProjectLink,
  writeProjectLink,
  removeProjectLink,
  resolveApiKey,
  resolveApiKeyWithConfig,
  getClient,
};
