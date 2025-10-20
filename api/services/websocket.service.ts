import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { ValidationService, ValidationProgress, ValidationResult } from './validation.service';
import { UploadRepository } from '../repositories/upload.repository';

export interface WebSocketMessage {
  type: string;
  jobId: string;
  userId: string;
  timestamp: Date;
  data: any;
}

export interface ValidationUpdateMessage extends WebSocketMessage {
  type: 'validation_progress' | 'validation_complete' | 'validation_error';
  data: ValidationProgress | ValidationResult | { error: string };
}

export interface ProcessingUpdateMessage extends WebSocketMessage {
  type: 'processing_progress' | 'processing_complete' | 'processing_error';
  data: {
    progress: number;
    recordsProcessed: number;
    totalRecords: number;
    processingSpeed: number;
    estimatedTimeRemaining?: number;
    error?: string;
  };
}

export interface ClientConnection {
  id: string;
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  subscribedJobs: Set<string>;
}

export class WebSocketService {
  private io: SocketIOServer;
  private clients: Map<string, ClientConnection> = new Map();
  private jobSubscribers: Map<string, Set<string>> = new Map(); // jobId -> Set of clientIds

  constructor(
    private httpServer: HTTPServer,
    private validationService: ValidationService,
    private uploadRepository: UploadRepository
  ) {
    this.initializeSocketIO();
    this.setupEventHandlers();
  }

