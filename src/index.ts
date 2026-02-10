#!/usr/bin/env bun
import { Command } from "commander";
import * as readline from "node:readline";
import { stdin, stdout } from "node:process";
import {
  getClient,
  readConfig,
  writeConfig,
  readProjectLink,
  writeProjectLink,
  removeProjectLink,
} from "./config.ts";
import { collectFiles } from "./files.ts";

const program = new Command();

function withErrorHandling(fn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (error: any) {
      if (error?.error?.type === "unauthorized_error") {
        console.error("Not authenticated. Run 'v0 login' or set V0_API_KEY.");
      } else if (error?.error?.type === "not_found_error") {
        console.error(`Not found: ${error.error.message}`);
      } else if (error?.error?.type === "too_many_requests_error") {
        console.error("Rate limited. Try again shortly.");
      } else if (error?.error?.type === "payload_too_large_error") {
        console.error(
          "Payload too large. Try reducing the number or size of files."
        );
      } else {
        console.error(error?.error?.message ?? error?.message ?? "Unknown error");
      }
      process.exit(1);
    }
  };
}

// Auth commands
program
  .command("login")
  .description("Authenticate with V0 API key")
  .action(
    withErrorHandling(async () => {
      const rl = readline.createInterface({ input: stdin, output: stdout });

      const apiKey = await new Promise<string>((resolve) => {
        rl.question("Enter your V0 API key: ", (answer) => {
          rl.close();
          resolve(answer.trim());
        });
      });

      if (!apiKey) {
        console.error("API key cannot be empty");
        process.exit(1);
      }

      // Validate the key
      const client = await import("v0-sdk").then((m) =>
        m.createClient({ apiKey })
      );
      await client.user.get();

      // Store the key
      const config = await readConfig();
      config.apiKey = apiKey;
      await writeConfig(config);

      console.log("Successfully authenticated!");
    })
  );

program
  .command("logout")
  .description("Remove stored API key")
  .action(
    withErrorHandling(async () => {
      const config = await readConfig();
      delete config.apiKey;
      await writeConfig(config);
      console.log("Logged out successfully");
    })
  );

