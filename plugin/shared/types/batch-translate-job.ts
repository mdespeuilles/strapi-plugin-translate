import { Data, UID } from '@strapi/strapi'

/**
 * Why a batch translation job failed, stored as JSON on the job
 */
export interface BatchTranslateJobFailureReason {
  message: string
  name?: string
}

export interface BatchTranslateJob {
  documentId: Data.DocumentID
  id: Data.ID
  contentType: UID.ContentType
  status:
    | 'created'
    | 'setup'
    | 'running'
    | 'paused'
    | 'finished'
    | 'cancelled'
    | 'failed'
  progress: number
  failureReason?: BatchTranslateJobFailureReason | null
  entityIds?: Data.DocumentID[]
  sourceLocale: string
  targetLocale: string
  autoPublish: boolean
}
