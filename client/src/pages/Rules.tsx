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
  X,
  CheckCircle2,
} from 'lucide-react'
import { ApiContext } from '../App'

type Notice = {
  type: 'success' | 'error'
  message: string
} | null

const defaultTemplateForm = {
  name: 'Bruno / ROI 50 / pause adset',
  offerName: 'Bruno',
  payout: '100',
  approveRate: '20',
  targetRoi: '50',
  actionScope: 'adset',
  actionType: 'pause',
  cooldownMinutes: '60',
}

const Rules: React.FC = () => {
  const api = useContext(ApiContext)
  const queryClient = useQueryClient()

  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState(defaultTemplateForm)

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null)
  const [applyForm, setApplyForm] = useState({
    adAccountId: '',
    campaignId: '',
    campaignName: '',
  })

  const [deleteRuleTarget, setDeleteRuleTarget] = useState<{ id: string; campaignName?: string } | null>(null)
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<{ id: string; name?: string } | null>(null)

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message })
  }

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

  const selectedApplyAccount = useMemo(
    () => allAccounts.find((account: any) => account.id === applyForm.adAccountId) || null,
    [allAccounts, applyForm.adAccountId]
  )

  const { data: applyAccountData, isLoading: applyCampaignsLoading } = useQuery({
    queryKey: ['rules-apply-campaigns', selectedApplyAccount?.accountId],
    queryFn: async () => {
      if (!selectedApplyAccount?.accountId) return null
      const response = await api.get(`/accounts/${selectedApplyAccount.accountId}`)
      return response.data
    },
    enabled: isApplyModalOpen && !!selectedApplyAccount?.accountId,
  })

  const availableCampaigns = applyAccountData?.account?.campaigns || []

  const createTemplateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post('/rule-templates', payload)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rule-templates'] })
      setIsCreateModalOpen(false)
      setTemplateForm(defaultTemplateForm)
      showNotice('success', 'Шаблон создан')
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка создания шаблона'
      showNotice('error', message)
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
      setIsApplyModalOpen(false)
      setSelectedTemplate(null)
      setApplyForm({ adAccountId: '', campaignId: '', campaignName: '' })
      showNotice('success', 'Шаблон применён к кампании')
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка применения шаблона'
      showNotice('error', message)
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
      showNotice('success', 'Статус campaign rule обновлён')
    },
    onError: (error: any) => {
      setTogglingRuleId(null)
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка обновления campaign rule'
      showNotice('error', message)
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await api.delete(`/rule-templates/${templateId}`)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rule-templates'] })
      setDeleteTemplateTarget(null)
      showNotice('success', 'Шаблон удалён')
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка удаления шаблона'
      showNotice('error', message)
    },
  })

  const deleteCampaignRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await api.delete(`/campaign-rules/${ruleId}`)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['campaign-rules'] })
      setDeleteRuleTarget(null)
      showNotice('success', 'Campaign rule удалён')
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка удаления campaign rule'
      showNotice('error', message)
    },
  })

  const handleRefresh = async () => {
    await Promise.all([refetchTemplates(), refetchCampaignRules()])
    showNotice('success', 'Данные обновлены')
  }

  const openCreateModal = () => {
    setNotice(null)
    setTemplateForm(defaultTemplateForm)
    setIsCreateModalOpen(true)
  }

  
  const submitCreateTemplate = () => {
    if (
      !templateForm.name ||
      !templateForm.offerName ||
      !templateForm.payout ||
      !templateForm.approveRate ||
      !templateForm.targetRoi ||
      !templateForm.actionScope ||
      !templateForm.actionType
    ) {
      showNotice('error', 'Заполните все обязательные поля шаблона')
      return
    }

    createTemplateMutation.mutate({
      name: templateForm.name,
      offerName: templateForm.offerName,
      payout: Number(templateForm.payout),
      approveRate: Number(templateForm.approveRate),
      targetRoi: Number(templateForm.targetRoi),
      actionScope: templateForm.actionScope,
      actionType: templateForm.actionType,
      cooldownMinutes: Number(templateForm.cooldownMinutes) || 60,
      sourceType: 'manual',
    })
  }

  const handleApplyTemplate = (template: any) => {
    if (!allAccounts.length) {
      showNotice('error', 'Сначала подключите рекламный аккаунт Facebook')
      return
    }

    setNotice(null)
    setSelectedTemplate(template)
    setApplyForm({
      adAccountId: allAccounts[0]?.id || '',
      campaignId: '',
      campaignName: '',
    })
    setIsApplyModalOpen(true)
  }

  const handleApplyAccountChange = (adAccountId: string) => {
    setApplyForm({
      adAccountId,
      campaignId: '',
      campaignName: '',
    })
  }

  const handleApplyCampaignChange = (campaignId: string) => {
    const campaign = availableCampaigns.find((item: any) => item.campaignId === campaignId)

    setApplyForm((prev) => ({
      ...prev,
      campaignId,
      campaignName: campaign?.name || '',
    }))
  }

  const submitApplyTemplate = () => {
    if (!selectedTemplate) return

    if (!applyForm.adAccountId || !applyForm.campaignId || !applyForm.campaignName) {
      showNotice('error', 'Выберите аккаунт и кампанию')
      return
    }

    applyTemplateMutation.mutate({
      templateId: selectedTemplate.id,
      payload: {
        adAccountId: applyForm.adAccountId,
        campaignId: applyForm.campaignId,
        campaignName: applyForm.campaignName,
      },
    })
  }

  const handleToggleCampaignRule = (ruleId: string) => {
    if (togglingRuleId) return
    setTogglingRuleId(ruleId)
    toggleCampaignRuleMutation.mutate(ruleId)
  }

  const handleDeleteCampaignRule = (ruleId: string, campaignName?: string) => {
    setDeleteRuleTarget({ id: ruleId, campaignName })
  }

  const handleDeleteTemplate = (template: any) => {
    if ((template._count?.campaignRules || 0) > 0) {
      showNotice('error', 'Нельзя удалить шаблон, который уже применён к кампаниям')
      return
    }

    setDeleteTemplateTarget({ id: template.id, name: template.name })
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
            onClick={openCreateModal}
            disabled={createTemplateMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            <span>Создать шаблон</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-lg border p-4 flex items-start justify-between gap-4 ${
            notice.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
            <p>{notice.message}</p>
          </div>
          <button onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                        <div className="mt-2 text-sm text-gray-500">
                          Применений: {template._count?.campaignRules || 0}
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

                        <button
                          className="btn-danger flex items-center space-x-2"
                          onClick={() => handleDeleteTemplate(template)}
                          disabled={deleteTemplateMutation.isPending}
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

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Создать шаблон</h3>
                <p className="text-sm text-gray-500 mt-1">Заполните ROI-параметры шаблона</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createTemplateMutation.isPending}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Название шаблона</label>
                <input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Оффер</label>
                <input
                  value={templateForm.offerName}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, offerName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payout</label>
                <input
                  value={templateForm.payout}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, payout: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Approve %</label>
                <input
                  value={templateForm.approveRate}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, approveRate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target ROI %</label>
                <input
                  value={templateForm.targetRoi}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, targetRoi: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
                <select
                  value={templateForm.actionScope}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, actionScope: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                >
                  <option value="ad">ad</option>
                  <option value="adset">adset</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <select
                  value={templateForm.actionType}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, actionType: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                >
                  <option value="pause">pause</option>
                  <option value="enable">enable</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cooldown, мин</label>
                <input
                  value={templateForm.cooldownMinutes}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, cooldownMinutes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createTemplateMutation.isPending}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={submitCreateTemplate}
                disabled={createTemplateMutation.isPending}
                className="btn-primary flex items-center space-x-2"
              >
                {createTemplateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Создать шаблон</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isApplyModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Применить шаблон</h3>
                <p className="text-sm text-gray-500 mt-1">Шаблон: {selectedTemplate.name}</p>
              </div>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                disabled={applyTemplateMutation.isPending}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Рекламный аккаунт</label>
                <select
                  value={applyForm.adAccountId}
                  onChange={(e) => handleApplyAccountChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                >
                  {allAccounts.map((account: any) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.accountId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Кампания из РК</label>
                <select
                  value={applyForm.campaignId}
                  onChange={(e) => handleApplyCampaignChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                  disabled={applyCampaignsLoading || availableCampaigns.length === 0}
                >
                  <option value="">
                    {applyCampaignsLoading
                      ? 'Загрузка кампаний...'
                      : availableCampaigns.length
                      ? 'Выберите кампанию'
                      : 'Нет кампаний'}
                  </option>
                  {availableCampaigns.map((campaign: any) => (
                    <option key={campaign.id} value={campaign.campaignId}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setIsApplyModalOpen(false)}
                disabled={applyTemplateMutation.isPending}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={submitApplyTemplate}
                disabled={applyTemplateMutation.isPending || !applyForm.campaignId}
                className="btn-primary flex items-center space-x-2"
              >
                {applyTemplateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Применить шаблон</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteRuleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Удалить правило</h3>
              <button
                onClick={() => setDeleteRuleTarget(null)}
                disabled={deleteCampaignRuleMutation.isPending}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Удалить campaign rule{deleteRuleTarget.campaignName ? ` для «${deleteRuleTarget.campaignName}»` : ''}?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setDeleteRuleTarget(null)}
                disabled={deleteCampaignRuleMutation.isPending}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={() => deleteCampaignRuleMutation.mutate(deleteRuleTarget.id)}
                disabled={deleteCampaignRuleMutation.isPending}
                className="btn-danger flex items-center space-x-2"
              >
                {deleteCampaignRuleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Удалить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTemplateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Удалить шаблон</h3>
              <button
                onClick={() => setDeleteTemplateTarget(null)}
                disabled={deleteTemplateMutation.isPending}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Удалить шаблон{deleteTemplateTarget.name ? ` «${deleteTemplateTarget.name}»` : ''}?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setDeleteTemplateTarget(null)}
                disabled={deleteTemplateMutation.isPending}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={() => deleteTemplateMutation.mutate(deleteTemplateTarget.id)}
                disabled={deleteTemplateMutation.isPending}
                className="btn-danger flex items-center space-x-2"
              >
                {deleteTemplateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Удалить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Информация</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Шаблон хранит offer, payout, approve rate и target ROI</li>
          <li>• Применённое правило работает на уровне конкретной кампании</li>
          <li>• Для применения из Rules теперь выбирается реальная кампания из РК</li>
          <li>• Один и тот же шаблон нельзя повесить на одну и ту же кампанию дважды</li>
        </ul>
      </div>
    </div>
  )
}

export default Rules
