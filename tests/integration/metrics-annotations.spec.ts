import { describe, beforeEach, it, expect, beforeAll, MockedObject, vi, afterEach } from 'vitest';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import { createRequestSender, RequestSender } from '@map-colonies/openapi-helpers/requestSender';
import { AppsV1Api } from '@kubernetes/client-node';
import { paths, operations } from '@openapi';
import { getApp } from '@src/app';
import { SERVICES } from '@common/constants';
import { initConfig } from '@src/common/config';
import { generateMockDeployment, generateMockStatefulSet } from '@tests/utils/generate-workload';

describe('metrics-annotations', function () {
  let mockedKubeClient: MockedObject<AppsV1Api>;

  let requestSender: RequestSender<paths, operations>;

  beforeAll(async function () {
    await initConfig(true);
  });

  beforeEach(async function () {
    mockedKubeClient = vi.mockObject(AppsV1Api.prototype);
    mockedKubeClient.listNamespacedDeployment = vi.fn();
    mockedKubeClient.listNamespacedStatefulSet = vi.fn();

    const [app] = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
        { token: SERVICES.APPS_API, provider: { useValue: mockedKubeClient } },
      ],
      useChild: true,
    });
    requestSender = await createRequestSender<paths, operations>('openapi3.yaml', app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path', function () {
    it('should return 200 and display the metrics annotations', async function () {
      const deployment = generateMockDeployment('test-deployment', 'default', {
        spec: { template: { metadata: { annotations: { 'prometheus.io/scrape': 'true', 'prometheus.io/port': '8080' } } } },
      });

      const statefulSet = generateMockStatefulSet('test-statefulset', 'default');

      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [deployment],
      });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [statefulSet],
      });

      const response = await requestSender.getMetricsAnnotations({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toMatchObject([
        {
          name: 'test-deployment',
          hasMetricsAnnotations: true,
        },
        {
          name: 'test-statefulset',
          hasMetricsAnnotations: false,
        },
      ]);
    });
  });

  describe('Bad Path', function () {
    // All requests with status code of 400

    it('should return 400 status code when namespaces array is empty', async function () {
      const response = await requestSender.getMetricsAnnotations({ queryParams: { namespaces: [] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
    });

    it('should return 400 status code when namespaces parameter is missing', async function () {
      // @ts-expect-error - Testing missing required parameter
      const response = await requestSender.getMetricsAnnotations({ queryParams: {} });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
    });
  });

  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX

    it('should return 500 status code when Kubernetes Apps API throws an error', async function () {
      mockedKubeClient.listNamespacedDeployment.mockRejectedValue(new Error('Kubernetes API connection failed'));
      mockedKubeClient.listNamespacedStatefulSet.mockRejectedValue(new Error('Kubernetes API connection failed'));

      const response = await requestSender.getMetricsAnnotations({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 status code when deployment API throws network error', async function () {
      mockedKubeClient.listNamespacedDeployment.mockRejectedValue(new Error('ECONNREFUSED'));
      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [],
      });

      const response = await requestSender.getMetricsAnnotations({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 status code when statefulset API throws timeout error', async function () {
      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [],
      });
      mockedKubeClient.listNamespacedStatefulSet.mockRejectedValue(new Error('Request timeout'));

      const response = await requestSender.getMetricsAnnotations({ queryParams: { namespaces: ['production', 'staging'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 status code when deployment API returns malformed response', async function () {
      // @ts-expect-error - Testing malformed response without required 'items' property
      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        kind: 'DeploymentList',
      });
      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [],
      });

      const response = await requestSender.getMetricsAnnotations({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 status code when statefulset API returns malformed response', async function () {
      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [],
      });
      // @ts-expect-error - Testing malformed response without required 'items' property
      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        kind: 'StatefulSetList',
      });

      const response = await requestSender.getMetricsAnnotations({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });
  });
});
