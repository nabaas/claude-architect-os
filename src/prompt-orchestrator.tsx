/**
 * prompt-orchestrator.tsx
 * Raycast UI for managing AI prompt layers.
 * Supports activating/deactivating layers, composing the full prompt stack,
 * and copying to clipboard.
 */

import {
  Action,
  ActionPanel,
  Alert,
  Clipboard,
  Color,
  confirmAlert,
  Detail,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useLocalStorage } from "@raycast/utils";
import { useCallback, useMemo, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type LayerKey =
  | "base"
  | "mission"
  | "role"
  | "task"
  | "context"
  | "memory"
  | "live-data";

interface PromptLayer {
  key: LayerKey;
  label: string;
  description: string;
  icon: Icon;
  color: Color;
  /** Priority order in final assembled prompt (lower = earlier) */
  order: number;
  defaultContent: string;
}

interface LayerState {
  active: boolean;
  content: string;
}

type LayersStateMap = Record<LayerKey, LayerState>;

// ── Layer definitions ──────────────────────────────────────────────────────

const PROMPT_LAYERS: PromptLayer[] = [
  {
    key: "base",
    label: "Base",
    description: "Core identity and behavioral constraints for the AI",
    icon: Icon.Circle,
    color: Color.SecondaryText,
    order: 0,
    defaultContent:
      "You are a highly capable AI assistant. Follow instructions precisely. Be concise unless depth is explicitly requested. Prefer structured output. Never fabricate information.",
  },
  {
    key: "mission",
    label: "Mission",
    description: "The overarching goal and success criteria for this session",
    icon: Icon.Rocket,
    color: Color.Purple,
    order: 1,
    defaultContent:
      "Mission: Build high-quality, production-ready software that solves real user problems. Every output should be deployable, not a prototype. Prioritize reliability, security, and maintainability.",
  },
  {
    key: "role",
    label: "Role",
    description: "The specific persona and expertise the AI should adopt",
    icon: Icon.Person,
    color: Color.Blue,
    order: 2,
    defaultContent:
      "You are a Senior Full-Stack Engineer with 10+ years of experience across Python, TypeScript, and cloud infrastructure. You write clean, well-tested code and explain architectural decisions clearly.",
  },
  {
    key: "task",
    label: "Task",
    description: "The immediate task or instruction to execute",
    icon: Icon.Bolt,
    color: Color.Yellow,
    order: 3,
    defaultContent: "[Task will be inserted here at runtime]",
  },
  {
    key: "context",
    label: "Context",
    description: "Relevant background, constraints, and project-specific information",
    icon: Icon.Document,
    color: Color.Green,
    order: 4,
    defaultContent:
      "Project: CMNDCENTER — AI Command Center v4.0. Stack: Python 3.12, TypeScript 5.4, Raycast extension API. Constraints: No placeholder code, full implementations only. Target: macOS Sequoia.",
  },
  {
    key: "memory",
    label: "Memory",
    description: "Prior session learnings and persistent agent knowledge",
    icon: Icon.MemoryChip,
    color: Color.Orange,
    order: 5,
    defaultContent:
      "Prior learnings: User prefers direct, actionable responses over explanations. Always use absolute file paths. Prefer editing existing files over creating new ones. Code must compile on first attempt.",
  },
  {
    key: "live-data",
    label: "Live Data",
    description: "Real-time signals, market data, or dynamic context injected at runtime",
    icon: Icon.Wifi,
    color: Color.Red,
    order: 6,
    defaultContent: "[Live data injected at runtime — market signals, metrics, or current state]",
  },
];

const LAYER_KEYS: LayerKey[] = PROMPT_LAYERS.map((l) => l.key);

// ── Default state ──────────────────────────────────────────────────────────

function buildDefaultState(): LayersStateMap {
  const state: Partial<LayersStateMap> = {};
  for (const layer of PROMPT_LAYERS) {
    state[layer.key] = {
      active: layer.key !== "live-data", // live-data off by default
      content: layer.defaultContent,
    };
  }
  return state as LayersStateMap;
}

// ── Prompt assembly ────────────────────────────────────────────────────────

function assemblePrompt(layers: LayersStateMap): string {
  const sortedLayers = [...PROMPT_LAYERS].sort((a, b) => a.order - b.order);
  const activeLayers = sortedLayers.filter((l) => layers[l.key].active);

  if (activeLayers.length === 0) {
    return "(No active layers — enable at least one layer to compose a prompt)";
  }

  const sections = activeLayers.map((layer) => {
    const content = layers[layer.key].content;
    return `## [${layer.label.toUpperCase()}]\n${content}`;
  });

  return sections.join("\n\n");
}

// ── Layer Detail view ──────────────────────────────────────────────────────

function LayerDetail({
  layer,
  state,
  onToggle,
  onCompose,
}: {
  layer: PromptLayer;
  state: LayerState;
  onToggle: (key: LayerKey) => void;
  onCompose: () => void;
}) {
  const markdown = [
    `# ${layer.label} Layer`,
    `> ${layer.description}`,
    "",
    "## Status",
    state.active ? "Active — included in prompt stack" : "Inactive — excluded from prompt stack",
    "",
    "## Current Content",
    "```",
    state.content,
    "```",
  ].join("\n");

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Layer">
            <Action
              title={state.active ? "Deactivate Layer" : "Activate Layer"}
              icon={state.active ? Icon.XMarkCircle : Icon.CheckCircle}
              onAction={() => onToggle(layer.key)}
            />
            <Action
              title="Copy Layer Content"
              icon={Icon.Clipboard}
              onAction={async () => {
                await Clipboard.copy(state.content);
                await showToast({
                  style: Toast.Style.Success,
                  title: "Copied",
                  message: `${layer.label} layer content copied`,
                });
              }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Stack">
            <Action
              title="Compose Full Stack"
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
              onAction={onCompose}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

// ── Composed Prompt view ───────────────────────────────────────────────────

function ComposedPromptView({ prompt }: { prompt: string }) {
  const lineCount = prompt.split("\n").length;
  const charCount = prompt.length;
  const approxTokens = Math.round(charCount / 4);

  const markdown = [
    "# Assembled Prompt Stack",
    "",
    `**${lineCount} lines** | **${charCount} chars** | **~${approxTokens} tokens**`,
    "",
    "---",
    "",
    "```",
    prompt,
    "```",
  ].join("\n");

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Copy to Clipboard"
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
            onAction={async () => {
              await Clipboard.copy(prompt);
              await showToast({
                style: Toast.Style.Success,
                title: "Copied",
                message: `${approxTokens} tokens copied to clipboard`,
              });
            }}
          />
          <Action
            title="Copy as Markdown"
            icon={Icon.Text}
            onAction={async () => {
              await Clipboard.copy(`\`\`\`\n${prompt}\n\`\`\``);
              await showToast({
                style: Toast.Style.Success,
                title: "Copied as Markdown",
              });
            }}
          />
        </ActionPanel>
      }
    />
  );
}

// ── Main command ───────────────────────────────────────────────────────────

export default function PromptOrchestrator() {
  const { push } = useNavigation();

  // Persist layer state across Raycast sessions
  const { value: storedState, setValue: setStoredState } =
    useLocalStorage<LayersStateMap>("prompt-layers-state", buildDefaultState());

  const layersState: LayersStateMap = storedState ?? buildDefaultState();

  const [searchText, setSearchText] = useState("");

  const toggleLayer = useCallback(
    async (key: LayerKey) => {
      const current = layersState[key];
      const updated: LayersStateMap = {
        ...layersState,
        [key]: { ...current, active: !current.active },
      };
      await setStoredState(updated);

      await showToast({
        style: Toast.Style.Success,
        title: updated[key].active ? "Layer activated" : "Layer deactivated",
        message: PROMPT_LAYERS.find((l) => l.key === key)?.label,
      });
    },
    [layersState, setStoredState]
  );

  const resetToDefaults = useCallback(async () => {
    const confirmed = await confirmAlert({
      title: "Reset All Layers",
      message: "This will restore all layers to their default content and activation state.",
      primaryAction: { title: "Reset", style: Alert.ActionStyle.Destructive },
    });

    if (confirmed) {
      await setStoredState(buildDefaultState());
      await showToast({
        style: Toast.Style.Success,
        title: "Layers reset to defaults",
      });
    }
  }, [setStoredState]);

  const handleCompose = useCallback(() => {
    const assembled = assemblePrompt(layersState);
    push(<ComposedPromptView prompt={assembled} />);
  }, [layersState, push]);

  const activeCount = useMemo(
    () => LAYER_KEYS.filter((k) => layersState[k].active).length,
    [layersState]
  );

  const filteredLayers = useMemo(() => {
    if (!searchText.trim()) return PROMPT_LAYERS;
    const q = searchText.toLowerCase();
    return PROMPT_LAYERS.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.key.toLowerCase().includes(q)
    );
  }, [searchText]);

  return (
    <List
      searchBarPlaceholder="Filter prompt layers..."
      onSearchTextChange={setSearchText}
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by status" storeValue>
          <List.Dropdown.Item title="All Layers" value="all" />
          <List.Dropdown.Item title="Active Only" value="active" />
          <List.Dropdown.Item title="Inactive Only" value="inactive" />
        </List.Dropdown>
      }
    >
      <List.Section
        title="Prompt Stack"
        subtitle={`${activeCount} of ${PROMPT_LAYERS.length} active`}
      >
        {filteredLayers.map((layer) => {
          const state = layersState[layer.key];

          return (
            <List.Item
              key={layer.key}
              icon={{ source: layer.icon, tintColor: state.active ? layer.color : Color.SecondaryText }}
              title={layer.label}
              subtitle={layer.description}
              accessories={[
                {
                  tag: {
                    value: state.active ? "Active" : "Off",
                    color: state.active ? Color.Green : Color.SecondaryText,
                  },
                },
                {
                  text: `Order ${layer.order + 1}`,
                  tooltip: "Position in assembled prompt",
                },
              ]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section title="Layer Actions">
                    <Action
                      title="View Layer Details"
                      icon={Icon.Eye}
                      onAction={() =>
                        push(
                          <LayerDetail
                            layer={layer}
                            state={state}
                            onToggle={toggleLayer}
                            onCompose={handleCompose}
                          />
                        )
                      }
                    />
                    <Action
                      title={state.active ? "Deactivate Layer" : "Activate Layer"}
                      icon={state.active ? Icon.XMarkCircle : Icon.CheckCircle}
                      shortcut={{ modifiers: ["cmd"], key: "t" }}
                      onAction={() => toggleLayer(layer.key)}
                    />
                    <Action
                      title="Copy Layer Content"
                      icon={Icon.Clipboard}
                      shortcut={{ modifiers: ["cmd"], key: "." }}
                      onAction={async () => {
                        await Clipboard.copy(state.content);
                        await showToast({
                          style: Toast.Style.Success,
                          title: "Copied",
                          message: `${layer.label} layer content`,
                        });
                      }}
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section title="Stack Actions">
                    <Action
                      title="Compose Full Prompt Stack"
                      icon={Icon.List}
                      shortcut={{ modifiers: ["cmd"], key: "return" }}
                      onAction={handleCompose}
                    />
                    <Action
                      title="Copy Full Stack to Clipboard"
                      icon={Icon.Clipboard}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      onAction={async () => {
                        const assembled = assemblePrompt(layersState);
                        await Clipboard.copy(assembled);
                        const tokens = Math.round(assembled.length / 4);
                        await showToast({
                          style: Toast.Style.Success,
                          title: "Full stack copied",
                          message: `~${tokens} tokens`,
                        });
                      }}
                    />
                    <Action
                      title="Reset All Layers to Defaults"
                      icon={Icon.RotateClockwise}
                      style={Action.Style.Destructive}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
                      onAction={resetToDefaults}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
