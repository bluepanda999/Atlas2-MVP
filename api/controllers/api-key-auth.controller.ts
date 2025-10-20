import { Request, Response, NextFunction } from 'express';
import { ApiKeyAuthService, ApiKeyConfig } from '../services/api-key-auth.service';
import { ApiResponse } from '../types/api';

export class ApiKeyAuthController {
  constructor(private apiKeyAuthService: ApiKeyAuthService) {}

  createAuthProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, type, config, apiSpecId } = req.body;

      // Validate request
      if (!name || !type || !config) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, type, config'
        });
        return;
      }

      if (!['api_key', 'basic_auth', 'bearer_token'].includes(type)) {
        res.status(400).json({
          success: false,
          error: 'Invalid type. Must be: api_key, basic_auth, bearer_token'
        });
        return;
      }

      const profile = await this.apiKeyAuthService.createAuthProfile(
        name,
        type,
        config,
        apiSpecId
      );

      const response: ApiResponse<typeof profile> = {
        success: true,
        data: profile,
        message: 'Authentication profile created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  getAuthProfiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profiles = await this.apiKeyAuthService.getAllAuthProfiles();

      const response: ApiResponse<typeof profiles> = {
        success: true,
        data: profiles,
        message: 'Authentication profiles retrieved successfully'
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getAuthProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { profileId } = req.params;
      
      const profile = await this.apiKeyAuthService.getAuthProfile(profileId);
      
      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Authentication profile not found'
        });
        return;
      }

      const response: ApiResponse<typeof profile> = {
        success: true,
        data: profile,
        message: 'Authentication profile retrieved successfully'
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  updateAuthProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { profileId } = req.params;
      const updates = req.body;

      const profile = await this.apiKeyAuthService.updateAuthProfile(profileId, updates);

      const response: ApiResponse<typeof profile> = {
        success: true,
        data: profile,
        message: 'Authentication profile updated successfully'
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteAuthProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { profileId } = req.params;

      await this.apiKeyAuthService.deleteAuthProfile(profileId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Authentication profile deleted successfully'
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  testAuthentication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { profileId } = req.params;
      const { testUrl } = req.body;

      const result = await this.apiKeyAuthService.testAuthentication(profileId, testUrl);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: 'Authentication test completed'
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { apiKey, config } = req.body;

      if (!apiKey || !config) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: apiKey, config'
        });
        return;
      }

      const result = await this.apiKeyAuthService.validateApiKey(apiKey, config);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: 'API key validation completed'
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  // Helper method to get auth headers for API requests
  getAuthHeaders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { profileId } = req.params;
      
      const profile = await this.apiKeyAuthService.getAuthProfile(profileId);
      
      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Authentication profile not found'
        });
        return;
      }

      const headers = this.apiKeyAuthService.getAuthHeaders(profile);
      const queryParams = this.apiKeyAuthService.getAuthQueryParams(profile);

      const response: ApiResponse<{ headers: typeof headers; queryParams: typeof queryParams }> = {
        success: true,
        data: { headers, queryParams },
        message: 'Authentication headers retrieved successfully'
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}