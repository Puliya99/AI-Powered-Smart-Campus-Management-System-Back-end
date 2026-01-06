import { Router } from 'express';
import settingController from '../controllers/setting.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all settings (Admin and Staff)
router.get(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  settingController.getAllSettings.bind(settingController)
);

// Get setting by key (Authenticated users)
router.get('/:key', settingController.getSettingByKey.bind(settingController));

// Create or update setting (Admin only)
router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN),
  settingController.upsertSetting.bind(settingController)
);

// Update multiple settings (Admin only)
router.put(
  '/bulk',
  authMiddleware.authorize(Role.ADMIN),
  settingController.updateMultipleSettings.bind(settingController)
);

// Delete setting (Admin only)
router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  settingController.deleteSetting.bind(settingController)
);

export default router;
