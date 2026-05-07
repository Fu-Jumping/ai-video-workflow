import YAML from "yaml";

export function stringifyYaml(value: unknown): string {
  return YAML.stringify(value, { indent: 2 });
}

export function parseYaml<T>(content: string): T {
  return YAML.parse(content) as T;
}
