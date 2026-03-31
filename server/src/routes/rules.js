import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, checkAccountOwnership } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /api/rules/:accountId
 * Получить список правил аккаунта
 */
router.get('/:accountId', checkAccountOwnership, async (req, res) => {
  try {
    const rules = await prisma.rule.findMany({
      where: { adAccountId: req.adAccount.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ rules });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get rules',
    });
  }
});

/**
 * PATCH /api/rules/:ruleId/toggle
 * Переключить активность правила
 */
router.patch('/:ruleId/toggle', async (req, res) => {
  try {
    const rule = await prisma.rule.findUnique({
      where: { id: req.params.ruleId },
      include: {
        adAccount: true,
      },
    });

    if (!rule) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Rule not found',
      });
    }

    if (rule.adAccount.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied',
      });
    }

    const updatedRule = await prisma.rule.update({
      where: { id: rule.id },
      data: { isActive: !rule.isActive },
    });

    res.json({
      message: 'Rule updated successfully',
      rule: updatedRule,
    });
  } catch (error) {
    console.error('Toggle rule error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to toggle rule',
    });
  }
});

export default router;
