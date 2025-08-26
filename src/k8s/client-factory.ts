import * as k8s from '@kubernetes/client-node';

/**
 * Creates and configures a Kubernetes client
 */
export function createKubernetesClient<T extends k8s.ApiType>(apiClass: k8s.ApiConstructor<T>): T {
  const kc = new k8s.KubeConfig();

  kc.loadFromDefault();

  return kc.makeApiClient(apiClass);
}
