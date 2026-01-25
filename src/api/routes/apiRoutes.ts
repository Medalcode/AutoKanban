import { Router } from 'express';
import { configController, logController } from '../../container';
import { authMiddleware } from '../../middleware/auth'; // reuse existing auth for now

const router = Router();

router.use(authMiddleware);

// Config Routes
router.post('/configs', (req, res) => configController.create(req, res));
router.get('/configs', (req, res) => configController.list(req, res));
router.get('/configs/:id', (req, res) => configController.get(req, res));
router.put('/configs/:id', (req, res) => configController.update(req, res));
router.delete('/configs/:id', (req, res) => configController.delete(req, res));

// Logs
router.get('/logs', (req, res) => logController.getLogs(req, res));

// Alias for old behavior if needed, or just new one
router.use('/rules', router); // Mount same routes on /rules if needed

export default router;
