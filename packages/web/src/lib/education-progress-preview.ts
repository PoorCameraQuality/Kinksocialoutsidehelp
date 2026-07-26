import type { ApiEducationArticle } from '@/lib/education-article-types'
import { MOCK_LEARNING_PATHS, type EducationLearningPath } from '@/lib/education-discover-data'

export type EducationProgressActivity = {
  id: string
  title: string
  href: string
  category: string
  activityLabel: string
  kind: 'module' | 'article' | 'outline'
}

export type EducationProgressSnapshot = {
  stats: {
    pathsInProgress: number
    modulesCompleted: number
    articlesEngaged: number
    weeklyGoalPercent: number
  }
  paths: EducationLearningPath[]
  resume: {
    pathTitle: string
    moduleLabel: string
    href: string
    progressPercent: number
  } | null
  recent: EducationProgressActivity[]
}

const ACTIVITY_LABELS = ['Last read yesterday', 'Module completed 3 days ago', 'Resumed 5 days ago', 'Saved 1 week ago']

/** Alpha preview: show realistic completion on live series paths. */
export function applyPreviewProgressToPaths(paths: EducationLearningPath[]): EducationLearningPath[] {
  if (paths.length === 0) return MOCK_LEARNING_PATHS

  return paths.map((path, pathIndex) => {
    const total = path.modules.length
    if (total === 0) return path

    const presetComplete =
      pathIndex === 0 ? Math.max(1, Math.ceil(total * 0.34))
      : pathIndex === 1 ? Math.max(2, Math.ceil(total * 0.67))
      : pathIndex === 2 ? 1
      : 0

    const modules = path.modules.map((mod, i) => ({
      ...mod,
      completed: mod.completed || i < presetComplete,
    }))
    const completed = modules.filter((m) => m.completed).length
    const progressPercent = Math.round((completed / total) * 100)

    return { ...path, modules, progressPercent }
  })
}

function pickResumePath(paths: EducationLearningPath[]): EducationProgressSnapshot['resume'] {
  const inProgress = paths
    .filter((p) => p.progressPercent > 0 && p.progressPercent < 100)
    .sort((a, b) => b.progressPercent - a.progressPercent)

  const path = inProgress[0] ?? paths.find((p) => p.progressPercent === 0)
  if (!path) return null

  const nextModule = path.modules.find((m) => !m.completed) ?? path.modules[path.modules.length - 1]
  if (!nextModule) return null

  return {
    pathTitle: path.title,
    moduleLabel: nextModule.label,
    href: path.href,
    progressPercent: path.progressPercent,
  }
}

function articlesToRecentActivity(articles: ApiEducationArticle[]): EducationProgressActivity[] {
  return articles.slice(0, 5).map((article, index) => ({
    id: article.id,
    title: article.title,
    href: `/education/${encodeURIComponent(article.slug)}`,
    category: article.categories[0] ?? 'Article',
    activityLabel: ACTIVITY_LABELS[index % ACTIVITY_LABELS.length] ?? 'Recently viewed',
    kind: index === 1 ? 'module' : 'article',
  }))
}

const MOCK_RECENT: EducationProgressActivity[] = [
  {
    id: 'mock-1',
    title: 'Consent check-ins that actually stick',
    href: '/education?view=articles',
    category: 'Safety',
    activityLabel: 'Module completed yesterday',
    kind: 'module',
  },
  {
    id: 'mock-2',
    title: 'SSC vs RACK: Understanding Kink Safety Frameworks',
    href: '/education?view=articles',
    category: 'Safety',
    activityLabel: 'Last read 2 days ago',
    kind: 'article',
  },
  {
    id: 'mock-3',
    title: 'Floor rope fundamentals',
    href: '/education?view=articles',
    category: 'Gear',
    activityLabel: 'Saved outline · 4 days ago',
    kind: 'outline',
  },
]

export function buildProgressSnapshot(
  paths: EducationLearningPath[],
  articles: ApiEducationArticle[],
): EducationProgressSnapshot {
  const withProgress = applyPreviewProgressToPaths(paths)
  const modulesCompleted = withProgress.reduce((sum, p) => sum + p.modules.filter((m) => m.completed).length, 0)
  const pathsInProgress = withProgress.filter((p) => p.progressPercent > 0 && p.progressPercent < 100).length
  const articlesEngaged = articles.length > 0 ? Math.min(articles.length, 5) : 3
  const recent = articles.length > 0 ? articlesToRecentActivity(articles) : MOCK_RECENT

  return {
    stats: {
      pathsInProgress,
      modulesCompleted,
      articlesEngaged,
      weeklyGoalPercent: Math.min(100, Math.round(modulesCompleted * 12 + pathsInProgress * 8)),
    },
    paths: withProgress,
    resume: pickResumePath(withProgress),
    recent,
  }
}
