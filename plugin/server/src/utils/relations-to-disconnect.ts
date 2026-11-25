import { Modules, Schema, UID } from '@strapi/strapi'
import { RelationReference } from '@shared/types/relations'
import { isLocalizedContentType } from './content-type'

const isEditableRelation = (
  attribute: Schema.Attribute.AnyAttribute
): attribute is Schema.Attribute.RelationWithTarget =>
  attribute.type === 'relation' &&
  'target' in attribute &&
  !!attribute.target &&
  !attribute.relation.toLowerCase().includes('morph')

const relationKey = (relation: {
  documentId: string
  locale?: string | null
}) => `${relation.documentId}:${relation.locale ?? ''}`

const toReferences = (value: unknown): RelationReference[] => {
  const relations = Array.isArray(value) ? value : value ? [value] : []
  return relations
    .filter(
      (relation): relation is RelationReference =>
        typeof relation === 'object' &&
        relation !== null &&
        'documentId' in relation &&
        !!relation.documentId
    )
    .map(({ id, documentId, locale }) => ({ id, documentId, locale }))
}

/**
 * The Content Manager keeps the relations a document already has out of its form
 * values: a relation field only holds what to connect and what to disconnect. So
 * filling the form with translated relations adds them to the existing ones
 * instead of replacing them.
 *
 * For every top-level relation of `translatedData` (empty ones included), this
 * returns the relations the target locale currently has and that the translation
 * no longer contains, for the form to disconnect them.
 *
 * Relations inside components and dynamic zones need nothing: the translated
 * components replace the existing ones, whose relations go with them.
 */
export async function getRelationsToDisconnect<
  TSchemaUID extends UID.ContentType,
>({
  contentType,
  documentId,
  targetLocale,
  translatedData,
}: {
  contentType: TSchemaUID
  documentId?: string
  targetLocale: string
  translatedData: Record<string, unknown>
}): Promise<Record<string, RelationReference[]>> {
  const schema = strapi.contentTypes[contentType]

  const attributes = Object.entries(schema.attributes).filter(
    ([name, attribute]) =>
      isEditableRelation(attribute) && translatedData[name] !== undefined
  ) as [string, Schema.Attribute.RelationWithTarget][]

  if (attributes.length === 0) {
    return {}
  }

  const populate = Object.fromEntries(
    attributes.map(([name, attribute]) => [
      name,
      {
        fields: isLocalizedContentType(attribute.target)
          ? ['documentId', 'locale']
          : ['documentId'],
      },
    ])
  )

  // The edit view works on the draft when draft & publish is enabled
  const params = {
    locale: targetLocale,
    populate,
    ...(schema.options?.draftAndPublish ? { status: 'draft' as const } : {}),
  } as Modules.Documents.ServiceParams<TSchemaUID>['findFirst']

  const current = documentId
    ? await strapi
        .documents(contentType)
        .findOne({
          ...params,
          documentId,
        } as Modules.Documents.ServiceParams<TSchemaUID>['findOne'])
    : await strapi.documents(contentType).findFirst(params)

  if (!current) {
    return {}
  }

  const result: Record<string, RelationReference[]> = {}
  for (const [name] of attributes) {
    const kept = new Set(toReferences(translatedData[name]).map(relationKey))
    const toDisconnect = toReferences(current[name]).filter(
      (relation) => !kept.has(relationKey(relation))
    )
    if (toDisconnect.length > 0) {
      result[name] = toDisconnect
    }
  }
  return result
}
