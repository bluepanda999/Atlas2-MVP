import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ErrorMiddleware } from '../middleware/error.middleware';

export function createAuthRoutes(
  authController: AuthController,
  authMiddleware: AuthMiddleware,
  errorMiddleware: ErrorMiddleware
): Router {
  const router = Router();

  // Public routes
  router.post('/login', errorMiddleware.asyncHandler(authController.login));
  router.post('/register', errorMiddleware.asyncHandler(authController.register));
  router.post('/refresh', errorMiddleware.asyncHandler(authController.refreshToken));

  // Protected routes
  router.use(authMiddleware.authenticate); // All routes below require authentication

  router.post('/logout', errorMiddleware.asyncHandler(authController.logout));
  router.get('/profile', errorMiddleware.asyncHandler(authController.getProfile));
  router.put('/profile', errorMiddleware.asyncHandler(authController.updateProfile));
  router.put('/change-password', errorMiddleware.asyncHandler(authController.changePassword));

  return router;
}