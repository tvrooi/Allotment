// Guides and tips are data (docs/GUIDES.md). A step points at an element through its
// data-guide marker, never a CSS class, so restyling a page can't break a guide; the test in
// utils/guides.test.ts checks every marker named here exists in the app.

export interface GuideStep {
  title: string;
  body: string;
  /** Said instead on a phone, where the element may be in the closed menu */
  phoneBody?: string;
  /**
   * The data-guide marker(s) to highlight; the first one visible on screen wins. None, or none
   * visible, shows the step in the middle of the screen.
   */
  target?: string | string[];
  /** The page to open first */
  route?: string;
}

export interface Guide {
  /** Stored in each person's progress: never rename one */
  id: string;
  /** Raise when the steps change enough to offer the guide again ("Updated guide") */
  version: number;
  title: string;
  /** One line for the guides list */
  summary: string;
  /** The page this guide belongs to ("Guide for this page", and offered on a first visit) */
  page?: string;
  steps: GuideStep[];
}

export interface TipDef {
  /** Stored in each person's progress when dismissed: never rename one */
  id: string;
  text: string;
}
