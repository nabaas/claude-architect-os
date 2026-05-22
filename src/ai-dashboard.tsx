import { List, ActionPanel, Action, Icon, Color, Detail } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getSystemStatus, getActiveAgents, getRecentOperations } from "./utils/system-monitor";

export default function AIDashboard() {
  const { data: systemStatus, isLoading: statusLoading } = useCachedPromise(getSystemStatus);
  const { data: activeAgents, isLoading: agentsLoading } = useCachedPromise(getActiveAgents);
  const { data: recentOps, isLoading: opsLoading } = useCachedPromise(getRecentOperations);

  return (
    <List isLoading={statusLoading || agentsLoading || opsLoading}>
      <List.Section title="System Status">
        <List.Item
          title="Claude Architect OS"
          subtitle={systemStatus?.status || "Unknown"}
          icon={{ source: Icon.Circle, tintColor: systemStatus?.healthy ? Color.Green : Color.Red }}
          accessories={[{ text: `Uptime: ${systemStatus?.uptime || "0s"}` }]}
        />
        <List.Item
          title="CMNDCENTER"
          subtitle={systemStatus?.cmndcenterStatus || "Unknown"}
          icon={{ source: Icon.Terminal, tintColor: Color.Blue }}
          accessories={[{ text: systemStatus?.version || "v4.0" }]}
        />
      </List.Section>

      <List.Section title="Active Agents">
        {activeAgents?.map((agent) => (
          <List.Item
            key={agent.id}
            title={agent.name}
            subtitle={agent.status}
            icon={{
              source: Icon.Person,
              tintColor: agent.status === "Active" ? Color.Green : agent.status === "Processing" ? Color.Yellow : Color.SecondaryText,
            }}
            accessories={[{ text: `Tasks: ${agent.activeTasks}` }, { text: `${agent.successRate}%` }]}
            actions={
              <ActionPanel>
                <Action.Push title="View Agent Details" target={<AgentDetails agent={agent} />} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title="Recent Operations">
        {recentOps?.map((op) => (
          <List.Item
            key={op.id}
            title={op.operation}
            subtitle={op.result}
            icon={{
              source: Icon.Clock,
              tintColor: op.result === "Success" ? Color.Green : op.result === "Failed" ? Color.Red : Color.Orange,
            }}
            accessories={[{ text: op.timestamp }]}
          />
        ))}
      </List.Section>
    </List>
  );
}

function AgentDetails({ agent }: { agent: Record<string, unknown> }) {
  const markdown = `
# ${agent.name as string}

**Status:** ${agent.status as string}
**Phase:** ${agent.phase as string}
**Active Tasks:** ${agent.activeTasks as number}
**Success Rate:** ${agent.successRate as number}%

## Description
${agent.description as string}

## Capabilities
${((agent.capabilities as string[]) || []).map((c) => `- ${c}`).join("\n")}
`;
  return <Detail markdown={markdown} />;
}
