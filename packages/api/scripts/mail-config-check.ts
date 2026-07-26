/** CLI: print mail transport diagnostic JSON; exit 1 when config is not OK. */
import { mailConfigDiagnostic } from '../src/lib/mail-config.js'

const diag = mailConfigDiagnostic()
console.log(JSON.stringify(diag, null, 2))
process.exit(diag.ok ? 0 : 1)
