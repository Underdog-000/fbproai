// Middleware для JWT аутентификации
// Проверяет токен в заголовке Authorization

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';

const prisma = new PrismaClient();

/**
 * Middleware для проверки JWT токена
 * Добавляет пользователя в req.user
 */
export async function authenticate(req, res, next) {
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided' 
      });
    }
    
    const token = authHeader.substring(7); // Удаляем "Bearer "
    
    // Верифицируем токен
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Получаем пользователя из БД
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'User not found' 
      });
    }
    
    // Добавляем пользователя в запрос
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Token expired' 
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Authentication failed' 
    });
  }
}

/**
 * Middleware для проверки владения аккаунтом
 * Используется после authenticate
 */
export async function checkAccountOwnership(req, res, next) {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;
    
    if (!accountId) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Account ID required' 
      });
    }
    
    // Проверяем, что аккаунт принадлежит пользователю
    const adAccount = await prisma.adAccount.findFirst({
      where: {
        accountId,
        userId,
      },
    });
    
    if (!adAccount) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Ad account not found or access denied' 
      });
    }
    
    // Добавляем аккаунт в запрос для дальнейшего использования
    req.adAccount = adAccount;
    next();
    
  } catch (error) {
    console.error('Account ownership check error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to verify account ownership' 
    });
  }
}

/**
 * Генерация JWT токена
 * @param {string} userId - ID пользователя
 * @returns {string} - JWT токен
 */
export function generateToken(userId) {
  return jwt.sign(
    { userId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}