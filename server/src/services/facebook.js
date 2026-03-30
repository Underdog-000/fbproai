// Сервис для работы с Facebook Marketing API
// Синхронизация данных, управление кампаниями, статистика

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';
import { decrypt } from '../utils/crypto.js';

const prisma = new PrismaClient();

/**
 * Получает расшифрованный токен доступа
 * @param {string} adAccountId - ID аккаунта в нашей БД
 * @returns {string} - Расшифрованный токен
 */
async function getAccessToken(adAccountId) {
  const account = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
    select: { accessToken: true, tokenExpiresAt: true },
  });
  
  if (!account) {
    throw new Error('Account not found');
  }
  
  // Проверяем срок действия токена
  if (new Date() > account.tokenExpiresAt) {
    throw new Error('Access token expired');
  }
  
  return decrypt(account.accessToken);
}

/**
 * Делает запрос к Facebook API
 * @param {string} endpoint - API endpoint
 * @param {string} accessToken - Токен доступа
 * @param {object} params - Параметры запроса
 * @returns {object} - Ответ API
 */
async function facebookApiRequest(endpoint, accessToken, params = {}) {
  try {
    const response = await axios.get(`https://graph.facebook.com/${config.facebook.apiVersion}${endpoint}`, {
      params: {
        ...params,
        access_token: accessToken,
      },
    });
    return response.data;
  } catch (error) {
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      throw new Error(`Facebook API Error: ${fbError.message} (code: ${fbError.code})`);
    }
    throw error;
  }
}

/**
 * Синхронизирует все данные аккаунта
 * @param {string} adAccountId - ID аккаунта в нашей БД
 * @returns {object} - Статистика синхронизации
 */
export async function syncAccountData(adAccountId) {
  const stats = {
    campaigns: 0,
    adSets: 0,
    ads: 0,
    metrics: 0,
  };
  
  const accessToken = await getAccessToken(adAccountId);
  const account = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
    select: { accountId: true },
  });
  
  if (!account) {
    throw new Error('Account not found');
  }
  
  const fbAccountId = account.accountId;
  
  // Синхронизируем кампании
  const campaigns = await facebookApiRequest(`/${fbAccountId}/campaigns`, accessToken, {
    fields: 'id,name,status,objective,created_time,updated_time',
    limit: 100,
  });
  
  for (const campaign of campaigns.data || []) {
    await prisma.campaign.upsert({
      where: { campaignId: campaign.id },
      update: {
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        updatedTime: new Date(campaign.updated_time),
      },
      create: {
        adAccountId,
        campaignId: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        createdTime: new Date(campaign.created_time),
        updatedTime: new Date(campaign.updated_time),
      },
    });
    stats.campaigns++;
  }
  
  // Синхронизируем адсеты
  const adSets = await facebookApiRequest(`/${fbAccountId}/adsets`, accessToken, {
    fields: 'id,name,campaign_id,status,daily_budget,lifetime_budget,bid_strategy,created_time,updated_time',
    limit: 100,
  });
  
  for (const adSet of adSets.data || []) {
    // Получаем campaign из нашей БД
    const campaign = await prisma.campaign.findUnique({
      where: { campaignId: adSet.campaign_id },
    });
    
    if (campaign) {
      await prisma.adSet.upsert({
        where: { adSetId: adSet.id },
        update: {
          name: adSet.name,
          status: adSet.status,
          budget: adSet.daily_budget || adSet.lifetime_budget || null,
          bidStrategy: adSet.bid_strategy,
          updatedTime: new Date(adSet.updated_time),
        },
        create: {
          adAccountId,
          campaignId: campaign.id,
          adSetId: adSet.id,
          name: adSet.name,
          status: adSet.status,
          budget: adSet.daily_budget || adSet.lifetime_budget || null,
          bidStrategy: adSet.bid_strategy,
          createdTime: new Date(adSet.created_time),
          updatedTime: new Date(adSet.updated_time),
        },
      });
      stats.adSets++;
    }
  }
  
  // Синхронизируем объявления
  const ads = await facebookApiRequest(`/${fbAccountId}/ads`, accessToken, {
    fields: 'id,name,adset_id,status,creative{url},created_time,updated_time',
    limit: 100,
  });
  
  for (const ad of ads.data || []) {
    // Получаем adset из нашей БД
    const adSet = await prisma.adSet.findUnique({
      where: { adSetId: ad.adset_id },
    });
    
    if (adSet) {
      await prisma.ad.upsert({
        where: { adId: ad.id },
        update: {
          name: ad.name,
          status: ad.status,
          creativeUrl: ad.creative?.url || null,
          updatedTime: new Date(ad.updated_time),
        },
        create: {
          adAccountId,
          adSetId: adSet.id,
          adId: ad.id,
          name: ad.name,
          status: ad.status,
          creativeUrl: ad.creative?.url || null,
          createdTime: new Date(ad.created_time),
          updatedTime: new Date(ad.updated_time),
        },
      });
      stats.ads++;
    }
  }
  
  // Синхронизируем метрики (за последние 7 дней)
  const metricsStats = await syncMetrics(adAccountId, accessToken);
  stats.metrics = metricsStats;
  
  return stats;
}

/**
 * Синхронизирует метрики для всех сущностей
 * @param {string} adAccountId - ID аккаунта в нашей БД
 * @param {string} accessToken - Токен доступа
 * @returns {number} - Количество сохраненных метрик
 */
