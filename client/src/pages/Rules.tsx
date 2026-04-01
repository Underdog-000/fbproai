import { Link } from 'react-router-dom'
import React, { useContext, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings,
  Loader2,
  Plus,
  Play,
  Pause,
  Clock,
  Zap,
  RefreshCw,
  Trash2,
  Target,
  DollarSign,
  Percent,
} from 'lucide-react'
import { ApiContext } from '../App'

const Rules: React.FC = () => {
  const api = useContext(ApiContext)
  const queryClient = useQueryClient()

  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null)

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get('/accounts')
      return response.data
    },
  })

  const { data: templatesData, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ['rule-templates'],
    queryFn: async () => {
      const response = await api.get('/rule-templates')
      return response.data
    },
  })

  const {
    data: campaignRulesData,
    isLoading: campaignRulesLoading,
    refetch: refetchCampaignRules,
  } = useQuery({
    queryKey: ['campaign-rules'],
    queryFn: async () => {
      const response = await api.get('/campaign-rules')
      return response.data
    },
  })

  const connections = accountsData?.connections || []

  const allAccounts = useMemo(
    () => connections.flatMap((connection: any) => connection.adAccounts || []),
    [connections]
  )

  const templates = templatesData?.templates || []
  const campaignRules = campaignRulesData?.campaignRules || []

  const createTemplateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post('/rule-templates', payload)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rule-templates'] })
      alert('Шаблон создан')
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка создания шаблона'
      alert(message)
    },
  })

  const applyTemplateMutation = useMutation({
    mutationFn: async ({
      templateId,
      payload,
    }: {
      templateId: string
      payload: any
    }) => {
      const response = await api.post(`/rule-templates/${templateId}/apply`, payload)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['campaign-rules'] })
      alert('Шаблон применён к кампании')
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка применения шаблона'
      alert(message)
    },
  })

  const toggleCampaignRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await api.patch(`/campaign-rules/${ruleId}/toggle`)
      return response.data
    },
    onSuccess: async () => {
      setTogglingRuleId(null)
      await queryClient.invalidateQueries({ queryKey: ['campaign-rules'] })
      alert('Статус campaign rule обновлён')
    },
    onError: (error: any) => {
      setTogglingRuleId(null)
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка обновления campaign rule'
      alert(message)
    },
  })

  const deleteCampaignRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await api.delete(`/campaign-rules/${ruleId}`)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['campaign-rules'] })
      alert('Campaign rule удалён')
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка удаления campaign rule'
      alert(message)
    },
  })

  const handleRefresh = async () => {
    await Promise.all([refetchTemplates(), refetchCampaignRules()])
    alert('Данные обновлены')
  }

  const handleCreateTemplate = () => {
    const name = window.prompt('Название шаблона', 'Bruno / ROI 50 / pause adset')
    if (!name) return

    const offerName = window.prompt('Оффер', 'Bruno')
    if (!offerName) return

    const payoutInput = window.prompt('Ставка / payout', '100')
    if (payoutInput === null || payoutInput === '') return

    const approveRateInput = window.prompt('Аппрув %', '20')
    if (approveRateInput === null || approveRateInput === '') return

    const targetRoiInput = window.prompt('Целевой ROI %', '50')
    if (targetRoiInput === null || targetRoiInput === '') return

    const actionScope = window.prompt('Scope: ad / adset', 'adset')
    if (!actionScope) return

    const actionType = window.prompt('Action: pause / enable', 'pause')
    if (!actionType) return

    const cooldownInput = window.prompt('Cooldown в минутах', '60')
    const cooldownMinutes = cooldownInput ? parseInt(cooldownInput, 10) : 60

    createTemplateMutation.mutate({
      name,
      offerName,
      payout: Number(payoutInput),
      approveRate: Number(approveRateInput),
      targetRoi: Number(targetRoiInput),
      actionScope,
      actionType,
      cooldownMinutes: Number.isNaN(cooldownMinutes) ? 60 : cooldownMinutes,
      sourceType: 'manual',
    })
  }

  const handleApplyTemplate = (template: any) => {
    if (!allAccounts.length) {
      alert('Сначала подключите рекламный аккаунт Facebook')
      return
    }

    const selectedAccountId = window.prompt(
      `ID аккаунта в системе (adAccount.id). Доступные:\n${allAccounts
        .map((a: any) => `${a.id} | ${a.name} | ${a.accountId}`)
        .join('\n')}`,
      allAccounts[0]?.id || ''
    )
    if (!selectedAccountId) return

    const campaignId = window.prompt('Facebook campaignId', '')
    if (!campaignId) return

    const campaignName = window.prompt('Название кампании', '')
    if (!campaignName) return

    applyTemplateMutation.mutate({
      templateId: template.id,
      payload: {
        adAccountId: selectedAccountId,
        campaignId,
        campaignName,
      },
    })
  }

  const handleToggleCampaignRule = (ruleId: string) => {
    if (togglingRuleId) return
    setTogglingRuleId(ruleId)
    toggleCampaignRuleMutation.mutate(ruleId)
  }

  const handleDeleteCampaignRule = (ruleId: string, campaignName?: string) => {
    const confirmed = window.confirm(
      `Удалить campaign rule${campaignName ? ` для "${campaignName}"` : ''}?`
    )

    if (confirmed) {
      deleteCampaignRuleMutation.mutate(ruleId)
    }
  }

  const isLoading = accountsLoading || templatesLoading || campaignRulesLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Правила</h1>
          <p className="text-gray-600 mt-1">ROI-шаблоны и применённые правила по кампаниям</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            className="btn-secondary flex items-center space-x-2"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>

          <button
            className="btn-primary flex items-center space-x-2"
            onClick={handleCreateTemplate}
            disabled={createTemplateMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            <span>Создать шаблон</span>
          </button>
        </div>
      </div>

      {allAccounts.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Сначала подключите рекламный аккаунт Facebook на странице{' '}
            <Link to="/accounts" className="font-medium underline">
              Аккаунты
            </Link>
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Шаблоны правил</h3>
              <span className="text-sm text-gray-500">{templates.length} шт.</span>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-10">
                <Zap className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Шаблонов пока нет</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {templates.map((template: any) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900">{template.name}</h4>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Settings className="h-4 w-4 mr-1" />
                            <span>{template.offerName}</span>
                          </div>
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            <span>Payout: {template.payout}</span>
                          </div>
                          <div className="flex items-center">
                            <Percent className="h-4 w-4 mr-1" />
                            <span>Approve: {template.approveRate}%</span>
                          </div>
                          <div className="flex items-center">
                            <Target className="h-4 w-4 mr-1" />
                            <span>ROI: {template.targetRoi}%</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>Cooldown: {template.cooldownMinutes} мин</span>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          Scope: {template.actionScope} | Action: {template.actionType} | Source:{' '}
                          {template.sourceType}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          className="btn-secondary"
                          onClick={() => handleApplyTemplate(template)}
                          disabled={applyTemplateMutation.isPending}
                        >
                          Применить к РК
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Применённые правила</h3>
              <span className="text-sm text-gray-500">{campaignRules.length} шт.</span>
            </div>

            {campaignRules.length === 0 ? (
              <div className="text-center py-10">
                <Settings className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Нет применённых правил</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {campaignRules.map((rule: any) => (
                  <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900">{rule.campaignName}</h4>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span>Campaign ID: {rule.campaignId}</span>
                          <span>Account: {rule.adAccount?.name || '—'}</span>
                          <span>Template: {rule.ruleTemplate?.name || '—'}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span>Payout: {rule.payout}</span>
                          <span>Approve: {rule.approveRate}%</span>
                          <span>ROI: {rule.targetRoi}%</span>
                          <span>Threshold CPL: {rule.calculatedCplThreshold}</span>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          Scope: {rule.actionScope} | Action: {rule.actionType} | Executions:{' '}
                          {rule._count?.executions || 0}
                        </div>
                        {rule.lastResult && (
                          <div className="mt-2 text-sm text-gray-500">Last result: {rule.lastResult}</div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          className="btn-secondary flex items-center space-x-2"
                          onClick={() => handleToggleCampaignRule(rule.id)}
                          disabled={togglingRuleId === rule.id}
                        >
                          {togglingRuleId === rule.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : rule.isActive ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          <span>{rule.isActive ? 'Пауза' : 'Запустить'}</span>
                        </button>

                        <button
                          className="btn-danger flex items-center space-x-2"
                          onClick={() => handleDeleteCampaignRule(rule.id, rule.campaignName)}
                          disabled={deleteCampaignRuleMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Удалить</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Информация</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Шаблон хранит offer, payout, approve rate и target ROI</li>
          <li>• Применённое правило работает на уровне конкретной кампании</li>
          <li>• Сейчас payout и approve rate вводятся вручную</li>
          <li>• Позже источник данных можно переключить на PP API</li>
        </ul>
      </div>
    </div>
  )
}

export default Rules
