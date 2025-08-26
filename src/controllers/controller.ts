import type { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import type { TypedRequestHandlers } from '@openapi';
import { SERVICES } from '@common/constants';

import { KubernetesWorkloadRetriever } from '@src/k8s/workload-retriever';
import { OpenShiftRouteRetriever } from '@src/openshift/route-manager';

@injectable()
export class Controller {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(KubernetesWorkloadRetriever) private readonly workloadRetriever: KubernetesWorkloadRetriever,
    @inject(OpenShiftRouteRetriever) private readonly openshiftRetriever: OpenShiftRouteRetriever
  ) {}

  public getMetricsAnnotations: TypedRequestHandlers['getMetricsAnnotations'] = async (req, res, next) => {
    this.logger.debug({ query: req.query }, 'Received getMetricsAnnotations request');
    try {
      const result = await this.workloadRetriever.getWorkloadMetricsInfoFromNamespaces(req.query.namespaces, req.query.labelSelector);
      this.logger.debug({ resultCount: result.length }, 'Returning metrics annotations result');
      return res.status(httpStatus.OK).json(result);
    } catch (error) {
      this.logger.error({ error }, 'Error in getMetricsAnnotations');
      next(error);
    }
  };

  public getRouteCerts: TypedRequestHandlers['getRouteCerts'] = async (req, res, next) => {
    this.logger.debug({ query: req.query }, 'Received getRouteCerts request');
    try {
      const result = await this.openshiftRetriever.getRoutesFromNamespaces(req.query.namespaces, req.query.labelSelector);
      this.logger.debug({ resultCount: result.length }, 'Returning route certs result');
      return res.status(httpStatus.OK).json(result);
    } catch (error) {
      this.logger.error({ error }, 'Error in getRouteCerts');
      next(error);
    }
  };
}
