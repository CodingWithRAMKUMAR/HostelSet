import type {
  EmailDeliveryResult,
  EmailService,
  EmailTemplateRequest,
} from "./email-service.ts";

type Fetcher = typeof fetch;

export type BrevoEmailServiceConfig = {
  apiKey: string;
  templateIds: Record<string, number>;
  timeoutMs?: number;
};

type BrevoResponse = {
  messageId?: string;
  message?: string;
  code?: string;
};

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_TIMEOUT_MS = 10_000;

export class BrevoEmailService implements EmailService {
  readonly configured: boolean;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: BrevoEmailServiceConfig,
    private readonly fetcher: Fetcher = fetch,
  ) {
    this.configured = Boolean(
      config.apiKey &&
        Object.keys(config.templateIds).length > 0 &&
        Object.values(config.templateIds).every((id) =>
          Number.isInteger(id) && id > 0
        ),
    );
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async sendTemplate(
    request: EmailTemplateRequest,
  ): Promise<EmailDeliveryResult> {
    if (!this.configured) {
      throw new Error("Brevo email service is not configured");
    }

    const templateId = this.config.templateIds[request.templateKey];
    if (!templateId) {
      throw new Error(
        `No Brevo template configured for ${request.templateKey}`,
      );
    }

    const response = await this.fetcher(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": this.config.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: [{
          email: request.recipient.email,
          name: request.recipient.name || undefined,
        }],
        templateId,
        params: request.variables,
        headers: { "Idempotency-Key": request.idempotencyKey },
        tags: ["rent-reminder", request.templateKey],
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const result = await response.json().catch(() => ({})) as BrevoResponse;
    if (!response.ok) {
      const detail = result.message || result.code || `HTTP ${response.status}`;
      throw new Error(`Brevo delivery failed: ${detail}`);
    }
    if (!result.messageId) {
      throw new Error("Brevo response did not include a message ID");
    }

    return { providerMessageId: result.messageId };
  }
}

function positiveInteger(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function createBrevoEmailService(
  getEnvironmentValue: (name: string) => string | undefined,
): BrevoEmailService {
  return new BrevoEmailService({
    apiKey: getEnvironmentValue("BREVO_API_KEY") ?? "",
    templateIds: {
      before_due: positiveInteger(
        getEnvironmentValue("BREVO_RENT_BEFORE_DUE_TEMPLATE_ID"),
      ),
      due_today: positiveInteger(
        getEnvironmentValue("BREVO_RENT_DUE_TODAY_TEMPLATE_ID"),
      ),
      overdue_2_days: positiveInteger(
        getEnvironmentValue("BREVO_RENT_OVERDUE_2_DAYS_TEMPLATE_ID"),
      ),
      weekly_overdue: positiveInteger(
        getEnvironmentValue("BREVO_RENT_WEEKLY_OVERDUE_TEMPLATE_ID"),
      ),
    },
  });
}
