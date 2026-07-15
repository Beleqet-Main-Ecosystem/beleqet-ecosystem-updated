/** SMTP configuration, loaded from environment variables only. */
export interface MailEnvConfig {
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpUser: string;
  readonly smtpPassword: string;
  readonly fromAddress: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required environment variable "${name}".`);
  }
  return value;
}

export function loadMailEnvConfig(): MailEnvConfig {
  return {
    smtpHost: requireEnv('SMTP_HOST'),
    smtpPort: Number(requireEnv('SMTP_PORT')),
    smtpUser: requireEnv('SMTP_USER'),
    smtpPassword: requireEnv('SMTP_PASSWORD'),
    fromAddress: requireEnv('SMTP_FROM_ADDRESS'),
  };
}
