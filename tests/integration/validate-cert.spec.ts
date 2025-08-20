import { describe, beforeEach, it, expect, beforeAll, MockedObject, vi, afterEach } from 'vitest';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import { createRequestSender, RequestSender } from '@map-colonies/openapi-helpers/requestSender';
import { CustomObjectsApi } from '@kubernetes/client-node';
import { paths, operations } from '@openapi';
import { CertResult, generateCerts } from '@tests/utils/generate-certs';
import { getApp } from '@src/app';
import { SERVICES } from '@common/constants';
import { initConfig } from '@src/common/config';
import { generateRoute } from '@tests/utils/generate-route';

describe('validate-certs', function () {
  const certs: CertResult[] = [];
  let mockedKubeClient: MockedObject<CustomObjectsApi>;

  let requestSender: RequestSender<paths, operations>;

  beforeAll(async function () {
    await initConfig(true);

    for (let i = 0; i < 3; i++) {
      certs.push(
        generateCerts({
          keySize: 2048,
          days: 365,
          algorithm: 'sha256',
          attributes: {
            commonName: `app${i + 1}.example.com`,
            countryName: 'US',
            stateOrProvinceName: 'CA',
            localityName: 'San Francisco',
            organizationName: 'Test',
            organizationalUnitName: 'Test',
          },
          altNames: [`app${i + 1}.example.com`],
        })
      );
    }
  });

  beforeEach(async function () {
    mockedKubeClient = vi.mockObject(CustomObjectsApi.prototype);
    mockedKubeClient.listNamespacedCustomObject = vi.fn();

    const [app] = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
        { token: SERVICES.ROUTE_API, provider: { useValue: mockedKubeClient } },
      ],
      useChild: true,
    });
    requestSender = await createRequestSender<paths, operations>('openapi3.yaml', app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path', function () {
    it('should return 200 status code and the routes list', async function () {
      const route1 = generateRoute({
        metadata: {
          name: 'test-route-1',
          namespace: 'default',
        },
        spec: {
          host: 'app1.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert,
            key: certs[0]?.private,
          },
        },
      });

      const route2 = generateRoute({
        metadata: {
          name: 'test-route-2',
          namespace: 'default',
        },
        spec: {
          host: 'app2.example.com',
          tls: {
            termination: 'passthrough',
            certificate: certs[1]?.cert,
            key: certs[1]?.private,
          },
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [route1, route2],
      });

      const response = await requestSender.getRouteCerts({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toMatchObject([
        {
          host: 'app1.example.com',
          name: 'test-route-1',
          tls: { termination: 'edge', hostMatchesCertificate: true, privateKeyMatchesCertificate: true },
        },
        { host: 'app2.example.com', name: 'test-route-2' },
      ]);
    });

    it('should return 200 status code and routes with certificate validation failures', async function () {
      // Route with mismatched certificate - host doesn't match certificate CN
      const routeWithMismatchedCert = generateRoute({
        metadata: {
          name: 'test-route-mismatched',
          namespace: 'default',
        },
        spec: {
          host: 'mismatched.example.com', // Host doesn't match cert CN (app1.example.com)
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert, // Certificate is for app1.example.com
            key: certs[0]?.private,
          },
        },
      });

      // Route with mismatched private key
      const routeWithMismatchedKey = generateRoute({
        metadata: {
          name: 'test-route-wrong-key',
          namespace: 'default',
        },
        spec: {
          host: 'app1.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert, // Certificate for app1.example.com
            key: certs[1]?.private, // Wrong private key (belongs to certs[1])
          },
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [routeWithMismatchedCert, routeWithMismatchedKey],
      });

      const response = await requestSender.getRouteCerts({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.body).toMatchObject([
        {
          host: 'mismatched.example.com',
          name: 'test-route-mismatched',
          tls: { termination: 'edge', hostMatchesCertificate: false, privateKeyMatchesCertificate: true },
        },
        {
          host: 'app1.example.com',
          name: 'test-route-wrong-key',
          tls: { termination: 'edge', hostMatchesCertificate: true, privateKeyMatchesCertificate: false },
        },
      ]);
    });
  });

  describe('Bad Path', function () {
    // All requests with status code of 400

    it('should return 400 status code when namespaces array is empty', async function () {
      const response = await requestSender.getRouteCerts({ queryParams: { namespaces: [] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
    });

    it('should return 400 status code when namespaces parameter is missing', async function () {
      // @ts-expect-error - Testing missing required parameter
      const response = await requestSender.getRouteCerts({ queryParams: {} });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
    });
  });

  describe('Sad Path', function () {
    // All requests with status code 4XX-5XX

    it('should return 500 status code when Kubernetes API throws an error', async function () {
      mockedKubeClient.listNamespacedCustomObject.mockRejectedValue(new Error('Kubernetes API connection failed'));

      const response = await requestSender.getRouteCerts({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 status code when Kubernetes API throws network error', async function () {
      mockedKubeClient.listNamespacedCustomObject.mockRejectedValue(new Error('ECONNREFUSED'));

      const response = await requestSender.getRouteCerts({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 status code when Kubernetes API throws timeout error', async function () {
      mockedKubeClient.listNamespacedCustomObject.mockRejectedValue(new Error('Request timeout'));

      const response = await requestSender.getRouteCerts({ queryParams: { namespaces: ['production', 'staging'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('should return 500 status code when Kubernetes API returns malformed response', async function () {
      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        // Missing 'items' property to simulate malformed response
        kind: 'RouteList',
      });

      const response = await requestSender.getRouteCerts({ queryParams: { namespaces: ['default'] } });

      expect(response).toSatisfyApiSpec();
      expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
    });
  });
});
