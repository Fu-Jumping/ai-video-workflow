import { defineConfig } from "vitepress";

export default defineConfig({
  title: "ai-video-workflow",
  description: "AI video workflow product docs",
  themeConfig: {
    nav: [
      { text: "English", link: "/en/" },
      { text: "中文", link: "/zh/" }
    ],
    sidebar: {
      "/en/": [
        { text: "For Users", items: [{ text: "Home", link: "/en/" }, { text: "Quickstart", link: "/en/quickstart/index" }] },
        { text: "Workflow", items: [{ text: "Overview", link: "/en/workflow/overview" }, { text: "Step 1", link: "/en/workflow/step-01-concept" }, { text: "Step 2", link: "/en/workflow/step-02-setting" }, { text: "Step 3", link: "/en/workflow/step-03-storyboard" }, { text: "Step 4", link: "/en/workflow/step-04-image-prompts" }, { text: "Step 5", link: "/en/workflow/step-05-video-prompts" }, { text: "Step 6", link: "/en/workflow/step-06-execution-plan" }] },
        { text: "IDE Integrations", items: [{ text: "Codex", link: "/en/ide-integrations/codex" }, { text: "Cursor", link: "/en/ide-integrations/cursor" }, { text: "Claude Code", link: "/en/ide-integrations/claude-code" }, { text: "Trae", link: "/en/ide-integrations/trae" }] },
        { text: "Platforms", items: [{ text: "By Task", link: "/en/generation-platforms/by-task" }] },
        { text: "Creators", items: [{ text: "Create a Pack", link: "/en/creators/create-a-pack" }, { text: "Write Skills", link: "/en/creators/write-skills" }, { text: "Write Rules", link: "/en/creators/write-rules" }, { text: "Write Templates", link: "/en/creators/write-templates" }] },
        { text: "Contributors", items: [{ text: "Repo Architecture", link: "/en/contributors/repo-architecture" }, { text: "Adapter Boundaries", link: "/en/contributors/adapter-boundaries" }, { text: "v0.2 Roadmap", link: "/en/contributors/roadmap-v0.2" }, { text: "Testing", link: "/en/contributors/testing" }, { text: "Release Process", link: "/en/contributors/release-process" }] }
      ],
      "/zh/": [
        { text: "给用户", items: [{ text: "首页", link: "/zh/" }, { text: "快速开始", link: "/zh/quickstart/index" }] },
        { text: "工作流", items: [{ text: "总览", link: "/zh/workflow/overview" }, { text: "Step 1", link: "/zh/workflow/step-01-concept" }, { text: "Step 2", link: "/zh/workflow/step-02-setting" }, { text: "Step 3", link: "/zh/workflow/step-03-storyboard" }, { text: "Step 4", link: "/zh/workflow/step-04-image-prompts" }, { text: "Step 5", link: "/zh/workflow/step-05-video-prompts" }, { text: "Step 6", link: "/zh/workflow/step-06-execution-plan" }] },
        { text: "IDE 接入", items: [{ text: "Codex", link: "/zh/ide-integrations/codex" }, { text: "Cursor", link: "/zh/ide-integrations/cursor" }, { text: "Claude Code", link: "/zh/ide-integrations/claude-code" }, { text: "Trae", link: "/zh/ide-integrations/trae" }] },
        { text: "平台", items: [{ text: "按任务分组", link: "/zh/generation-platforms/by-task" }] },
        { text: "创作者", items: [{ text: "创建 Pack", link: "/zh/creators/create-a-pack" }, { text: "写 Skills", link: "/zh/creators/write-skills" }, { text: "写 Rules", link: "/zh/creators/write-rules" }, { text: "写 Templates", link: "/zh/creators/write-templates" }] },
        { text: "贡献者", items: [{ text: "仓库架构", link: "/zh/contributors/repo-architecture" }, { text: "Adapter 边界", link: "/zh/contributors/adapter-boundaries" }, { text: "v0.2 路线图", link: "/zh/contributors/roadmap-v0.2" }, { text: "测试", link: "/zh/contributors/testing" }, { text: "发布流程", link: "/zh/contributors/release-process" }] }
      ]
    }
  }
});
