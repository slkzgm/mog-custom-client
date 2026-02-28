import { appConfig } from "../../app/config";

interface BuildSiweMessageParams {
  address: string;
  chainId: number;
  nonce: string;
  issuedAtIso?: string;
  expirationTimeIso?: string;
}

function addDays(isoTimestamp: string, days: number): string {
  const baseMs = Date.parse(isoTimestamp);
  const expirationMs = baseMs + days * 24 * 60 * 60 * 1000;
  return new Date(expirationMs).toISOString();
}

export function buildSiweMessage(params: BuildSiweMessageParams): string {
  const issuedAtIso = params.issuedAtIso ?? new Date().toISOString();
  const expirationTimeIso =
    params.expirationTimeIso ?? addDays(issuedAtIso, appConfig.auth.siwe.expirationDays);

  return `${appConfig.auth.siwe.domain} wants you to sign in with your Ethereum account:
${params.address}

${appConfig.auth.siwe.statement}

URI: ${appConfig.auth.siwe.uri}
Version: ${appConfig.auth.siwe.version}
Chain ID: ${params.chainId}
Nonce: ${params.nonce}
Issued At: ${issuedAtIso}
Expiration Time: ${expirationTimeIso}`;
}
