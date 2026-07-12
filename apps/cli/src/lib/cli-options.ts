import { SUPPORTED_IDES, SUPPORTED_PLATFORMS } from "./constants.js";
import type { Ide, Platform } from "./types.js";
import { CliUserError } from "./cli-errors.js";

function levenshtein(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column += 1) {
    rows[0][column] = column;
  }
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + substitutionCost
      );
    }
  }
  return rows[left.length][right.length];
}

function nearestAllowedValue<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  const normalized = value.toLowerCase();
  const prefixMatch = allowed.find((item) => item.startsWith(normalized) || normalized.startsWith(item));
  if (prefixMatch) {
    return prefixMatch;
  }
  const ranked = allowed
    .map((item) => ({ item, distance: levenshtein(normalized, item.toLowerCase()) }))
    .sort((left, right) => left.distance - right.distance);
  const best = ranked[0];
  return best && best.distance <= 3 ? best.item : undefined;
}

function parseChoice<T extends string>(value: string | undefined, allowed: readonly T[], label: string): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  const suggestion = nearestAllowedValue(value, allowed);
  throw new CliUserError(
    `Invalid ${label}: ${value}. Expected one of: ${allowed.join(", ")}.`,
    suggestion ? `Did you mean ${suggestion}?` : undefined
  );
}

export function parseIde(value: string | undefined): Ide | undefined {
  return parseChoice(value, SUPPORTED_IDES, "AI IDE");
}

export function parsePlatform(value: string | undefined, label: string): Platform | undefined {
  return parseChoice(value, SUPPORTED_PLATFORMS, label);
}
