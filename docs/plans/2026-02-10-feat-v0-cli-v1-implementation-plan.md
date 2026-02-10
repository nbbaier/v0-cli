---
title: "feat: Implement v0 CLI v1"
type: feat
date: 2026-02-10
---

# feat: Implement v0 CLI v1

## Overview

Build the v1 of the `v0` CLI — a personal tool for managing v0.dev chats, projects, and resources from the terminal. Uses Bun, Commander.js, and v0-sdk.

**This is a personal tool, not designed for distribution.** Every decision below flows from that fact: minimize abstraction, skip defensive complexity, add polish only when the lack of it actually bothers you during real usage.

## Project Structure

```
v0-cli/
├── src/
│   ├── index.ts       # Entry point, Commander setup, all command handlers (~250 lines)
│   ├── config.ts      # Config read/write + auth resolution + client factory (~50 lines)
│   └── files.ts       # File reading/glob expansion for chat init (~30 lines)
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

3 files. ~330 lines of actual logic. Extract more files only when a single file gets unwieldy (400+ lines).

## Key Design Decisions

### SDK Mismatches

1. **`chat init` flags** — The SDK's `ChatsInitRequest` does not accept `--system`, `--model`, `--image-gen`, or `--thinking`. **Decision:** Remove these flags from `chat init` for now. Keep `--message` — if provided, call `chats.init()` then immediately `chats.sendMessage()` with the message (which *does* accept `system` and `modelConfiguration`). This can be revisited to pass those flags through `sendMessage` later.

2. **`--private` on `chat list`** — The SDK's `find()` has no privacy filter. **Decision:** Cut from v1. Add later if actually needed. Avoids client-side filtering complexity and `--limit` interaction issues.

3. **`--model` deprecation** — The SDK's `modelConfiguration.modelId` is deprecated. **Decision:** Accept `--model` on `chat create`, pass it through, let the API validate.

4. **Project linking** — When a `.v0` file exists, `chat create` and `chat init` automatically pass `projectId` to the SDK. Add `--no-project` flag to opt out.

5. **`create()`/`sendMessage()` return union types** — Both return `ChatDetail | ReadableStream`. **Decision:** Always omit `responseMode` (defaults to sync) and assert the return type. Add a type guard if TypeScript complains:
   ```typescript
   const result = await client.chats.create({ message });
   if (result instanceof ReadableStream) throw new Error("Unexpected stream response");
   ```

### Authentication

- **Resolution order:** `V0_API_KEY` env var → `~/.config/v0/config.json` → error
- **Login:** `v0 login` prompts for API key via readline, validates with `v0.user.get()`, stores in config. Don't store if validation fails.
- **Config directory:** `mkdir -p` on first write using `Bun.write`
- **No masked input** — personal tool, simple readline is fine

### File Handling (`chat init`)

Keep it simple:
- Accept explicit file paths and globs (Bun's `Glob` handles expansion natively)
- Skip `node_modules/` and `.git/` (hardcoded)
- Read files, send them. If too big, the API returns `PayloadTooLargeError` — catch it and show a clear message.
- No `.gitignore` parsing, no extension allowlists, no size caps. Add later if needed.
- **No extra dependencies** — no `ignore` package.

### Output

- **Default:** `console.log` for everything. Format inline — no output abstraction module.
- **`--json`:** Single global flag. Where used: `if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }`. Inline ternary, not a helper function.
- URLs always printed to stdout.
- **No `--verbose` flag** — log full errors during development, simplify later if needed.

### Error Handling

No dedicated error module. A single `withErrorHandling` wrapper at the top level:

```typescript
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
      } else {
        console.error(error?.error?.message ?? error?.message ?? "Unknown error");
      }
      process.exit(1);
    }
  };
}
```

### Prompts

- **Login:** Simple readline prompt (no masking, no library)
- **Delete confirmation:** Cut. Just delete. Add `--dry-run` later if accidental deletes become a problem.
- **Link project selection:** Cut. Require `v0 link <project-id>` always. Check the web UI for project IDs.

### Config Types

```typescript
type V0Config = {
  apiKey?: string;
};

