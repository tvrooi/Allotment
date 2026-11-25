import { useId, type ReactNode } from 'react';

/** One control's card on the controls gallery: a section named by its heading */
export function GalleryCard({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="bg-surface rounded-lg p-4 md:p-6">
      <h2 id={headingId} className="text-base font-medium text-text mb-4">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * One state of a control. Gallery specs find a row by role and name: a group named
 * "<Control>, <State>", for example "Switch, Disabled". On phones the state's name sits above
 * the control, so the control has the screen's width as it does on a screen.
 */
export function Specimen({
  control,
  state,
  children,
}: {
  control: string;
  state: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={`${control}, ${state}`}
      className="flex flex-col gap-1 md:flex-row md:items-center md:gap-4"
    >
      <span className="md:w-24 shrink-0 text-sm font-medium text-text-secondary">{state}</span>
      <div className="min-w-0 md:flex-1">{children}</div>
    </div>
  );
}
