import type { Guide } from './types';
import { welcomeTour } from './welcome';
import { budgetGuide } from './budget';
import { PAGE_GUIDES } from './pages';

export type { Guide, GuideStep, TipDef } from './types';
export { TIPS } from './tips';
export { welcomeTour };

/** Every guide, in the order the guides list shows them */
export const GUIDES: Guide[] = [welcomeTour, budgetGuide, ...PAGE_GUIDES];

export const guideById = (id: string) => GUIDES.find((g) => g.id === id);
