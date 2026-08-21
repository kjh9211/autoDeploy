import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import forge from "node-forge";

const CERT_EXTENSIONS = new Set([".pem", ".crt", ".cert", ".cer"]);
const WARN_WITHIN_DAYS = 14;

export type CertInfo = {
  file: string;
  commonName: string | null;
  dnsNames: string[];
  issuer: string | null;
  notBefore: Date;
  notAfter: Date;
  daysRemaining: number;
  expiringSoon: boolean;
  expired: boolean;
};

function attributeValue(
  attrs: forge.pki.Certificate["subject"]["attributes"],
  shortName: string,
): string | null {
  const attr = attrs.find((a) => a.shortName === shortName);
  return typeof attr?.value === "string" ? attr.value : null;
}

function extractDnsNames(cert: forge.pki.Certificate): string[] {
  const ext = cert.extensions.find((e) => e.name === "subjectAltName");
  const altNames = (ext as { altNames?: { type: number; value?: string }[] })
    ?.altNames;
  if (!altNames) return [];
  return altNames
    .filter((n) => n.type === 2 && n.value) // type 2 = dNSName
    .map((n) => n.value as string);
}

function parseCertFile(fileName: string, pem: string): CertInfo | null {
  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(pem);
  } catch {
    return null; // not a cert (private key, chain bundle we can't parse, etc.)
  }

  const now = Date.now();
  const notAfter = cert.validity.notAfter;
  const msRemaining = notAfter.getTime() - now;
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

  return {
    file: fileName,
    commonName: attributeValue(cert.subject.attributes, "CN"),
    dnsNames: extractDnsNames(cert),
    issuer: attributeValue(cert.issuer.attributes, "CN"),
    notBefore: cert.validity.notBefore,
    notAfter,
    daysRemaining,
    expiringSoon: daysRemaining <= WARN_WITHIN_DAYS,
    expired: msRemaining <= 0,
  };
}

export type CertListResult =
  | { ok: true; certs: CertInfo[] }
  | { ok: false; error: string };

// Reads the same certs/ directory webproxy loads addContext() SNI contexts
// from (docs/PLANNING.md §6.2). Read-only — Phase 0 doesn't reload webproxy.
export async function listCerts(certsDir: string): Promise<CertListResult> {
  let fileNames: string[];
  try {
    fileNames = await readdir(certsDir);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const certs: CertInfo[] = [];
  for (const fileName of fileNames) {
    if (!CERT_EXTENSIONS.has(path.extname(fileName).toLowerCase())) continue;
    const pem = await readFile(path.join(certsDir, fileName), "utf-8");
    const info = parseCertFile(fileName, pem);
    if (info) certs.push(info);
  }

  certs.sort((a, b) => a.notAfter.getTime() - b.notAfter.getTime());
  return { ok: true, certs };
}
