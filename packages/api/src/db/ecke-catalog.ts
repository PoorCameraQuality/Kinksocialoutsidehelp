/**
 * Curated seed catalog from public listings on https://www.eastcoastkinkevents.com
 * C2K is not affiliated with ECKE; used for realistic local dev QA only.
 */
export const ECKE_SOURCE = 'https://www.eastcoastkinkevents.com'

export type EckeEventRow = {
  title: string
  location: string
  startsAt: string
  endsAt: string
  slug: string
  description: string
  category: string
  imageUrl?: string | null
}

export type EckeVendorRow = {
  name: string
  slug: string
  bio: string
  location: string
  categories: string[]
  website?: string
  logoUrl?: string | null
  productImageUrl?: string | null
}

export type EckeDungeonRow = {
  name: string
  slug: string
  location: string
  category: string
  description: string
  logoUrl?: string | null
  website?: string | null
}

export type EckePersonaRow = {
  username: string
  displayName: string
  bio: string
  location: string
  stateName: string
  isVendor?: boolean
}

function ev(
  title: string,
  location: string,
  start: string,
  end: string,
  slug: string,
  blurb: string,
  category = 'Convention',
): EckeEventRow {
  return {
    title,
    location,
    startsAt: `${start}T18:00:00.000Z`,
    endsAt: `${end}T04:00:00.000Z`,
    slug,
    description: `${blurb} Listing reference: ${ECKE_SOURCE}/events/${slug}`,
    category,
  }
}

