import { createContext, useContext } from 'react';

/**
 * True while the Get started checklist is on the dashboard. Its cards' own empty states then
 * leave out their buttons, so a new budget has one list of next steps instead of several.
 */
export const OnboardingContext = createContext(false);

export const useOnboardingActive = () => useContext(OnboardingContext);
