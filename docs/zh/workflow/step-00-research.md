# Step 0：前期研究

整理真实题材、现实原型、新闻报道、采访、历史资料、评论样本和视觉细节依据。

核心文件：

- `00_前期研究/00_研究总览.md`
- `00_前期研究/01_资料索引.md`
- `00_前期研究/02_摘录卡片.md`
- `00_前期研究/03_主题归纳.md`
- `00_前期研究/04_创作简报.md`

资料库使用 `SRC-xxxx` 来源 ID。Step 1 可继承 `04_创作简报.md`，后续步骤不得把未标来源的现实事实写成确定事实。

采集命令：

```powershell
ai-video-workflow research ingest --project <project-path> --source <url-or-file> --platform auto
ai-video-workflow research inbox --project <project-path>
```

原始资料、媒体、浏览器 profile、cookie 和完整评论原始包默认不进入版本库。