/** 46 upcoming listings (eastcoastkinkevents.com/events, May 2026 crawl). */
export const ECKE_UPCOMING_EVENTS: EckeEventRow[] = [
  ev('Camp Crucible', 'Darlington, MD', '2026-05-23', '2026-05-31', 'camp-crucible', 'Maryland camp-style gathering with classes, dungeons, and community programming.'),
  ev('Kink Odyssey · Spring 2026', 'Greenwich, NY', '2026-05-27', '2026-05-31', 'kink-odyssey-spring-2026', 'Upstate retreat weekend with education tracks and social space.'),
  ev("Naughty N'at", 'Pittsburgh, PA', '2026-05-28', '2026-05-31', 'naughty-nat', 'Pittsburgh hotel weekend. Parties, classes, and vendor market.'),
  ev('Oklahoma LeatherFest 2026', 'Oklahoma City, OK', '2026-05-29', '2026-05-31', 'oklahoma-leatherfest-2026', 'Regional leather weekend with contests and vendor hall.'),
  ev('Twisted Tryst', 'Athens, OH', '2026-06-11', '2026-06-14', 'twisted-tryst', 'Ohio regional play party weekend with workshops.'),
  ev('Dark Odyssey Fusion', 'Darlington, MD', '2026-06-23', '2026-06-29', 'dark-odyssey-fusion', 'Maryland fusion weekend. Ritual, education, and dungeon space.'),
  ev('TESFest', 'Piscataway, NJ', '2026-07-02', '2026-07-05', 'tesfest', 'Central NJ education-focused convention with large class grid.'),
  ev("Naughty in N'Awlins", 'New Orleans, LA', '2026-07-08', '2026-07-12', 'naughty-in-nawlins', 'French Quarter-adjacent kink weekend with parties and classes.'),
  ev('Chicago Fetish Weekend 2026', 'Chicago, IL', '2026-07-09', '2026-07-12', 'chicago-fetish-weekend-2026', 'Windy City hotel programming, vendor hall, and parties.'),
  ev('Elevation Rope 2026', 'Horse Shoe, NC', '2026-07-16', '2026-07-21', 'elevation-rope-2026', 'Rope-intensive week in western North Carolina.'),
  ev('Beguiled 2026 · Odyssey of Trance', 'Chicago, IL', '2026-07-16', '2026-07-19', 'beguiled-2026', 'Hypnosis and trance-focused weekend. Confirm on organiser site.'),
  ev('OKC Kink Weekend 2026', 'Oklahoma City, OK', '2026-07-16', '2026-07-19', 'okc-kink-weekend-2026', 'Long weekend of classes and play in OKC.'),
  ev('Whips and Wine', 'Eastern Pennsylvania, PA', '2026-07-17', '2026-07-19', 'whips-and-wine', 'PA weekend pairing tastings with kink classes.'),
  ev('FetCamp', 'Northern Massachusetts, MA', '2026-07-17', '2026-07-19', 'fetcamp', 'Outdoor-friendly camp with workshops and dungeons.'),
  ev('World Bear Weekend 2026', 'Lexington, KY', '2026-07-30', '2026-08-02', 'world-bear-weekend-2026', 'Bear community takeover weekend.'),
  ev("Pacific Northwest Leathermen's Campout 2026", 'Portland area, OR', '2026-07-30', '2026-08-02', 'pnw-leathermens-campout-2026', 'Outdoor leather camp programming.'),
  ev('Fetish Con XXIV', 'St. Petersburg, FL', '2026-08-06', '2026-08-09', 'fetish-con-xxiv', 'Florida fetish convention with vendor floor and parties.'),
  ev('Naughty Knowledge', 'Gettysburg, PA', '2026-08-06', '2026-08-09', 'naughty-knowledge', 'Education-heavy Pennsylvania weekend.'),
  ev('Dark Odyssey Camp Thornwood 2026', 'Sierra Foothills, CA', '2026-08-10', '2026-08-17', 'dark-odyssey-camp-thornwood-2026', 'West coast camp week. Confirm dates on organiser site.'),
  ev('Kink Down South Weekend 2026', 'Atlanta, GA', '2026-08-14', '2026-08-16', 'kink-down-south-weekend-2026', 'Atlanta-area summer play weekend.'),
  ev('The Summer Michigan Rope Conference (SMIRC)', 'Troy, MI', '2026-08-15', '2026-08-17', 'smirc-2026', 'Michigan rope education conference.'),
  ev('goBOUNDLESS Full Access Member Camp 2026', 'Central Massachusetts, MA', '2026-08-20', '2026-08-23', 'goboundless-member-camp-2026', 'Member camp with early arrival window.'),
  ev('Iowa Leather Weekend 2026', 'Des Moines, IA', '2026-08-28', '2026-08-30', 'iowa-leather-weekend-2026', 'Midwest leather social weekend.'),
  ev('Dark Odyssey Summer Camp', 'Northern Maryland, MD', '2026-09-01', '2026-09-07', 'dark-odyssey-summer-camp', 'Week-long Maryland camp with ritual and play tracks.'),
  ev('The Master/slave Conference (MsC) 2026', 'Washington, DC', '2026-09-03', '2026-09-07', 'master-slave-conference-2026', 'Labor Day M/s education and social programming in DC.'),
  ev('MAUL 20th Anniversary Weekend', 'Providence, RI', '2026-09-17', '2026-09-20', 'maul-20th-anniversary', 'Rhode Island leather anniversary weekend.'),
  ev('Annual Kink Expo · Elgin Munchers 2026', 'Chicago suburbs, IL', '2026-09-18', '2026-09-20', 'elgin-munchers-kink-expo-2026', 'Chicago-area expo with vendors and classes.'),
  ev('Women of Drummer 2026', 'Darlington, MD', '2026-09-24', '2026-09-27', 'women-of-drummer-2026', 'Women-focused leather weekend in Maryland.'),
  ev('DomCon New Orleans 2026', 'New Orleans, LA', '2026-09-30', '2026-10-04', 'domcon-new-orleans-2026', 'Pro-domme and lifestyle education convention.'),
  ev('FORNUCOPIA', 'Darlington, MD', '2026-10-01', '2026-10-04', 'fornucopia', 'Maryland autumn gathering with vendor market.'),
  ev('Beyond Vanilla 35', 'Dallas, TX', '2026-10-01', '2026-10-04', 'beyond-vanilla-35', 'Dallas educational weekend.'),
  ev('NEPAH 2027 (Northeast Pet & Handler Weekend)', 'Philadelphia, PA', '2026-10-16', '2026-10-18', 'nepah-2027', 'Pet and handler social weekend in Philly.'),
  ev('Kinky Kollege: Homecoming 2026', 'Chicago, IL', '2026-10-16', '2026-10-18', 'kinky-kollege-homecoming-2026', 'Chicago homecoming-style kink college weekend.'),
  ev('Ohio SMART Fetish Flea', 'Cleveland, OH', '2026-10-16', '2026-10-18', 'ohio-smart-fetish-flea', 'Vendor-forward fetish flea market weekend.'),
  ev('Dark Odyssey Surrender 2026', 'San Jose, CA', '2026-10-22', '2026-10-25', 'dark-odyssey-surrender-2026', 'West coast surrender-focused retreat.'),
  ev('Exploration Into Kink (EiK) 2026', 'St Louis Metro Area, MO', '2026-11-06', '2026-11-08', 'exploration-into-kink-2026', 'St. Louis regional education weekend.'),
  ev('Kinky Con 2026', 'Manchester, NH', '2026-11-13', '2026-11-15', 'kinky-con-2026', 'New England indoor convention.'),
  ev('Leather Reign 2026', 'Seattle metro, WA', '2026-11-13', '2026-11-15', 'leather-reign-2026', 'Pacific Northwest leather weekend.'),
  ev('Naughty Noel 2026', 'Gettysburg, PA', '2026-12-03', '2026-12-06', 'naughty-noel-2026', 'Holiday hotel weekend in Pennsylvania.'),
  ev('Florida Power Exchange Conference', 'Tampa Bay area, FL', '2027-01-08', '2027-01-11', 'florida-power-exchange-conference', 'Florida power exchange education weekend.'),
  ev('Tethered Together 2027', 'Stamford, CT', '2027-03-19', '2027-03-22', 'tethered-together-2027', 'Connecticut rope and connection weekend.'),
]

