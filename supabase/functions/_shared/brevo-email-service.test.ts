import {
  BrevoEmailService,
  createBrevoEmailService,
} from "./brevo-email-service.ts";
import type { EmailTemplateRequest } from "./email-service.ts";

const request: EmailTemplateRequest = {
  recipient: { email: "tenant@example.com", name: "Tenant" },
  templateKey: "due_today",
  variables: { tenantName: "Tenant", amount: 8000, dueDate: "2026-06-30" },
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Brevo service sends an external template with an idempotency key", async () => {
  const captured: { body: Record<string, unknown> | null } = { body: null };
  const fetcher =
    (async (_input: string | URL | Request, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ messageId: "brevo-message-id" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  const service = new BrevoEmailService({
    apiKey: "test-key",
    templateIds: { due_today: 42 },
  }, fetcher);

  const result = await service.sendTemplate(request);
  const capturedBody = captured.body;

  assert(
    result.providerMessageId === "brevo-message-id",
    "message ID should be returned",
  );
  assert(capturedBody !== null, "request body should be captured");
  assert(
    capturedBody.templateId === 42,
    "configured template ID should be used",
  );
  const headers = capturedBody.headers as Record<string, string>;
  assert(
    headers["Idempotency-Key"] === request.idempotencyKey,
    "idempotency key is required",
  );
  assert(
    !("htmlContent" in capturedBody),
    "template markup must not be embedded",
  );
});

Deno.test("Brevo service is disabled when any template ID is missing", () => {
  const environment: Record<string, string> = {
    BREVO_API_KEY: "test-key",
    BREVO_RENT_BEFORE_DUE_TEMPLATE_ID: "1",
    BREVO_RENT_DUE_TODAY_TEMPLATE_ID: "2",
    BREVO_RENT_OVERDUE_2_DAYS_TEMPLATE_ID: "3",
  };

  const service = createBrevoEmailService((name) => environment[name]);

  assert(
    !service.configured,
    "all four template IDs must exist before delivery is enabled",
  );
});

Deno.test("Brevo API failures are surfaced for queue retry", async () => {
  const fetcher =
    (async () =>
      new Response(JSON.stringify({ message: "Temporary failure" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
  const service = new BrevoEmailService({
    apiKey: "test-key",
    templateIds: { due_today: 42 },
  }, fetcher);

  let errorMessage = "";
  try {
    await service.sendTemplate(request);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  assert(
    errorMessage.includes("Temporary failure"),
    "provider error should reach retry handling",
  );
});
