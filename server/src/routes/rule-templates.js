import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authenticate)

function calculateCplThreshold(payout, approveRate, targetRoi) {
  const payoutNum = Number(payout)
  const approveRateNum = Number(approveRate)
  const targetRoiNum = Number(targetRoi)

  if (
    Number.isNaN(payoutNum) ||
    Number.isNaN(approveRateNum) ||
    Number.isNaN(targetRoiNum) ||
    payoutNum <= 0 ||
    approveRateNum < 0
  ) {
    return 0
  }

  const breakEvenCpl = payoutNum * (approveRateNum / 100)
  const threshold = breakEvenCpl / (1 + targetRoiNum / 100)

  return Number.isFinite(threshold) ? Number(threshold.toFixed(4)) : 0
}

/**
 * GET /api/rule-templates
 * Список шаблонов правил пользователя
 */
router.get('/', async (req, res) => {
  try {
    const templates = await prisma.ruleTemplate.findMany({
      where: { userId: req.user.id },
      include: {
        _count: {
          select: {
            campaignRules: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ templates })
  } catch (error) {
    console.error('Get rule templates error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get rule templates',
    })
  }
})

/**
 * POST /api/rule-templates
 * Создать шаблон правила
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      offerName,
      payout,
      approveRate,
      targetRoi,
      actionScope,
      actionType,
      cooldownMinutes,
      sourceType,
      externalOfferId,
      notes,
    } = req.body

    if (
      !name ||
      !offerName ||
      payout === undefined ||
      approveRate === undefined ||
      targetRoi === undefined ||
      !actionScope ||
      !actionType
    ) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Missing required fields',
      })
    }

    const template = await prisma.ruleTemplate.create({
      data: {
        userId: req.user.id,
        name,
        offerName,
        payout: Number(payout),
        approveRate: Number(approveRate),
        targetRoi: Number(targetRoi),
        actionScope,
        actionType,
        cooldownMinutes: cooldownMinutes ? Number(cooldownMinutes) : 60,
        sourceType: sourceType || 'manual',
        externalOfferId: externalOfferId || null,
        notes: notes || null,
      },
    })

    res.json({
      message: 'Rule template created successfully',
      template,
    })
  } catch (error) {
    console.error('Create rule template error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create rule template',
    })
  }
})

/**
 * PATCH /api/rule-templates/:templateId
 * Обновить шаблон правила
 */
router.patch('/:templateId', async (req, res) => {
  try {
    const existingTemplate = await prisma.ruleTemplate.findUnique({
      where: { id: req.params.templateId },
    })

    if (!existingTemplate) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Rule template not found',
      })
    }

    if (existingTemplate.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied',
      })
    }

    const {
      name,
      offerName,
      payout,
      approveRate,
      targetRoi,
      actionScope,
      actionType,
      cooldownMinutes,
      isActive,
      sourceType,
      externalOfferId,
      notes,
    } = req.body

    const template = await prisma.ruleTemplate.update({
      where: { id: existingTemplate.id },
      data: {
        name: name ?? existingTemplate.name,
        offerName: offerName ?? existingTemplate.offerName,
        payout: payout !== undefined ? Number(payout) : existingTemplate.payout,
        approveRate:
          approveRate !== undefined
            ? Number(approveRate)
            : existingTemplate.approveRate,
        targetRoi:
          targetRoi !== undefined
            ? Number(targetRoi)
            : existingTemplate.targetRoi,
        actionScope: actionScope ?? existingTemplate.actionScope,
        actionType: actionType ?? existingTemplate.actionType,
        cooldownMinutes:
          cooldownMinutes !== undefined
            ? Number(cooldownMinutes)
            : existingTemplate.cooldownMinutes,
        isActive:
          isActive !== undefined ? Boolean(isActive) : existingTemplate.isActive,
        sourceType: sourceType ?? existingTemplate.sourceType,
        externalOfferId:
          externalOfferId !== undefined
            ? externalOfferId || null
            : existingTemplate.externalOfferId,
        notes: notes !== undefined ? notes || null : existingTemplate.notes,
      },
    })

    res.json({
      message: 'Rule template updated successfully',
      template,
    })
  } catch (error) {
    console.error('Update rule template error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update rule template',
    })
  }
})

/**
 * DELETE /api/rule-templates/:templateId
 * Удалить шаблон правила
 */
router.delete('/:templateId', async (req, res) => {
  try {
    const existingTemplate = await prisma.ruleTemplate.findUnique({
      where: { id: req.params.templateId },
      include: {
        _count: {
          select: {
            campaignRules: true,
          },
        },
      },
    })

    if (!existingTemplate) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Rule template not found',
      })
    }

    if (existingTemplate.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied',
      })
    }

    if (existingTemplate._count.campaignRules > 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Cannot delete template that is already applied to campaigns',
      })
    }

    await prisma.ruleTemplate.delete({
      where: { id: existingTemplate.id },
    })

    res.json({
      message: 'Rule template deleted successfully',
    })
  } catch (error) {
    console.error('Delete rule template error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete rule template',
    })
  }
})

/**
 * POST /api/rule-templates/:templateId/apply
 * Применить шаблон к конкретной кампании
 */
router.post('/:templateId/apply', async (req, res) => {
  try {
    const { adAccountId, campaignId, campaignName } = req.body

    if (!adAccountId || !campaignId || !campaignName) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'adAccountId, campaignId and campaignName are required',
      })
    }

    const template = await prisma.ruleTemplate.findUnique({
      where: { id: req.params.templateId },
    })

    if (!template) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Rule template not found',
      })
    }

    if (template.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied',
      })
    }

    const adAccount = await prisma.adAccount.findFirst({
      where: {
        id: adAccountId,
        facebookConnection: {
          userId: req.user.id,
        },
      },
    })

    if (!adAccount) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ad account not found or access denied',
      })
    }

    const calculatedCplThreshold = calculateCplThreshold(
      template.payout,
      template.approveRate,
      template.targetRoi
    )

    const campaignRule = await prisma.campaignRule.create({
      data: {
        adAccountId,
        campaignId,
        campaignName,
        ruleTemplateId: template.id,
        payout: template.payout,
        approveRate: template.approveRate,
        targetRoi: template.targetRoi,
        calculatedCplThreshold,
        actionScope: template.actionScope,
        actionType: template.actionType,
        isActive: true,
      },
    })

    res.json({
      message: 'Template applied successfully',
      campaignRule,
    })
  } catch (error) {
    console.error('Apply rule template error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to apply rule template',
    })
  }
})

export default router
