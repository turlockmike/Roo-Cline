import { z } from 'zod';

export class ValidationError extends Error {
  constructor(
    public issues: z.ZodError['issues'],
    message = 'Validation failed'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}