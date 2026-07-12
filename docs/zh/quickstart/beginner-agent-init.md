# 新手：让智能体代跑 CLI

如果你只是想开始第一个 AI 视频创作项目，不要直接在 `ai-video-workflow` 工具仓库里写剧本。这个仓库用来创建单独的创作项目目录；真正写 Step 1 到 Step 6 的地方，是生成后的创作项目。

把下面这段话复制给 Codex、Cursor、Claude Code、Trae 或其他能运行本地命令的智能体：

```text
我想用当前 ai-video-workflow 工具创建一个新的 AI 视频创作项目。
请先检查这个工具仓库是否已经安装依赖并构建 CLI；如果没有，请帮我完成。
然后询问我项目名称、项目保存位置、使用哪个智能体工具、默认图片生成平台和默认视频生成平台。
请你根据我的回答运行初始化命令，创建项目后告诉我应该打开哪个目录，并带我从 Step 1 策划开始。
我没有编程经验，请不要让我自己拼复杂命令；每一步只告诉我需要确认或填写什么。
```

智能体应调用 CLI，而不是手工复制模板。CLI 是权威初始化入口，会稳定创建 `AGENTS.md`、`docs/ai-workspace/`、Step 目录、模板、配置和 IDE runtime 文件。

初始化完成后，打开生成出来的创作项目目录，不要继续在工具仓库里写创作内容。第一步从 `01_concept/story-kernel.md` 开始。

如果使用 Obsidian，只把 `_views/obsidian/` 作为 vault 打开。不要把项目根目录本身当成 Obsidian vault。高级用户仍可用 `--out <path>` 把生成 vault 放到项目外部。

手动 CLI 仍保留给熟练用户和脚本化场景：

```powershell
node apps/cli/dist/index.js init --name my-ai-video-project --ide codex --image openai --video runway
```

创建后运行校验：

```powershell
ai-video-workflow verify --project <project-path> --ide <ide>
```
