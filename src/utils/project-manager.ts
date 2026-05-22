import { Octokit } from "@octokit/rest";
import { getPreferenceValues } from "@raycast/api";
import * as fs from "fs-extra";
import * as path from "path";
import simpleGit from "simple-git";

interface Preferences {
  githubToken: string;
  repoName: string;
  repoDescription: string;
}

export async function createProject(config: {
  name: string;
  description: string;
  template: string;
  aiFeatures: string[];
  autoSetup: boolean;
}): Promise<string> {
  const projectPath = path.join(process.env.HOME!, "CMNDCENTER", "repos", config.name);
  await fs.ensureDir(projectPath);

  const files: Record<string, string> = {
    "package.json": generatePackageJson(config),
    "README.md": generateReadme(config),
    "src/index.ts": generateMainFile(config),
    ".env.example": generateEnvFile(),
    ".gitignore": generateGitignore(),
    "tsconfig.json": generateTsConfig(),
  };

  await fs.ensureDir(path.join(projectPath, "src"));
  await fs.ensureDir(path.join(projectPath, "src/agents"));
  await fs.ensureDir(path.join(projectPath, "src/memory"));
  await fs.ensureDir(path.join(projectPath, "src/pipelines"));

  for (const [filePath, content] of Object.entries(files)) {
    await fs.writeFile(path.join(projectPath, filePath), content, "utf-8");
  }

  const git = simpleGit(projectPath);
  await git.init();
  await git.add(".");
  await git.commit("Initial commit: Claude Architect OS project scaffold");

  return projectPath;
}

export async function deployToGitHub(name: string, description: string, projectPath: string): Promise<string> {
  const prefs = getPreferenceValues<Preferences>();
  const token = prefs.githubToken || process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GitHub token not found. Set it in Raycast preferences or GITHUB_TOKEN env var.");
  }

  const octokit = new Octokit({ auth: token });

  const { data: repo } = await octokit.repos.createForAuthenticatedUser({
    name,
    description,
    private: false,
    auto_init: false,
  });

  const git = simpleGit(projectPath);
  try {
    await git.addRemote("origin", repo.clone_url);
  } catch {
    await git.remote(["set-url", "origin", repo.clone_url]);
  }
  await git.push("origin", "main", ["--set-upstream"]);

  return repo.html_url;
}

function generatePackageJson(config: { name: string; description: string }) {
  return JSON.stringify(
    {
      name: config.name,
      version: "1.0.0",
      description: config.description,
      main: "dist/index.js",
      scripts: { build: "tsc", dev: "ts-node src/index.ts", start: "node dist/index.js" },
      dependencies: {
        "@anthropic-ai/sdk": "^0.17.0",
        "@raycast/api": "^1.68.0",
        "@raycast/utils": "^1.12.0",
        "typescript": "^5.2.2",
        "ts-node": "^10.9.0",
      },
    },
    null,
    2
  );
}

function generateMainFile(config: { name: string }) {
  return `// Claude Architect OS — ${config.name}
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function main() {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Initialize ${config.name}" }],
  });
  console.log(response.content[0]);
}

main().catch(console.error);
`;
}

function generateReadme(config: { name: string; description: string; aiFeatures: string[] }) {
  return `# ${config.name}

${config.description}

## Features

${config.aiFeatures.map((f) => `- ${f}`).join("\n")}

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

Built with Claude Architect OS
`;
}

function generateEnvFile() {
  return `ANTHROPIC_API_KEY=your_anthropic_key_here
GITHUB_TOKEN=your_github_token_here
NODE_ENV=development
`;
}

function generateGitignore() {
  return `node_modules/
dist/
.env
.DS_Store
*.log
`;
}

function generateTsConfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        module: "commonjs",
        lib: ["ES2020"],
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2
  );
}
