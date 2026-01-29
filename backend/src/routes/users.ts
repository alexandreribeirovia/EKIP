import { Router } from 'express'
import { sessionAuth } from '@/middleware/sessionAuth'

const router = Router()

// Aplicar autenticação em todas as rotas
router.use(sessionAuth)

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Users route - implementar CRUD completo'
    }
  })
})

export default router 