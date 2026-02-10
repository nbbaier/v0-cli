# v0-cli

A CLI tool for managing [v0](https://v0.app) chats.

## Installation

```bash
$ git clone https://github.com/nbbaier/v0-cli.git
$ cd v0-cli
$ bun install
```

Link the CLI globally:

```bash
bun link
```

## Authentication

Set your API key via environment variable:

```bash
export V0_API_KEY="your-api-key"
```

Or use the login command:

```bash
v0 login
```

## Commands

### Auth

```bash
v0 login                    # Authenticate with API key
v0 logout                   # Remove stored credentials
v0 whoami                   # Show current user info
v0 whoami --json            # Output as JSON
```

### Chats

```bash
# Create a new chat
v0 chat create "Build a dashboard"

# With options
v0 chat create "Build a dashboard" \
  --system "You are a React expert" \
  --model "claude-sonnet-4" \
  --image-gen \
  --thinking \
  --private

# List chats
v0 chat list
v0 chat list --favorites
v0 chat list -n 10

# Open a chat in browser
v0 chat open <chat-id>
v0 chat open <chat-id> --no-browser  # Print URL only

# Delete a chat
v0 chat delete <chat-id>

# Initialize with local files
v0 chat init "src/**/*.ts"
v0 chat init "src/**/*.ts" -m "Review these files"
```

### Project Linking

```bash
v0 link <project-id>        # Link current directory to a project
v0 unlink                   # Remove project link
```

When linked, `chat create` and `chat init` automatically attach the project ID.

## Configuration

- Global config: `~/.config/v0/config.json`
- Project link: `.v0` file in working directory
- API key can be set via `V0_API_KEY` environment variable or `v0 login`

## Requirements

- [Bun](https://bun.sh) runtime
- v0.dev API key

## License

MIT
