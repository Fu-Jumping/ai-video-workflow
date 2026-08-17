export type ReferenceAssetKind = "character-triview" | "scene-image";

export interface ReferenceAssetToken {
  token: string;
  name: string;
  kind: ReferenceAssetKind;
}

export interface MissingReferenceAsset {
  code: "missing-character-triview" | "missing-scene-reference-image";
  name: string;
  expectedToken: string;
}

interface MarkdownSection {
  heading: string;
  body: string;
}

const referenceAssetPattern = /@([^@\s，。、；;：:（）()【】\[\]<>《》"'`]+?)(三视图|场景图)/gu;
const levelTwoHeadingPattern = /^##\s+(.+?)\s*#*\s*$/gmu;
const mainCharacterPattern = /^\s*[-*]?\s*(?:主角色|角色类型|类型)\s*[：:]\s*(?:是|主角色)\s*$/mu;
const specialScenePattern = /^\s*[-*]?\s*(?:需要场景(?:设定)?图|特殊场景|特殊区域|特殊布景)\s*[：:]\s*是\s*$/mu;
// Self-check blocks carry illustrative tokens such as `@xx三视图` that must not be read as
// declared reference assets. Strip them before extraction so templates can keep a self-check.
const selfCheckSectionPattern = /^##\s*中文?自检\s*#*\s*[\s\S]*$/mu;

function uniqueReferenceAssets(tokens: ReferenceAssetToken[]): ReferenceAssetToken[] {
  const seen = new Set<string>();
  const unique: ReferenceAssetToken[] = [];
  for (const token of tokens) {
    if (seen.has(token.token)) {
      continue;
    }
    seen.add(token.token);
    unique.push(token);
  }
  return unique;
}

function markdownSections(content: string): MarkdownSection[] {
  const matches = [...content.matchAll(levelTwoHeadingPattern)];
  return matches.map((match, index) => {
    const heading = (match[1] ?? "").trim();
    const bodyStart = (match.index ?? 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? content.length;
    return {
      heading,
      body: content.slice(bodyStart, bodyEnd)
    };
  });
}

export function extractReferenceAssets(content: string): ReferenceAssetToken[] {
  const searchable = content.replace(selfCheckSectionPattern, "");
  const tokens = [...searchable.matchAll(referenceAssetPattern)].map((match) => {
    const name = match[1] ?? "";
    const suffix = match[2] ?? "";
    return {
      token: `@${name}${suffix}`,
      name,
      kind: suffix === "三视图" ? "character-triview" : "scene-image"
    } satisfies ReferenceAssetToken;
  });
  return uniqueReferenceAssets(tokens);
}

export function formatReferenceAssets(tokens: readonly ReferenceAssetToken[]): string {
  return tokens.length > 0 ? tokens.map((token) => token.token).join("、") : "未声明";
}

export function missingReferenceAssets(required: readonly ReferenceAssetToken[], actual: readonly ReferenceAssetToken[]): ReferenceAssetToken[] {
  const actualTokens = new Set(actual.map((token) => token.token));
  return required.filter((token) => !actualTokens.has(token.token));
}

export function hasReferenceAssetRequirementSection(content: string): boolean {
  return /^##\s+参考资产要求\s*$/mu.test(content);
}

export function findMissingCharacterTriViews(content: string): MissingReferenceAsset[] {
  const missing: MissingReferenceAsset[] = [];
  for (const section of markdownSections(content)) {
    if (!mainCharacterPattern.test(section.body)) {
      continue;
    }
    const expectedToken = `@${section.heading}三视图`;
    if (!section.body.includes(expectedToken)) {
      missing.push({
        code: "missing-character-triview",
        name: section.heading,
        expectedToken
      });
    }
  }
  return missing;
}

export function findMissingSceneReferenceImages(content: string): MissingReferenceAsset[] {
  const missing: MissingReferenceAsset[] = [];
  for (const section of markdownSections(content)) {
    if (!specialScenePattern.test(section.body)) {
      continue;
    }
    const expectedToken = `@${section.heading}场景图`;
    if (!section.body.includes(expectedToken)) {
      missing.push({
        code: "missing-scene-reference-image",
        name: section.heading,
        expectedToken
      });
    }
  }
  return missing;
}
