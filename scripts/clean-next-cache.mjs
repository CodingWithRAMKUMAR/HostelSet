import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const target = resolve(process.cwd(), '.next')

if (!target.startsWith(process.cwd())) {
  throw new Error('Refusing to remove a path outside the project directory.')
}

await rm(target, { recursive: true, force: true })
console.log('Removed .next. Start dev/build only after the previous Next.js process has stopped.')
