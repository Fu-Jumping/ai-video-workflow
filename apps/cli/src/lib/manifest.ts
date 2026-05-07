import fs from "fs-extra";
import path from "node:path";

export async function readPackSkillNames(packRoot: string): Promise<string[]> {
  const skillsRoot = path.join(packRoot, "skills");
  if (!(await fs.pathExists(skillsRoot))) {
    return [];
  }
  return (await fs.readdir(skillsRoot)).filter(Boolean);
}
