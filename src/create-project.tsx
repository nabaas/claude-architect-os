import { Form, ActionPanel, Action, showToast, Toast, popToRoot } from "@raycast/api";
import { useForm, FormValidation } from "@raycast/utils";
import { useState } from "react";
import { createProject, deployToGitHub } from "./utils/project-manager";

interface ProjectForm {
  name: string;
  description: string;
  template: string;
  aiFeatures: string[];
  autoSetup: boolean;
}

export default function CreateProject() {
  const [isLoading, setIsLoading] = useState(false);

  const { handleSubmit, itemProps } = useForm<ProjectForm>({
    async onSubmit(values) {
      setIsLoading(true);
      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Creating AI Project...",
      });

      try {
        const projectPath = await createProject(values);

        if (values.autoSetup) {
          const repoUrl = await deployToGitHub(values.name, values.description, projectPath);
          toast.style = Toast.Style.Success;
          toast.title = "Project Created & Deployed!";
          toast.message = `Repository: ${repoUrl}`;
          toast.primaryAction = {
            title: "Open Repository",
            onAction: () => {
              require("child_process").exec(`open ${repoUrl}`);
            },
          };
        } else {
          toast.style = Toast.Style.Success;
          toast.title = "Project Created Successfully!";
          toast.message = `Location: ${projectPath}`;
        }

        popToRoot();
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = "Failed to create project";
        toast.message = String(error);
      } finally {
        setIsLoading(false);
      }
    },
    validation: {
      name: FormValidation.Required,
      description: FormValidation.Required,
    },
  });

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Project" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        title="Project Name"
        placeholder="claude-architect-project"
        {...itemProps.name}
      />

      <Form.TextArea
        title="Description"
        placeholder="AI-powered application with autonomous capabilities"
        {...itemProps.description}
      />

      <Form.Dropdown title="Template" {...itemProps.template}>
        <Form.Dropdown.Item value="full-stack" title="Full Stack AI App" />
        <Form.Dropdown.Item value="raycast-extension" title="Raycast Extension" />
        <Form.Dropdown.Item value="automation-suite" title="Automation Suite" />
        <Form.Dropdown.Item value="ai-agent" title="AI Agent Framework" />
        <Form.Dropdown.Item value="marketplace-bot" title="Marketplace Bot" />
      </Form.Dropdown>

      <Form.TagPicker title="AI Features" {...itemProps.aiFeatures}>
        <Form.TagPicker.Item value="claude-integration" title="Claude Integration" />
        <Form.TagPicker.Item value="vector-storage" title="Vector Storage" />
        <Form.TagPicker.Item value="autonomous-agents" title="Autonomous Agents" />
        <Form.TagPicker.Item value="prompt-chaining" title="Prompt Chaining" />
        <Form.TagPicker.Item value="memory-layer" title="Memory Layer" />
        <Form.TagPicker.Item value="execution-engine" title="Execution Engine" />
      </Form.TagPicker>

      <Form.Checkbox label="Auto-deploy to GitHub" {...itemProps.autoSetup} />
    </Form>
  );
}
