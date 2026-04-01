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
} from 'lucide-react'
import { ApiContext } from '../App'

const Campaigns: React.FC = () => {
  const api = useContext(ApiContext)
  const queryClient = useQueryClient()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>('')

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

  const connections = accountsData?.connections || []
  const templates = templatesData?.templates || []

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

  const handleRefresh = async () => {
    if (!selectedAdAccountId || isRefreshing) return

    setIsRefreshing(true)

    try {
      await api.post(`/accounts/${selectedAdAccountId}/sync`)
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
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

  const handleApplyTemplate = async (campaign: any) => {
    if (!selectedAdAccount) {
      alert('Сначала выберите рекламный аккаунт')
      return
    }

    if (!templates.length) {
      alert('Сначала создайте шаблон на странице Rules')
      return
    }

    const templateText = templates
      .map(
        (template: any, index: number) =>
          `${index + 1}. ${template.name} | ${template.offerName} | ROI ${template.targetRoi}%`
      )
      .join('\n')

    const selectedIndexInput = window.prompt(
      `Выберите номер шаблона:\n\n${templateText}`,
      '1'
    )

    if (!selectedIndexInput) return

    const selectedIndex = Number(selectedIndexInput) - 1
    const selectedTemplate = templates[selectedIndex]

    if (!selectedTemplate) {
      alert('Неверный номер шаблона')
      return
    }

    try {
      await api.post(`/rule-templates/${selectedTemplate.id}/apply`, {
        adAccountId: selectedAdAccount.id,
        campaignId: campaign.campaignId,
        campaignName: campaign.name,
      })

      alert(`Шаблон "${selectedTemplate.name}" применён к кампании "${campaign.name}"`)
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка применения шаблона'
      alert(message)
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
              {campaigns.map((campaign: any) => (
                <tr key={campaign.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <Megaphone className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="font-medium text-gray-900">{campaign.name}</span>
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
                      onClick={() => handleApplyTemplate(campaign)}
                      className="btn-secondary"
                    >
                      Применить шаблон
                    </button>
                  </td>
                </tr>
              ))}
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Информация</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Кампании загружаются из выбранного рекламного аккаунта</li>
          <li>• Шаблон применяется к конкретной кампании</li>
          <li>• Сейчас выбор шаблона сделан через prompt</li>
          <li>• Следующий шаг — нормальное окно выбора шаблона без prompt</li>
        </ul>
      </div>
    </div>
  )
}

export default Campaigns
