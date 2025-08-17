import { X509Certificate } from 'node:crypto';
import type { components } from '@openapi';
import type { Result } from '@src/types/shared.types';

type CertificateInfo = components['schemas']['CertificateInfo'];

/**
 * Parses an X.509 certificate from PEM format
 */
export function parseCertificate(certificatePem: string): Result<CertificateInfo, Error> {
  try {
    const cert = new X509Certificate(certificatePem);

    const certificateInfo: CertificateInfo = {
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      serialNumber: cert.serialNumber,
      fingerprint: cert.fingerprint,
      subjectAltNames: cert.subjectAltName !== undefined ? cert.subjectAltName.split(', ') : undefined,
    };

    return { ok: true, value: certificateInfo };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
