import { appConfig } from "../../app/config";
import { ApiError } from "./api-error";
import { safeJsonParse } from "./json";

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

const defaultHeaders = {
  Accept: "application/json",
};

function normalizePath(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function buildApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;

  const normalizedPath = normalizePath(path);
  if (/^https?:\/\//.test(appConfig.apiBaseUrl)) {
    return new URL(normalizedPath, ensureTrailingSlash(appConfig.apiBaseUrl)).toString();
  }

  const base = ensureTrailingSlash(appConfig.apiBaseUrl);
  return `${base}${normalizedPath}`;
}

function toRequestBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { body, headers, credentials, ...rest } = options;
  const requestHeaders = new Headers(defaultHeaders);
  const incomingHeaders = new Headers(headers);
  incomingHeaders.forEach((value, key) => {
    requestHeaders.set(key, value);
  });

  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    ...rest,
    headers: requestHeaders,
    body: toRequestBody(body),
    credentials: credentials ?? "include",
  });

  const responseText = await response.text();
  const responseBody = responseText ? safeJsonParse(responseText) : null;

  if (!response.ok) {
    throw ApiError.fromResponse({
      path,
      status: response.status,
      statusText: response.statusText,
      body: responseBody,
    });
  }

  return responseBody as TResponse;
}
