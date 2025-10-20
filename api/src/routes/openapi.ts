import { Router } from 'express';
import { OpenApiController } from '../../../controllers/openapi.controller';
import { OpenApiService } from '../../../services/openapi.service';
import { ApiClientGenerator } from '../../../services/api-client-generator.service';

const router = Router();

// Initialize services and controller
const openApiService = new OpenApiService();
const apiClientGenerator = new ApiClientGenerator();
const openApiController = new OpenApiController(openApiService, apiClientGenerator);

// POST /api/v1/openapi/import - Import OpenAPI specification
router.post('/import', openApiController.importSpecification.bind(openApiController));

// POST /api/v1/openapi/validate - Validate OpenAPI specification
router.post('/validate', openApiController.validateSpecification.bind(openApiController));

// GET /api/v1/openapi/:specId - Get specification details
router.get('/:specId', openApiController.getSpecification.bind(openApiController));

// GET /api/v1/openapi/:specId/endpoints - Get specification endpoints
router.get('/:specId/endpoints', openApiController.getEndpoints.bind(openApiController));

// POST /api/v1/openapi/generate-client - Generate API client
router.post('/generate-client', openApiController.generateClient.bind(openApiController));

export { router as openApiRouter };