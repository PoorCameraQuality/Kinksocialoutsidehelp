import type { MockArticle } from '@/data/types'

/**
 * Filters articles by optional category tab and search query (title, category, tags).
 */
export function filterMockArticles(
  articles: MockArticle[],
  opts: { selectedCategory: string | null; searchQuery: string }
): MockArticle[] {
  let list = opts.selectedCategory ? articles.filter((a) => a.category === opts.selectedCategory) : articles

  const q = opts.searchQuery.trim().toLowerCase()
  if (!q) return list

  return list.filter((a) => {
    const tags = (a.tags ?? []).join(' ').toLowerCase()
    return (
      a.title.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      tags.includes(q)
    )
  })
}
