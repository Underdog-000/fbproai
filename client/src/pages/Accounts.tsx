import React, { useContext, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Facebook,
  Plus,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  CreditCard,
  Bot,
  Users,
} from 'lucide-react'
import { ApiContext, AuthContext } from '../App'

const Accounts: React.FC = () => {
  const api = useContext(ApiContext)
  const { user } = useContext(AuthContext)
  const queryClient = useQueryClient()

  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null)
  const [isSyncingAll, setIsSyncingAll] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get('/accounts')
      return response.data
    },
  })

  const connections = data?.connections || []

  const allAccounts = useMemo(
    () => connections.flatMap((connection: any) => connection.adAccounts || []),
    [connections]
  )

  const syncMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await api.post(`/accounts/${accountId}/sync`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setSyncingId(null)
      alert('Синхронизация завершена')
    },
    onError: (error: any) => {
      setSyncingId(null)
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка синхронизации'
      alert(message)
    },
  })

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await api.delete(`/accounts/connections/${connectionId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      alert('Подключение удалено')
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка удаления подключения'
      alert(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await api.delete(`/accounts/${accountId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      alert('Аккаунт удалён')
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка удаления аккаунта'
      alert(message)
    },
  })

  const handleConnectFacebook = async () => {
    try {
      const response = await api.get(`/auth/facebook?userId=${user?.id}`)
      window.location.href = response.data.authUrl
    } catch (error) {
      console.error('Failed to get Facebook auth URL:', error)
      alert('Не удалось начать подключение Facebook')
    }
  }

  const handleSync = (accountId: string) => {
    setSyncingId(accountId)
    syncMutation.mutate(accountId)
  }

  const handleSyncConnection = async (connectionId: string, adAccounts: any[]) => {
    if (!adAccounts.length || syncingConnectionId === connectionId) return

    setSyncingConnectionId(connectionId)

    let successCount = 0
    let failedCount = 0
    const failedAccounts: string[] = []

    try {
      for (const account of adAccounts) {
        try {
          await api.post(`/accounts/${account.accountId}/sync`)
          successCount++
        } catch (error) {
          failedCount++
          failedAccounts.push(account.name || account.accountId)
          console.error(`Failed to sync account ${account.accountId}:`, error)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['accounts'] })

      if (failedCount === 0) {
        alert(`Синхронизация подключения завершена. Успешно: ${successCount}`)
      } else {
        alert(
          `Синхронизация подключения завершена.\nУспешно: ${successCount}\nС ошибкой: ${failedCount}\n\nПроблемные аккаунты:\n${failedAccounts.join('\n')}`
        )
      }
    } finally {
      setSyncingConnectionId(null)
    }
  }

  const handleSyncAll = async () => {
    if (!allAccounts.length || isSyncingAll) return

    setIsSyncingAll(true)

    let successCount = 0
    let failedCount = 0
    const failedAccounts: string[] = []

    try {
      for (const account of allAccounts) {
        try {
          await api.post(`/accounts/${account.accountId}/sync`)
          successCount++
        } catch (error) {
          failedCount++
          failedAccounts.push(account.name || account.accountId)
          console.error(`Failed to sync account ${account.accountId}:`, error)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['accounts'] })

      if (failedCount === 0) {
        alert(`Синхронизация завершена. Успешно: ${successCount}`)
      } else {
        alert(
          `Синхронизация завершена.\nУспешно: ${successCount}\nС ошибкой: ${failedCount}\n\nПроблемные аккаунты:\n${failedAccounts.join('\n')}`
        )
      }
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleDeleteConnection = (
    connectionId: string,
    connectionName?: string
  ) => {
    const confirmed = window.confirm(
      `Удалить подключение${connectionName ? ` "${connectionName}"` : ''} целиком вместе со всеми рекламными аккаунтами?`
    )

    if (confirmed) {
      deleteConnectionMutation.mutate(connectionId)
    }
  }

  const handleDeleteAccount = (accountId: string, accountName?: string) => {
    const confirmed = window.confirm(
      `Удалить рекламный аккаунт${accountName ? ` "${accountName}"` : ''}?`
    )

    if (confirmed) {
      deleteMutation.mutate(accountId)
    }
  }

  const getConnectionStatusBadge = (status?: string) => {
    const active = status === 'active'
    return (
      <div className={`flex items-center text-sm ${active ? 'text-green-600' : 'text-yellow-600'}`}>
        {active ? (
          <CheckCircle className="h-4 w-4 mr-1" />
        ) : (
          <AlertCircle className="h-4 w-4 mr-1" />
        )}
        <span>{active ? 'Подключение активно' : status || 'Неизвестно'}</span>
      </div>
    )
  }

  const getAccountStatusBadge = (status?: string) => {
    const active = status === 'active'
    return (
      <div className={`flex items-center text-sm ${active ? 'text-green-600' : 'text-yellow-600'}`}>
        {active ? (
          <CheckCircle className="h-4 w-4 mr-1" />
        ) : (
          <AlertCircle className="h-4 w-4 mr-1" />
        )}
        <span>{active ? 'Активен' : status || 'Неизвестно'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Аккаунты</h1>
          <p className="text-gray-600 mt-1">
            Подключения Facebook и связанные рекламные аккаунты
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleSyncAll}
            className="btn-secondary flex items-center space-x-2"
            disabled={isLoading || isSyncingAll || allAccounts.length === 0}
          >
            {isSyncingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Синхронизировать все</span>
          </button>

          <button
            onClick={handleConnectFacebook}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Подключить Facebook</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : connections.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Facebook className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Нет подключений Facebook
          </h3>
          <p className="text-gray-500 mb-6">
            Подключите Facebook-профиль, чтобы загрузить его рекламные аккаунты
          </p>
          <button
            onClick={handleConnectFacebook}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <Facebook className="h-5 w-5" />
            <span>Подключить Facebook</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {connections.map((connection: any) => {
            const adAccounts = connection.adAccounts || []
            const activeAccounts = adAccounts.filter((a: any) => a.status === 'active').length

            return (
              <div key={connection.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start space-x-4">
                      <div className="bg-blue-100 p-3 rounded-lg">
                        <Facebook className="h-6 w-6 text-blue-600" />
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {connection.facebookName || 'Facebook connection'}
                        </h3>

                        <div className="mt-1 text-sm text-gray-500 space-y-1">
                          <p>Facebook ID: {connection.facebookUserId}</p>
                          {connection.facebookEmail && (
                            <p>Email: {connection.facebookEmail}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          {getConnectionStatusBadge(connection.status)}

                          <div className="flex items-center text-sm text-gray-500">
                            <Users className="h-4 w-4 mr-1" />
                            <span>
                              {adAccounts.length} аккаунтов / {activeAccounts} активных
                            </span>
                          </div>

                          <div className="flex items-center text-sm text-gray-500">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>
                              Токен до:{' '}
                              {connection.tokenExpiresAt
                                ? new Date(connection.tokenExpiresAt).toLocaleDateString('ru-RU')
                                : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="text-sm text-gray-500 whitespace-nowrap">
                        Подключено:{' '}
                        {connection.connectedAt
                          ? new Date(connection.connectedAt).toLocaleDateString('ru-RU')
                          : '—'}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSyncConnection(connection.id, adAccounts)}
                          disabled={syncingConnectionId === connection.id || adAccounts.length === 0}
                          className="btn-secondary flex items-center space-x-2"
                        >
                          {syncingConnectionId === connection.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span>Синхронизировать подключение</span>
                        </button>

                        <button
                          onClick={() =>
                            handleDeleteConnection(connection.id, connection.facebookName)
                          }
                          disabled={deleteConnectionMutation.isPending}
                          className="btn-danger flex items-center space-x-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Удалить подключение</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {adAccounts.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      У этого подключения пока нет рекламных аккаунтов.
                    </div>
                  ) : (
                    adAccounts.map((account: any) => (
                      <div
                        key={account.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div>
                              <h4 className="text-base font-semibold text-gray-900">
                                {account.name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                ID: {account.accountId}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center text-sm text-gray-500">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>Часовой пояс: {account.timezone || '—'}</span>
                              </div>

                              {getAccountStatusBadge(account.status)}

                              <div className="text-sm text-gray-500">
                                {account._count?.campaigns || 0} кампаний
                              </div>

                              <div className="text-sm text-gray-500">
                                {account._count?.rules || 0} правил
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pt-1">
                              <div className="flex items-center">
                                <CreditCard className="h-4 w-4 mr-1" />
                                <span>
                                  Billing:{' '}
                                  {account.billingStatus || 'unknown'}
                                </span>
                              </div>

                              <div className="flex items-center">
                                <span>
                                  Карта:{' '}
                                  {account.paymentMethodLabel || 'неизвестно'}
                                </span>
                              </div>

                              <div className="flex items-center">
                                <Bot className="h-4 w-4 mr-1" />
                                <span>
                                  AI:{' '}
                                  {account.aiEnabled
                                    ? account.aiMode || 'on'
                                    : 'off'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleSync(account.accountId)}
                              disabled={syncingId === account.accountId}
                              className="btn-secondary flex items-center space-x-2"
                            >
                              {syncingId === account.accountId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              <span>Синхронизировать</span>
                            </button>

                            <button
                              onClick={() =>
                                handleDeleteAccount(account.accountId, account.name)
                              }
                              disabled={deleteMutation.isPending}
                              className="btn-danger flex items-center space-x-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Удалить аккаунт</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Информация</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Один пользователь сервиса может подключить несколько Facebook-профилей</li>
          <li>• У каждого подключения может быть несколько рекламных аккаунтов</li>
          <li>• Можно синхронизировать один аккаунт, одно подключение или все аккаунты сразу</li>
          <li>• Удаление аккаунта удаляет только один рекламный аккаунт</li>
          <li>• Удаление подключения удаляет весь профиль вместе с его рекламными аккаунтами</li>
        </ul>
      </div>
    </div>
  )
}

export default Accounts
