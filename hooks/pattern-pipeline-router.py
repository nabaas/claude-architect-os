#!/usr/bin/env python3
"""
PostToolUse hook: detects file pattern from Write/Edit tool calls
and injects pipeline routing context back to Claude.
"""
import json, sys, os, re

data = json.load(sys.stdin)
tool = data.get("tool_name", "")
tool_input = data.get("tool_input", {})
file_path = tool_input.get("file_path", "") or tool_input.get("path", "")

if not file_path:
    sys.exit(0)

ext = os.path.splitext(file_path)[1].lower()
basename = os.path.basename(file_path)

CONFIG_FILES = {
    "keybindings.json", "settings.json", "tasks.json", "launch.json",
    "extensions.json", "tsconfig.json", "jsconfig.json", "package.json",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", ".eslintrc.json",
    "biome.json", ".prettierrc", "babel.config.json", "jest.config.json",
    "playwright.config.json", "vite.config.json", "next.config.json",
    "MEMORY.md", "settings.local.json", "mcp.json", ".mcp.json",
}
if basename in CONFIG_FILES:
    sys.exit(0)

CONFIG_PATHS = [".claude/", "/.claude/", "Application Support/Code/User/", ".vscode/"]
SKIP_EXTS = {".plist", ".xml", ".lock", ".log", ".md", ".txt", ".env",
             ".toml", ".ini", ".cfg", ".conf", ".sh", ".bash", ".zsh"}
if any(p in file_path for p in CONFIG_PATHS):
    sys.exit(0)
if ext in SKIP_EXTS:
    sys.exit(0)

PATTERNS = {
    "frontend": {
        "exts": [".tsx", ".jsx", ".css", ".scss", ".html", ".svelte", ".vue"],
        "files": ["tailwind.config", "next.config", "vite.config"],
        "pipeline": "lint → typecheck → playwright test",
        "agents": ["frontend-architect", "quality-engineer"],
        "tools": ["Tailwind IntelliSense", "Import Cost", "Pretty TS Errors", "Color Highlight"]
    },
    "backend": {
        "exts": [".ts", ".js", ".py", ".go", ".rs"],
        "files": ["server", "api", "router", "handler", "controller"],
        "pipeline": "lint → unit test → integration test",
        "agents": ["backend-architect", "security-engineer"],
        "tools": ["Error Lens", "ESLint", "Biome"]
    },
    "prisma": {
        "exts": [".prisma"],
        "files": ["schema.prisma"],
        "pipeline": "prisma format → validate → generate → migrate",
        "agents": ["database-architect"],
        "tools": ["Prisma extension"]
    },
    "proto": {
        "exts": [".proto"],
        "files": [],
        "pipeline": "proto lint → compile → generate TypeScript types",
        "agents": ["api-architect"],
        "tools": ["proto3 extension"]
    },
    "test": {
        "exts": [".test.ts", ".spec.ts", ".test.py", ".spec.js"],
        "files": ["*.test.*", "*.spec.*", "playwright.config"],
        "pipeline": "run tests → coverage → report",
        "agents": ["quality-engineer", "test-architect"],
        "tools": ["Playwright", "Jest", "Wallaby"]
    },
    "data": {
        "exts": [".json", ".csv", ".parquet", ".jsonl"],
        "files": [],
        "pipeline": "validate schema → QuickType generate types → pipeline test",
        "agents": ["data-engineer"],
        "tools": ["QuickType", "Rainbow CSV"]
    },
    "docker": {
        "exts": [".yml", ".yaml"],
        "files": ["Dockerfile", "docker-compose", "k8s", "helm"],
        "pipeline": "validate → lint → build → health check",
        "agents": ["deployment-engineer", "devops-architect"],
        "tools": ["Docker extension", "Kubernetes tools", "YAML"]
    },
    "python": {
        "exts": [".py"],
        "files": [],
        "pipeline": "black format → ruff lint → pytest → type check",
        "agents": ["python-expert"],
        "tools": ["Pylance", "Black", "Python Debugger"]
    }
}

detected = None
for pattern_name, config in PATTERNS.items():
    if ext in config["exts"]:
        detected = (pattern_name, config)
        break
    for f in config["files"]:
        if f in basename or f in file_path:
            detected = (pattern_name, config)
            break
    if detected:
        break

# Also detect by full path keywords
if not detected:
    path_lower = file_path.lower()
    if any(k in path_lower for k in ["/components/", "/pages/", "/layouts/", "/ui/", "/styles/"]):
        detected = ("frontend", PATTERNS["frontend"])
    elif any(k in path_lower for k in ["/api/", "/routes/", "/server/", "/services/"]):
        detected = ("backend", PATTERNS["backend"])
    elif any(k in path_lower for k in ["test", "spec", "__tests__"]):
        detected = ("test", PATTERNS["test"])

if detected:
    name, config = detected
    msg = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": (
                f"[PATTERN ROUTER] File '{basename}' matched pattern: {name.upper()}\n"
                f"Recommended pipeline: {config['pipeline']}\n"
                f"Best agents for this: {', '.join(config['agents'])}\n"
                f"Active VS Code tools: {', '.join(config['tools'])}\n"
                f"Run the '{name}' pipeline task in VS Code (Cmd+Shift+P → Tasks: Run Task)"
            )
        }
    }
    print(json.dumps(msg))

sys.exit(0)
