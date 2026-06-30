export type EmailRecipient = {
  email: string;
  name?: string | null;
};

export type EmailTemplateRequest = {
  recipient: EmailRecipient;
  templateKey: string;
  variables: Record<string, string | number | boolean | null>;
  idempotencyKey: string;
};

export type EmailDeliveryResult = {
  providerMessageId?: string;
};

/**
 * Provider-independent transactional email boundary.
 *
 * Implementations resolve templateKey in the provider or template repository;
 * template markup must never be embedded in the reminder processor.
 */
export interface EmailService {
  readonly configured: boolean;
  sendTemplate(request: EmailTemplateRequest): Promise<EmailDeliveryResult>;
}

/**
 * Safe default used until a real provider is configured. It deliberately does
 * not pretend delivery succeeded, and the processor will not claim queue rows.
 */
export class UnconfiguredEmailService implements EmailService {
  readonly configured = false;

  async sendTemplate(
    _request: EmailTemplateRequest,
  ): Promise<EmailDeliveryResult> {
    throw new Error("No email provider is configured");
  }
}
