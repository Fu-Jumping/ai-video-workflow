import path from "node:path";

export const generatedViewsDir = "_views";
export const obsidianViewRelativePath = "_views/obsidian";

export function resolveInProjectObsidianView(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), ...obsidianViewRelativePath.split("/"));
}

export function assertSingleObsidianTarget({
  outRoot,
  inProjectView,
  targetLabel
}: {
  outRoot?: string;
  inProjectView?: boolean;
  targetLabel: "--out" | "--vault";
}): void {
  if (inProjectView && outRoot) {
    throw new Error(`Use either ${targetLabel} or --in-project-view, not both`);
  }
  if (!inProjectView && !outRoot) {
    throw new Error(`Missing ${targetLabel}; pass ${targetLabel} <path> or --in-project-view`);
  }
}