program
  .command("whoami")
  .description("Show current user info")
  .option("--json", "Output as JSON")
  .action(
    withErrorHandling(async (opts) => {
      const client = await getClient();
      const user = await client.user.get();

      if (opts.json) {
        console.log(JSON.stringify(user, null, 2));
      } else {
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Name: ${user.name ?? "N/A"}`);
      }
    })
  );

// Chat commands
const chat = program.command("chat").description("Manage v0 chats");

chat
  .command("create <message>")
  .description("Create a new chat")
  .option("-s, --system <prompt>", "System prompt")
  .option("-M, --model <model>", "Model to use")
  .option("--image-gen", "Enable image generation")
  .option("--thinking", "Enable thinking mode")
  .option("--private", "Create as private chat")
  .option("--no-project", "Don't attach project ID")
  .option("--json", "Output as JSON")
  .action(
    withErrorHandling(async (message, opts) => {
      const client = await getClient();

      // Auto-attach project ID unless --no-project
      let projectId: string | undefined;
      if (opts.project !== false) {
        const link = await readProjectLink();
        if (link) projectId = link.projectId;
      }

      const createOpts: any = {
        message,
        projectId,
        isPrivate: opts.private,
      };

      // Build modelConfiguration if any model flags are set
      if (opts.model || opts.imageGen || opts.thinking) {
        createOpts.modelConfiguration = {};
        if (opts.model) createOpts.modelConfiguration.modelId = opts.model;
        if (opts.imageGen !== undefined)
          createOpts.modelConfiguration.imageGeneration = opts.imageGen;
        if (opts.thinking !== undefined)
          createOpts.modelConfiguration.thinking = opts.thinking;
      }

      if (opts.system) {
        createOpts.system = opts.system;
      }

      const result = await client.chats.create(createOpts);
      if (result instanceof ReadableStream) {
        throw new Error("Unexpected stream response");
      }

      const url = `https://v0.dev/chat/${result.id}`;

      if (opts.json) {
        console.log(JSON.stringify({ ...result, url }, null, 2));
      } else {
        console.log(`Chat created: ${result.id}`);
        console.log(url);
      }
    })
  );

chat
  .command("list")
  .description("List chats")
  .option("--favorites", "Show only favorited chats")
  .option("-n, --limit <number>", "Maximum results to return", parseInt)
  .option("--json", "Output as JSON")
  .action(
    withErrorHandling(async (opts) => {
      const client = await getClient();

      const queryOpts: any = {};
      if (opts.limit) queryOpts.limit = opts.limit;
      if (opts.favorites) queryOpts.favorite = true;

      const response = await client.chats.find(queryOpts);
      const chats = response.data || [];

      if (opts.json) {
        console.log(JSON.stringify(chats, null, 2));
      } else {
        if (chats.length === 0) {
          console.log("No chats found");
          return;
        }

        for (const chat of chats) {
          const favorite = chat.favorite ? " ⭐" : "";
          const privacy = chat.privacy === "private" ? " 🔒" : "";
          console.log(
            `${chat.id} - ${chat.name}${favorite}${privacy} (${new Date(
              chat.createdAt
            ).toLocaleDateString()})`
          );
        }
      }
    })
  );

chat
  .command("open <chatId>")
  .description("Open a chat in the browser")
  .option("--no-browser", "Print URL only, don't open browser")
  .action(
    withErrorHandling(async (chatId, opts) => {
      const url = `https://v0.dev/chat/${chatId}`;
      console.log(url);

      if (opts.browser !== false) {
        await Bun.$`open ${url}`;
      }
    })
  );

chat
  .command("delete <chatId>")
  .description("Delete a chat")
  .action(
    withErrorHandling(async (chatId) => {
      const client = await getClient();
      await client.chats.delete({ chatId });
      console.log(`Chat ${chatId} deleted`);
    })
  );

chat
  .command("init <patterns...>")
  .description("Initialize a chat with local files")
  .option("-m, --message <prompt>", "Initial message to send after init")
  .option("--no-project", "Don't attach project ID")
  .option("--json", "Output as JSON")
  .action(
    withErrorHandling(async (patterns, opts) => {
      if (patterns.length === 0) {
        console.error("No file patterns provided");
        process.exit(1);
      }

      const files = await collectFiles(patterns);

      if (files.length === 0) {
        console.error("No files found matching patterns");
        process.exit(1);
      }

      const client = await getClient();

      // Auto-attach project ID unless --no-project
      let projectId: string | undefined;
      if (opts.project !== false) {
        const link = await readProjectLink();
        if (link) projectId = link.projectId;
      }

      const initOpts: any = {
        files: files.map((f) => ({ name: f.name, content: f.content })),
      };

      if (projectId) {
        initOpts.projectId = projectId;
      }

      const result = await client.chats.init(initOpts);
      if (result instanceof ReadableStream) {
        throw new Error("Unexpected stream response");
      }

      // If --message is provided, send a follow-up message
      if (opts.message) {
        const messageOpts: any = {
          message: opts.message,
        };

        const messageResult = await client.chats.sendMessage(
          result.id,
          messageOpts
        );
        if (messageResult instanceof ReadableStream) {
          throw new Error("Unexpected stream response");
        }
      }

      const url = `https://v0.dev/chat/${result.id}`;

      if (opts.json) {
        console.log(JSON.stringify({ ...result, url }, null, 2));
      } else {
        console.log(`Chat initialized: ${result.id}`);
        console.log(`Files attached: ${files.length}`);
        console.log(url);
      }
    })
  );

// Link commands
program
  .command("link <projectId>")
  .description("Link current directory to a v0 project")
  .action(
    withErrorHandling(async (projectId) => {
      const client = await getClient();

      // Validate project exists
      await client.projects.get(projectId);

      await writeProjectLink(projectId);
      console.log(`Linked to project: ${projectId}`);
    })
  );

program
  .command("unlink")
  .description("Remove project link from current directory")
  .action(
    withErrorHandling(async () => {
      await removeProjectLink();
      console.log("Project link removed");
    })
  );

program
  .name("v0")
  .description("Personal CLI for managing v0.dev chats and projects")
  .version("1.0.0");

program.parse();
