# Midjourney v8.2 平台参考文档

> 本文件是 Midjourney v8.2 平台事实的唯一固化位置。规则正文只引用本文件的相对路径，不把平台私有参数写死为事实源。
> 本文档属于 `workflow/indexes/`，sync 会将该目录同步进全部 IDE 镜像。

## 第 1 部分 版本事实与参数矩阵（官方文档已核实，2026-08）

### 版本事实

- `--v 8.2` 是官方当前默认版本（2026-07-24 起默认；`docs.midjourney.com` Version 文章原文："The current default Midjourney version is V8.2"）。
- V8.1（2026-04-14）更快、更贴 prompt、支持 HD 图（`--hd` / `--sd`）。
- `--style raw` 官方参数现名为 `--raw`（Raw 文章与参数表原文均为 `--raw`），两者等价；工作区统一写 `--style raw`。

### 参数矩阵（V8 兼容性以官方 Version 功能对比表为准）

- `--ar`：画幅，默认 1:1，V8 上限 14:1（HD 4:1），不接受小数；官方常用比例 1:1 / 4:3 / 2:3 / 16:9 / 9:16；极宽画幅属实验性、结果可能不可预测。关键帧默认建议 `--ar 21:9`（视频项目一致口径），由项目目标画幅覆盖。
- `--stylize` / `--s`：默认 100，范围 0-1000，低值更贴 prompt、更写实。
- `--raw`：关闭默认自动风格化，简单 prompt 更接近真实照片。
- `--no`：按空格逐词独立解析（`--no modern clothing` 会被读成 "no modern" + "no clothing"），禁止短语式否定；逗号分隔可列多词；负向约束优先正向描述。
- `--sref`（风格参考）：V6+ 可用；`--sref <数字代码>` 用官方内部风格库、`--sref random` 随机；`--sw` 权重 0-1000 默认 100；`--sv` 风格参考模型版本（V7 下 `--sv 6` 默认，风格码仅兼容 `--sv 4` / `--sv 6`）。
- `--oref`（Omni Reference）：V7 起替换 `--cref`，添加后自动以 V7 运行、耗 GPU×2、只能一张图、不兼容 Fast/Draft/Conversational 与 `--q 4`；可配合 Personalization / Moodboards / `--stylize` / `--sref` 使用。
- `--profile` / `--p`：Personalization 个性化配置。
- V8 不支持：`--cref` / `--cw`（仅 V6）、`--q`（V7 为 1/2/4，V8 功能表为空）、`::` 多提示词语法（官方 Multi-Prompts 文章明示仅支持至 V6.1/Niji6）。
- 其他可用：`--chaos` / `--c`（多样性）、`--weird`（怪异度）、`--seed`（V8.x 99% 一致）、`--tile`、`--repeat` / `--r`、`--draft`（V7 半价 GPU 草稿）。

### 官方写作法则（Prompt Basics 文章原文）

- "Short and simple prompts typically generate the best images"
- 正向描述优先（"Describe what you do want instead of what you don't"）
- 具体强词（big → huge / gigantic / enormous）
- 具体数字与集合名词（three cats / flock of birds）
- 光照词（soft / ambient / overcast / neon / studio lights）
- 参数放末尾，参数前留空格且参数内不用标点。

### 7 要素结构（Prompt Basics 官方原文）

Subject / Medium / Environment / Lighting / Color / Mood / Composition

## 第 2 部分 备选风格方案库（核心：风格不写死，项目按画面选用）

> 以下全部是**备选方向与触发词**，不是硬性合同。默认实拍电影方向，项目/画面按题材显式声明其他方向时，从本库选择收尾词与视觉描述词；7 要素结构、`--v 8.2` 参数行与 ≤1024 字数不变。

### A. 实拍电影感（默认方向，外部项目实测 + 官方 `--raw` 支持）

- 收尾：`photorealistic film still, shot on 65mm film, anamorphic lens, extreme detail, dramatic wide-angle composition`
- 触发词：cinematic / film still / anamorphic / 65mm / overcast
- 配合 `--style raw`（或 `--stylize 50~100`）增强写实。

### B. 官方 Art of Prompting 风格维度词库（官方文档可检索词）

- 艺术媒介 Mediums：Watercolor 水彩、Oil Painting 油画、Pixel Art 像素、Ukiyo-e 浮世绘、Pencil Sketch 铅笔素描、Ballpoint Pen Sketch 圆珠笔素描、Block Print 木刻版画、Cyanotype 蓝晒、Graffiti 涂鸦、Paint-by-Numbers、Risograph 孔版印刷、Blacklight Painting、Cross Stitch 十字绣、Acrylic Pour 丙烯浇注、Cut Paper 剪纸、Pressed Flowers 押花。
- 时代 Time Periods：1400s–2000s（可直接对应项目时代设定，如 "illustration of a 1920s ..."）。
- 情绪 Moods：Shy / Determined / Sad / Joyful / Angry / Happy / Depressed / Sleepy。
- 色彩 Colors：Sepia 复古棕、Duotone 双色调、Pastel 粉彩、Grayscale 灰阶、Neon 霓虹、Iridescent 虹彩、Ebony、Millennial Pink、Acid Green、Canary Yellow、Indigo、Neutral。
- 环境 Environments：Tundra / Salt Flat / Jungle / Desert / Forest / Cave / Farm / Crystal Forest / City / Garden / Suburban / Ocean。

