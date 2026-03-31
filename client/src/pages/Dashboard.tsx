import React, { useContext, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  MousePointer,
  Target,
  RefreshCw
} from 'lucide-react'
import { ApiContext } from '../App'

// Компонент карточки метрики
const MetricCard: React.FC<{
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  color: string
}> = ({ title, value, change, icon, color }) => (
  <div className="metric-card">
    <div className="flex items-center justify-between">
      <div>
        <p className="dashboard-label">{title}</p>
        <p className="dashboard-stat">{value}</p>
        {change !== undefined && (
          <div className={`flex items-center mt-1 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        {icon}
      </div>
    </div>
  </div>
)

const Dashboard: React.FC = () => {
  const api = useContext(ApiContext)
  const queryClient = useQueryClient()
const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Запрос списка аккаунтов
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get('/accounts')
      return response.data
    },
  })
  
  // Запрос общей статистики (для первого аккаунта)
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['stats', accountsData?.accounts?.[0]?.accountId],
    queryFn: async () => {
      if (!accountsData?.accounts?.[0]?.accountId) return null
      const response = await api.get(`/accounts/${accountsData.accounts[0].accountId}/stats?days=7`)
      return response.data
    },
    enabled: !!accountsData?.accounts?.[0]?.accountId,
  })
  const currentAccountId = accountsData?.accounts?.[0]?.accountId
  const isLoading = accountsLoading || statsLoading
  const metrics = statsData?.metrics

  const handleRefresh = async () => {
  if (!currentAccountId || isRefreshing) return

  setIsRefreshing(true)

  try {
    await api.post(`/accounts/${currentAccountId}/sync`)
    await queryClient.invalidateQueries({ queryKey: ['accounts'] })
    await refetchStats()
    alert('Данные дашборда обновлены')
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Ошибка обновления дашборда'
    alert(message)
  } finally {
    setIsRefreshing(false)
  }
}
  
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
          <p className="text-gray-600 mt-1">Обзор ваших рекламных кампаний</p>
        </div>
        <button
  onClick={handleRefresh}
  className="btn-secondary flex items-center space-x-2"
  disabled={isLoading || isRefreshing || !currentAccountId}
>
  <RefreshCw className={`h-4 w-4 ${(isLoading || isRefreshing) ? 'animate-spin' : ''}`} />
  <span>Обновить</span>
</button>
      </div>
      
      {/* Аккаунты */}
      {!accountsLoading && accountsData?.accounts?.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            У вас пока нет подключенных аккаунтов. 
            <Link to="/accounts" className="font-medium underline ml-1">Подключить Facebook</Link>
          </p>
        </div>
      )}
      
      {/* Метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Расходы (7 дней)"
          value={metrics ? `$${metrics.totalSpend.toFixed(2)}` : '$0.00'}
          icon={<DollarSign className="h-6 w-6 text-white" />}
          color="bg-blue-500"
        />
        <MetricCard
          title="Лиды"
          value={metrics?.totalLeads || 0}
          icon={<Target className="h-6 w-6 text-white" />}
          color="bg-green-500"
        />
        <MetricCard
          title="CPL"
          value={metrics ? `$${metrics.avgCPL.toFixed(2)}` : '$0.00'}
          icon={<Users className="h-6 w-6 text-white" />}
          color="bg-purple-500"
        />
        <MetricCard
          title="ROAS"
          value={metrics ? `${metrics.roas.toFixed(2)}x` : '0.00x'}
          icon={<TrendingUp className="h-6 w-6 text-white" />}
          color="bg-orange-500"
        />
      </div>
      
      {/* Детальная статистика */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Левая колонка */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Основные показатели</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">Показы</span>
              <span className="font-medium">{metrics?.totalImpressions?.toLocaleString() || 0}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">Клики</span>
              <span className="font-medium">{metrics?.totalClicks?.toLocaleString() || 0}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">CTR</span>
              <span className="font-medium">{metrics?.avgCTR?.toFixed(2) || 0}%</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">CPC</span>
              <span className="font-medium">${metrics?.avgCPC?.toFixed(2) || 0}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-600">Конверсии</span>
              <span className="font-medium">{metrics?.totalConversions || 0}</span>
            </div>
          </div>
        </div>
        
        {/* Правая колонка */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Доходность</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">Доход</span>
              <span className="font-medium text-green-600">${metrics?.totalRevenue?.toFixed(2) || 0}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">ROI</span>
              <span className={`font-medium ${(metrics?.roi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics?.roi?.toFixed(2) || 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">Аппрувы</span>
              <span className="font-medium">{metrics?.totalApproves || 0}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">CPA</span>
              <span className="font-medium">${metrics?.avgCPA?.toFixed(2) || 0}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-600">Период</span>
              <span className="font-medium">{statsData?.period || '7 дней'}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Быстрые действия */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Быстрые действия</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a 
            href="/accounts" 
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="font-medium text-gray-900">Аккаунты</p>
              <p className="text-sm text-gray-500">Управление аккаунтами</p>
            </div>
          </a>
          <a 
            href="/campaigns" 
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <MousePointer className="h-8 w-8 text-green-500" />
            <div>
              <p className="font-medium text-gray-900">Кампании</p>
              <p className="text-sm text-gray-500">Просмотр кампаний</p>
            </div>
          </a>
          <a 
            href="/rules" 
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Target className="h-8 w-8 text-purple-500" />
            <div>
              <p className="font-medium text-gray-900">Правила</p>
              <p className="text-sm text-gray-500">Автоматизация</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
