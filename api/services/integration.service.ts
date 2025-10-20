import { IntegrationRepository, ApiConfiguration } from '../repositories/integration.repository';
import { logger } from '../utils/logger';

export class IntegrationService {
  constructor(private integrationRepository: IntegrationRepository) {}

  async getIntegrationsByUserId(userId: string): Promise<ApiConfiguration[]> {
    try {
      return await this.integrationRepository.findByUserId(userId);
    } catch (error) {
      logger.error('Failed to get integrations for user:', { userId, error });
      throw error;
    }
  }

  async getActiveIntegrationsByUserId(userId: string): Promise<ApiConfiguration[]> {
    try {
      return await this.integrationRepository.findActiveByUserId(userId);
    } catch (error) {
      logger.error('Failed to get active integrations for user:', { userId, error });
      throw error;
    }
  }

  async getIntegrationById(id: string): Promise<ApiConfiguration | null> {
    try {
      return await this.integrationRepository.findById(id);
    } catch (error) {
      logger.error('Failed to get integration by id:', { id, error });
      throw error;
    }
  }

  async createIntegration(userId: string, integrationData: Omit<ApiConfiguration, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ApiConfiguration> {
    try {
      const integration = await this.integrationRepository.create({
        ...integrationData,
        user_id: userId,
      });
      
      logger.info('Integration created successfully', { integrationId: integration.id, userId });
      return integration;
    } catch (error) {
      logger.error('Failed to create integration:', { userId, integrationData, error });
      throw error;
    }
  }

  async updateIntegration(id: string, userId: string, updateData: Partial<ApiConfiguration>): Promise<ApiConfiguration | null> {
    try {
      // First check if the integration belongs to the user
      const existingIntegration = await this.integrationRepository.findById(id);
      if (!existingIntegration || existingIntegration.user_id !== userId) {
        throw new Error('Integration not found or access denied');
      }

      const updatedIntegration = await this.integrationRepository.update(id, updateData);
      
      if (updatedIntegration) {
        logger.info('Integration updated successfully', { integrationId: id, userId });
      }
      
      return updatedIntegration;
    } catch (error) {
      logger.error('Failed to update integration:', { id, userId, updateData, error });
      throw error;
    }
  }

  async deleteIntegration(id: string, userId: string): Promise<boolean> {
    try {
      // First check if the integration belongs to the user
      const existingIntegration = await this.integrationRepository.findById(id);
      if (!existingIntegration || existingIntegration.user_id !== userId) {
        throw new Error('Integration not found or access denied');
      }

      const deleted = await this.integrationRepository.delete(id);
      
      if (deleted) {
        logger.info('Integration deleted successfully', { integrationId: id, userId });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Failed to delete integration:', { id, userId, error });
      throw error;
    }
  }

  async activateIntegration(id: string, userId: string): Promise<boolean> {
    try {
      // First check if the integration belongs to the user
      const existingIntegration = await this.integrationRepository.findById(id);
      if (!existingIntegration || existingIntegration.user_id !== userId) {
        throw new Error('Integration not found or access denied');
      }

      const activated = await this.integrationRepository.activate(id);
      
      if (activated) {
        logger.info('Integration activated successfully', { integrationId: id, userId });
      }
      
      return activated;
    } catch (error) {
      logger.error('Failed to activate integration:', { id, userId, error });
      throw error;
    }
  }

  async deactivateIntegration(id: string, userId: string): Promise<boolean> {
    try {
      // First check if the integration belongs to the user
      const existingIntegration = await this.integrationRepository.findById(id);
      if (!existingIntegration || existingIntegration.user_id !== userId) {
        throw new Error('Integration not found or access denied');
      }

      const deactivated = await this.integrationRepository.deactivate(id);
      
      if (deactivated) {
        logger.info('Integration deactivated successfully', { integrationId: id, userId });
      }
      
      return deactivated;
    } catch (error) {
      logger.error('Failed to deactivate integration:', { id, userId, error });
      throw error;
    }
  }

  async testIntegration(integration: ApiConfiguration): Promise<boolean> {
    try {
      // This is a placeholder for integration testing
      // In a real implementation, you would make a test request to the API
      logger.info('Testing integration', { integrationId: integration.id, type: integration.type });
      
      // Simulate test
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      logger.error('Integration test failed:', { integrationId: integration.id, error });
      throw error;
    }
  }
}