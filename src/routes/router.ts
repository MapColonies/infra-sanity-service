import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { Controller } from '@src/controllers/controller';

const routerFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(Controller);

  router.get('/metrics-annotations', controller.getMetricsAnnotations);
  router.get('/validate-certs', controller.getRouteCerts);

  return router;
};

export const ROUTER_SYMBOL = Symbol('routerFactory');

export { routerFactory };
