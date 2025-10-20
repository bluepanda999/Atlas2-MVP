/**
 * Tests for WebSocket Service
 */

import { WebSocketService } from '../../../api/services/websocket.service';
import { Server as SocketIOServer } from 'socket.io';
import { Socket } from 'socket.io';

// Mock socket.io
jest.mock('socket.io');

describe('WebSocketService', () => {
  let webSocketService: WebSocketService;
  let mockIo: jest.Mocked<SocketIOServer>;
  let mockSocket: jest.Mocked<Socket>;

  beforeEach(() => {
    mockIo = {
      use: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      close: jest.fn(),
    } as any;

    mockSocket = {
      id: 'socket-1',
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    webSocketService = new WebSocketService();
    (webSocketService as any).io = mockIo;
    
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize WebSocket service successfully', async () => {
      // Arrange
      const mockServer = {} as any;
      mockIo.use = jest.fn((middleware) => {
        middleware(mockSocket, jest.fn());
      });

      // Act
      await webSocketService.initialize(mockServer);

      // Assert
      expect(mockIo.use).toHaveBeenCalled();
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle authentication middleware', async () => {
      // Arrange
      const mockServer = {} as any;
      const mockNext = jest.fn();
      let authMiddleware: Function;

      mockIo.use = jest.fn((middleware) => {
        authMiddleware = middleware;
      });

      // Act
      await webSocketService.initialize(mockServer);

      // Test successful authentication
      mockSocket.handshake.auth = { token: 'valid-token' };
      await authMiddleware(mockSocket, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unauthorized connections', async () => {
      // Arrange
      const mockServer = {} as any;
      const mockNext = jest.fn();
      let authMiddleware: Function;

      mockIo.use = jest.fn((middleware) => {
        authMiddleware = middleware;
      });

      // Act
      await webSocketService.initialize(mockServer);

      // Test failed authentication
      mockSocket.handshake.auth = { token: null };
      await authMiddleware(mockSocket, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed'));
    });
  });

  describe('handleConnection', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should handle new socket connection', () => {
      // Arrange
      let connectionHandler: Function;
      mockIo.on.mockImplementation((event, handler) => {
        if (event === 'connection') {
          connectionHandler = handler;
        }
      });

      // Act
      connectionHandler(mockSocket);

      // Assert
      expect(mockSocket.on).toHaveBeenCalledWith('authenticate', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('join_validation', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave_validation', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  describe('handleAuthentication', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should authenticate socket with valid token', () => {
      // Arrange
      let authHandler: Function;
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'authenticate') {
          authHandler = handler;
        }
      });

      const mockData = { token: 'valid-token' };

      // Act
      authHandler(mockData);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith('authenticated', { success: true });
    });

    it('should reject authentication with invalid token', () => {
      // Arrange
      let authHandler: Function;
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'authenticate') {
          authHandler = handler;
        }
      });

      const mockData = { token: 'invalid-token' };

      // Act
      authHandler(mockData);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith('authentication_error', { 
        error: 'Invalid token' 
      });
    });
  });

  describe('handleJoinValidation', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should handle joining validation room', () => {
      // Arrange
      let joinHandler: Function;
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'join_validation') {
          joinHandler = handler;
        }
      });

      const mockData = { fileId: 'file-1' };

      // Act
      joinHandler(mockData);

      // Assert
      expect(mockSocket.join).toHaveBeenCalledWith(`validation:${mockData.fileId}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('joined_validation', { 
        fileId: mockData.fileId 
      });
    });

    it('should handle joining validation room without fileId', () => {
      // Arrange
      let joinHandler: Function;
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'join_validation') {
          joinHandler = handler;
        }
      });

      const mockData = {};

      // Act
      joinHandler(mockData);

      // Assert
      expect(mockSocket.emit).toHaveBeenCalledWith('validation_error', { 
        error: 'File ID is required' 
      });
    });
  });

  describe('handleLeaveValidation', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should handle leaving validation room', () => {
      // Arrange
      let leaveHandler: Function;
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'leave_validation') {
          leaveHandler = handler;
        }
      });

      const mockData = { fileId: 'file-1' };

      // Act
      leaveHandler(mockData);

      // Assert
      expect(mockSocket.leave).toHaveBeenCalledWith(`validation:${mockData.fileId}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('left_validation', { 
        fileId: mockData.fileId 
      });
    });
  });

  describe('handleDisconnect', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should handle socket disconnection', () => {
      // Arrange
      let disconnectHandler: Function;
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'disconnect') {
          disconnectHandler = handler;
        }
      });

      const mockReason = 'client disconnect';

      // Act
      disconnectHandler(mockReason);

      // Assert
      // Should clean up any rooms or state associated with this socket
      expect(mockSocket.leave).toHaveBeenCalled();
    });
  });

  describe('broadcast', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should broadcast message to all clients', async () => {
      // Arrange
      const event = 'test-event';
      const data = { message: 'test data' };

      mockIo.to.mockReturnValue({
        emit: jest.fn()
      } as any);

      // Act
      await webSocketService.broadcast(event, data);

      // Assert
      expect(mockIo.to).toHaveBeenCalledWith('all');
      expect(mockIo.to('').emit).toHaveBeenCalledWith(event, data);
    });

    it('should broadcast message to specific room', async () => {
      // Arrange
      const event = 'validation-progress';
      const data = { fileId: 'file-1', progress: 50 };
      const room = `validation:${data.fileId}`;

      mockIo.to.mockReturnValue({
        emit: jest.fn()
      } as any);

      // Act
      await webSocketService.broadcast(event, data, room);

      // Assert
      expect(mockIo.to).toHaveBeenCalledWith(room);
      expect(mockIo.to(room).emit).toHaveBeenCalledWith(event, data);
    });
  });

  describe('sendToSocket', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should send message to specific socket', async () => {
      // Arrange
      const socketId = 'socket-1';
      const event = 'private-message';
      const data = { message: 'private data' };

      mockIo.to.mockReturnValue({
        emit: jest.fn()
      } as any);

      // Act
      await webSocketService.sendToSocket(socketId, event, data);

      // Assert
      expect(mockIo.to).toHaveBeenCalledWith(socketId);
      expect(mockIo.to(socketId).emit).toHaveBeenCalledWith(event, data);
    });
  });

  describe('getConnectedClients', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should return count of connected clients', () => {
      // Arrange
      const mockSockets = new Map([
        ['socket-1', mockSocket],
        ['socket-2', mockSocket],
      ]);
      
      (webSocketService as any).connectedSockets = mockSockets;

      // Act
      const count = webSocketService.getConnectedClients();

      // Assert
      expect(count).toBe(2);
    });

    it('should return 0 when no clients connected', () => {
      // Arrange
      (webSocketService as any).connectedSockets = new Map();

      // Act
      const count = webSocketService.getConnectedClients();

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should shutdown WebSocket service gracefully', async () => {
      // Act
      await webSocketService.shutdown();

      // Assert
      expect(mockIo.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should handle socket errors gracefully', () => {
      // Arrange
      let errorHandler: Function;
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      const mockError = new Error('Socket error');

      // Act
      errorHandler(mockError);

      // Assert
      // Should not throw unhandled errors
      expect(mockSocket.emit).toHaveBeenCalledWith('error', { 
        error: 'An error occurred' 
      });
    });

    it('should handle broadcast errors', async () => {
      // Arrange
      const event = 'test-event';
      const data = { message: 'test data' };

      mockIo.to.mockImplementation(() => {
        throw new Error('Broadcast failed');
      });

      // Act & Assert
      await expect(webSocketService.broadcast(event, data))
        .rejects.toThrow('Broadcast failed');
    });
  });

  describe('room management', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should track socket rooms correctly', () => {
      // Arrange
      let joinHandler: Function;
      let leaveHandler: Function;
      
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'join_validation') {
          joinHandler = handler;
        } else if (event === 'leave_validation') {
          leaveHandler = handler;
        }
      });

      const fileId = 'file-1';

      // Act
      joinHandler({ fileId });
      leaveHandler({ fileId });

      // Assert
      expect(mockSocket.join).toHaveBeenCalledWith(`validation:${fileId}`);
      expect(mockSocket.leave).toHaveBeenCalledWith(`validation:${fileId}`);
    });
  });

  describe('performance tests', () => {
    beforeEach(async () => {
      await webSocketService.initialize({} as any);
    });

    it('should handle multiple concurrent broadcasts', async () => {
      // Arrange
      const promises = [];
      const eventCount = 100;

      mockIo.to.mockReturnValue({
        emit: jest.fn()
      } as any);

      // Act
      for (let i = 0; i < eventCount; i++) {
        promises.push(
          webSocketService.broadcast('test-event', { id: i })
        );
      }

      await Promise.all(promises);

      // Assert
      expect(mockIo.to).toHaveBeenCalledTimes(eventCount);
    });

    it('should handle high-frequency validation updates', async () => {
      // Arrange
      const fileId = 'file-1';
      const updateCount = 1000;
      const promises = [];

      mockIo.to.mockReturnValue({
        emit: jest.fn()
      } as any);

      // Act
      for (let i = 0; i < updateCount; i++) {
        promises.push(
          webSocketService.broadcast('validation_progress', {
            fileId,
            progress: (i / updateCount) * 100,
            currentRow: i
          }, `validation:${fileId}`)
        );
      }

      await Promise.all(promises);

      // Assert
      expect(mockIo.to).toHaveBeenCalledTimes(updateCount);
    });
  });
});