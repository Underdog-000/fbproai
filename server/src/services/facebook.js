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
    select: {
      id: true,
      facebookConnection: {
        select: {
          accessToken: true,
          tokenExpiresAt: true,
          status: true,
        },
      },
    },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  if (!account.facebookConnection) {
    throw new Error('Facebook connection not found');
  }

  if (account.facebookConnection.status !== 'active') {
    throw new Error('Facebook connection is not active');
  }

  if (new Date() > account.facebookConnection.tokenExpiresAt) {
    throw new Error('Access token expired');
  }

  return decrypt(account.facebookConnection.accessToken);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTodayDateRange() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const dateString = `${yyyy}-${mm}-${dd}`;

  return {
    since: dateString,
    until: dateString,
    date: new Date(`${dateString}T00:00:00.000Z`),
  };
}

async function fetchEntityState(entityType, entityId, adAccountId) {
  const accessToken = await getAccessToken(adAccountId);
  const response = await facebookApiRequest(`/${entityId}`, accessToken, {
    fields: 'id,name,status,effective_status',
  });

  return {
    entityType,
    entityId,
    name: response.name || null,
    status: response.status || null,
    effectiveStatus: response.effective_status || null,
    raw: response,
  };
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
    const campaign = await prisma.campaign.findUnique({
      where: { campaignId: adSet.campaign_id },
    });

    if (!campaign) continue;

    try {
      const rawBudget = adSet.daily_budget ?? adSet.lifetime_budget ?? null;
      const parsedBudget =
        rawBudget !== null && rawBudget !== undefined && rawBudget !== ''
          ? parseFloat(rawBudget)
          : null;

      await prisma.adSet.upsert({
        where: { adSetId: adSet.id },
        update: {
          name: adSet.name,
          status: adSet.status,
          budget: Number.isNaN(parsedBudget) ? null : parsedBudget,
          bidStrategy: adSet.bid_strategy || null,
          updatedTime: new Date(adSet.updated_time),
        },
        create: {
          adAccountId,
          campaignId: campaign.id,
          adSetId: adSet.id,
          name: adSet.name,
          status: adSet.status,
          budget: Number.isNaN(parsedBudget) ? null : parsedBudget,
          bidStrategy: adSet.bid_strategy || null,
          createdTime: new Date(adSet.created_time),
          updatedTime: new Date(adSet.updated_time),
        },
      });

      stats.adSets++;
    } catch (error) {
      console.error('Failed to upsert adset:', {
        adSetId: adSet.id,
        name: adSet.name,
        daily_budget: adSet.daily_budget,
        lifetime_budget: adSet.lifetime_budget,
        bid_strategy: adSet.bid_strategy,
        error: error.message,
      });
      throw error;
    }
  }
  
  // Синхронизируем объявления
  const ads = await facebookApiRequest(`/${fbAccountId}/ads`, accessToken, {
    fields: 'id,name,adset_id,status,created_time,updated_time',
    limit: 100,
  });
  
  for (const ad of ads.data || []) {
    const adSet = await prisma.adSet.findUnique({
      where: { adSetId: ad.adset_id },
    });
    
    if (adSet) {
      await prisma.ad.upsert({
        where: { adId: ad.id },
        update: {
          name: ad.name,
          status: ad.status,
          creativeUrl: null,
          updatedTime: new Date(ad.updated_time),
        },
        create: {
          adAccountId,
          adSetId: adSet.id,
          adId: ad.id,
          name: ad.name,
          status: ad.status,
          creativeUrl: null,
          createdTime: new Date(ad.created_time),
          updatedTime: new Date(ad.updated_time),
        },
      });
      stats.ads++;
    }
  }
  
  // Синхронизируем метрики Today
  const metricsStats = await syncMetrics(adAccountId, accessToken);
  stats.metrics = metricsStats;

  await prisma.adAccount.update({
    where: { id: adAccountId },
    data: { lastSyncedAt: new Date() },
  });
  
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

  const todayRange = getTodayDateRange();
  const timeRange = {
    since: todayRange.since,
    until: todayRange.until,
  };
  const snapshotDate = todayRange.date;

  await prisma.metricSnapshot.deleteMany({
    where: {
      adAccountId,
      date: snapshotDate,
    },
  });
  
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
      await saveMetrics(
        adAccountId,
        'account',
        fbAccountId,
        accountInsights.data[0]?.account_name || 'Account',
        insight,
        snapshotDate
      );
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
      await saveMetrics(adAccountId, 'campaign', insight.campaign_id, insight.campaign_name, insight, snapshotDate);
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
      await saveMetrics(adAccountId, 'adset', insight.adset_id, insight.adset_name, insight, snapshotDate);
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
      await saveMetrics(adAccountId, 'ad', insight.ad_id, insight.ad_name, insight, snapshotDate);
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
  const actions = insight.actions || [];

  const leadsRaw = actions.find(a => a.action_type === 'lead')?.value ?? 0;
  const conversionsRaw = actions.find(a => a.action_type === 'offsite_conversion')?.value ?? 0;

  const leads = parseInt(leadsRaw, 10) || 0;
  const conversions = parseInt(conversionsRaw, 10) || 0;
  
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
      impressions: parseInt(insight.impressions, 10) || 0,
      clicks: parseInt(insight.clicks, 10) || 0,
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

  const updateResponse = await axios.post(`https://graph.facebook.com/${config.facebook.apiVersion}/${entityId}`, {
    status,
  }, {
    params: { access_token: accessToken },
  });

  let verifiedState = null;
  let verified = false;
  let verificationError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) {
        await sleep(1000);
      }

      verifiedState = await fetchEntityState(entityType, entityId, adAccountId);

      const currentStatus = verifiedState.status;
      const effectiveStatus = verifiedState.effectiveStatus;

      if (currentStatus === status || effectiveStatus === status) {
        verified = true;
        break;
      }
    } catch (error) {
      verificationError = error.message;
    }
  }

  console.log('[FB] updateEntityStatus result:', JSON.stringify({
    entityType,
    entityId,
    requestedStatus: status,
    apiResponse: updateResponse?.data || null,
    verified,
    verifiedState,
    verificationError,
  }));

  if (!verified) {
    throw new Error(
      `Status verification failed. Requested=${status}, actual=${verifiedState?.status || 'unknown'}, effective=${verifiedState?.effectiveStatus || 'unknown'}${verificationError ? `, verificationError=${verificationError}` : ''}`
    );
  }
  
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

  return {
    ok: true,
    requestedStatus: status,
    verified,
    status: verifiedState?.status || null,
    effectiveStatus: verifiedState?.effectiveStatus || null,
    name: verifiedState?.name || null,
    apiResponse: updateResponse?.data || null,
  };
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
  
  await prisma.adSet.update({
    where: { adSetId },
    data: { budget },
  });
}

export default {
  syncAccountData,
  updateEntityStatus,
  updateAdSetBudget,
};","display_url":"https://github.com/Underdog-000/fbproai/commit/0657a349d673971fb06bef02357f6dc88b035c46","display_title":"Verify Meta status after rule actions and add detailed cron logs"}
