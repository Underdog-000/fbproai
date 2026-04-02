import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Megaphone,
  Loader2,
  Play,
  Pause,
  RefreshCw,
  Facebook,
  CheckCircle2,
  X,
  Settings,
  DollarSign,
  Percent,
  Target,
  Clock,
} from 'lucide-react'
import { ApiContext } from '../App'

const Campaigns: React.FC = () => {
  const api = useContext(ApiContext)
  const queryClient = useQueryClient()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>('')

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [selectedCampaignForTemplate, setSelectedCampaignForTemplate] = useState<any | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get('/accounts')
      return response.data
    },
  })

  const { data: templatesData } = useQuery({
    queryKey: ['rule-templates'],
    queryFn: async () => {
      const response = await api.get('/rule-templates')
      return response.data
    },
  })

  const { data: campaignRulesData } = useQuery({
    queryKey: ['campaign-rules'],
    queryFn: async () => {
      const response = await api.get('/campaign-rules')
      return response.data
    },
  })

  const connections = accountsData?.connections || []
  const templates = templatesData?.templates || []
  const campaignRules = campaignRulesData?.campaignRules || []

  useEffect(() => {
    if (!connections.length) {
      setSelectedConnectionId('')
      setSelectedAdAccountId('')
      return
    }

    if (!selectedConnectionId) {
      const firstConnection = connections[0]
      setSelectedConnectionId(firstConnection.id)

      const firstAdAccount = firstConnection.adAccounts?.[0]
      setSelectedAdAccountId(firstAdAccount?.accountId || '')
      return
    }

    const currentConnection = connections.find(
      (connection: any) => connection.id === selectedConnectionId
    )

    if (!currentConnection) {
      const firstConnection = connections[0]
      setSelectedConnectionId(firstConnection.id)
      setSelectedAdAccountId(firstConnection.adAccounts?.[0]?.accountId || '')
      return
    }

    const hasSelectedAccount = currentConnection.adAccounts?.some(
      (account: any) => account.accountId === selectedAdAccountId
    )

    if (!hasSelectedAccount) {
      setSelectedAdAccountId(currentConnection.adAccounts?.[0]?.accountId || '')
    }
  }, [connections, selectedConnectionId, selectedAdAccountId])

  const selectedConnection = useMemo(
    () =>
      connections.find((connection: any) => connection.id === selectedConnectionId) ||
      null,
    [connections, selectedConnectionId]
  )

  const selectedAdAccounts = selectedConnection?.adAccounts || []

  const selectedAdAccount = useMemo(
    () =>
      selectedAdAccounts.find(
        (account: any) => account.accountId === selectedAdAccountId
      ) || null,
    [selectedAdAccounts, selectedAdAccountId]
  )

  const {
    data: accountData,
    isLoading: campaignsLoading,
    refetch,
  } = useQuery({
    queryKey: ['campaigns', selectedAdAccountId],
    queryFn: async () => {
      if (!selectedAdAccountId) return null
      const response = await api.get(`/accounts/${selectedAdAccountId}`)
      return response.data
    },
    enabled: !!selectedAdAccountId,
  })

  const campaigns = accountData?.account?.campaigns || []

  const appliedRulesByCampaignId = useMemo(() => {
    if (!selectedAdAccount?.id) return new Map<string, number>()

    return campaignRules.reduce((acc: Map<string, number>, rule: any) => {
      if (rule.adAccount?.id === selectedAdAccount.id) {
        acc.set(rule.campaignId, (acc.get(rule.campaignId) || 0) + 1)
      }
      return acc
    }, new Map<string, number>())
  }, [campaignRules, selectedAdAccount?.id])

  const handleRefresh = async () => {
    if (!selectedAdAccountId || isRefreshing) return

    setIsRefreshing(true)

    try {
      await api.post(`/accounts/${selectedAdAccountId}/sync`)
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      await queryClient.invalidateQueries({ queryKey: ['campaign-rules'] })
      await refetch()
      alert('Кампании обновлены')
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка обновления кампаний'
      alert(message)
    } finally {
      setIsRefreshing(false)
    }
  }

  const openTemplateModal = (campaign: any) => {
    if (!selectedAdAccount) {
      alert('Сначала выберите рекламный аккаунт')
      return
    }

    if (!templates.length) {
      alert('Сначала создайте шаблон на странице Rules')
      return
    }

    setSelectedCampaignForTemplate(campaign)
    setSelectedTemplateId(templates[0]?.id || '')
    setIsTemplateModalOpen(true)
  }

  const closeTemplateModal = () => {
    if (isApplyingTemplate) return
    setIsTemplateModalOpen(false)
    setSelectedCampaignForTemplate(null)
    setSelectedTemplateId('')
  }

  const handleApplyTemplate = async () => {
    if (!selectedCampaignForTemplate || !selectedAdAccount || !selectedTemplateId) {
      return
    }

    setIsApplyingTemplate(true)

    try {
      const selectedTemplate = templates.find(
        (template: any) => template.id === selectedTemplateId
      )

      await api.post(`/rule-templates/${selectedTemplateId}/apply`, {
        adAccountId: selectedAdAccount.id,
        campaignId: selectedCampaignForTemplate.campaignId,
        campaignName: selectedCampaignForTemplate.name,
      })

      await queryClient.invalidateQueries({ queryKey: ['campaign-rules'] })

      alert(
        `Шаблон "${selectedTemplate?.name || 'Template'}" применён к кампании "${selectedCampaignForTemplate.name}"`
      )

      closeTemplateModal()
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка применения шаблона'
      alert(message)
    } finally {
      setIsApplyingTemplate(false)
    }
  }

  const handleConnectionChange = (connectionId: string) => {
    setSelectedConnectionId(connectionId)

    const connection = connections.find((item: any) => item.id === connectionId)
    const firstAdAccount = connection?.adAccounts?.[0]

    setSelectedAdAccountId(firstAdAccount?.accountId || '')
  }

  const handleAdAccountChange = (accountId: string) => {
    setSelectedAdAccountId(accountId)
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      ACTIVE: { label: 'Активна', color: 'bg-green-100 text-green-800' },
      PAUSED: { label: 'Приостановлена', color: 'bg-yellow-100 text-yellow-800' },
      DELETED: { label: 'Удалена', color: 'bg-red-100 text-red-800' },
    }

    const { label, color } = statusMap[status] || {
      label: status,
      color: 'bg-gray-100 text-gray-800',
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    )
  }

  const isLoading = accountsLoading || campaignsLoading

  const selectedTemplate = templates.find(
    (template: any) => template.id === selectedTemplateId
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Кампании</h1>
          <p className="text-gray-600 mt-1">
            Просмотр кампаний и применение rule templates
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="btn-secondary flex items-center space-x-2"
          disabled={isLoading || isRefreshing || !selectedAdAccountId}
        >
          <RefreshCw
            className={`h-4 w-4 ${(isLoading || isRefreshing) ? 'animate-spin' : ''}`}
          />
          <span>Обновить</span>
        </button>
      </div>

      {connections.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Сначала подключите рекламный аккаунт Facebook на странице{' '}
            <Link to="/accounts" className="font-medium underline">
              Аккаунты
            </Link>
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Подключение Facebook
              </label>
              <select
                value={selectedConnectionId}
                onChange={(e) => handleConnectionChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
              >
                {connections.map((connection: any) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.facebookName} ({connection.adAccounts?.length || 0} акк.)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Рекламный аккаунт
              </label>
              <select
                value={selectedAdAccountId}
                onChange={(e) => handleAdAccountChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                disabled={!selectedAdAccounts.length}
              >
                {selectedAdAccounts.length === 0 ? (
                  <option value="">Нет аккаунтов</option>
                ) : (
                  selectedAdAccounts.map((account: any) => (
                    <option key={account.id} value={account.accountId}>
                      {account.name} ({account.accountId})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {selectedConnection && (
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center">
                <Facebook className="h-4 w-4 mr-1" />
                <span>{selectedConnection.facebookName}</span>
              </div>
              {selectedAdAccount && (
                <div className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  <span>{selectedAdAccount.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : !selectedAdAccountId ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Megaphone className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Аккаунт не выбран
          </h3>
          <p className="text-gray-500">
            Выберите рекламный аккаунт для просмотра кампаний
          </p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Megaphone className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет кампаний</h3>
          <p className="text-gray-500">
            Кампании не найдены в выбранном аккаунте
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Название</th>
                <th className="table-header">ID кампании</th>
                <th className="table-header">Статус</th>
                <th className="table-header">Цель</th>
                <th className="table-header">Обновлена</th>
                <th className="table-header">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign: any) => {
                const appliedRulesCount = appliedRulesByCampaignId.get(campaign.campaignId) || 0

                return (
                  <tr key={campaign.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <Megaphone className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <span className="font-medium text-gray-900">{campaign.name}</span>
                          {appliedRulesCount > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              Уже есть applied rules: {appliedRulesCount}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500">
                      {campaign.campaignId}
                    </td>
                    <td className="table-cell">
                      {getStatusBadge(campaign.status)}
                    </td>
                    <td className="table-cell text-gray-500">
                      {campaign.objective || '—'}
                    </td>
                    <td className="table-cell text-gray-500">
                      {new Date(campaign.updatedTime).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => openTemplateModal(campaign)}
                        className="btn-secondary"
                      >
                        {appliedRulesCount > 0 ? 'Добавить ещё шаблон' : 'Применить шаблон'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Megaphone className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Всего кампаний</p>
                <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg">
                <Play className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Активных</p>
                <p className="text-2xl font-bold text-gray-900">
                  {campaigns.filter((campaign: any) => campaign.status === 'ACTIVE').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Pause className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Приостановленных</p>
                <p className="text-2xl font-bold text-gray-900">
                  {campaigns.filter((campaign: any) => campaign.status === 'PAUSED').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTemplateModalOpen && selectedCampaignForTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Применить шаблон
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Кампания: {selectedCampaignForTemplate.name}
                </p>
              </div>

              <button
                onClick={closeTemplateModal}
                disabled={isApplyingTemplate}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите шаблон
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
                >
                  {templates.map((template: any) => (
                    <option key={template.id} value={template.id}>
                      {template.name} | {template.offerName} | ROI {template.targetRoi}%
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate && (
                <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <h4 className="text-base font-semibold text-gray-900">
                    {selectedTemplate.name}
                  </h4>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Settings className="h-4 w-4 mr-1" />
                      <span>{selectedTemplate.offerName}</span>
                    </div>

                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      <span>Payout: {selectedTemplate.payout}</span>
                    </div>

                    <div className="flex items-center">
                      <Percent className="h-4 w-4 mr-1" />
                      <span>Approve: {selectedTemplate.approveRate}%</span>
                    </div>

                    <div className="flex items-center">
                      <Target className="h-4 w-4 mr-1" />
                      <span>ROI: {selectedTemplate.targetRoi}%</span>
                    </div>

                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>Cooldown: {selectedTemplate.cooldownMinutes} мин</span>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    Scope: {selectedTemplate.actionScope} | Action: {selectedTemplate.actionType} | Source: {selectedTemplate.sourceType}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={closeTemplateModal}
                disabled={isApplyingTemplate}
                className="btn-secondary"
              >
                Отмена
              </button>

              <button
                onClick={handleApplyTemplate}
                disabled={!selectedTemplateId || isApplyingTemplate}
                className="btn-primary flex items-center space-x-2"
              >
                {isApplyingTemplate && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span>Применить шаблон</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Информация</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Кампании загружаются из выбранного рекламного аккаунта</li>
          <li>• Шаблон применяется к конкретной кампании</li>
          <li>• Выбор шаблона теперь делается через modal</li>
          <li>• Если на кампании уже есть applied rule, это видно прямо в списке</li>
        </ul>
      </div>
    </div>
  )
}

export default Campaigns
