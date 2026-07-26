/**
 * MOCK DATA - Remove when API is ready.
 * Barrel: re-exports types, seeds, and mutations for backward compatibility.
 */

// Types
export {
  getTrustTierFromScore,
  type TrustTier,
  type MockProfilePhoto,
  type MockPerson,
  type MockEndorsement,
  type MockEvent,
  type MockVendor,
  type MockArticle,
  type GroupRole,
  type MockGroup,
  type MockGroupMember,
  type MockGroupChannel,
  type MockGroupPost,
  type MockGroupPhoto,
  type MockLocalPost,
  type MockResource,
  type MockContentByTag,
  type MockNotification,
} from './types'

// Seeds + read helpers
export {
  MOCK_VIEWER_USERNAME,
  TAG_SEEDS,
  demoMockImageUrl,
  mockPeople,
  mockEvents,
  mockVendors,
  mockArticles,
  mockGroups,
  mockGroupMembers,
  mockGroupChannels,
  mockGroupPosts,
  mockGroupPhotos,
  mockLocalPosts,
  mockEndorsements,
  mockNotifications,
  mockConversations,
  mockResources,
  getMockPersonByUsername,
  getMockEventById,
  MOCK_VENDOR_ROPE_DREAMER_SUPPLY,
  getMockVendorById,
  getMockEndorsementsForUser,
  getMockGroupById,
  getMockGroupBySlug,
  getMockEventsForGroup,
  getMockGroupMembers,
  getMockUserGroupRole,
  getMockChannelsForGroup,
  getMockChannelById,
  getMockPhotosForGroup,
  getMockPendingPhotosForGroup,
  getMockPendingPhotosByAuthor,
  getMockResourcesForGroup,
  getMockArticleBySlug,
} from './mock-seeds'

export {
  mockHomeConventions,
  mockEducationExtras,
  getMockEducationCatalog,
  getPublicGroupDiscussionPeek,
  mockCoAttendanceSuggestions,
  mockNearbyPeopleSuggestions,
  mockVendorSpotlightListings,
  mockVendorInPersonRows,
  mockVendorListingCarousel,
  mockTrendingMixedFeed,
  mockUpcomingClassesRail,
  mockGroupsForHomeJoin,
  mockRichLocalFeedPosts,
} from './mock-home-surface'

export type { MockCoSuggestHome } from './mock-home-surface'

// Mutations + getters that use deleted sets
export {
  getMockPostsForChannel,
  getMockLocalPostsVisible,
  getMockContentByTag,
  approveMockGroupPhoto,
  denyMockGroupPhoto,
  removeMockGroupPhoto,
  addMockGroupPhoto,
  withdrawMockGroupPhoto,
  editMockGroupPost,
  deleteMockGroupPost,
  togglePinMockGroupPost,
  editMockLocalPost,
  deleteMockLocalPost,
  addMockLocalPost,
  addMockEndorsement,
  addMockGroupMember,
  removeMockGroupMember,
  addMockResource,
  removeMockResource,
  setMockGroupTags,
} from './mock-mutations'
