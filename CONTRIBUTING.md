# Contributing to oh-my-embedded

Welcome. If you work with embedded systems and want to make OpenCode smarter about hardware, firmware, and electronics — you're in the right place.

This guide covers everything you need to add a new skill, tool, command, agent, or MCP server integration. The bar is intentionally low. If you can write a Markdown file, you can contribute.

---

## Code of Conduct

Be respectful. Be inclusive. Be constructive. Critique ideas, not people. If someone is new to embedded systems or open source, help them — don't gatekeep. That's it.

---

## Getting Started

**Prerequisites:**

- [Bun](https://bun.sh) >= 1.0
- TypeScript 5.7+
- [OpenCode](https://opencode.ai) installed and configured

No npm. No yarn. Bun only.

---

## Development Setup

```bash
git clone https://github.com/captainluzik/oh-my-embedded.git
cd oh-my-embedded
bun install
bun run build
bun run typecheck
```

If typecheck and build both pass, you're ready.

---

## Testing Locally

Point your OpenCode config at the local build instead of the published package:

```json
{
  "plugins": [
    "file:///absolute/path/to/oh-my-embedded/dist/index.js"
  ]
}
```

After making changes, rebuild and restart OpenCode:

```bash
bun run build
# restart opencode
```

---

## Project Structure

```
oh-my-embedded/
├── src/
│   ├── index.ts          # Plugin entry point — registers tools, hooks, skills
│   ├── tools/             # Embedded-specific calculator and advisor tools
│   │   ├── power-calculator.ts
│   │   ├── impedance-calculator.ts
│   │   ├── resistor-divider.ts
│   │   ├── pin-mapper.ts
│   │   └── decoupling-advisor.ts
│   ├── hooks/             # Auto-detection hooks that run on project open
│   │   ├── project-detector.ts
│   │   └── sdkconfig-injector.ts
│   └── cli/
│       └── install.ts     # CLI installer for guided setup
├── skills/                # AI skill definitions (one directory per skill)
│   ├── embedded-engineer/
│   ├── embedded-review/
│   ├── pcb-designer/
│   ├── component-sourcer/
│   ├── firmware-debugger/
│   └── circuit-simulator/
├── commands/              # Slash command definitions (.md files)
├── agents/                # Agent definitions (.md files)
├── docs/guide/
│   └── installation.md
├── package.json
├── tsconfig.json
└── biome.json
```

---

## How to Add a New Skill

Skills are the primary way to give OpenCode domain expertise. Each skill lives in its own directory under `skills/` and is defined by a `SKILL.md` file with YAML frontmatter.

**Step 1:** Create a directory under `skills/`:

```bash
mkdir skills/my-new-skill
```

**Step 2:** Create `skills/my-new-skill/SKILL.md`:

```markdown
---
name: my-new-skill
description: What this skill does — be specific about the embedded domain it covers
mcpConfig:
  myMcpServer:
    command: npx
    args: ["-y", "my-mcp-package"]
---

Write the skill prompt here. Describe the persona, expertise, and behavior.
What does this agent know? What tools does it use? What problems does it solve?

Be concrete. Reference real datasheets, protocols, or toolchains if relevant.
```

The `mcpConfig` block is optional — only include it if your skill needs an MCP server (see [How to Add a New MCP Server Integration](#how-to-add-a-new-mcp-server-integration)).

**Step 3:** Export the skill from the plugin in `src/index.ts`:

```typescript
plugin.skill("./skills/my-new-skill/SKILL.md");
```

**Step 4:** Build and test:

```bash
bun run build
bun run typecheck
```

---

## How to Add a New Tool

Tools are TypeScript functions exposed to the AI as callable actions. They live in `src/tools/` and are registered in `src/index.ts`.

**Step 1:** Create `src/tools/my-tool.ts`:

```typescript
import { z } from "zod";

export function registerMyTool(plugin: any) {
  plugin.tool("embedded-my-tool", {
    description: "What this tool does",
    parameters: z.object({
      input: z.string().describe("Description"),
    }),
    execute: async ({ input }) => {
      return { content: [{ type: "text", text: `Result: ${input}` }] };
    },
  });
}
```

Keep tool names prefixed with `embedded-` to avoid collisions with other plugins.

**Step 2:** Register it in `src/index.ts`:

```typescript
import { registerMyTool } from "./tools/my-tool";

// inside plugin setup
registerMyTool(plugin);
```

**Step 3:** Add a Zod schema for every parameter. No untyped inputs. No `as any`.

**Step 4:** Build and typecheck:

```bash
bun run build
bun run typecheck
```

---

## How to Add a New Command

Commands are slash commands that appear in the OpenCode UI. They're just Markdown files with YAML frontmatter.

**Step 1:** Create a `.md` file in `commands/`:

```markdown
---
name: my-command
description: Short description shown in the command palette
---

The prompt or instructions that run when this command is invoked.
```

**Step 2:** Register it in `src/index.ts`:

```typescript
plugin.command("./commands/my-command.md");
```

**Step 3:** Build and test locally.

---

## How to Add a New Agent

Agents are specialized AI personas with a defined mode and visual identity. They live in `agents/`.

**Step 1:** Create a `.md` file in `agents/`:

```markdown
---
name: My Agent Name
description: What this agent specializes in
color: "#4A90D9"
mode: build
---

Agent system prompt goes here. Define the persona, expertise, and constraints.
```

Valid `mode` values: `build`, `plan`, `review` (check OpenCode docs for the current list).

**Step 2:** Register it in `src/index.ts`:

```typescript
plugin.agent("./agents/my-agent.md");
```

**Step 3:** Build and test.

---

## How to Add a New MCP Server Integration

This is the highest-impact contribution you can make. MCP servers give the AI access to real tools — datasheets, component databases, simulation engines, hardware interfaces. If you know of an MCP server relevant to embedded systems, add it.

MCP integrations live inside skill YAML frontmatter under `mcpConfig`:

```yaml
---
name: component-sourcer
description: Sources components from distributors and checks availability
mcpConfig:
  octopart:
    command: npx
    args: ["-y", "@octopart/mcp-server"]
  digikey:
    command: npx
    args: ["-y", "@digikey/mcp-server", "--api-key", "${DIGIKEY_API_KEY}"]
---
```

Each key under `mcpConfig` is a named MCP server. The `command` and `args` follow the standard MCP server spawn format.

**Guidelines for MCP integrations:**

- Only add MCP servers that are publicly available and maintained
- If the server requires an API key, use an environment variable (e.g., `${MY_API_KEY}`) — never hardcode credentials
- Document what the MCP server provides in the skill prompt
- Test that the server actually starts and responds before submitting

If you're adding a new MCP server to an existing skill, just update that skill's `SKILL.md`. If it warrants a new skill entirely, create one.

---

## Pull Request Process

1. Fork the repo on GitHub
2. Branch from `main`:
   ```bash
   git checkout -b feat/my-contribution
   ```
3. Make your changes
4. Run typecheck and build:
   ```bash
   bun run typecheck
   bun run build
   ```
5. Run the linter:
   ```bash
   bunx biome check .
   ```
6. Test locally using the `file://` path in your OpenCode config
7. Submit a PR against `main` with a clear description of what you added and why

Keep PRs focused. One skill, one tool, or one MCP integration per PR is ideal. Easier to review, faster to merge.

---

## PR Checklist

Before submitting, confirm:

- [ ] `bun run typecheck` passes with no errors
- [ ] `bun run build` succeeds
- [ ] `bunx biome check .` passes
- [ ] Tested locally with the `file://` plugin path
- [ ] No hardcoded credentials or API keys
- [ ] New tools use Zod schemas for all parameters
- [ ] New skill directories follow `kebab-case` naming
- [ ] PR description explains what was added and why it's useful for embedded development

---

## Code Style

- **Package manager:** Bun only. Never `npm install` or `yarn add`.
- **Linter:** [Biome](https://biomejs.dev). Run `bunx biome check .` before committing.
- **TypeScript:** Strict mode. No `as any`. No `@ts-ignore`. If the types are wrong, fix them.
- **Directory names:** `kebab-case` everywhere.
- **Tool names:** Prefix with `embedded-` to avoid collisions.
- **Imports:** Use explicit file extensions where required by the build config.
- **Commits:** Keep them small and descriptive. `feat: add impedance calculator tool` not `update stuff`.

---

Questions? Open an issue on [GitHub](https://github.com/captainluzik/oh-my-embedded/issues). Happy to help.
