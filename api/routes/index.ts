import { Router } from 'express';
import { createAuthRoutes } from './auth.routes';
import { createUploadRoutes } from './upload.routes';
import { createMappingRoutes } from './mapping.routes';
import { createIntegrationRoutes } from './integration.routes';
import { createValidationRoutes } from './validation.routes';

export function createRoutes(
  authController: any,
  uploadController: any,
  mappingController: any,
  integrationController: any,
  validationController: any,
  authMiddleware: any,
  errorMiddleware: any
): Router {
  const router = Router();

  // Health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // API routes
  router.use('/auth', createAuthRoutes(authController, authMiddleware, errorMiddleware));
  router.use('/upload', createUploadRoutes(uploadController, authMiddleware, errorMiddleware));
  router.use('/mapping', createMappingRoutes(mappingController, authMiddleware, errorMiddleware));
  router.use('/integrations', createIntegrationRoutes(integrationController, authMiddleware, errorMiddleware));
  router.use('/validation', createValidationRoutes(validationController, authMiddleware, errorMiddleware));

  return router;
}