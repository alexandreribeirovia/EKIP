import { Router, Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { sessionAuth } from '../middleware/sessionAuth'

const router = Router()

// Aplicar middleware de autenticação por sessão em todas as rotas
// O middleware injeta req.supabaseUser com o cliente autenticado (RLS ativo)
router.use(sessionAuth)

// Helper para obter o cliente Supabase do request
// Usa o cliente do usuário (com RLS) se disponível, senão usa admin (fallback)
const getSupabaseClient = (req: Request) => {
  return req.supabaseUser || supabaseAdmin
}

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Lista todos os projetos
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: Lista de projetos com owners
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        projects_owner(
          id,
          created_at,
          updated_at,
          project_id,
          user_id,
          employees(
            user_id,
            name,
            avatar_large_url
          )
        )
      `)
      .order('name', { ascending: true })

    if (error) {
      console.error('Erro ao buscar projetos:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Transformar os dados para incluir owners formatados
    const projectsWithOwners = (data || []).map(project => ({
      ...project,
      owners: (project.projects_owner || []).map((ownerData: any) => {
        const employeeData = Array.isArray(ownerData.employees) && ownerData.employees.length > 0 
          ? ownerData.employees[0] 
          : ownerData.employees
        return {
          id: ownerData.id,
          created_at: ownerData.created_at,
          updated_at: ownerData.updated_at,
          project_id: ownerData.project_id,
          user_id: ownerData.user_id,
          employees: employeeData && !Array.isArray(employeeData) ? {
            user_id: employeeData.user_id,
            name: employeeData.name,
            avatar_large_url: employeeData.avatar_large_url
          } : null
        }
      }).filter((owner: any) => owner.employees !== null)
    }))

    return res.json({
      success: true,
      data: projectsWithOwners
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/domains:
 *   get:
 *     summary: Busca todos os domínios ativos
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: Lista de domínios
 */
router.get('/domains', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .eq('is_active', true)

    if (error) {
      console.error('Erro ao buscar domínios:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data || []
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/{id}/tasks:
 *   get:
 *     summary: Busca tarefas do projeto com assignees
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Lista de tarefas do projeto
 */
router.get('/:id/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    if (!id) {
      return res.status(400).json({ success: false, error: { message: 'ID do projeto é obrigatório', code: 'MISSING_ID' } })
    }

    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .rpc('get_tasks_with_assignees', {
        p_project_id: parseInt(id)
      })

    if (error) {
      console.error('Erro ao buscar tarefas:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: data || []
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/{id}/time-worked:
 *   get:
 *     summary: Busca tempo trabalhado por usuário no projeto
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Lista de tempo trabalhado por usuário
 */
router.get('/:id/time-worked', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    if (!id) {
      return res.status(400).json({ success: false, error: { message: 'ID do projeto é obrigatório', code: 'MISSING_ID' } })
    }

    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .from('time_worked')
      .select('user_id, user_name, time')
      .eq('project_id', parseInt(id))

    if (error) {
      console.error('Erro ao buscar time_worked:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Agrupar por user_id e somar o time (que está em segundos)
    const groupedData = new Map<string, { name: string; total_seconds: number }>()
    
    ;(data || []).forEach((record: any) => {
      const userId = record.user_id
      const userName = record.user_name
      const time = record.time || 0
      
      const current = groupedData.get(userId) || { name: userName, total_seconds: 0 }
      current.total_seconds += time
      groupedData.set(userId, current)
    })

    // Converter para array e calcular horas
    const consultorsList = Array.from(groupedData.entries())
      .map(([user_id, data]) => ({
        user_id: parseInt(user_id),
        name: data.name,
        total_hours: data.total_seconds / 3600
      }))
      .filter(c => c.total_hours > 0)
      .sort((a, b) => b.total_hours - a.total_hours)

    return res.json({
      success: true,
      data: consultorsList
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/{id}/time-entries-grouped:
 *   get:
 *     summary: Busca tempo trabalhado agrupado por usuário e tarefa
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Lista de tempo trabalhado por usuário e tarefa
 */
router.get('/:id/time-entries-grouped', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    if (!id) {
      return res.status(400).json({ success: false, error: { message: 'ID do projeto é obrigatório', code: 'MISSING_ID' } })
    }

    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .from('time_worked')
      .select('user_id, user_name, task_id, time')
      .eq('project_id', parseInt(id))

    if (error) {
      console.error('Erro ao buscar time_worked agrupado:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Agrupar por user_id + task_id e somar o time (que está em segundos)
    const groupedData = new Map<string, { user_id: string; user_name: string; task_id: number; time_seconds: number }>()
    
    ;(data || []).forEach((record: any) => {
      const userId = record.user_id
      const userName = record.user_name
      const taskId = record.task_id
      const time = record.time || 0
      
      const key = `${userId}_${taskId}`
      const current = groupedData.get(key) || { user_id: userId, user_name: userName, task_id: taskId, time_seconds: 0 }
      current.time_seconds += time
      groupedData.set(key, current)
    })

    // Converter para array
    const entriesList = Array.from(groupedData.values())
      .filter(e => e.time_seconds > 0)
      .sort((a, b) => a.user_name.localeCompare(b.user_name))

    return res.json({
      success: true,
      data: entriesList
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/{id}/phases:
 *   get:
 *     summary: Busca fases do projeto com nomes de domínio
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Lista de fases do projeto
 */
router.get('/:id/phases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    if (!id) {
      return res.status(400).json({ success: false, error: { message: 'ID do projeto é obrigatório', code: 'MISSING_ID' } })
    }

    const supabase = getSupabaseClient(req)

    // Buscar fases do projeto
    const { data: phasesData, error: phasesError } = await supabase
      .from('projects_phase')
      .select('*')
      .eq('project_id', parseInt(id))
      .order('order', { ascending: true })

    if (phasesError) {
      console.error('Erro ao buscar fases:', phasesError)
      return res.status(500).json({
        success: false,
        error: { message: phasesError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar domínios das fases
    const { data: domainsData, error: domainsError } = await supabase
      .from('domains')
      .select('id, value')
      .eq('type', 'project_phase')
      .eq('is_active', true)

    if (domainsError) {
      console.error('Erro ao buscar domínios das fases:', domainsError)
      return res.status(500).json({
        success: false,
        error: { message: domainsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Fazer JOIN manual entre fases e domínios
    const phasesWithNames = (phasesData || []).map((phase: any) => {
      const domain = domainsData?.find((d: any) => d.id === phase.domains_id)
      return {
        ...phase,
        phase_name: domain?.value || 'Fase desconhecida',
        domains: domain ? { id: domain.id, value: domain.value } : undefined
      }
    })

    return res.json({
      success: true,
      data: phasesWithNames
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/{id}/risks:
 *   get:
 *     summary: Busca riscos do projeto
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Lista de riscos do projeto
 */
router.get('/:id/risks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    if (!id) {
      return res.status(400).json({ success: false, error: { message: 'ID do projeto é obrigatório', code: 'MISSING_ID' } })
    }

    const supabase = getSupabaseClient(req)

    // Buscar domínios primeiro
    const { data: domainsData, error: domainsError } = await supabase
      .from('domains')
      .select('*')
      .eq('is_active', true)

    if (domainsError) {
      console.error('Erro ao buscar domínios:', domainsError)
      return res.status(500).json({
        success: false,
        error: { message: domainsError.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar riscos do projeto
    const { data, error } = await supabase
      .from('risks')
      .select('*')
      .eq('project_id', parseInt(id))
      .order('description')

    if (error) {
      console.error('Erro ao buscar riscos:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Mapear valores dos domínios
    const risksWithValues = (data || []).map((risk: any) => {
      const typeValue = domainsData?.find((d: any) => d.id === risk.type_id)?.value || ''
      const priorityValue = domainsData?.find((d: any) => d.id === risk.priority_id)?.value || ''
      const statusValue = domainsData?.find((d: any) => d.id === risk.status_id)?.value || ''
      
      return {
        ...risk,
        type: typeValue,
        priority: priorityValue,
        status: statusValue,
      }
    })

    return res.json({
      success: true,
      data: risksWithValues
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/{id}/risks/{riskId}:
 *   delete:
 *     summary: Deleta um risco do projeto
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do projeto
 *       - in: path
 *         name: riskId
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do risco
 *     responses:
 *       200:
 *         description: Risco deletado com sucesso
 */
router.delete('/:id/risks/:riskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const riskId = req.params['riskId'] as string
    if (!riskId) {
      return res.status(400).json({ success: false, error: { message: 'ID do risco é obrigatório', code: 'MISSING_ID' } })
    }

    const supabase = getSupabaseClient(req)
    const { error } = await supabase
      .from('risks')
      .delete()
      .eq('id', parseInt(riskId))

    if (error) {
      console.error('Erro ao deletar risco:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: { message: 'Risco excluído com sucesso' }
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/{id}/owners:
 *   get:
 *     summary: Busca responsáveis do projeto
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Lista de responsáveis do projeto
 */
router.get('/:id/owners', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    if (!id) {
      return res.status(400).json({ success: false, error: { message: 'ID do projeto é obrigatório', code: 'MISSING_ID' } })
    }

    const supabase = getSupabaseClient(req)
    const { data, error } = await supabase
      .from('projects_owner')
      .select(`
        id,
        created_at,
        updated_at,
        project_id,
        user_id,
        users!inner(
          user_id,
          name,
          avatar_large_url
        )
      `)
      .eq('project_id', parseInt(id))

    if (error) {
      console.error('Erro ao buscar owners:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Transformar os dados para o formato esperado
    const transformedData = (data || []).map((item: any) => {
      const userData = Array.isArray(item.users) && item.users.length > 0 ? item.users[0] : item.users
      return {
        id: item.id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        project_id: item.project_id,
        user_id: item.user_id,
        users: userData && !Array.isArray(userData) ? {
          user_id: userData.user_id,
          name: userData.name,
          avatar_large_url: userData.avatar_large_url
        } : null
      }
    })

    return res.json({
      success: true,
      data: transformedData
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/{id}/accesses:
 *   get:
 *     summary: Busca acessos do projeto (via client)
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Lista de acessos do projeto
 */
router.get('/:id/accesses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'] as string
    if (!id) {
      return res.status(400).json({ success: false, error: { message: 'ID do projeto é obrigatório', code: 'MISSING_ID' } })
    }

    const supabase = getSupabaseClient(req)

    // Buscar client_name do projeto
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('client_name')
      .eq('project_id', parseInt(id))
      .single()

    if (projectError || !projectData) {
      console.error('Erro ao buscar dados do projeto:', projectError)
      return res.status(404).json({
        success: false,
        error: { message: 'Projeto não encontrado', code: 'NOT_FOUND' }
      })
    }

    // Buscar client_id baseado no client_name
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('client_id')
      .eq('name', projectData.client_name)
      .single()

    if (clientError || !clientData) {
      console.error('Erro ao buscar client_id:', clientError)
      return res.json({
        success: true,
        data: [] // Retorna lista vazia se cliente não encontrado
      })
    }

    // Buscar acessos do cliente com nome do funcionário
    const { data, error } = await supabase
      .from('access_platforms')
      .select('*, users!access_platforms_user_id_fkey(name)')
      .eq('client_id', clientData.client_id)
      .eq('is_active', true)
      .order('platform_name')

    if (error) {
      console.error('Erro ao buscar acessos:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    // Buscar detalhes de acesso para cada acesso
    const accessIds = (data || []).map((a: any) => a.id)
    
    let accessDetails: any[] = []
    if (accessIds.length > 0) {
      const { data: detailsData, error: detailsError } = await supabase
        .from('access_platforms_details')
        .select('*')
        .in('access_platform_id', accessIds)
      
      if (!detailsError) {
        accessDetails = detailsData || []
      }
    }

    // Mapear dados para incluir user_name e detalhes
    const accessesWithUserName = (data || []).map((access: any) => {
      const details = accessDetails.filter((d: any) => d.access_platform_id === access.id)
      const policies = details.filter((d: any) => d.domain_type === 'access_policy').map((d: any) => d.domain_value)
      const dataTypes = details.filter((d: any) => d.domain_type === 'access_data_type').map((d: any) => d.domain_value)
      
      return {
        ...access,
        user_name: access.users?.name || 'Funcionário não encontrado',
        access_policies: policies,
        data_types: dataTypes,
      }
    })

    return res.json({
      success: true,
      data: accessesWithUserName
    })
  } catch (err) {
    return next(err)
  }
})

/**
 * @swagger
 * /api/projects/{id}/accesses/{accessId}:
 *   delete:
 *     summary: Deleta um acesso do projeto
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do projeto
 *       - in: path
 *         name: accessId
 *         required: true
 *         schema:
 *           type: number
 *         description: ID do acesso
 *     responses:
 *       200:
 *         description: Acesso deletado com sucesso
 */
router.delete('/:id/accesses/:accessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accessId = req.params['accessId'] as string
    if (!accessId) {
      return res.status(400).json({ success: false, error: { message: 'ID do acesso é obrigatório', code: 'MISSING_ID' } })
    }

    const supabase = getSupabaseClient(req)
    const { error } = await supabase
      .from('access_platforms')
      .delete()
      .eq('id', parseInt(accessId))

    if (error) {
      console.error('Erro ao deletar acesso:', error)
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'SUPABASE_ERROR' }
      })
    }

    return res.json({
      success: true,
      data: { message: 'Acesso excluído com sucesso' }
    })
  } catch (err) {
    return next(err)
  }
})

export default router
