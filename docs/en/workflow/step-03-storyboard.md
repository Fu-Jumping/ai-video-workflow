# Step 3: Storyboard

Step 3 splits the script and settings into scene / shot-group / shot / storyboard-segment layers, and the body text lives in the project's `内容/` content tree (`内容/00_镜头总表.md`, `内容/01_分镜总表.md`, `内容/场-XXX/00_场总览.md`, `内容/场-XXX/镜头组-XXX/00_镜头组总览.md`, `内容/场-XXX/镜头组-XXX/镜头-NNN/00_镜头-NNN.md`, `内容/场-XXX/镜头组-XXX/镜头-NNN/分镜-NN.md`). `内容/` is the single source of truth; `03_分镜脚本/` holds only `00_内容树索引.md`, which points at the tree and does not copy the body text.

One shot is one video-generation task with a 15-second default target. A shot contains 1-4 consecutively numbered storyboard segments, with 1-2 as the default. Select one keyframe by default; add more only when needed, never exceeding the segment count or four files. Keyframes are not inherently first or last frames, and Step 3 must link every selected Step 4 file.
