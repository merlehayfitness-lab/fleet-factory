// Generates .env.generated from business data and decrypted secrets.
// The caller (deployment service) is responsible for decrypting secrets
// before passing them to this generator.

interface EnvFileInput {
  business: { id: string; slug: string };
  secrets: Array<{ key: string; decryptedValue: string }>;
  deploymentVersion: number;
}

export function generateEnvFile(input: EnvFileInput): string {
  const { business, secrets, deploymentVersion } = input;

  const lines: string[] = [];

  lines.push(`# Generated for ${business.slug} v${deploymentVersion}`);
  lines.push(`# Do not edit manually -- regenerated on each deployment`);
  lines.push("");
  lines.push(`BUSINESS_ID=${business.id}`);
  lines.push(`BUSINESS_SLUG=${business.slug}`);
  lines.push(`DEPLOYMENT_VERSION=${deploymentVersion}`);
  lines.push("");

  if (secrets.length > 0) {
    lines.push("# Secrets");
    for (const secret of secrets) {
      lines.push(`${secret.key}=${secret.decryptedValue}`);
    }
    lines.push("");
  }

  lines.push(`GENERATED_AT=${new Date().toISOString()}`);

  return lines.join("\n");
}
