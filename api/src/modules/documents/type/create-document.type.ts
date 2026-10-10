import { StatusDocument } from './status-documents.enum';

export type CreateDocumentType = {
  fileName: string;

  storageKey: string;

  size: number;

  status: StatusDocument;

  userId: string;
};
