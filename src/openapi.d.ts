/* eslint-disable */
import type { TypedRequestHandlers as ImportedTypedRequestHandlers } from '@map-colonies/openapi-helpers/typedRequestHandler';
export type paths = {
  '/metrics-annotations': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Check if Kubernetes workloads have Prometheus metrics annotations
     * @description Returns, for each Deployment or StatefulSet in the specified namespaces, whether Prometheus metrics annotations are present. If present, includes annotation details (scrapeEnabled, port, path).
     *
     */
    get: operations['getMetricsAnnotations'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/validate-certs': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Validate TLS certificates for OpenShift routes
     * @description Returns, for each OpenShift route in the specified namespaces, details about its TLS certificate and validation status. Includes certificate subject, issuer, validity dates, and whether the host and private key match the certificate.
     *
     */
    get: operations['getRouteCerts'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};
export type webhooks = Record<string, never>;
export type components = {
  schemas: {
    error: {
      message: string;
    };
    WorkloadMetricsInfo: {
      name: string;
      namespace: string;
      /** @enum {string} */
      type: 'Deployment' | 'StatefulSet';
      replicas?: number;
      readyReplicas?: number;
      /** Format: date-time */
      createdAt?: string;
      metricsAnnotations?: components['schemas']['MetricsAnnotations'];
    };
    MetricsAnnotations: {
      scrapeEnabled?: boolean;
      port?: string;
      path?: string;
    };
    RouteInfo: {
      name: string;
      namespace: string;
      host: string;
      path?: string;
      service: string;
      port?: string;
      tls?: components['schemas']['RouteTlsInfo'];
    };
    RouteTlsInfo: {
      termination?: string;
      certificateInfo?: components['schemas']['CertificateInfo'];
      hostMatchesCertificate?: boolean;
      privateKeyMatchesCertificate?: boolean;
    };
    CertificateInfo: {
      subject: string;
      issuer: string;
      validFrom: string;
      validTo: string;
      serialNumber: string;
      fingerprint: string;
      subjectAltNames?: string[];
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
  getMetricsAnnotations: {
    parameters: {
      query: {
        /** @description List of namespaces */
        namespaces: string[];
        /** @description Label selector to filter workloads */
        labelSelector?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description List of workload metrics info */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['WorkloadMetricsInfo'][];
        };
      };
      /** @description Bad Request */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['error'];
        };
      };
    };
  };
  getRouteCerts: {
    parameters: {
      query: {
        /** @description List of namespaces */
        namespaces: string[];
        /** @description Label selector to filter routes */
        labelSelector?: string;
        /** @description Filter out routes without certificates */
        filterNoCert?: boolean;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description List of route info with certificate validation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RouteInfo'][];
        };
      };
      /** @description Bad Request */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['error'];
        };
      };
    };
  };
}
export type TypedRequestHandlers = ImportedTypedRequestHandlers<paths, operations>;
