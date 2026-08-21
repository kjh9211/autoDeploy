import { Secret, TOTP } from "otpauth";

const ISSUER = "Ops Console";

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function buildTotp(email: string, secret: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
}

// URI for a QR code, scanned once when the admin account is provisioned.
export function totpProvisioningUri(email: string, secret: string): string {
  return buildTotp(email, secret).toString();
}

// Accepts the current code plus one step of clock drift either way.
export function verifyTotpToken(
  email: string,
  secret: string,
  token: string,
): boolean {
  const delta = buildTotp(email, secret).validate({ token, window: 1 });
  return delta !== null;
}
