/**
 * UI Agent — Claude Architect OS
 * Designs and generates React/TypeScript UI components for CMNDCENTER dashboards.
 * Raycast-native, Tailwind-compatible, accessible. Feeds: Chain 2, Chain 5.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are the UI Agent for CMNDCENTER — a React and Raycast UI specialist.
You build Raycast extension components, dashboard panels, and system status displays.
Stack: React 18, TypeScript strict, @raycast/api components, Tailwind CSS.
Principles: accessible, performant, composable. No inline styles. No magic numbers.`;

export interface UIComponent {
  id: string;
  name: string;
  type: "list" | "form" | "detail" | "menu-bar" | "dashboard" | "alert";
  code: string;
  dependencies: string[];
  props: Record<string, string>;
  description: string;
}

export async function generateComponent(
  description: string,
  componentType: UIComponent["type"] = "list",
  dataShape?: Record<string, unknown>
): Promise<UIComponent> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3072,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Generate a Raycast extension component: ${description}
Type: ${componentType}
${dataShape ? `Data shape: ${JSON.stringify(dataShape, null, 2)}` : ""}

Requirements:
- Use @raycast/api components (List, Form, Detail, Action, etc.)
- TypeScript strict, no any
- Handle loading, empty, and error states
- useCallback/useMemo where appropriate for perf

Output JSON: {
  "name": "ComponentName",
  "code": "full TypeScript React component code",
  "dependencies": ["@raycast/api", "other-packages"],
  "props": { "propName": "TypeScript type string" },
  "description": "one-line component description"
}`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*"name"[\s\S]*"code"[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No component JSON");

    const raw = JSON.parse(jsonMatch[0]);
    return {
      id: `ui-${Date.now()}`,
      name: String(raw.name || "UnnamedComponent"),
      type: componentType,
      code: String(raw.code || ""),
      dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.map(String) : ["@raycast/api"],
      props: typeof raw.props === "object" ? raw.props : {},
      description: String(raw.description || description),
    };
  } catch {
    return {
      id: `ui-${Date.now()}`,
      name: "UnnamedComponent",
      type: componentType,
      code: `// Generation failed for: ${description}`,
      dependencies: ["@raycast/api"],
      props: {},
      description,
    };
  }
}

export async function generateDashboard(
  title: string,
  sections: Array<{ name: string; dataSource: string; refreshInterval?: number }>
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Generate a Raycast extension dashboard: "${title}"
Sections: ${JSON.stringify(sections, null, 2)}

Build a comprehensive List-based dashboard that:
- Shows all sections as List.Section groups
- Uses List.Item.Detail for expandable info
- Has refresh hotkey (CMD+R)
- Shows loading state with skeleton items
- Has section-level refresh indicators

Output: complete TypeScript file, ready to add to src/ of a Raycast extension.`,
    }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "// Dashboard generation failed";
}

export async function designMenuBar(
  items: Array<{ title: string; value: string; icon?: string }>,
  statusIndicator: "health" | "profit" | "trade" | "build"
): Promise<string> {
  const statusColors: Record<typeof statusIndicator, string> = {
    health: "🟢",
    profit: "💰",
    trade: "📈",
    build: "🔱",
  };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Generate a Raycast MenuBar command showing CMNDCENTER status.
Status indicator: ${statusColors[statusIndicator]} ${statusIndicator}
Menu items: ${JSON.stringify(items)}

Build a MenuBarExtra component that:
- Shows ${statusColors[statusIndicator]} icon in menu bar
- Opens dropdown with provided items as MenuBarExtra.Item
- Has "Open Dashboard" action that opens the full List dashboard
- Refreshes every 60 seconds

Output: complete TypeScript MenuBarExtra component.`,
    }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "// MenuBar generation failed";
}

if (require.main === module) {
  const description = process.argv.slice(2).join(" ") || "CMNDCENTER system status overview with service health";
  generateComponent(description, "list").then((component) => {
    console.log(`\n🎨 UI Agent generated: ${component.name}`);
    console.log(`  Type: ${component.type}`);
    console.log(`  Dependencies: ${component.dependencies.join(", ")}`);
    console.log(`  Props: ${Object.keys(component.props).join(", ")}`);
    console.log(`  Code length: ${component.code.length} chars`);

    // Save component
    const outputDir = path.join(__dirname, "generated");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `${component.name}.tsx`), component.code);
    console.log(`  → Saved to agents/ui/generated/${component.name}.tsx`);
  });
}
