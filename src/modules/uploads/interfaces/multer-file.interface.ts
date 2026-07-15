/** Custom local interface representing an uploaded file from Multer to avoid dependency issues */
export interface MulterFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size?: number;
  buffer: Buffer;
}
