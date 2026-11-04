import { Users } from 'lucide-react';

/**
 * Plaid, SimpleFIN and Enable Banking are community supported (audit decision I-10): they keep
 * working, but only Up is checked against a real bank with every release, and they get Up's
 * safeguards only once someone uses them. CSV import is the way in for any other bank.
 */
export const COMMUNITY_SUPPORTED = 'Community supported';

export function CommunitySupportedNote({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs text-text-tertiary ${className}`}>
      <Users size={13} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        <span className="font-medium text-text-secondary">{COMMUNITY_SUPPORTED}.</span> Plaid,
        SimpleFIN and Enable Banking work, but only Up is checked with every release. If one stops
        working for your bank, import its CSV files instead: any bank can export them.
      </span>
    </p>
  );
}
