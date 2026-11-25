import type { Core } from '@strapi/strapi'

import { toLower } from 'lodash'

import { actions } from './services/permissions/actions'
import { getService } from './utils/get-service'
import { TranslateConfig } from './config'
import { TranslateProvider } from '../../shared/types/provider'
import dummyProvider from './utils/dummy-provider'

// Accepts a short name ("deepl"), resolved to this fork's providers first, then
// to the historical unscoped packages, or a full package name.
const PROVIDER_PREFIXES = [
  '@mdespeuilles/strapi-provider-translate-',
  'strapi-provider-translate-',
]

const resolveProvider = (providerName: string): string => {
  const candidates = [
    ...PROVIDER_PREFIXES.map((prefix) => `${prefix}${providerName}`),
    providerName,
  ]
  for (const candidate of candidates) {
    try {
      return require.resolve(candidate)
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        throw error
      }
    }
  }
  return providerName
}

const createProvider = async (translateConfig: TranslateConfig) => {
  const providerName = toLower(translateConfig.provider)
  let provider: TranslateProvider

  if (providerName === 'dummy') {
    provider = dummyProvider
  } else {
    const modulePath = resolveProvider(providerName)
    try {
      provider = require(modulePath)
    } catch (err) {
      console.error(err)
      throw new Error(
        `Could not load translate provider "${providerName}": ${err instanceof Error ? err.message : err}`
      )
    }
  }

  return provider.init(translateConfig.providerOptions)
}

const bootstrap: Core.Plugin['bootstrap'] = async ({ strapi }) => {
  const translateConfig =
    strapi.config.get<TranslateConfig>('plugin::translate')
  strapi.plugin('translate').provider = await createProvider(translateConfig)

  // Listen for updates to entries, mark them as updated
  strapi.db.lifecycles.subscribe({
    afterUpdate(event) {
      if (
        // content type must not be on ignore list
        event?.model?.uid &&
        !translateConfig.ignoreUpdatedContentTypes.includes(event.model.uid) &&
        // entity must have localizations
        event.result?.locale &&
        Array.isArray(event.result?.localizations) &&
        event.result.localizations.length > 0 &&
        // update must include relevant fields
        Object.keys(event.params.data).some(
          (key) => !['localizations', 'updatedAt', 'updatedBy'].includes(key)
        )
      ) {
        setTimeout(() => {
          strapi
            .documents('plugin::translate.updated-entry')
            .create({
              data: {
                contentType: event.model.uid,
                groupID: event.result.documentId,
                localesWithUpdates: [event.result.locale],
              },
            })
            .catch(console.error)
        })
      }
    },
  })

  await strapi.admin.services.permission.actionProvider.registerMany(actions)
  await getService('translate').batchTranslateManager.bootstrap()
}

export default bootstrap
