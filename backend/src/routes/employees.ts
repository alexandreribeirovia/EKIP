import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Employees route - implementar CRUD completo'
    }
  })
})

export default router 