import type { FastifyInstance } from 'fastify'
import { createRegistrar } from './shared.js'
import { registerDoorRoutes } from './door-routes.js'
import { registerModuleRoutes } from './modules-routes.js'
import { registerOpsRoutes } from './ops-routes.js'
import { registerPeopleRoutes } from './people-routes.js'
import { registerPolicyRoutes } from './policy-routes.js'
import { registerProgramExtRoutes, registerExportsExtRoutes } from './program-ext-routes.js'
import { registerRegistrationRoutes } from './registration-routes.js'

import { registerParticipationRoutes } from './participation-routes.js'

/** Registers all extension routes ported for Command Bridge completion. */
export function registerConventionOrganizerExtensionRoutes(
  app: FastifyInstance,
  registered: string[],
) {
  const reg = createRegistrar(app, registered)
  registerOpsRoutes(reg)
  registerPeopleRoutes(reg)
  registerRegistrationRoutes(reg)
  registerParticipationRoutes(app, registered)
  registerDoorRoutes(reg)
  registerPolicyRoutes(reg)
  registerProgramExtRoutes(reg)
  registerExportsExtRoutes(reg)
  registerModuleRoutes(reg)
}
