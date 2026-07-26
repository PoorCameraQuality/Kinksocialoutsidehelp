/**
 * Fallback ECKE education articles when the sibling EastCoast repo is unavailable.
 * Source: East Coast Kink Events `src/data/education.js` (published articles only).
 */
export type EckeEducationArticleRow = {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  tags: string[]
  authorName: string
  publishDate: string
  readTime: string
  featured: boolean
}

export const ECKE_EDUCATION_ARTICLES: EckeEducationArticleRow[] = [
  {
    id: '1',
    slug: 'ssc-vs-rack-kink-safety-frameworks',
    title: 'SSC vs RACK: Understanding Kink Safety Frameworks',
    excerpt:
      'Learn the differences between SSC and RACK safety frameworks for responsible BDSM participation. Essential reading for kink community members.',
    category: 'Safety',
    tags: ['safety', 'ssc', 'rack', 'consent', 'beginners', 'education'],
    authorName: 'Dr. Sarah Chen',
    publishDate: '2024-01-15',
    readTime: '8 min read',
    featured: true,
    content: `# SSC vs RACK: Understanding Kink Safety Frameworks

## Introduction

When entering the kink community, you'll encounter two primary safety frameworks: SSC (Safe, Sane, and Consensual) and RACK (Risk-Aware Consensual Kink). Understanding these frameworks is crucial for responsible participation in BDSM activities.

## What is SSC?

**Safe, Sane, and Consensual** was one of the first widely adopted safety frameworks in the BDSM community.

### The Three Pillars:

- **Safe**: Activities should not cause permanent harm or injury
- **Sane**: Participants should be of sound mind and judgment
- **Consensual**: All parties must give informed, enthusiastic consent

## What is RACK?

**Risk-Aware Consensual Kink** emerged as a more nuanced approach that acknowledges that all activities carry some level of risk.

## Conclusion

Both frameworks emphasize consent and communication. Choose the language that helps you and your partners negotiate clearly.`,
  },
  {
    id: '2',
    slug: 'negotiation-101-building-consent-bdsm-relationships',
    title: 'Negotiation 101: Building Consent in BDSM Relationships',
    excerpt:
      'Learn the essential skills for building consent and trust in BDSM relationships through effective negotiation techniques.',
    category: 'Safety',
    tags: ['negotiation', 'consent', 'communication', 'safety', 'beginners', 'relationships'],
    authorName: 'Marcus Rodriguez',
    publishDate: '2024-01-20',
    readTime: '12 min read',
    featured: true,
    content: `# Negotiation 101: Building Consent in BDSM Relationships

## The Foundation of Kink

Negotiation is the cornerstone of ethical BDSM practice. It's not just about getting permission—it's about building understanding, trust, and mutual respect.

## The Negotiation Process

### 1. Pre-Negotiation Preparation

**Before the conversation:**
- Research the activities you're interested in
- Understand your own limits and desires
- Prepare questions about safety and logistics

### 2. Setting the Stage

**Choose the right time and place:**
- Private, distraction-free environment
- Both parties are well-rested and clear-headed

## Consent is Ongoing

Remember: **Consent can be withdrawn at any time.** Regular communication and check-ins are essential for maintaining ethical BDSM relationships.`,
  },
  {
    id: '3',
    slug: 'aftercare-essentials-supporting-partner-after-play',
    title: 'Aftercare Essentials: Supporting Your Partner After Play',
    excerpt:
      'Learn the essential skills for providing physical and emotional aftercare to support your partner after BDSM activities.',
    category: 'Safety',
    tags: ['aftercare', 'safety', 'emotional-health', 'relationships', 'support', 'wellness'],
    authorName: 'Dr. Emily Watson',
    publishDate: '2024-01-25',
    readTime: '10 min read',
    featured: false,
    content: `# Aftercare Essentials: Supporting Your Partner After Play

## What is Aftercare?

Aftercare is the care and support provided to partners after BDSM activities. It's essential for physical and emotional well-being, helping participants process their experiences and return to their normal state.

## Why Aftercare Matters

### Physical Recovery
- Replenish fluids and nutrients
- Address any physical discomfort
- Provide comfort and warmth

### Emotional Processing
- Help process intense emotions
- Provide reassurance and validation
- Strengthen emotional bonds

## Conclusion

Aftercare is not optional—it's an essential part of ethical BDSM practice.`,
  },
]