export const ECKE_VENDORS: EckeVendorRow[] = [
  {
    name: 'Flogging Farmers',
    slug: 'flogging-farmers',
    bio: 'Handcrafted birch wood floggers and impact implements. Balance, finish, and durability for real play.',
    location: 'Online • Etsy',
    categories: ['Impact', 'Handmade'],
    website: ECKE_SOURCE,
  },
  {
    name: 'Agreeable Agony',
    slug: 'agreeable-agony',
    bio: 'Small-batch impact and sensation tools for convention floors and dungeon vending.',
    location: 'Online',
    categories: ['Impact', 'Sensation'],
  },
  {
    name: 'Anubis Gear',
    slug: 'anubis-gear',
    bio: 'Leather restraints, fetish wear, and custom commission work.',
    location: 'Online',
    categories: ['Leather', 'Restraints'],
  },
  {
    name: 'Barking Leather',
    slug: 'barking-leather',
    bio: 'Atlanta leather brand. Harnesses, apparel, and pup play gear.',
    location: 'Atlanta, GA',
    categories: ['Leather', 'Pup play'],
  },
  {
    name: "Addison's Jewelry and Design",
    slug: 'addisons-jewelry',
    bio: 'Chained Rapture. Collars, chain work, and custom jewelry.',
    location: 'Online',
    categories: ['Jewelry', 'Collars'],
  },
  {
    name: 'Angel Eyes Photography',
    slug: 'angel-eyes-photography',
    bio: 'Chicago-based studio. Portraits, boudoir, and event photography on the circuit.',
    location: 'Chicago, IL',
    categories: ['Photography', 'Services'],
  },
  {
    name: 'BadPups Store',
    slug: 'badpups-store',
    bio: 'Pup and pet play gear, chastity, and broader BDSM accessories.',
    location: 'Online',
    categories: ['Pup play', 'Gear'],
  },
  {
    name: 'Bastille & Bags',
    slug: 'bastille-and-bags',
    bio: 'Handmade leather bags and fetish wear for travel and dungeons.',
    location: 'Online',
    categories: ['Leather', 'Accessories'],
  },
  {
    name: 'Arcane Impact',
    slug: 'arcane-impact',
    bio: 'Convention-favorite impact toys and sensation tools.',
    location: 'Online',
    categories: ['Impact'],
  },
  {
    name: 'Awkward Artist Studio',
    slug: 'awkward-artist-studio',
    bio: 'Mixed media, decor, and aftercare lifestyle goods.',
    location: 'Online',
    categories: ['Lifestyle', 'Aftercare'],
  },
]

