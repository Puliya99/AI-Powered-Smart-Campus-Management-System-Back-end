import { Router } from 'express';
import userController from '../controllers/user.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Only Admin and Staff can manage users
router.get(
  '/',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  userController.getAllUsers.bind(userController)
);

router.get(
  '/stats',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  userController.getUserStats.bind(userController)
);

router.get(
  '/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  userController.getUserById.bind(userController)
);

router.post(
  '/',
  authMiddleware.authorize(Role.ADMIN),
  userController.createUser.bind(userController)
);

router.put(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  userController.updateUser.bind(userController)
);

router.delete(
  '/:id',
  authMiddleware.authorize(Role.ADMIN),
  userController.deleteUser.bind(userController)
);

export default router;
