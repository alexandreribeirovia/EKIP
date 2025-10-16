import { Router } from 'express'

const router = Router()

router.get('/stats', (_req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Dashboard stats - implementar métricas'
    }
  })
})

export default router 