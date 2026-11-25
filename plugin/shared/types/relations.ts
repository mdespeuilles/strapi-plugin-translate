import { Data } from '@strapi/types'

/**
 * Identifies one entry of a relation, the way the Content Manager sends it to the API
 */
export interface RelationReference {
  id: Data.ID
  documentId: Data.DocumentID
  locale?: string | null
}