  private initializeSocketIO(): void {
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    logger.info('WebSocket server initialized');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Setup periodic cleanup
    setInterval(() => {
      this.cleanupInactiveClients();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private handleConnection(socket: any): void {
    const clientId = socket.id;
    
    logger.info(`WebSocket client connected: ${clientId}`);

    // Authentication middleware
    socket.on('authenticate', async (data: { token: string }) => {
      try {
        // In a real implementation, verify JWT token
        const userId = this.verifyToken(data.token);
        
        const client: ClientConnection = {
          id: clientId,
          userId,
          socketId: socket.id,
          connectedAt: new Date(),
          lastActivity: new Date(),
          subscribedJobs: new Set(),
        };

        this.clients.set(clientId, client);
        
        socket.emit('authenticated', { success: true, userId });
        socket.userId = userId; // Store on socket for easy access
        
        logger.info(`WebSocket client authenticated: ${clientId} for user: ${userId}`);
        
      } catch (error) {
        logger.warn(`WebSocket authentication failed for ${clientId}:`, error);
        socket.emit('authentication_error', { 
          error: 'Authentication failed' 
        });
        socket.disconnect();
      }
    });

    // Job subscription handlers
    socket.on('subscribe_job', (data: { jobId: string }) => {
      this.handleJobSubscription(socket, data.jobId);
    });

    socket.on('unsubscribe_job', (data: { jobId: string }) => {
      this.handleJobUnsubscription(socket, data.jobId);
    });

    // Validation progress requests
    socket.on('get_validation_progress', async (data: { jobId: string }) => {
      await this.handleValidationProgressRequest(socket, data.jobId);
    });

    // Job status requests
    socket.on('get_job_status', async (data: { jobId: string }) => {
      await this.handleJobStatusRequest(socket, data.jobId);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Error handler
    socket.on('error', (error: Error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
    });

    // Activity tracking
    socket.onAny(() => {
      this.updateClientActivity(clientId);
    });
  }

  private verifyToken(token: string): string {
    // In a real implementation, verify JWT token
    // For now, return a mock user ID
    try {
      // This would be actual JWT verification
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.userId || 'mock-user-id';
    } catch (error) {
      throw new AppError('Invalid token', 401);
    }
  }

  private handleJobSubscription(socket: any, jobId: string): void {
    const clientId = socket.id;
    const client = this.clients.get(clientId);

    if (!client) {
      socket.emit('error', { message: 'Client not authenticated' });
      return;
    }

    // Add job to client's subscriptions
    client.subscribedJobs.add(jobId);

    // Add client to job subscribers
    if (!this.jobSubscribers.has(jobId)) {
      this.jobSubscribers.set(jobId, new Set());
    }
    this.jobSubscribers.get(jobId)!.add(clientId);

    socket.emit('subscribed_to_job', { jobId });
    
    logger.debug(`Client ${clientId} subscribed to job ${jobId}`);
  }

  private handleJobUnsubscription(socket: any, jobId: string): void {
    const clientId = socket.id;
    const client = this.clients.get(clientId);

    if (!client) {
      socket.emit('error', { message: 'Client not authenticated' });
      return;
    }

    // Remove job from client's subscriptions
    client.subscribedJobs.delete(jobId);

    // Remove client from job subscribers
    const subscribers = this.jobSubscribers.get(jobId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.jobSubscribers.delete(jobId);
      }
    }

    socket.emit('unsubscribed_from_job', { jobId });
    
    logger.debug(`Client ${clientId} unsubscribed from job ${jobId}`);
  }

  private async handleValidationProgressRequest(socket: any, jobId: string): Promise<void> {
    try {
      const progress = this.validationService.getValidationProgress(jobId);
      const result = this.validationService.getValidationResult(jobId);

      socket.emit('validation_progress', {
        jobId,
        progress,
        result,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error(`Error getting validation progress for job ${jobId}:`, error);
      socket.emit('error', { 
        message: 'Failed to get validation progress',
        jobId,
      });
    }
  }

  private async handleJobStatusRequest(socket: any, jobId: string): Promise<void> {
    try {
      const job = await this.uploadRepository.findById(jobId);
      
      if (!job) {
        socket.emit('error', { 
          message: 'Job not found',
          jobId,
        });
        return;
      }

      socket.emit('job_status', {
        jobId,
        job,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error(`Error getting job status for job ${jobId}:`, error);
      socket.emit('error', { 
        message: 'Failed to get job status',
        jobId,
      });
    }
  }

  private handleDisconnection(socket: any): void {
    const clientId = socket.id;
    const client = this.clients.get(clientId);

    if (client) {
      // Remove client from all job subscriptions
      client.subscribedJobs.forEach(jobId => {
        const subscribers = this.jobSubscribers.get(jobId);
        if (subscribers) {
          subscribers.delete(clientId);
          if (subscribers.size === 0) {
            this.jobSubscribers.delete(jobId);
          }
        }
      });

      // Remove client
      this.clients.delete(clientId);
      
      logger.info(`WebSocket client disconnected: ${clientId} (user: ${client.userId})`);
    }
  }

  private updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
    }
  }

  private cleanupInactiveClients(): void {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [clientId, client] of this.clients.entries()) {
      if (now.getTime() - client.lastActivity.getTime() > inactiveThreshold) {
        // Remove inactive client
        client.subscribedJobs.forEach(jobId => {
          const subscribers = this.jobSubscribers.get(jobId);
          if (subscribers) {
            subscribers.delete(clientId);
            if (subscribers.size === 0) {
              this.jobSubscribers.delete(jobId);
            }
          }
        });

        this.clients.delete(clientId);
        
        // Disconnect socket
        const socket = this.io.sockets.sockets.get(client.socketId);
        if (socket) {
          socket.disconnect(true);
        }

        logger.info(`Cleaned up inactive WebSocket client: ${clientId}`);
      }
    }
  }

  // Public methods for broadcasting updates
  broadcastValidationProgress(jobId: string, userId: string, progress: ValidationProgress): void {
    const message: ValidationUpdateMessage = {
      type: 'validation_progress',
      jobId,
      userId,
      timestamp: new Date(),
      data: progress,
    };

    this.broadcastToJobSubscribers(jobId, message);
  }

  broadcastValidationComplete(jobId: string, userId: string, result: ValidationResult): void {
    const message: ValidationUpdateMessage = {
      type: 'validation_complete',
      jobId,
      userId,
      timestamp: new Date(),
      data: result,
    };

    this.broadcastToJobSubscribers(jobId, message);
  }

  broadcastValidationError(jobId: string, userId: string, error: string): void {
    const message: ValidationUpdateMessage = {
      type: 'validation_error',
      jobId,
      userId,
      timestamp: new Date(),
      data: { error },
    };

    this.broadcastToJobSubscribers(jobId, message);
  }

  broadcastProcessingProgress(
    jobId: string, 
    userId: string, 
    progress: number,
    recordsProcessed: number,
    totalRecords: number,
    processingSpeed: number,
    estimatedTimeRemaining?: number
  ): void {
    const message: ProcessingUpdateMessage = {
      type: 'processing_progress',
      jobId,
      userId,
      timestamp: new Date(),
      data: {
        progress,
        recordsProcessed,
        totalRecords,
        processingSpeed,
        estimatedTimeRemaining,
      },
    };

    this.broadcastToJobSubscribers(jobId, message);
  }

  broadcastProcessingComplete(jobId: string, userId: string): void {
    const message: ProcessingUpdateMessage = {
      type: 'processing_complete',
      jobId,
      userId,
      timestamp: new Date(),
      data: {
        progress: 100,
        recordsProcessed: 0, // Would be filled with actual data
        totalRecords: 0,
        processingSpeed: 0,
      },
    };

    this.broadcastToJobSubscribers(jobId, message);
  }

  broadcastProcessingError(jobId: string, userId: string, error: string): void {
    const message: ProcessingUpdateMessage = {
      type: 'processing_error',
      jobId,
      userId,
      timestamp: new Date(),
      data: {
        progress: 0,
        recordsProcessed: 0,
        totalRecords: 0,
        processingSpeed: 0,
        error,
      },
    };

    this.broadcastToJobSubscribers(jobId, message);
  }

  private broadcastToJobSubscribers(jobId: string, message: WebSocketMessage): void {
    const subscribers = this.jobSubscribers.get(jobId);
    
    if (!subscribers || subscribers.size === 0) {
      logger.debug(`No subscribers for job ${jobId}`);
      return;
    }

    let sentCount = 0;
    subscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      const socket = this.io.sockets.sockets.get(client?.socketId);

      if (socket && client?.userId === message.userId) {
        socket.emit(message.type, message);
        sentCount++;
      }
    });

    logger.debug(`Broadcasted ${message.type} to ${sentCount} subscribers for job ${jobId}`);
  }

  // Statistics and monitoring
  getStats(): {
    connectedClients: number;
    totalSubscriptions: number;
    jobsWithSubscribers: number;
    clients: Array<{
      id: string;
      userId: string;
      connectedAt: Date;
      lastActivity: Date;
      subscriptionCount: number;
    }>;
  } {
    const clients = Array.from(this.clients.values()).map(client => ({
      id: client.id,
      userId: client.userId,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      subscriptionCount: client.subscribedJobs.size,
    }));

    const totalSubscriptions = Array.from(this.clients.values())
      .reduce((total, client) => total + client.subscribedJobs.size, 0);

    return {
      connectedClients: this.clients.size,
      totalSubscriptions,
      jobsWithSubscribers: this.jobSubscribers.size,
      clients,
    };
  }

  // Graceful shutdown
  shutdown(): void {
    logger.info('Shutting down WebSocket service...');
    
    // Disconnect all clients
    this.io.emit('server_shutdown', { 
      message: 'Server is shutting down',
      timestamp: new Date(),
    });

    // Close the server
    this.io.close(() => {
      logger.info('WebSocket server closed');
    });
  }
}