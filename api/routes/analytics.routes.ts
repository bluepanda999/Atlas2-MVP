import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { AuthMiddleware } from "../middleware/auth.middleware";
import { ErrorMiddleware } from "../middleware/error.middleware";

export function createAnalyticsRoutes(
  analyticsController: AnalyticsController,
  authMiddleware: AuthMiddleware,
  errorMiddleware: ErrorMiddleware,
): Router {
  const router = Router();

  // Apply authentication middleware to all routes
  router.use(authMiddleware.authenticate.bind(authMiddleware));

  /**
   * @route GET /api/analytics/dashboard
   * @desc Get analytics dashboard data
   * @access Private
   */
  router.get(
    "/dashboard",
    analyticsController.getDashboardData.bind(analyticsController),
  );

  /**
   * @route GET /api/analytics/export
   * @desc Export analytics data
   * @access Private
   */
  router.get(
    "/export",
    analyticsController.exportAnalytics.bind(analyticsController),
  );

  /**
   * @route GET /api/analytics/realtime
   * @desc Get real-time analytics data
   * @access Private
   */
  router.get(
    "/realtime",
    analyticsController.getRealTimeData.bind(analyticsController),
  );

  /**
   * @route GET /api/analytics/health
   * @desc Get system health status
   * @access Private
   */
  router.get(
    "/health",
    analyticsController.getSystemHealth.bind(analyticsController),
  );

  /**
   * @route GET /api/analytics/config
   * @desc Get analytics configuration
   * @access Private
   */
  router.get(
    "/config",
    analyticsController.getConfiguration.bind(analyticsController),
  );

  // Error handling
  router.use(errorMiddleware.notFound);
  router.use(errorMiddleware.handle);

  return router;
}