export const ECKE_DUNGEONS: EckeDungeonRow[] = [
  {
    name: 'Baltimore Playhouse',
    slug: 'baltimore-playhouse',
    location: 'Baltimore, MD',
    category: 'BDSM Dungeon',
    description: 'Charm City play space since 1997 · 12,000 sq ft, alcohol-free, Kink First Contact nights.',
  },
  {
    name: 'B.O.I.N.K.',
    slug: 'boink-holyoke',
    location: 'Holyoke, MA',
    category: 'BDSM Dungeon & Retail',
    description: 'Western MA retail and event home. Rope parties and classes at 358 Dwight St.',
  },
  {
    name: 'Black Rose',
    slug: 'black-rose-dc',
    location: 'Washington, DC',
    category: 'Community Organization',
    description: 'DC-area BDSM education nonprofit. Classes, munches, and play parties since 1988.',
  },
  {
    name: 'Ascend Hudson Valley Community',
    slug: 'ascend-hudson-valley',
    location: 'Hudson Valley, NY',
    category: 'Kink Community',
    description: 'RACK-focused Hudson Valley community space and events.',
  },
  {
    name: 'The Crucible',
    slug: 'the-crucible-washington',
    location: 'Washington, DC',
    category: 'BDSM Dungeon',
    description: 'DC institution for classes, parties, and staffed play space.',
  },
  {
    name: 'The Woodshed',
    slug: 'the-woodshed-orlando',
    location: 'Orlando, FL',
    category: 'BDSM Dungeon',
    description: 'Florida dungeon with membership paths and recurring parties.',
  },
]

/** Additional community accounts beyond core demo users. */
export const ECKE_PERSONAS: EckePersonaRow[] = [
  {
    username: 'HarborRigger',
    displayName: 'Jordan Reed',
    bio: 'Rigger on the I-95 corridor. Teaching at Elevation Rope and TESFest this summer.',
    location: 'Baltimore, MD',
    stateName: 'Maryland',
  },
  {
    username: 'PhillyQueerKink',
    displayName: 'Sam Ortiz',
    bio: 'Organizer and educator · NEPAH prep, Philly munches, and hub moderation.',
    location: 'Philadelphia, PA',
    stateName: 'Pennsylvania',
  },
  {
    username: 'DCBlackRose',
    displayName: 'Alex Morgan',
    bio: 'Black Rose volunteer. Classes on consent frameworks and dungeon etiquette.',
    location: 'Washington, DC',
    stateName: 'Maryland',
  },
  {
    username: 'NOLA_traveler',
    displayName: 'Riley Chen',
    bio: 'Traveling bottom · Naughty in N\'Awlins and DomCon on the calendar.',
    location: 'New Orleans, LA',
    stateName: 'Louisiana',
  },
  {
    username: 'ChiKinkHost',
    displayName: 'Morgan Lee',
    bio: 'Chicago weekend host · CFw and Kinky Kollege regular.',
    location: 'Chicago, IL',
    stateName: 'Illinois',
  },
  {
    username: 'RopeElevation',
    displayName: 'Casey Ng',
    bio: 'Switch rope top · SMIRC and Elevation volunteer.',
    location: 'Horse Shoe, NC',
    stateName: 'North Carolina',
  },
  {
    username: 'FloggingFarmers',
    displayName: 'Flogging Farmers',
    bio: 'Vendor account for birch floggers. Find us at TESFest and FORNUCOPIA.',
    location: 'Online',
    stateName: 'Pennsylvania',
    isVendor: true,
  },
  {
    username: 'AgreeableAgony',
    displayName: 'Agreeable Agony',
    bio: 'Impact and sensation tools. Convention circuit vendor.',
    location: 'Online',
    stateName: 'Pennsylvania',
    isVendor: true,
  },
  {
    username: 'DungeonHospMD',
    displayName: 'Jamie Fox',
    bio: 'Baltimore Playhouse door team. Ask me about Kink First Contact nights.',
    location: 'Baltimore, MD',
    stateName: 'Maryland',
  },
  {
    username: 'TESFestHelper',
    displayName: 'Quinn Avery',
    bio: 'NJ-based volunteer. Hospitality suite and class check-in at TESFest.',
    location: 'Piscataway, NJ',
    stateName: 'New Jersey',
  },
]
