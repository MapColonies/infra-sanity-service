import * as k8s from '@kubernetes/client-node';

export interface KubernetesClientOptions {
  readonly token?: string;
  readonly server?: string;
}

/**
 * Creates and configures a Kubernetes client
 */
export function createKubernetesClient<T extends k8s.ApiType>(apiClass: k8s.ApiConstructor<T>): T {
  const kc = new k8s.KubeConfig();

  kc.loadFromDefault();

  return kc.makeApiClient(apiClass);
}
