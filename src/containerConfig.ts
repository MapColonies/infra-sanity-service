import { getOtelMixin } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import { Registry } from 'prom-client';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger from '@map-colonies/js-logger';
import { AppsV1Api, CustomObjectsApi } from '@kubernetes/client-node';
import { InjectionObject, registerDependencies } from '@common/dependencyRegistration';
import { SERVICES, SERVICE_NAME } from '@common/constants';
import { getTracing } from '@common/tracing';
import { ROUTER_SYMBOL, routerFactory } from './routes/router';
import { getConfig } from './common/config';
import { createKubernetesClient } from './k8s/client-factory';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const configInstance = getConfig();

  const loggerConfig = configInstance.get('telemetry.logger');

  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  const tracer = trace.getTracer(SERVICE_NAME);
  const metricsRegistry = new Registry();
  configInstance.initializeMetrics(metricsRegistry);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: configInstance } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METRICS, provider: { useValue: metricsRegistry } },
    { token: SERVICES.APPS_API, provider: { useFactory: () => createKubernetesClient(AppsV1Api) } },
    { token: SERVICES.ROUTE_API, provider: { useFactory: () => createKubernetesClient(CustomObjectsApi) } },
    { token: ROUTER_SYMBOL, provider: { useFactory: routerFactory } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([getTracing().stop()]);
          },
        },
      },
    },
  ];

  return Promise.resolve(registerDependencies(dependencies, options?.override, options?.useChild));
};
