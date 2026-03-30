// Утилиты для шифрования敏感ных данных
// Используем AES-256-GCM для безопасного хранения токенов

import crypto from 'crypto';
import config from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Шифрует текст
 * @param {string} text - Текст для шифрования
 * @returns {string} - Зашифрованный текст в формате base64
 */
export function encrypt(text) {
  if (!text) return '';
  
  const key = Buffer.from(config.encryptionKey.padEnd(32, '0').slice(0, 32));
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const tag = cipher.getAuthTag();
  
  // Формат: iv:tag:encrypted (все в base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
}

/**
 * Дешифрует текст
 * @param {string} encryptedText - Зашифрованный текст
 * @returns {string} - Расшифрованный текст
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return '';
  
  try {
    const [ivBase64, tagBase64, encrypted] = encryptedText.split(':');
    
    const key = Buffer.from(config.encryptionKey.padEnd(32, '0').slice(0, 32));
    const iv = Buffer.from(ivBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return '';
  }
}

/**
 * Хеширует пароль
 * @param {string} password - Пароль
 * @returns {string} - Хешированный пароль
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Проверяет пароль
 * @param {string} password - Пароль для проверки
 * @param {string} hashedPassword - Хешированный пароль
 * @returns {boolean} - true если пароль верный
 */
export function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}