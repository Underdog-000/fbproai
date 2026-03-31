// Routes для аутентификации
// Включает: регистрацию, логин, Facebook OAuth

import express from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';
import { encrypt } from '../utils/crypto.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/auth/register
 * Регистрация нового пользователя
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
    }
    
    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists',
      });
    }
    
    // Хешируем пароль
    const { hashPassword } = await import('../utils/crypto.js');
    const hashedPassword = hashPassword(password);
    
    // Создаем пользователя
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
    
    // Генерируем токен
    const token = generateToken(user.id);
    
    res.status(201).json({
      user,
      token,
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Registration failed',
    });
  }
});

/**
 * POST /api/auth/login
 * Вход пользователя
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
    }
    
    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }
    
    // Проверяем пароль
    const { verifyPassword } = await import('../utils/crypto.js');
    const isValid = verifyPassword(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }
    
    // Генерируем токен
    const token = generateToken(user.id);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      token,
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Login failed',
    });
  }
});

/**
 * GET /api/auth/facebook
 * Начало Facebook OAuth flow
 */
router.get('/facebook', (req, res) => {
  const { facebook } = config;
  
  if (!facebook.appId) {
    return res.status(500).json({
      error: 'Configuration error',
      message: 'Facebook App ID not configured',
    });
  }
  
  const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  authUrl.searchParams.set('client_id', facebook.appId);
  authUrl.searchParams.set('redirect_uri', facebook.redirectUri);
  authUrl.searchParams.set('scope', facebook.scopes.join(','));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', req.query.userId || ''); // Передаем userId в state
  
  res.json({ authUrl: authUrl.toString() });
});

/**
 * GET /api/auth/facebook/callback
 * Callback от Facebook OAuth
 */
router.get('/facebook/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.status(400).json({
        error: 'OAuth error',
        message: error,
      });
    }
    
    if (!code) {
      return res.status(400).json({
        error: 'OAuth error',
        message: 'Authorization code not provided',
      });
    }
    
    const { facebook } = config;
    
    // Обмениваем код на токен
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: facebook.appId,
        client_secret: facebook.appSecret,
        redirect_uri: facebook.redirectUri,
        code,
      },
    });
    
    const { access_token, expires_in } = tokenResponse.data;
    
    // Получаем информацию о пользователе Facebook
    const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: {
        fields: 'id,name,email',
        access_token,
      },
    });
    
    const fbUser = userResponse.data;
    
    // Получаем рекламные аккаунты
    const accountsResponse = await axios.get(`https://graph.facebook.com/v18.0/${fbUser.id}/adaccounts`, {
      params: {
        fields: 'account_id,name,timezone_id,currency',
        access_token,
      },
    });
    
    const adAccounts = accountsResponse.data.data || [];
    
    // Определяем userId (из state или создаем нового)
    let userId = state;
    
    if (!userId) {
      // Создаем нового пользователя на основе Facebook
      const newUser = await prisma.user.create({
        data: {
          email: fbUser.email || `${fbUser.id}@facebook.com`,
          name: fbUser.name,
          password: 'facebook-oauth', // Placeholder, не используется
        },
      });
      userId = newUser.id;
    }
    
    // Сохраняем/обновляем рекламные аккаунты
    for (const account of adAccounts) {
      await prisma.adAccount.upsert({
        where: { accountId: `act_${account.account_id}` },
        update: {
          name: account.name,
          timezone: account.timezone_id?.toString() || 'UTC',
          accessToken: encrypt(access_token),
          tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
          status: 'active',
          updatedAt: new Date(),
        },
        create: {
          userId,
          accountId: `act_${account.account_id}`,
          name: account.name,
          timezone: account.timezone_id?.toString() || 'UTC',
          accessToken: encrypt(access_token),
          tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
          status: 'active',
        },
      });
    }
    
    // Генерируем JWT для приложения
    const token = generateToken(userId);
    
    // Редирект на frontend с токеном
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return res.redirect(
  `${frontendUrl}/dashboard?token=${token}&accounts=${adAccounts.length}`
);
    
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    res.status(500).json({
      error: 'OAuth error',
      message: 'Failed to complete Facebook authentication',
    });
  }
});

export default router;
