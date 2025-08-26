import type { CustomObjectsApi } from '@kubernetes/client-node';
import { inject, injectable } from 'tsyringe';
import type { Logger } from '@map-colonies/js-logger';
import type { components } from '@openapi';
import type { Result } from '@src/types/shared.types.js';
import { SERVICES } from '@src/common/constants.js';
import type { components as OpenshiftComponents } from '@src/types/openshift-route.types.js';
import { parseCertificate } from '@src/crypto/certificate-parser.js';
import { checkHostMatchesCertificate, checkPrivateKeyMatchesCertificate } from '../crypto/certificate-matcher.js';

type RouteInfo = components['schemas']['RouteInfo'];
type RouteTlsInfo = components['schemas']['RouteTlsInfo'];
type CertificateInfo = components['schemas']['CertificateInfo'];

@injectable()
export class OpenShiftRouteRetriever {
  public constructor(
    @inject(SERVICES.ROUTE_API) private readonly k8sApi: CustomObjectsApi,
    @inject(SERVICES.LOGGER) private readonly logger: Logger
  ) {}

  /**
   * Retrieves routes from multiple namespaces
   */
  public async getRoutesFromNamespaces(namespaces: readonly string[], labelSelector?: string): Promise<RouteInfo[]> {
    this.logger.debug({ namespaces, labelSelector }, 'Retrieving routes from namespaces');
    const allRoutes: RouteInfo[] = [];
    const errors: string[] = [];

    for (const namespace of namespaces) {
      this.logger.debug({ namespace, labelSelector }, 'Fetching routes from namespace');
      const result = await this.getRoutesFromNamespace(namespace, labelSelector);
      if (result.ok) {
        this.logger.debug({ count: result.value.length }, `Routes fetched for namespace ${namespace}`);
        allRoutes.push(...result.value);
      } else {
        this.logger.error({ error: result.error }, `Failed to get routes from namespace ${namespace}`);
        errors.push(`Failed to get routes from namespace ${namespace}: ${result.error.message}`);
      }
    }

    if (errors.length > 0 && allRoutes.length === 0) {
      this.logger.error({ errors }, 'No routes found in any namespace');
      throw new Error(errors.join('; '));
    }

    this.logger.debug({ total: allRoutes.length }, 'Returning all routes');
    return allRoutes;
  }

  private async getRoutesFromNamespace(namespace: string, labelSelector?: string): Promise<Result<RouteInfo[], Error>> {
    this.logger.debug({ namespace, labelSelector }, 'Listing routes from namespace');
    try {
      const response = (await this.k8sApi.listNamespacedCustomObject({
        group: 'route.openshift.io',
        version: 'v1',
        namespace: namespace,
        labelSelector: labelSelector,
        plural: 'routes',
      })) as OpenshiftComponents['schemas']['com.github.openshift.api.route.v1.RouteList'];

      this.logger.debug({ count: response.items.length }, `Routes listed for namespace ${namespace}`);
      const routes = response.items;
      const parsedRoutes = routes.map((route) => this.parseRoute(route));

      return { ok: true, value: parsedRoutes };
    } catch (error) {
      this.logger.error({ error }, `Error listing routes from namespace ${namespace}`);
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private parseRoute(route: OpenshiftComponents['schemas']['com.github.openshift.api.route.v1.Route']): RouteInfo {
    this.logger.debug({ route }, 'Parsing OpenShift route');
    const spec = route.spec;
    const metadata = route.metadata;
    const name = metadata?.name ?? 'unknown';

    let tlsInfo: RouteTlsInfo | undefined;

    if (spec.tls) {
      let certificateInfo: CertificateInfo | undefined;
      let hostMatchesCertificate: boolean | undefined;
      let privateKeyMatchesCertificate: boolean | undefined;

      if (spec.tls.certificate !== undefined) {
        this.logger.debug({ certificate: spec.tls.certificate }, `Parsing certificate for route ${name}`);
        const parseResult = parseCertificate(spec.tls.certificate);

        if (parseResult.ok) {
          certificateInfo = parseResult.value;
          hostMatchesCertificate = checkHostMatchesCertificate(spec.host ?? 'unknown', certificateInfo);

          if (spec.tls.key !== undefined) {
            this.logger.debug({ key: spec.tls.key }, `Validating private key for route ${name}`);
            const keyMatchResult = checkPrivateKeyMatchesCertificate(spec.tls.certificate, spec.tls.key);

            if (keyMatchResult.ok) {
              privateKeyMatchesCertificate = keyMatchResult.value;
            } else {
              this.logger.error({ error: keyMatchResult.error }, `Failed to validate private key for route ${name}`);
            }
          }
        } else {
          this.logger.error({ error: parseResult.error }, `Failed to parse certificate for route ${name}`);
        }
      }

      tlsInfo = {
        termination: spec.tls.termination,
        certificateInfo,
        hostMatchesCertificate,
        privateKeyMatchesCertificate,
      };
    }

    const routeInfo: RouteInfo = {
      name: name,
      namespace: metadata?.namespace ?? 'unknown',
      host: spec.host ?? 'unknown',
      path: spec.path,
      service: spec.to.name,
      port: spec.port?.targetPort,
      tls: tlsInfo,
    };
    this.logger.debug({ routeInfo }, 'Parsed route info');
    return routeInfo;
  }
}
