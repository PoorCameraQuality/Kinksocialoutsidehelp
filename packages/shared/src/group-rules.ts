import { z } from 'zod'

/** One rule shown in the join-group accordion modal (SG-096). */
export const groupRuleSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
})

export type GroupRule = z.infer<typeof groupRuleSchema>

export const groupRulesSchema = z.array(groupRuleSchema).max(20)

export type GroupRules = z.infer<typeof groupRulesSchema>

export function parseGroupRules(value: unknown): GroupRules {
  const parsed = groupRulesSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}
