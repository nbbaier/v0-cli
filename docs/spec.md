# v0 CLI Specification

A personal CLI tool for managing v0.dev chats, projects, and resources from the terminal. Built with Bun and the v0-sdk.

## Overview

- **Binary name:** `v0`
- **Audience:** Personal tool (not designed for distribution initially)
- **Scope:** Iterative — start with chat management, expand over time
- **Philosophy:** Management/orchestration tool, not a terminal chat client. Users create, list, open, and manage v0 chats and resources from the command line.

## Architecture

- **Runtime:** Bun
- **CLI framework:** Commander
- **SDK:** v0-sdk (v0.16.1+)
- **Command style:** Git-style subcommands (`v0 chat list`, `v0 chat create`, etc.)
- **Output:** Pretty-formatted by default, `--json` flag for machine-readable output
- **Errors:** Clean user-friendly messages by default, `--verbose` for full API error details
- **Interactivity:** Light prompts for missing required args (no full TUI)

## Authentication

### `v0 login`

- Prompts the user for their V0 API key
- Stores the key in `~/.config/v0/config.json`
- Env var `V0_API_KEY` always takes precedence over the config file

### `v0 logout`

- Removes the stored API key from config

### Resolution Order

1. `V0_API_KEY` environment variable
2. `~/.config/v0/config.json`

## v1 Commands

### Chat Management

#### `v0 chat create`

Create a new v0 chat from a text prompt.

```
v0 chat create "Create a responsive navbar with Tailwind CSS"
```

**Flags:**
- `--system, -s <prompt>` — System prompt for the chat
- `--model, -M <model>` — Model to use
- `--image-gen` — Enable image generation
- `--thinking` — Enable thinking mode
- `--private` — Create as a private chat

**Output:** Chat ID, web URL, and basic metadata.

#### `v0 chat list`

List chats with optional filtering.

```
v0 chat list
v0 chat list --favorites --limit 10
```

**Flags:**
- `--favorites` — Show only favorited chats
- `--private` — Show only private chats
- `--limit, -n <number>` — Max results to return
- `--json` — Output as JSON

#### `v0 chat open <chat-id>`

Open a chat in the browser and print its URL.

```
v0 chat open abc123
```

**Behavior:**
- Always prints the chat URL to stdout (useful for piping/copying)
- Opens the URL in the default browser
- `--info` flag: instead of opening browser, display chat metadata, messages, and version info in the terminal
- `--no-browser` flag: print URL only, don't launch browser

#### `v0 chat delete <chat-id>`

Delete a chat.

```
v0 chat delete abc123
```

- Prompts for confirmation unless `--force` is passed

#### `v0 chat init`

Initialize a new chat seeded with local files.

```
v0 chat init ./src/**/*.tsx
v0 chat init ./src
v0 chat init ./App.tsx ./Header.tsx ./styles.css
```

**File selection:**
- Glob patterns: `./src/**/*.tsx`
- Directories: `./src` (includes all files recursively)
- Explicit file paths as positional args

**Flags:**
- `--message, -m <prompt>` — Optional initial message to send with the files
- `--system, -s <prompt>` — System prompt
- `--model, -M <model>` — Model to use
- `--image-gen` — Enable image generation
- `--thinking` — Enable thinking mode

**Output:** Chat ID, web URL.

### Project Linking

#### `v0 link`

Link the current directory to a v0 project.

```
v0 link              # prompts to select a project
v0 link <project-id> # link to a specific project
```

- Stores the association in a `.v0` file in the current directory (or a `.v0/config.json`)
- Once linked, commands that accept `--project-id` will use the linked project as the default

#### `v0 unlink`

Remove the project link from the current directory.

### Auth Commands

#### `v0 login`

```
v0 login
```

- Prompts for the API key
- Validates the key by calling `v0.user.get()`
- Stores in `~/.config/v0/config.json`

#### `v0 whoami`

```
v0 whoami
```

- Displays the currently authenticated user's info

## Configuration

### Config file: `~/.config/v0/config.json`

```json
{
  "apiKey": "v0_...",
  "defaults": {
    "model": "...",
    "imageGeneration": false,
    "thinking": false
  }
}
```

### Project link file: `.v0` (in project root)

```json
{
  "projectId": "..."
}
```

## Output Formatting

- **Default:** Pretty-printed tables/lists with colors and alignment
- **`--json`:** Machine-readable JSON output on all list/detail commands
- **URLs:** Always printed to stdout when relevant (for easy piping)

## Error Handling

- **Default:** Clean, user-friendly messages
  - `"Authentication failed. Run 'v0 login' to set your API key."`
  - `"Rate limited. Try again in 30s."`
  - `"Chat not found: abc123"`
- **`--verbose`:** Full error details including HTTP status, response body, and stack trace

## Future Commands (post-v1)

These are planned for future iterations:

- `v0 chat send <chat-id> <message>` — Send a message to an existing chat
- `v0 chat download <chat-id>` — Download a chat version as files (`--out <dir>`, `--force` to overwrite)
- `v0 chat fork <chat-id>` — Fork an existing chat
- `v0 chat favorite/unfavorite <chat-id>` — Manage favorites
- `v0 project list` — List all projects
- `v0 project create` — Create a new project
- `v0 project env list/set/delete` — Manage project environment variables
- `v0 deploy create` — Create a deployment
- `v0 deploy list` — List deployments
- `v0 deploy logs <deploy-id>` — View deployment logs

## Technical Notes

- Uses Bun as the runtime (not Node.js)
- No tests in v1 — to be added later
- Commander for CLI parsing
- v0-sdk handles all API communication
- Bun auto-loads `.env` so no dotenv needed
- Config stored XDG-compliant at `~/.config/v0/`
