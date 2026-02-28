interface ApiErrorPayload {
  path: string;
  status: number;
  statusText: string;
  body: unknown;
}

function hasCode(value: unknown): value is { code: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "code" in value &&
      typeof (value as { code?: unknown }).code === "string",
  );
}

function hasErrorObject(value: unknown): value is { error: { code?: unknown; message?: unknown } } {
  return Boolean(value && typeof value === "object" && "error" in value);
}

function pickCode(body: unknown): string | null {
  if (hasCode(body)) return body.code;
  if (hasErrorObject(body)) {
    const nestedCode = body.error.code;
    if (typeof nestedCode === "string") return nestedCode;
  }
  return null;
}

function pickMessage(payload: ApiErrorPayload, code: string | null): string {
  if (hasErrorObject(payload.body)) {
    const nestedMessage = payload.body.error.message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  if (typeof payload.body === "string" && payload.body.trim()) {
    return payload.body;
  }

  if (code) {
    return `${code} (${payload.status})`;
  }

  return `${payload.status} ${payload.statusText}`.trim();
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly path: string;
  readonly details: unknown;

  constructor(payload: ApiErrorPayload) {
    const code = pickCode(payload.body);
    super(pickMessage(payload, code));
    this.name = "ApiError";
    this.status = payload.status;
    this.code = code;
    this.path = payload.path;
    this.details = payload.body;
  }

  static fromResponse(payload: ApiErrorPayload): ApiError {
    return new ApiError(payload);
  }
}
