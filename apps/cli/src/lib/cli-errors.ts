export class CliUserError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = "CliUserError";
  }
}

export function isCliUserError(error: unknown): error is CliUserError {
  return error instanceof CliUserError;
}

// Wraps an @inquirer prompt so a closed/cancelled stdin surfaces as a readable
// CliUserError instead of leaking the internal ExitPromptError shape.
export async function runCliPrompt<T>(prompt: () => Promise<T>, cancelMessage: string): Promise<T> {
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
