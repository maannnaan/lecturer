/**
 * The production database's connection string. DATABASE_URL wins; otherwise the pooled URL the
 * Vercel ↔ Neon integration added for this project, which it named with a LECTURER_ prefix
 * (LECTURER_DATABASE_URL). If the integration is ever reconnected with another prefix, set
 * DATABASE_URL instead.
 */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.LECTURER_DATABASE_URL || process.env.LECTURER_POSTGRES_URL || undefined;
}