### C. 中式/东方美学方向（外部"复原类合集视频"项目实测）

- 宋画式构图：composition echoing a Song dynasty painting
- 水墨：ink wash / sumi-e
- 单光源明暗：chiaroscuro / single-source lamp
- 留白：open expanse，一条提示词最多一处留白表述
- 雾适度：overcast dim daylight 等宽泛暗调优于写死浓雾
- 神兽/人物类题材可叠加实拍质感收尾。

### D. 风格一致性机制（官方，供同一项目多镜头锁定统一风格）

- `--sref <code>`：官方内部风格数字码；`--sref random` 随机；`--sw` 控制权重（默认 100）；`--sv 4/6` 兼容风格码。
- Style Explorer（官网 Explore → Styles）：按 "photographic" / "anime" 等关键词模糊搜索风格码、按社区热度排序、Try Style 直接套用。
- Style Creator（官网，V7）：从样图网格创建自定义 `--sref` 风格码，可反复复用。
- 风格参考可与 `--oref` / Image Prompts 叠加使用。

### E. 社区风格库参考来源（素材出处，不写入规则正文）

- Midlibrary.io：社区最完整风格库，4000+ 艺术风格、5505 分类，含风格代码与提示词，可作为备选风格词汇与 `--sref` 代码检索来源（无官方背书，仅参考）。
- 官方 Style Explorer / Style Creator 为风格码的首选来源。

### F. 画面负向约束执行

- `--no` 只写单词级排除项；短语式否定一律改写为正向描述（官方 No 文章明示）。

### G. 动画画风方向（风格词为社区通用/官方 Style Explorer 可检索词，如 "anime"；参数行 `--stylize` 可适当调高增强风格化，写实收尾不适用）

- 日式动画 Anime：`anime style, cel-shaded, clean lineart, vibrant colors`；吉卜力向 `ghibli-inspired animation still, hand-painted backgrounds, soft watercolor sky`。
- 赛璐璐/扁平卡通：`cel shading, flat colors, bold clean outlines, 2D animation still`。
- 美式 2D 动画：`classic American cartoon, exaggerated proportions, bold outlines, limited palette`。
- 3D 动画渲染：`3D animated film still, soft global illumination, subsurface scattering, stylized proportions`（用渲染特征描述，不写受版权保护的工作室名）。
- 定格动画：`stop-motion puppet animation still, tactile materials, visible texture`。
- 剪纸/皮影动画：`shadow puppet theater style, cut paper silhouettes`（可与 C 中式美学叠加）。

### H. 朋克系/科幻画风方向

- 赛博朋克 Cyberpunk：`cyberpunk, neon-noir, rain-slicked streets, holographic signage, futuristic megacity, teal and magenta palette`；复古向 `retro-futuristic 1980s cyberpunk`。
- 中式赛博朋克（可与 C 叠加）：`Chinese cyberpunk, neon signs with Chinese characters, wet asphalt reflections, futuristic Shanghai streetscape`。
- 蒸汽朋克 Steampunk：`steampunk, brass and copper machinery, victorian-era technology, sepia-lit workshops`。
- 废土/末日：`post-apocalyptic wasteland, rusted ruins, overgrown urban decay, harsh sunlight, muted dust tones`。
- 极简科幻：`minimal sci-fi, clean futuristic architecture, soft neon accents, muted palette, vast empty spaces`。

### I. 影像/胶片类方向（实拍感之外的影像质感，保留 `--style raw` 或 `--stylize 50~100`）

- 黑白电影 Noir：`film noir, black and white, high contrast, dramatic shadows, venetian blind lighting, 1940s detective film`。
- 复古胶片：`kodachrome 35mm film, film grain, vintage color grading, faded highlights`。
- 纪录片纪实：`documentary style, natural light, candid framing, handheld camera feel, neutral tones`。
- 时尚大片：`high fashion editorial photography, studio lighting, magazine cover composition, sharp focus`。
- 极简海报/图形：`minimalist graphic poster, bold typography, negative space, flat solid colors`。

## 第 3 部分 字数与踩坑

- 字数底线：整条提示词（含标点与空格）≤1024 字符（外部项目 `check_prompt_len.py` 口径）。
- 踩坑对策表（外部项目实测 + 官方说明）：
  - 画面偏绘画/手绘感 → 去 iridescent / shimmering / magical 等插画风触发词并加实拍收尾。
  - 主体与背景糊为一体 → 加 clearly separated from / distinct silhouette against。
  - 人脸族裔漂移 → 主语与面容显式写 Chinese。
  - 专名/人名模型不识别 → 写通用身份与视觉描述。
  - 多头生物整齐对称 → asymmetric staggered poses。
  - 鳞片/毛发被吞 → 区域锁定句。