async function syncMetrics(adAccountId, accessToken) {
  const account = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
    select: { accountId: true },
  });
  
  const fbAccountId = account.accountId;
  let count = 0;
  
  // Период для метрик (последние 7 дней)
  const dateStop = new Date();
  const dateStart = new Date();
  dateStart.setDate(dateStart.getDate() - 7);
  
  const timeRange = {
    since: dateStart.toISOString().split('T')[0],
    until: dateStop.toISOString().split('T')[0],
  };
  
  // Метрики для запроса
  const fields = [
    'spend',
    'impressions',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'actions',
    'action_values',
    'cost_per_action_type',
  ].join(',');
  
  // Метрики аккаунта
  try {
    const accountInsights = await facebookApiRequest(`/${fbAccountId}/insights`, accessToken, {
      fields,
      time_range: JSON.stringify(timeRange),
      level: 'account',
    });
    
    for (const insight of accountInsights.data || []) {
      await saveMetrics(adAccountId, 'account', fbAccountId, accountInsights.data[0]?.account_name || 'Account', insight, new Date(timeRange.until));
      count++;
    }
  } catch (error) {
    console.error('Failed to sync account metrics:', error.message);
  }
  
  // Метрики кампаний
  try {
    const campaignInsights = await facebookApiRequest(`/${fbAccountId}/insights`, accessToken, {
      fields: `campaign_id,campaign_name,${fields}`,
      time_range: JSON.stringify(timeRange),
      level: 'campaign',
    });
    
    for (const insight of campaignInsights.data || []) {
      await saveMetrics(adAccountId, 'campaign', insight.campaign_id, insight.campaign_name, insight, new Date(timeRange.until));
      count++;
    }
  } catch (error) {
    console.error('Failed to sync campaign metrics:', error.message);
  }
  
  // Метрики адсетов
  try {
    const adsetInsights = await facebookApiRequest(`/${fbAccountId}/insights`, accessToken, {
      fields: `adset_id,adset_name,${fields}`,
      time_range: JSON.stringify(timeRange),
      level: 'adset',
    });
    
    for (const insight of adsetInsights.data || []) {
      await saveMetrics(adAccountId, 'adset', insight.adset_id, insight.adset_name, insight, new Date(timeRange.until));
      count++;
    }
  } catch (error) {
    console.error('Failed to sync adset metrics:', error.message);
  }
  
  // Метрики объявлений
  try {
    const adInsights = await facebookApiRequest(`/${fbAccountId}/insights`, accessToken, {
      fields: `ad_id,ad_name,${fields}`,
      time_range: JSON.stringify(timeRange),
      level: 'ad',
    });
    
    for (const insight of adInsights.data || []) {
      await saveMetrics(adAccountId, 'ad', insight.ad_id, insight.ad_name, insight, new Date(timeRange.until));
      count++;
    }
  } catch (error) {
    console.error('Failed to sync ad metrics:', error.message);
  }
  
  return count;
}

/**
 * Сохраняет метрики в БД
 */
async function saveMetrics(adAccountId, entityType, entityId, entityName, insight, date) {
  // Извлекаем конверсии из actions
  const actions = insight.actions || [];
  const leads = actions.find(a => a.action_type === 'lead')?.value || 0;
  const conversions = actions.find(a => a.action_type === 'offsite_conversion')?.value || 0;
  
  // Вычисляем CPL и CPA
  const spend = parseFloat(insight.spend) || 0;
  const cpl = leads > 0 ? spend / leads : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  
  await prisma.metricSnapshot.create({
    data: {
      adAccountId,
      entityType,
      entityId,
      entityName,
      spend,
      impressions: parseInt(insight.impressions) || 0,
      clicks: parseInt(insight.clicks) || 0,
      ctr: parseFloat(insight.ctr) || 0,
      cpc: parseFloat(insight.cpc) || 0,
      cpm: parseFloat(insight.cpm) || 0,
      leads,
      conversions,
      cpl,
      cpa,
      date,
    },
  });
}

/**
 * Изменяет статус сущности (кампания, адсет, объявление)
 * @param {string} entityType - Тип сущности
 * @param {string} entityId - ID сущности
 * @param {string} status - Новый статус
 * @param {string} adAccountId - ID аккаунта в нашей БД
 */
export async function updateEntityStatus(entityType, entityId, status, adAccountId) {
  const accessToken = await getAccessToken(adAccountId);
  
  await axios.post(`https://graph.facebook.com/${config.facebook.apiVersion}/${entityId}`, {
    status,
  }, {
    params: { access_token: accessToken },
  });
  
  // Обновляем в нашей БД
  const model = entityType === 'campaign' ? prisma.campaign :
                entityType === 'adset' ? prisma.adSet :
                prisma.ad;
  
  const idField = entityType === 'campaign' ? 'campaignId' :
                  entityType === 'adset' ? 'adSetId' :
                  'adId';
  
  await model.update({
    where: { [idField]: entityId },
    data: { status },
  });
}

/**
 * Изменяет бюджет адсета
 * @param {string} adSetId - ID адсета
 * @param {number} budget - Новый бюджет
 * @param {string} budgetType - Тип бюджета (daily или lifetime)
 * @param {string} adAccountId - ID аккаунта в нашей БД
 */
export async function updateAdSetBudget(adSetId, budget, budgetType, adAccountId) {
  const accessToken = await getAccessToken(adAccountId);
  
  const data = budgetType === 'daily' 
    ? { daily_budget: budget }
    : { lifetime_budget: budget };
  
  await axios.post(`https://graph.facebook.com/${config.facebook.apiVersion}/${adSetId}`, data, {
    params: { access_token: accessToken },
  });
  
  // Обновляем в нашей БД
  await prisma.adSet.update({
    where: { adSetId },
    data: { budget },
  });
}

export default {
  syncAccountData,
  updateEntityStatus,
  updateAdSetBudget,
};