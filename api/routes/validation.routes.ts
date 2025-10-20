import { Router, Request, Response, NextFunction } from 'express';
import { ValidationController } from '../controllers/validation.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ErrorMiddleware } from '../middleware/error.middleware';

export function createValidationRoutes(
  validationController: ValidationController,
  authMiddleware: AuthMiddleware,
  errorMiddleware: ErrorMiddleware
): Router {
  const router = Router();

  // Apply authentication middleware to all routes
  router.use(authMiddleware.authenticate.bind(authMiddleware));

  /**
   * POST /api/validation/session
   * Create a new validation session
   */
  router.post('/session', 
    validationController.createValidationSession.bind(validationController)
  );

  /**
   * GET /api/validation/session/:sessionId
   * Get validation session details
   */
  router.get('/session/:sessionId',
    validationController.getValidationSession.bind(validationController)
  );

  /**
   * GET /api/validation/session/:sessionId/progress
   * Get validation progress
   */
  router.get('/session/:sessionId/progress',
    validationController.getValidationProgress.bind(validationController)
  );

  /**
   * POST /api/validation/session/:sessionId/cancel
   * Cancel validation session
   */
  router.post('/session/:sessionId/cancel',
    validationController.cancelValidationSession.bind(validationController)
  );

  /**
   * GET /api/validation/session/:sessionId/result
   * Get validation results
   */
  router.get('/session/:sessionId/result',
    validationController.getValidationResult.bind(validationController)
  );

  /**
   * GET /api/validation/session/:sessionId/preview
   * Get data preview
   */
  router.get('/session/:sessionId/preview',
    validationController.getDataPreview.bind(validationController)
  );

  /**
   * POST /api/validation/rules
   * Create validation rule
   */
  router.post('/rules',
    validationController.createValidationRule.bind(validationController)
  );

  /**
   * GET /api/validation/rules
   * Get all validation rules
   */
  router.get('/rules',
    validationController.getValidationRules.bind(validationController)
  );

  /**
   * PUT /api/validation/rules/:ruleId
   * Update validation rule
   */
  router.put('/rules/:ruleId',
    validationController.updateValidationRule.bind(validationController)
  );

  /**
   * DELETE /api/validation/rules/:ruleId
   * Delete validation rule
   */
  router.delete('/rules/:ruleId',
    validationController.deleteValidationRule.bind(validationController)
  );

  /**
   * GET /api/validation/rules/templates
   * Get validation rule templates
   */
  router.get('/rules/templates',
    validationController.getValidationRuleTemplates.bind(validationController)
  );

  /**
   * POST /api/validation/rules/validate
   * Test validation rule against sample data
   */
  router.post('/rules/validate',
    validationController.testValidationRule.bind(validationController)
  );

  /**
   * GET /api/validation/statistics
   * Get validation statistics
   */
  router.get('/statistics',
    validationController.getValidationStatistics.bind(validationController)
  );

  /**
   * POST /api/validation/export
   * Export validation configuration
   */
  router.post('/export',
    validationController.exportValidationConfig.bind(validationController)
  );

  /**
   * POST /api/validation/import
   * Import validation configuration
   */
  router.post('/import',
    validationController.importValidationConfig.bind(validationController)
  );

  // Apply error middleware to all routes
  router.use(errorMiddleware.handle.bind(errorMiddleware));

  return router;
}