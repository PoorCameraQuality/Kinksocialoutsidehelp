import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  buildKinkSocialCsafProviderMetadata,
  buildKinkSocialRobotsTxt,
  buildKinkSocialSecurityTxt,
  buildKinkSocialSitemapXml,
  ECKE_URL,
  KINK_SOCIAL_PUBLIC_SITEMAP_PATHS,
  KINK_SOCIAL_ROBOTS_META,
  KINK_SOCIAL_X_ROBOTS_TAG,
  eckePayloadContainsPrivateAppUrls,
  isEckePublishEligible,
  isKinkSocialPublicIndexPath,
  isKinkSocialPublicLaunchEnabled,
  kinkSocialPublicCaddyExemptPaths,
  kinkSocialPublicRobotsAllowLines,
  sanitizeEckePublicText,
  sanitizeEckeEducationPublicText,
  educationEckePayloadContainsLeakedPrivateUrls,
  sanitizeEckeArticleSlug,
  sanitizeEckeHeroImageUrl,
  sanitizeEckeEducationBodyHtml,
} from './seo-policy'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const webRoot = join(repoRoot, 'packages/web')
const dockerRoot = join(repoRoot, 'docker')

describe('seo-policy', () => {
  it('isEckePublishEligible requires publishToEcke, public visibility, and approved moderation', () => {
    assert.equal(
      isEckePublishEligible({
        publishToEcke: true,
        visibility: 'PUBLIC',
        moderationStatus: 'approved',
      }),
      true,
    )
    assert.equal(isEckePublishEligible({ publishToEcke: false, visibility: 'PUBLIC' }), false)
    assert.equal(isEckePublishEligible({ publishToEcke: true, visibility: 'MEMBERS' }), false)
    assert.equal(
      isEckePublishEligible({ publishToEcke: true, visibility: 'PUBLIC', directoryVisibility: 'UNLISTED' }),
      false,
    )
    assert.equal(
      isEckePublishEligible({ publishToEcke: true, visibility: 'PUBLIC', moderationStatus: 'pending' }),
      false,
    )
    assert.equal(
      isEckePublishEligible({ publishToEcke: true, visibility: 'PUBLIC', publicationStatus: 'DRAFT' }),
      false,
    )
  })

  it('isKinkSocialPublicLaunchEnabled parses launch flags', () => {
    assert.equal(isKinkSocialPublicLaunchEnabled('true'), true)
    assert.equal(isKinkSocialPublicLaunchEnabled('1'), true)
    assert.equal(isKinkSocialPublicLaunchEnabled('false'), false)
    assert.equal(isKinkSocialPublicLaunchEnabled(null), false)
  })

  it('buildKinkSocialRobotsTxt and sitemap respond to launch flag', () => {
    assert.match(buildKinkSocialRobotsTxt(false), /Disallow:\s*\//)
    const robotsLaunch = buildKinkSocialRobotsTxt(true)
    assert.match(robotsLaunch, /Allow:\s*\/sitemap\.xml/)
    assert.match(robotsLaunch, /Allow:\s*\/\$/)
    assert.match(robotsLaunch, /Allow:\s*\/about\$/)
    assert.match(robotsLaunch, /Allow:\s*\/policies/)
    assert.match(robotsLaunch, /Disallow:\s*\//)
    assert.match(robotsLaunch, /Sitemap:\s*https:\/\/kink\.social\/sitemap\.xml/)
    assert.ok(
      robotsLaunch.indexOf('Allow: /sitemap.xml') < robotsLaunch.indexOf('Disallow: /'),
      'Allow sitemap must precede Disallow: / for GSC fetch',
    )
    assert.match(
      buildKinkSocialRobotsTxt(true, 'https://staging.example.com/'),
      /Sitemap:\s*https:\/\/staging\.example\.com\/sitemap\.xml/,
    )
    assert.doesNotMatch(buildKinkSocialRobotsTxt(true), /Allow:\s*\/home/)
    assert.doesNotMatch(buildKinkSocialRobotsTxt(true), /Allow:\s*\/events/)
    const xml = buildKinkSocialSitemapXml('https://kink.social')
    assert.match(xml, /<urlset/)
    assert.match(xml, /<loc>https:\/\/kink\.social\/<\/loc>/)
    assert.match(xml, /<loc>https:\/\/kink\.social\/about<\/loc>/)
    assert.match(xml, /<loc>https:\/\/kink\.social\/terms<\/loc>/)
    assert.match(xml, /<loc>https:\/\/kink\.social\/policies\/appeals<\/loc>/)
    assert.doesNotMatch(xml, /<loc>https:\/\/kink\.social\/events<\/loc>/)
    assert.doesNotMatch(xml, /<loc>https:\/\/kink\.social\/home<\/loc>/)
  })

  it('public index allowlist covers brand/legal only', () => {
    assert.equal(isKinkSocialPublicIndexPath('/'), true)
    assert.equal(isKinkSocialPublicIndexPath('/about'), true)
    assert.equal(isKinkSocialPublicIndexPath('/about/'), true)
    assert.equal(isKinkSocialPublicIndexPath('/policies/appeals'), true)
    assert.equal(isKinkSocialPublicIndexPath('/policies/new-policy'), true)
    assert.equal(isKinkSocialPublicIndexPath('/home'), false)
    assert.equal(isKinkSocialPublicIndexPath('/events'), false)
    assert.equal(isKinkSocialPublicIndexPath('/messages/inbox'), false)
    assert.ok(KINK_SOCIAL_PUBLIC_SITEMAP_PATHS.includes('/about'))
    assert.ok(kinkSocialPublicRobotsAllowLines().includes('Allow: /about$'))
    assert.ok(kinkSocialPublicCaddyExemptPaths().includes('/policies/*'))
  })

  it('sanitizeEckePublicText strips kink.social references', () => {
    assert.equal(
      sanitizeEckePublicText('Join us at https://kink.social/events/foo for details'),
      'Join us at  for details',
    )
    assert.equal(eckePayloadContainsPrivateAppUrls({ website: 'https://kink.social/orgs/x' }), true)
    assert.equal(eckePayloadContainsPrivateAppUrls({ website: `${ECKE_URL}/events/foo` }), false)
    assert.equal(
      eckePayloadContainsPrivateAppUrls({
        logo: 'https://kink.social/c2k-uploads/events/demo/cover.png',
      }),
      false,
    )
    assert.equal(
      sanitizeEckeHeroImageUrl('https://kink.social/c2k-uploads/events/demo/cover.png'),
      'https://kink.social/c2k-uploads/events/demo/cover.png',
    )
    assert.equal(sanitizeEckeHeroImageUrl('https://kink.social/api/v1/media/assets/x/content'), null)
    assert.equal(sanitizeEckeHeroImageUrl('https://cdn.example.com/hero.jpg'), 'https://cdn.example.com/hero.jpg')
  })

  it('education sanitizer keeps brand mentions and strips private app URLs only', () => {
    assert.equal(
      sanitizeEckeEducationPublicText('Kink.Social alpha at https://kink.social/messages/inbox'),
      'Kink.Social alpha at',
    )
    assert.equal(sanitizeEckeArticleSlug('kink.social-goes-live'), 'kink-social-goes-live')
    const payload = {
      title: 'Kink.Social launch',
      bodyHtml: '<p>Visit kink.social today</p>',
      authorProfileUrl: 'https://kink.social/profile/demo',
    }
    assert.equal(educationEckePayloadContainsLeakedPrivateUrls(payload), false)
    assert.equal(
      educationEckePayloadContainsLeakedPrivateUrls({
        ...payload,
        bodyHtml: '<p>https://kink.social/settings/account</p>',
      }),
      true,
    )
    // Regression: detection must not depend on prior RegExp lastIndex (sticky /g).
    const clean = { note: 'Visit kink.social today' }
    const dirty = { note: 'https://kink.social/organizer/orgs/demo' }
    assert.equal(educationEckePayloadContainsLeakedPrivateUrls(dirty), true)
    assert.equal(educationEckePayloadContainsLeakedPrivateUrls(clean), false)
    assert.equal(educationEckePayloadContainsLeakedPrivateUrls(dirty), true)
    assert.equal(educationEckePayloadContainsLeakedPrivateUrls(clean), false)
  })

  it('sanitizeEckeEducationBodyHtml keeps formatting and public CDN images', () => {
    const body =
      '<h2>Guide</h2><p><strong>Bold</strong> tip</p><ul><li>One</li></ul>' +
      '<img src="https://kink.social/c2k-uploads/edu/demo.jpg" alt="x" />' +
      '<p>See https://kink.social/settings/account later</p>' +
      '<img src="https://kink.social/api/v1/media/assets/x/content" alt="private" />'
    const out = sanitizeEckeEducationBodyHtml(body) ?? ''
    assert.match(out, /<h2>Guide<\/h2>/)
    assert.match(out, /<strong>Bold<\/strong>/)
    assert.match(out, /<ul>/)
    assert.match(out, /c2k-uploads\/edu\/demo\.jpg/)
    assert.doesNotMatch(out, /settings\/account/)
    assert.doesNotMatch(out, /media\/assets/)
  })
})

describe('kink.social crawl policy (source files)', () => {
  const robotsTxt = readFileSync(join(webRoot, 'public/robots.txt'), 'utf8')
  const indexHtml = readFileSync(join(webRoot, 'index.html'), 'utf8')
  const nginxConf = readFileSync(join(dockerRoot, 'nginx-spa.conf'), 'utf8')
  const caddyfile = readFileSync(join(repoRoot, 'Caddyfile'), 'utf8')
  const scopeMetaSrc = readFileSync(join(webRoot, 'src/components/seo/ScopePageMeta.tsx'), 'utf8')
  const appRobotsSrc = readFileSync(join(webRoot, 'src/components/seo/AppRobotsMeta.tsx'), 'utf8')
  const landingMetaSrc = readFileSync(join(webRoot, 'src/components/seo/LandingPageMeta.tsx'), 'utf8')
  const footerSrc = readFileSync(join(webRoot, 'src/components/Footer.tsx'), 'utf8')
  const viteConfigSrc = readFileSync(join(webRoot, 'vite.config.ts'), 'utf8')
  const shareRoutesSrc = readFileSync(join(repoRoot, 'packages/api/src/routes/share-routes.ts'), 'utf8')

  it('robots.txt allowlists brand/legal pages when launch is enabled', () => {
    assert.match(robotsTxt, /User-agent:\s*\*/i)
    assert.match(robotsTxt, /Disallow:\s*\//)
    assert.match(robotsTxt, /Allow:\s*\/\$/)
    assert.match(robotsTxt, /Allow:\s*\/sitemap\.xml/)
    assert.match(robotsTxt, /Allow:\s*\/about\$/)
    assert.match(robotsTxt, /Allow:\s*\/policies/)
    assert.match(robotsTxt, /Sitemap:\s*https:\/\/kink\.social\/sitemap\.xml/)
    assert.equal(
      robotsTxt.replace(/\r\n/g, '\n').trim(),
      buildKinkSocialRobotsTxt(true).trim(),
    )
    assert.doesNotMatch(robotsTxt, /Allow:\s*\/events/)
    assert.doesNotMatch(robotsTxt, /Allow:\s*\/home/)
  })

  it('Helmet components keep member app noindex; allowlist paths opt in via AppRobotsMeta', () => {
    assert.doesNotMatch(indexHtml, /noindex,\s*nofollow,\s*noarchive,\s*nosnippet/)
    assert.match(scopeMetaSrc, /KINK_SOCIAL_ROBOTS_META/)
    assert.match(appRobotsSrc, /KINK_SOCIAL_ROBOTS_META/)
    assert.match(appRobotsSrc, /isKinkSocialPublicIndexPath/)
    assert.match(appRobotsSrc, /KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META/)
    assert.match(landingMetaSrc, /KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META/)
    assert.match(landingMetaSrc, /VITE_PUBLIC_LAUNCH/)
    assert.match(viteConfigSrc, /isKinkSocialPublicIndexPath/)
  })

  it('ScopePageMeta stays noindex unless explicitly overridden', () => {
    assert.match(scopeMetaSrc, /content=\{robots\}/)
    assert.match(scopeMetaSrc, /KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META/)
    assert.equal(KINK_SOCIAL_ROBOTS_META, 'noindex, nofollow, noarchive, nosnippet')
  })

  it('Caddy sets X-Robots-Tag noindex except on brand/legal allowlist when public launch is enabled', () => {
    assert.match(caddyfile, /C2K_PUBLIC_LAUNCH/)
    assert.match(caddyfile, /@not_landing\s+not path /)
    for (const path of kinkSocialPublicCaddyExemptPaths()) {
      assert.match(
        caddyfile,
        new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `Caddy @not_landing missing exempt path ${path}`,
      )
    }
    assert.match(caddyfile, /@private_launch/)
    assert.match(caddyfile, new RegExp(KINK_SOCIAL_X_ROBOTS_TAG.replace(/,\s*/g, ',\\s*')))
    assert.doesNotMatch(nginxConf, new RegExp(KINK_SOCIAL_X_ROBOTS_TAG.replace(/,\s*/g, ',\\s*')))
  })

  it('sitemap is launch-gated at build time and footer does not link to kink.social sitemap', () => {
    assert.match(nginxConf, /location\s*=\s*\/sitemap\.xml/)
    assert.match(nginxConf, /try_files\s+\/sitemap\.xml/)
    assert.match(viteConfigSrc, /\/sitemap\.xml/)
    assert.match(viteConfigSrc, /VITE_PUBLIC_LAUNCH/)
    assert.doesNotMatch(footerSrc, /to="\/sitemap\.xml"/)
  })

  it('security.txt is served at /.well-known with legacy redirect', () => {
    assert.match(nginxConf, /location\s*=\s*\/\.well-known\/security\.txt/)
    assert.match(nginxConf, /location\s*=\s*\/security\.txt/)
    assert.match(nginxConf, /location\s*=\s*\/\.well-known\/csaf\/provider-metadata\.json/)
    assert.match(viteConfigSrc, /\.well-known\/security\.txt/)
    assert.match(viteConfigSrc, /provider-metadata\.json/)
    const securityTxt = buildKinkSocialSecurityTxt('https://kink.social')
    assert.match(securityTxt, /Contact: mailto:sheldonkinneymmo\.tm@gmail\.com/)
    assert.match(securityTxt, /Expires: 2027-06-30T09:27:00\.000Z/)
    assert.match(securityTxt, /Policy: https:\/\/kink\.social\/security/)
    assert.match(securityTxt, /CSAF: https:\/\/kink\.social\/\.well-known\/csaf\/provider-metadata\.json/)
    const csaf = buildKinkSocialCsafProviderMetadata('https://kink.social')
    assert.equal(csaf.list_on_CSAF_aggregators, false)
    assert.equal(csaf.mirror_on_CSAF_aggregators, false)
    assert.equal(csaf.metadata_version, '2.0')
  })

  it('share crawler HTML is noindex with X-Robots-Tag header', () => {
    assert.match(shareRoutesSrc, /X-Robots-Tag/)
    assert.match(shareRoutesSrc, /KINK_SOCIAL_ROBOTS_META/)
  })
})

describe('ECKE publish boundary', () => {
  it('ECKE URLs use eastcoastkinkevents.com, not kink.social', () => {
    const dancecardPayloadSrc = readFileSync(
      join(repoRoot, 'packages/api/src/lib/ecke-publish-payload.ts'),
      'utf8',
    )
    assert.match(dancecardPayloadSrc, /eastcoastkinkevents\.com/)
    assert.doesNotMatch(dancecardPayloadSrc, /kink\.social/)
  })
})
