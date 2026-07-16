import path from "node:path";

import { CliUserError } from "./cli-errors.js";

const windowsReservedNames = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9"
]);

const controlCharacterPattern = /[\u0000-\u001f\u007f]/;
const invisibleCharacterPattern = /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
const pathSeparatorPattern = /[\\/]/;

export function validateSafeDirectoryName(name: string, label: string): string {
  if (name.length === 0) {
    throw new CliUserError(`${label} cannot be empty.`);
  }
  if (name.trim() !== name || name.trim().length === 0) {
    throw new CliUserError(`${label} cannot start or end with whitespace and cannot be only whitespace.`);
  }
  if (name === "." || name === "..") {
    throw new CliUserError(`${label} must be a directory name, not ${name}.`);
  }
  if (pathSeparatorPattern.test(name)) {
    throw new CliUserError(`${label} must not contain path separators. Choose a parent directory separately.`);
  }
  if (/^[A-Za-z]:/.test(name) || name.startsWith("\\\\") || name.startsWith("//") || path.win32.isAbsolute(name) || path.posix.isAbsolute(name)) {
    throw new CliUserError(`${label} must be a name, not an absolute path. Choose a parent directory separately.`);
  }
  if (name.endsWith(".") || name.endsWith(" ")) {
    throw new CliUserError(`${label} must not end with a dot or space.`);
  }
  if (controlCharacterPattern.test(name) || invisibleCharacterPattern.test(name)) {
    throw new CliUserError(`${label} must not contain control or invisible characters.`);
  }
  const baseName = name.split(".")[0].toUpperCase();
  if (windowsReservedNames.has(baseName)) {
    throw new CliUserError(`${label} cannot use Windows reserved name: ${baseName}.`);
  }
  return name;
}