type ProjectLink = {
  projectId: string;
};
```

No `defaults` section — nothing reads it. Store only `apiKey`. Use `Bun.file()` and `Bun.write()` per CLAUDE.md.

### `.v0` File Format

Use a plain `.v0` JSON file: `{ "projectId": "..." }`. Simple, sufficient for v1.

## Acceptance Criteria

### Auth Commands
- [ ] `v0 login` prompts for API key, validates with `v0.user.get()`, stores in `~/.config/v0/config.json`
- [ ] `v0 login` creates `~/.config/v0/` directory if missing
- [ ] `v0 logout` removes `apiKey` from config
- [ ] `v0 whoami` displays user info

### Chat Commands
- [ ] `v0 chat create "<prompt>"` creates chat, prints ID + URL
- [ ] `v0 chat create` supports `--system`, `--model`, `--image-gen`, `--thinking`, `--private`
- [ ] `v0 chat create` auto-attaches project ID from `.v0` file if present (`--no-project` to opt out)
- [ ] `v0 chat list` shows chats (id, name, privacy, created, favorite)
- [ ] `v0 chat list` supports `--favorites`, `--limit`, `--json`
- [ ] `v0 chat open <id>` prints URL and opens browser
- [ ] `v0 chat open --no-browser` prints URL only
- [ ] `v0 chat delete <id>` deletes the chat
- [ ] `v0 chat init <files>` reads files, sends to API, prints chat ID + URL
- [ ] `v0 chat init` supports glob patterns and explicit file paths
- [ ] `v0 chat init --message` sends follow-up message after init
- [ ] `v0 chat init` auto-attaches project ID from `.v0` file

### Link Commands
- [ ] `v0 link <project-id>` validates project exists, writes `.v0` file
- [ ] `v0 unlink` removes `.v0` file

### Global Behavior
- [ ] `--json` flag works on commands producing structured output
- [ ] All commands show clean error for missing auth
- [ ] `--help` works on all commands and subcommands
- [ ] `--version` shows version from package.json

## Implementation Phases

### Phase 1: Build Everything

One pass. Build outward from working code.

**Tasks:**

1. `bun add commander` ✓
2. Create `src/config.ts`: ✓
   - `readConfig()` / `writeConfig()` — using `Bun.file()` / `Bun.write()` ✓
   - `readProjectLink()` / `writeProjectLink()` / `removeProjectLink()` ✓
   - `resolveApiKey()` — env var → config → throw ✓
   - `getClient()` — `createClient({ apiKey: resolveApiKey() })` ✓
3. Create `src/files.ts`: ✓
   - `collectFiles(patterns: string[])` — expand globs with `Bun.Glob`, read with `Bun.file()`, skip `node_modules/` and `.git/` ✓
   - Returns `Array<{ name: string; content: string }>` ✓
4. Create `src/index.ts`: ✓
   - Commander program with `--json` global flag and `--version` ✓
   - `withErrorHandling` wrapper ✓
   - `v0 login` — readline prompt → validate → store ✓
   - `v0 logout` — remove key from config ✓
   - `v0 whoami` — display user info ✓
   - `v0 chat create` — all flags, project ID injection ✓
   - `v0 chat list` — `--favorites`, `--limit`, `--json` ✓
   - `v0 chat open` — print URL + open browser, `--no-browser` ✓
   - `v0 chat delete` — just deletes ✓
   - `v0 chat init` — collect files, init chat, optional `sendMessage` ✓
   - `v0 link <project-id>` — validate + write `.v0` ✓
   - `v0 unlink` — remove `.v0` ✓
5. Set up `bin` in package.json: `"bin": { "v0": "./src/index.ts" }` ✓

### Phase 2: Test and Fix

Manual smoke test of every command. Fix what breaks.

1. Test auth flow: login → whoami → logout → whoami (should error)
2. Test chat lifecycle: create → list → open → delete
3. Test chat init with a few files
4. Test link/unlink + project ID injection on chat create
5. Test error cases: no auth, invalid chat ID, empty file list
6. Test `--json` on list/create/whoami

## Dependencies

```json
{
  "dependencies": {
    "v0-sdk": "^0.16.1",
    "commander": "^13.0.0"
  }
}
```

No additional dependencies. Bun's built-in `Glob`, `Bun.file()`, `Bun.write()`, and Node's `readline` cover everything.

## Deferred to Later (if needed)

- `--private` filter on `chat list` (SDK doesn't support it)
- `--verbose` flag for full error details
- `chat open --info` (add as `v0 chat info <id>` if needed)
- Delete confirmation prompts
- Interactive project selection for `v0 link`
- `.gitignore` parsing for `chat init`
- File size limits and extension allowlists for `chat init`
- Config `defaults` section (model, thinking, imageGen)
- Masked API key input during login
- Config file permissions (`0600`)
- `bun build --compile` for standalone binary
- Pretty table formatting (use simple console.log for now)

## References

- **v0-sdk API:** Full surface documented via btca — chats, projects, user, deployments, hooks, integrations, rateLimits, reports
- **Spec:** `docs/spec.md`
- **Commander.js:** git-style subcommands via `program.command('chat').command('list')`
- **Bun APIs:** `Bun.file()`, `Bun.write()`, `Bun.Glob`, `Bun.argv`
