/** Matches `shapeArticleRow` responses from `/api/v1/me/education-articles*` and `/api/v1/education/articles*`. */

export type EducationArticleVisibility = 'PUBLIC' | 'MEMBERS' | 'CONNECTIONS'

export type EducationPublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type ApiEducationArticle = {
  id: string
  authorUserId: string
  authorUsername: string
  authorDisplayName: string | null
  slug: string
  title: string
  excerpt: string | null
  bodyJson: Record<string, unknown>
  bodyHtml: string
  heroImageUrl: string | null
  categories: string[]
  difficulty: string | null
  contentWarnings: string[]
  readingMinutes: number | null
  linkedOfferingIds: string[]
  visibility: EducationArticleVisibility
  listInEducation: boolean
  publicationStatus: EducationPublicationStatus
  eckePublish: boolean
  organizationId: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  saveCount?: number
}
