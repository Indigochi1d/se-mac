const DISCORD_WEBHOOK_URL_REGEX =
  /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+\/?$/;

export function isValidDiscordWebhookUrl(value: string): boolean {
  return DISCORD_WEBHOOK_URL_REGEX.test(value.trim());
}
