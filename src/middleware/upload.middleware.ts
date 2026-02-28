import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { Request } from 'express';
import fs from 'fs';

// Ensure upload directory exists
if (!fs.existsSync(env.UPLOAD_PATH)) {
  fs.mkdirSync(env.UPLOAD_PATH, { recursive: true });
}

// Disk storage configuration
const storage = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, env.UPLOAD_PATH);
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter - allow images and documents
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png, .pdf, .doc, .docx files are allowed!'));
  }
};

// Multer configuration
const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE }, // From env (default 5MB)
  fileFilter,
});

// Export middleware variants
export const uploadSingle = (fieldName: string) => upload.single(fieldName);

export const uploadMultiple = (fieldName: string, maxCount: number = 10) =>
  upload.array(fieldName, maxCount);

export const uploadFields = (fields: { name: string; maxCount?: number }[]) =>
  upload.fields(fields.map(f => ({ name: f.name, maxCount: f.maxCount || 1 })));

// Default export (most common usage)
export default upload;
