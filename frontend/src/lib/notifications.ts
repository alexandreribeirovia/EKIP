import { supabase } from './supabaseClient'
import type { CreateNotificationParams } from '@/types'

/**
 * Função helper para criar notificações no sistema
 * @param params - Parâmetros da notificação
 * @returns Objeto com success e error
 */
export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        title: params.title,
        message: params.message,
        type_id: params.type_id,
        type: params.type,
        audience: params.audience || 'user',
        auth_user_id: params.auth_user_id || null,
        link_url: params.link_url || null,
        source_type: params.source_type || null,
        source_id: params.source_id || null
      })

    if (error) {
      console.error('Erro ao criar notificação:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    console.error('Erro ao criar notificação:', error)
    return { success: false, error }
  }
}

// ===============================
// Funções específicas por contexto
// ===============================

/**
 * Notificar usuário sobre novo feedback recebido
 */
export const notifyNewFeedback = async (
  userId: string,
  senderName: string,
  feedbackId: number,
  typeId: number
) => {
  await createNotification({
    title: 'Novo Feedback Recebido',
    message: `${senderName} enviou um novo feedback para você`,
    type_id: typeId,
    type: 'info',
    auth_user_id: userId,
    link_url: `/employee/${userId}`,
    source_type: 'feedback',
    source_id: feedbackId.toString()
  })
}

/**
 * Notificar usuário sobre avaliação pendente
 */
export const notifyEvaluationPending = async (
  userId: string,
  evaluationName: string,
  evaluationId: number,
  typeId: number
) => {
  await createNotification({
    title: 'Avaliação Pendente',
    message: `Você tem uma avaliação aguardando resposta: ${evaluationName}`,
    type_id: typeId,
    type: 'warning',
    auth_user_id: userId,
    link_url: `/evaluation-response/${evaluationId}`,
    source_type: 'evaluation',
    source_id: evaluationId.toString()
  })
}

/**
 * Notificar usuário sobre avaliação concluída
 */
export const notifyEvaluationCompleted = async (
  userId: string,
  evaluationName: string,
  evaluationId: number,
  typeId: number
) => {
  await createNotification({
    title: 'Avaliação Concluída',
    message: `Sua avaliação "${evaluationName}" foi concluída e está disponível para visualização`,
    type_id: typeId,
    type: 'success',
    auth_user_id: userId,
    link_url: `/employee/${userId}`,
    source_type: 'evaluation',
    source_id: evaluationId.toString()
  })
}

/**
 * Notificar usuário sobre nova tarefa atribuída
 */
export const notifyTaskAssigned = async (
  userId: string,
  taskTitle: string,
  taskId: number,
  typeId: number
) => {
  await createNotification({
    title: 'Nova Tarefa Atribuída',
    message: `Você foi atribuído à tarefa: ${taskTitle}`,
    type_id: typeId,
    type: 'info',
    auth_user_id: userId,
    link_url: `/tasks/${taskId}`,
    source_type: 'task',
    source_id: taskId.toString()
  })
}

/**
 * Notificar usuário sobre tarefa vencida
 */
export const notifyTaskOverdue = async (
  userId: string,
  taskTitle: string,
  taskId: number,
  typeId: number
) => {
  await createNotification({
    title: 'Tarefa Vencida',
    message: `A tarefa "${taskTitle}" está atrasada. Por favor, atualize o status.`,
    type_id: typeId,
    type: 'error',
    auth_user_id: userId,
    link_url: `/tasks/${taskId}`,
    source_type: 'task',
    source_id: taskId.toString()
  })
}

/**
 * Notificar usuário sobre lançamento de horas pendente
 */
export const notifyTimeEntryReminder = async (
  userId: string,
  date: string,
  typeId: number
) => {
  await createNotification({
    title: 'Lançamento de Horas Pendente',
    message: `Não se esqueça de lançar suas horas trabalhadas do dia ${date}`,
    type_id: typeId,
    type: 'warning',
    auth_user_id: userId,
    link_url: '/time-entries',
    source_type: 'system',
    source_id: null
  })
}

/**
 * Notificar usuário sobre PDI criado
 */
export const notifyPDICreated = async (
  userId: string,
  pdiId: number,
  typeId: number
) => {
  await createNotification({
    title: 'Novo PDI Criado',
    message: 'Um novo Plano de Desenvolvimento Individual foi criado para você',
    type_id: typeId,
    type: 'info',
    auth_user_id: userId,
    link_url: `/pdi/${pdiId}`,
    source_type: 'pdi',
    source_id: pdiId.toString()
  })
}

/**
 * Notificação global para todos os usuários (ex: manutenção)
 */
export const notifySystemMaintenance = async (
  title: string,
  message: string,
  typeId: number
) => {
  await createNotification({
    title,
    message,
    type_id: typeId,
    type: 'warning',
    audience: 'all',
    auth_user_id: null,
    source_type: 'system',
    source_id: null
  })
}

/**
 * Notificação global de sucesso (ex: nova feature lançada)
 */
export const notifySystemAnnouncement = async (
  title: string,
  message: string,
  typeId: number,
  linkUrl?: string
) => {
  await createNotification({
    title,
    message,
    type_id: typeId,
    type: 'success',
    audience: 'all',
    auth_user_id: null,
    link_url: linkUrl || null,
    source_type: 'system',
    source_id: null
  })
}
