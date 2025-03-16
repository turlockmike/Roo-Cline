export interface CustomInstructionsConfig {
  language?: string;
  instructions?: string;
}

export function getCustomInstructionsSection(config?: CustomInstructionsConfig): string {
  if (!config?.instructions) {
    return '';
  }

  const allInstructions = [];

  if (config.language) {
    allInstructions.push(`Language: ${config.language}`);
  }

  allInstructions.push(config.instructions.trim());

  return `The following additional instructions are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.

${allInstructions.join('\n\n')}`;
}