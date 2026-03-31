import React, { useContext, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { 
  Megaphone, 
  Loader2, 
  Play, 
  Pause, 
  DollarSign,
  Target,
  TrendingUp,
  RefreshCw
} from 'lucide-react'
import { ApiContext } from '../App'

const Campaigns: React.FC = () => {
  const api = useContext(ApiContext)
  const queryClient = useQueryClient()
const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Запрос списка аккаунтов
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get('/accounts')
      return response.data
    },
  })
  
  // Запрос кампаний для первого аккаунта
  const accountId = accountsData?.accounts?.[0]?.accountId
  const { data: accountData, isLoading, refetch } = useQuery({
    queryKey: ['campaigns', accountId],
    queryFn: async () => {
      if (!accountId) return null
      const response = await api.get(`/accounts/${accountId}`)
      return response.data
    },
    enabled: !!accountId,
  })
  
  const campaigns = accountData?.account?.campaigns || []
  const handleRefresh = async () => {
  if (!accountId || isRefreshing) return

  setIsRefreshing(true)

  try {
    await api.post(`/accounts/${accountId}/sync`)
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
  
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'ACTIVE': { label: 'Активна', color: 'bg-green-100 text-green-800' },
      'PAUSED': { label: 'Приостановлена', color: 'bg-yellow-100 text-yellow-800' },
      'DELETED': { label: 'Удалена', color: 'bg-red-100 text-red-800' },
    }
    const { label, color } = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{label}</span>
  }
  
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Кампании</h1>
          <p className="text-gray-600 mt-1">Просмотр рекламных кампаний</p>
        </div>
        <button
  onClick={handleRefresh}
  className="btn-secondary flex items-center space-x-2"
  disabled={isLoading || isRefreshing || !accountId}
>
  <RefreshCw className={`h-4 w-4 ${(isLoading || isRefreshing) ? 'animate-spin' : ''}`} />
  <span>Обновить</span>
</button>
      </div>
      
      {/* Информация об аккаунте */}
      {!accountId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Сначала подключите рекламный аккаунт Facebook на странице{' '}
            <Link to="/accounts" className="font-medium underline">Аккаунты</Link>
          </p>
        </div>
      )}
      
      {/* Список кампаний */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Megaphone className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Нет кампаний</h3>
          <p className="text-gray-500">
            {accountId 
              ? 'Кампании не найдены в этом аккаунте' 
              : 'Подключите аккаунт для просмотра кампаний'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Название</th>
                <th className="table-header">Статус</th>
                <th className="table-header">Цель</th>
                <th className="table-header">Создана</th>
                <th className="table-header">Обновлена</th>
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
                  <td className="table-cell">
                    {getStatusBadge(campaign.status)}
                  </td>
                  <td className="table-cell text-gray-500">
                    {campaign.objective || '—'}
                  </td>
                  <td className="table-cell text-gray-500">
                    {new Date(campaign.createdTime).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="table-cell text-gray-500">
                    {new Date(campaign.updatedTime).toLocaleDateString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Статистика */}
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
                  {campaigns.filter((c: any) => c.status === 'ACTIVE').length}
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
                  {campaigns.filter((c: any) => c.status === 'PAUSED').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Информация */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Информация</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Кампании синхронизируются из Facebook автоматически</li>
          <li>• Управление кампаниями осуществляется через Facebook Ads Manager</li>
          <li>• Статистика обновляется каждые 6 часов</li>
        </ul>
      </div>
    </div>
  )
}

export default Campaigns
