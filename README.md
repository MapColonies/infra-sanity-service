# Infra Sanity Service

Infra Sanity Service is a Node.js/TypeScript web service for infrastructure observability and validation in Kubernetes and OpenShift environments. It exposes a REST API for checking Prometheus metrics annotations on workloads and validating TLS certificates on OpenShift routes.

## Features

- Check Kubernetes Deployments and StatefulSets for Prometheus metrics annotations
- Validate TLS certificates for OpenShift routes, including certificate details and match status
- OpenAPI request validation and documentation
- Structured logging and metrics
- Configurable via environment and config files

## API Endpoints

See the full OpenAPI spec [here](./openapi3.yaml).

### `GET /metrics-annotations`
Checks Deployments and StatefulSets in specified namespaces for Prometheus metrics annotations. Returns details about annotation presence and values.

**Query Parameters:**
- `namespaces` (array, required): List of namespaces to check
- `labelSelector` (string, optional): Label selector to filter workloads

### `GET /validate-certs`
Validates TLS certificates for OpenShift routes in specified namespaces. Returns certificate details and validation status (host and key match).

**Query Parameters:**
- `namespaces` (array, required): List of namespaces to check
- `labelSelector` (string, optional): Label selector to filter routes

## Getting Started

### Installation

```bash
npm install
```

### Running the Service

```bash
npm run start:dev   # Development mode (with source maps, config offline)
npm run start       # Production mode
```

### Configuration

Configuration is managed via the `config/` directory and environment variables. See `config/default.json` for options.

### Running Tests

```bash
npm run test           # Run all tests
npm run test:unit      # Run unit tests only
npm run test:integration # Run integration tests only
```

## Development

- Uses ESLint, Prettier, and commitlint for code quality
- Multi-stage Dockerfile for production builds
- Tracing and metrics via [@map-colonies/telemetry](https://github.com/MapColonies/telemetry)
- Logging via [@map-colonies/js-logger](https://github.com/MapColonies/js-logger)

## Example: Kubernetes RBAC for Infra Sanity Service

To allow Infra Sanity Service to read Deployments, StatefulSets, and OpenShift Routes, create the following RBAC resources. This grants only 'get' and 'list' permissions for these resources, following the principle of least privilege for observability and validation use cases.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: sanity-service
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: sanity-service
  namespace: default
rules:
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets"]
    verbs: ["get", "list"]
  - apiGroups: ["route.openshift.io"]
    resources: ["routes"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: sanity-service-binding
  namespace: default
subjects:
  - kind: ServiceAccount
    name: sanity-service
    namespace: default
roleRef:
  kind: Role
  name: sanity-service
  apiGroup: rbac.authorization.k8s.io
```

**Explanation:**
- The ServiceAccount is used by the Infra Sanity Service pod.
- The Role grants read-only access to Deployments, StatefulSets, and Routes.
- The RoleBinding attaches the Role to the ServiceAccount in the target namespace.

Apply these manifests to your cluster to enable secure, scoped access for the service.

## License

MIT
