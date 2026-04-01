import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authenticate)

/**
 * GET /api/campaign-rules
 * Получить все применённые campaign rules пользователя
 */
router.get('/', async (req, res) => {
  try {
    const campaignRules = await prisma.campaignRule.findMany({
      where: {
        adAccount: {
          facebookConnection: {
            userId: req.user.id,
          },
        },
      },
      include: {
        adAccount: {
          select: {
            id: true,
            accountId: true,
            name: true,
          },
        },
        ruleTemplate: {
          select: {
            id: true,
            name: true,
            offerName: true,
            sourceType: true,
          },
        },
        _count: {
          select: {
            executions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ campaignRules })
  } catch (error) {
    console.error('Get campaign rules error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get campaign rules',
    })
  }
})

/**
 * GET /api/campaign-rules/:id
 * Получить одно применённое правило
 */
router.get('/:id', async (req, res) => {
  try {
    const campaignRule = await prisma.campaignRule.findFirst({
      where: {
        id: req.params.id,
        adAccount: {
          facebookConnection: {
            userId: req.user.id,
          },
        },
      },
      include: {
        adAccount: {
          select: {
            id: true,
            accountId: true,
            name: true,
          },
        },
        ruleTemplate: true,
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!campaignRule) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Campaign rule not found',
      })
    }

    res.json({ campaignRule })
  } catch (error) {
    console.error('Get campaign rule error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get campaign rule',
    })
  }
})

/**
 * PATCH /api/campaign-rules/:id/toggle
 * Включить / выключить применённое правило
 */
router.patch('/:id/toggle', async (req, res) => {
  try {
    const campaignRule = await prisma.campaignRule.findFirst({
      where: {
        id: req.params.id,
        adAccount: {
          facebookConnection: {
            userId: req.user.id,
          },
        },
      },
    })

    if (!campaignRule) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Campaign rule not found',
      })
    }

    const updated = await prisma.campaignRule.update({
      where: { id: campaignRule.id },
      data: {
        isActive: !campaignRule.isActive,
      },
    })

    res.json({
      message: 'Campaign rule updated successfully',
      campaignRule: updated,
    })
  } catch (error) {
    console.error('Toggle campaign rule error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to toggle campaign rule',
    })
  }
})

/**
 * PATCH /api/campaign-rules/:id
 * Обновить applied rule
 */
router.patch('/:id', async (req, res) => {
  try {
    const campaignRule = await prisma.campaignRule.findFirst({
      where: {
        id: req.params.id,
        adAccount: {
          facebookConnection: {
            userId: req.user.id,
          },
        },
      },
    })

    if (!campaignRule) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Campaign rule not found',
      })
    }

    const {
      payout,
      approveRate,
      targetRoi,
      calculatedCplThreshold,
      actionScope,
      actionType,
      isActive,
      lastResult,
    } = req.body

    const updated = await prisma.campaignRule.update({
      where: { id: campaignRule.id },
      data: {
        payout: payout !== undefined ? Number(payout) : campaignRule.payout,
        approveRate:
          approveRate !== undefined
            ? Number(approveRate)
            : campaignRule.approveRate,
        targetRoi:
          targetRoi !== undefined
            ? Number(targetRoi)
            : campaignRule.targetRoi,
        calculatedCplThreshold:
          calculatedCplThreshold !== undefined
            ? Number(calculatedCplThreshold)
            : campaignRule.calculatedCplThreshold,
        actionScope: actionScope ?? campaignRule.actionScope,
        actionType: actionType ?? campaignRule.actionType,
        isActive:
          isActive !== undefined ? Boolean(isActive) : campaignRule.isActive,
        lastResult: lastResult !== undefined ? lastResult : campaignRule.lastResult,
        lastEvaluationAt: new Date(),
      },
    })

    res.json({
      message: 'Campaign rule updated successfully',
      campaignRule: updated,
    })
  } catch (error) {
    console.error('Update campaign rule error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update campaign rule',
    })
  }
})

/**
 * DELETE /api/campaign-rules/:id
 * Удалить applied rule и его executions
 */
router.delete('/:id', async (req, res) => {
  try {
    const campaignRule = await prisma.campaignRule.findFirst({
      where: {
        id: req.params.id,
        adAccount: {
          facebookConnection: {
            userId: req.user.id,
          },
        },
      },
    })

    if (!campaignRule) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Campaign rule not found',
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.campaignRuleExecution.deleteMany({
        where: { campaignRuleId: campaignRule.id },
      })

      await tx.campaignRule.delete({
        where: { id: campaignRule.id },
      })
    })

    res.json({
      message: 'Campaign rule deleted successfully',
    })
  } catch (error) {
    console.error('Delete campaign rule error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete campaign rule',
    })
  }
})

/**
 * GET /api/campaign-rules/:id/executions
 * История выполнения applied rule
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const campaignRule = await prisma.campaignRule.findFirst({
      where: {
        id: req.params.id,
        adAccount: {
          facebookConnection: {
            userId: req.user.id,
          },
        },
      },
    })

    if (!campaignRule) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Campaign rule not found',
      })
    }

    const executions = await prisma.campaignRuleExecution.findMany({
      where: { campaignRuleId: campaignRule.id },
      orderBy: { executedAt: 'desc' },
      take: 100,
    })

    res.json({ executions })
  } catch (error) {
    console.error('Get campaign rule executions error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get campaign rule executions',
    })
  }
})

export default router
