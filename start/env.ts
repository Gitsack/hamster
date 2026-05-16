/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
  SESSION_AGE: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring cookies
  |----------------------------------------------------------
  */
  SECURE_COOKIES: Env.schema.boolean.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  /*
  |----------------------------------------------------------
  | Variables for service host mapping (local development)
  |----------------------------------------------------------
  */
  SERVICE_HOST_MAP: Env.schema.string.optional(),
  /*
   * Filesystem path translation, same syntax as SERVICE_HOST_MAP.
   * Each entry is FROM:TO and translates the FROM prefix on any DB-stored
   * filesystem path (e.g. download client localPath) to TO at FS-access time.
   * Used when the local dev environment mounts the same volume at a different
   * path than the production Docker setup (Docker: /downloads, local: /mnt/nas/download).
   * Example: SERVICE_PATH_MAP=/downloads:/mnt/nas/download,/media:/mnt/nas/media
   */
  SERVICE_PATH_MAP: Env.schema.string.optional(),

  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
})
