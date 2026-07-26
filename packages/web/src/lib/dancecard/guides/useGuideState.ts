/** Guide/onboarding state - stub until Kink Social wires tutorial flows. */
export function useGuideState(_eventSlug: string, _guideId: string) {
  return {
    dismissed: true,
    dismiss: () => {},
    active: false,
    reset: () => {},
    labels: { tour: 'Tour' },
  }
}
