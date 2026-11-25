import {
  ServiceMap,
  TranslatePluginService,
} from '@mdespeuilles/strapi-plugin-translate/shared'

export const getService = <Name extends keyof ServiceMap>(name: Name) => {
  return strapi.plugin('translate').service<TranslatePluginService<Name>>(name)
}
