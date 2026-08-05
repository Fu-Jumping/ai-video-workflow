# Step 0: Research

Organize real-world topics, prototypes, news reports, interviews, historical records, comment samples, and visual evidence before script planning.

Core files:

- `00_前期研究/00_研究总览.md`
- `00_前期研究/01_资料索引.md`
- `00_前期研究/02_摘录卡片.md`
- `00_前期研究/03_主题归纳.md`
- `00_前期研究/04_创作简报.md`

The local library uses `SRC-xxxx` source IDs. Step 1 may inherit `04_创作简报.md`; later steps must not present uncited real-world facts as certain facts.

Source archiving commands:

```powershell
ai-video-workflow research ingest --project <project-path> --source <url-or-file> --platform auto
ai-video-workflow research inbox --project <project-path>
```

Raw source packages, media, browser profiles, cookies, and complete raw comment packages are gitignored by default.
