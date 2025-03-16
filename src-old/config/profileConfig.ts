import { z } from 'zod';

export const ProfileOptionsSchema = z.object({
  stream: z.boolean().optional().default(true),
  sound: z.boolean().optional().default(true),
  verbose: z.boolean().optional().default(false),
  maxRetries: z.number().int().positive().optional().default(3),
  maxSteps: z.number().int().positive().optional().default(50)
});

export const KnowledgeBaseConfigSchema = z.object({
  knowledgeBaseId: z.string(),
  modelArn: z.string().optional(),
  region: z.string().optional()
});

export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agent: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  providerOptions: z.record(z.string()).optional(),
  options: ProfileOptionsSchema.optional(),
  knowledgeBase: KnowledgeBaseConfigSchema.optional()
});

export const ProfilesConfigSchema = z.object({
  activeProfile: z.string(),
  profiles: z.array(ProfileSchema)
});

export type ProfileOptions = z.infer<typeof ProfileOptionsSchema>;
export type KnowledgeBaseConfig = z.infer<typeof KnowledgeBaseConfigSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfilesConfig = z.infer<typeof ProfilesConfigSchema>;

// Default profile configuration
export const DEFAULT_PROFILE: Profile = {
  name: 'default',
  description: 'Default configuration using Claude',
  provider: 'anthropic',
  model: 'claude-3-7-sonnet-20250219',
  tools: ['ai-tools', 'dev-tools'],
  options: {
    stream: true,
    sound: true,
    verbose: false,
    maxRetries: 3,
    maxSteps: 50
  }
}; 