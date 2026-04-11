import { fileURLToPath } from 'node:url'
import { IndexGenerator } from '@adonisjs/assembler/index_generator'
import { indexEntities } from '@adonisjs/core'
import { indexPages } from '@adonisjs/inertia'

const appRoot = fileURLToPath(new URL('../', import.meta.url))
const logger = { info: () => {} }
const generator = new IndexGenerator(appRoot, logger)

await indexEntities().run(null, null, generator)
await indexPages({ framework: 'react' }).run(null, null, generator)
await generator.generate()
