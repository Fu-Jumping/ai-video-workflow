export class CliUserError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = "CliUserError";
  }
}

export function isCliUserError(error: unknown): error is CliUserError {
  return error instanceof CliUserError;
}

// Wraps an @inquirer prompt. Non-TTY runs never enter the prompt: an EOF stdin
// would leave the internal prompt promise pending forever and crash the process
// with an "unsettled top-level await" warning. In TTY runs, a cancelled prompt
// (Ctrl+C / closed stdin) surfaces as a readable CliUserError instead of leaking
// the internal ExitPromptError shape.
export async function runCliPrompt<T>(prompt: () => Promise<T>, cancelMessage: string): Promise<T> {
  if (!(process.stdin.isTTY && process.stdout.isTTY)) {
    throw new CliUserError(cancelMessage);
  }
  try {
    return await prompt();
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      throw new CliUserError(cancelMessage);
    }
    throw error;
  }
}

export async function runCliAction(action: () => Promise<void>, debug: () => boolean): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    if (isCliUserError(error) && error.hint) {
      console.error(`Hint: ${error.hint}`);
    }
    if (debug() && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
}
