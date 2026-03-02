import { Router } from 'express';
import libraryController from '../controllers/library.controller';
import authMiddleware from '../middleware/auth.middleware';
import { Role } from '../enums/Role.enum';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Student/Lecturer - own borrowings
router.get(
  '/my-borrowings',
  authMiddleware.authorize(Role.STUDENT, Role.LECTURER),
  libraryController.getMyBorrowings.bind(libraryController)
);

// Book management (ADMIN + USER/Staff)
router.get(
  '/books',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.getAllBooks.bind(libraryController)
);

router.get(
  '/books/stats',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.getBookStats.bind(libraryController)
);

router.get(
  '/books/dropdown',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.getBooksDropdown.bind(libraryController)
);

router.get(
  '/books/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.getBookById.bind(libraryController)
);

router.post(
  '/books',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.createBook.bind(libraryController)
);

router.put(
  '/books/:id',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.updateBook.bind(libraryController)
);

router.delete(
  '/books/:id',
  authMiddleware.authorize(Role.ADMIN),
  libraryController.deleteBook.bind(libraryController)
);

// Borrowing management (ADMIN + USER/Staff)
router.get(
  '/borrowings',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.getAllBorrowings.bind(libraryController)
);

router.get(
  '/borrowings/stats',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.getBorrowingStats.bind(libraryController)
);

router.post(
  '/borrowings',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.createBorrowing.bind(libraryController)
);

router.put(
  '/borrowings/:id/return',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.returnBook.bind(libraryController)
);

// Users dropdown for borrow form
router.get(
  '/users/dropdown',
  authMiddleware.authorize(Role.ADMIN, Role.USER),
  libraryController.getUsersDropdown.bind(libraryController)
);

export default router;
