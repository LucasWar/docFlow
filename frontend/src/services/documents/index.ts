import { download } from './download'
import { listDocuments } from './listDocuments'
import { presignedURL } from './presigendURL'
import { uploadFile } from './put-s3'
import { resume } from './resume'

export const documentsService = {
  listDocuments,
  presignedURL,
  uploadFile,
  resume,
  download,
}
