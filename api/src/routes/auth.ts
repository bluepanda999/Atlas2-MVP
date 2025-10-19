import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const router = Router();

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // TODO: Implement actual authentication
    // For now, just accept any credentials and return a token
    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }

    const token = jwt.sign(
      { username, role: 'user' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`User logged in: ${username}`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        username,
        role: 'user'
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

router.post('/refresh', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Missing token',
        message: 'Refresh token is required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const newToken = jwt.sign(
      { username: decoded.username, role: decoded.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token: newToken
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Invalid token',
      message: 'Token is invalid or expired'
    });
  }
});

export { router as authRouter };