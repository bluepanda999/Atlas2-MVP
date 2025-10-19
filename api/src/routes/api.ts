import { Router } from 'express';
import { openApiRouter } from './openapi';
import { mappingRouter } from './mapping';
import { transformationRouter } from './transformation';

const router = Router();

// API versioning
router.use('/v1', (req, res, next) => {
  req.apiVersion = 'v1';
  next();
});

// OpenAPI/Swagger endpoints
router.use('/v1/openapi', openApiRouter);

// Field mapping endpoints
router.use('/v1/mapping', mappingRouter);

// Data transformation endpoints
router.use('/v1/transformation', transformationRouter);

// API documentation
router.get('/docs', (req, res) => {
  res.json({
    title: 'Atlas2 API',
    version: '1.0.0',
    description: 'CSV to API mapping tool API',
    endpoints: {
      upload: '/api/upload',
      openapi: '/api/v1/openapi',
      mapping: '/api/v1/mapping',
      transformation: '/api/v1/transformation',
      auth: '/auth'
    }
  });
});

export { router as apiRouter };