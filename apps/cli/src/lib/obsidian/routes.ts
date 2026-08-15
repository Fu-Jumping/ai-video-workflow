/**
 * Canonical relative paths for the generated Obsidian viewing layer.
 *
 * Keep these values vault-relative and POSIX-style. Source Step files remain
 * the project fact source; these routes only describe their generated views.
 */
export const startReviewDirectory = "00_开始审阅";
export const stageReviewDirectory = "01_阶段审核";
export const shotLookupDirectory = "02_按镜头联查";
export const reviewToolsDirectory = "03_审阅工具";
export const userNotesDirectory = "04_个人笔记";

export const stepDisplayDirectories: Readonly<Record<number, string>> = Object.freeze({
  0: "00_前期研究",
  1: "01_概念策划",
  2: "02_世界设定",
  3: "03_分镜脚本",
  4: "04_图片提示词",
  5: "05_视频提示词",
  6: "06_执行计划"
});

export function stepDisplayDirectory(step: number): string {
  return stepDisplayDirectories[step] ?? `步骤${step}`;
}

export function stageReviewPath(step: number): string {
  return `${stageReviewDirectory}/${stepDisplayDirectory(step)}`;
}

export function stageReviewHubPath(step: number): string {
  return `${stageReviewPath(step)}/00_阶段审核.md`;
}

export const stageReviewOverviewPath = `${stageReviewDirectory}/00_阶段总览.md`;

export function singleShotPagePath(shotId: string): string {
  return `${shotLookupDirectory}/单镜头/${shotId}.md`;
}

export function shotGroupPagePath(groupId: string): string {
  return `${shotLookupDirectory}/镜头组/${groupId}.md`;
}

export function shotReviewCanvasPath(shotId: string): string {
  return `${shotLookupDirectory}/逐镜头审阅画布/${shotId}.canvas`;
}

export const shotLookupIndexPath = `${shotLookupDirectory}/00_镜头联查.md`;

export const reviewToolsDashboardDirectory = `${reviewToolsDirectory}/数据看板`;
export const globalCanvasDirectory = `${reviewToolsDirectory}/全局画布`;
export const collaborationTemplatesDirectory = `${reviewToolsDirectory}/协作模板`;
export const shotReviewNotesDirectory = `${userNotesDirectory}/镜头审阅`;

export const projectHomePath = `${startReviewDirectory}/00_项目首页.md`;
export const reviewOverviewPath = `${startReviewDirectory}/01_审阅总览.md`;
export const projectionInfoPath = `${startReviewDirectory}/02_观看层说明.md`;
export const productionBoardPath = `${reviewToolsDirectory}/00_制作看板.md`;
export const agentHandoffPath = `${reviewToolsDirectory}/01_智能体交接.md`;
export const workflowBasePath = `${reviewToolsDashboardDirectory}/流程文件.base`;
export const shotBasePath = `${reviewToolsDashboardDirectory}/镜头.base`;
export const productionStatusBasePath = `${reviewToolsDashboardDirectory}/制作状态.base`;
export const reviewMapCanvasPath = `${globalCanvasDirectory}/审阅地图.canvas`;
export const workflowCanvasPath = `${globalCanvasDirectory}/流程图.canvas`;
export const shotPipelineCanvasPath = `${globalCanvasDirectory}/镜头流水线.canvas`;
export const communityPluginRecipesPath = `${collaborationTemplatesDirectory}/社区插件配方.md`;

export function shotReviewNotePath(shotId: string): string {
  return `${shotReviewNotesDirectory}/${shotId}.md`;
}

export const notesIndexPath = `${userNotesDirectory}/说明.md`;
export const notesIndexLink = notesIndexPath.slice(0, -3);

// Naming aliases keep the route contract readable at call sites that refer
// to the top-level areas as entry, tools, or personal-notes directories.
export const entryDirectory = startReviewDirectory;
export const toolsDirectory = reviewToolsDirectory;
export const personalNotesDirectory = userNotesDirectory;
export const startReviewHomePath = projectHomePath;
export const startReviewOverviewPath = reviewOverviewPath;
