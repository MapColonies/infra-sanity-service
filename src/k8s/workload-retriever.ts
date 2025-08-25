import type { AppsV1Api, V1Deployment, V1StatefulSet } from '@kubernetes/client-node';
import { inject, injectable } from 'tsyringe';
import type { Logger } from '@map-colonies/js-logger';
import type { components } from '@openapi';
import { SERVICES } from '@src/common/constants';

type WorkloadMetricsInfo = components['schemas']['WorkloadMetricsInfo'];
type MetricsAnnotations = components['schemas']['MetricsAnnotations'];

@injectable()
export class KubernetesWorkloadRetriever {
  public constructor(
    @inject(SERVICES.APPS_API) private readonly kubeClient: AppsV1Api,
    @inject(SERVICES.LOGGER) private readonly logger: Logger
  ) {}

  public async getWorkloadMetricsInfoFromNamespaces(namespaces: string[], labelSelector?: string): Promise<WorkloadMetricsInfo[]> {
    this.logger.debug({ namespaces, labelSelector }, 'Retrieving workload metrics info for namespaces');
    const allWorkloads: WorkloadMetricsInfo[] = [];

    for (const namespace of namespaces) {
      this.logger.debug({ namespace, labelSelector }, 'Fetching deployments and stateful sets');
      const deployments = await this.getDeployments(namespace, labelSelector);
      const statefulSets = await this.getStatefulSets(namespace, labelSelector);

      this.logger.debug({ count: deployments.length }, `Found ${deployments.length} deployments in namespace ${namespace}`);
      this.logger.debug({ count: statefulSets.length }, `Found ${statefulSets.length} stateful sets in namespace ${namespace}`);

      const deploymentWorkloads = deployments.map((deployment): WorkloadMetricsInfo => {
        const metricsAnnotations = this.extractMetricsAnnotations(deployment.spec?.template.metadata?.annotations);
        return {
          name: deployment.metadata?.name ?? '',
          namespace: deployment.metadata?.namespace ?? '',
          type: 'Deployment' as const,
          replicas: deployment.spec?.replicas,
          readyReplicas: deployment.status?.readyReplicas,
          createdAt: deployment.metadata?.creationTimestamp?.toISOString(),
          hasMetricsAnnotations: metricsAnnotations.scrapeEnabled !== undefined,
          metricsAnnotations,
        };
      });

      const statefulSetWorkloads = statefulSets.map((statefulSet): WorkloadMetricsInfo => {
        const metricsAnnotations = this.extractMetricsAnnotations(statefulSet.spec?.template.metadata?.annotations);
        return {
          name: statefulSet.metadata?.name ?? '',
          namespace: statefulSet.metadata?.namespace ?? '',
          type: 'StatefulSet' as const,
          replicas: statefulSet.spec?.replicas,
          readyReplicas: statefulSet.status?.readyReplicas,
          createdAt: statefulSet.metadata?.creationTimestamp?.toISOString(),
          hasMetricsAnnotations: metricsAnnotations.scrapeEnabled !== undefined,
          metricsAnnotations,
        };
      });
      allWorkloads.push(...deploymentWorkloads, ...statefulSetWorkloads);
    }

    this.logger.debug({ total: allWorkloads.length }, 'Returning all workload metrics info');
    return allWorkloads;
  }

  private async getDeployments(namespace: string, labelSelector?: string): Promise<V1Deployment[]> {
    this.logger.debug({ namespace, labelSelector }, 'Listing deployments');
    const response = await this.kubeClient.listNamespacedDeployment({ namespace, labelSelector });
    this.logger.debug({ count: response.items.length }, `Deployments fetched for namespace ${namespace}`);
    return response.items;
  }

  private async getStatefulSets(namespace: string, labelSelector?: string): Promise<V1StatefulSet[]> {
    this.logger.debug({ namespace, labelSelector }, 'Listing stateful sets');
    const response = await this.kubeClient.listNamespacedStatefulSet({ namespace, labelSelector });
    this.logger.debug({ count: response.items.length }, `Stateful sets fetched for namespace ${namespace}`);
    return response.items;
  }

  private extractMetricsAnnotations(annotations?: { [key: string]: string }): MetricsAnnotations {
    this.logger.debug({ annotations }, 'Extracting Prometheus metrics annotations');
    if (!annotations) {
      return { scrapeEnabled: undefined };
    }

    const prometheusAnnotations = {
      scrape: annotations['prometheus.io/scrape'],
      port: annotations['prometheus.io/port'],
      path: annotations['prometheus.io/path'],
    };

    this.logger.debug({ prometheusAnnotations }, 'Parsed Prometheus annotations');
    return {
      scrapeEnabled: prometheusAnnotations.scrape !== undefined ? prometheusAnnotations.scrape === 'true' : undefined,
      port: prometheusAnnotations.port,
      path: prometheusAnnotations.path,
    };
  }
}
