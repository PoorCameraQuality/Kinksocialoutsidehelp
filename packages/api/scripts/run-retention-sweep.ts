/** CLI: run retention sweep once (dev/ops). Loads API env then prints JSON result. */
import '../src/load-dev-env.js'
import { runRetentionSweep } from '../src/lib/retention-sweep.js'

const result = await runRetentionSweep()
console.log(JSON.stringify(result, null, 2))
