import { apiFetch } from './client';

// Combined households (multi-user mode; server: gateway/sharing.ts, docs/HOUSEHOLDS.md): one
// person's household joined with another's, each kept in its owner's budget.

export interface HouseholdLink {
  id: string;
  /** inviter asked; invitee was asked */
  role: 'inviter' | 'invitee';
  status: 'pending' | 'active';
  partner: { id: string; name: string };
  /** This person's household in the link (null until an invitee accepts) */
  groupId: string | null;
  /** Their household person who stands for the partner */
  partnerPersonId: string | null;
}

export interface SharingState {
  /** Others with a budget on this server, who can be asked */
  people: { id: string; name: string }[];
  links: HouseholdLink[];
}

export interface CombinedEntry {
  key: string;
  ownerId: string;
  eventId: string;
  mine: boolean;
  kind: 'expense' | 'contribution' | 'settlement' | 'refund';
  date: string;
  description: string;
  amount: number;
  /** A person key; null when the owner's household pool paid */
  payer: string | null;
  recipient: string | null;
  merchant: { name: string; logo: string | null } | null;
  fromBank: boolean;
  reviewReason: string | null;
  reverses: string | null;
  shares: { person: string; amount: number }[];
  note: { text: string; updatedBy: string; updatedAt: string } | null;
  possibleDuplicate: boolean;
}

export interface CombinedRegister {
  link: HouseholdLink;
  currency: string;
  households: { ownerId: string; name: string }[];
  people: { key: string; name: string; isMe: boolean; isPartner: boolean; balance: number }[];
  entries: CombinedEntry[];
}

export const getSharing = () => apiFetch<SharingState>('/shared-households');

export const askToCombine = (body: {
  partnerId: string;
  groupId: string;
  partnerPersonId: string;
}) => apiFetch<HouseholdLink>('/shared-households', { method: 'POST', body: JSON.stringify(body) });

export const acceptCombine = (id: string, body: { groupId: string; partnerPersonId: string }) =>
  apiFetch<HouseholdLink>(`/shared-households/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** Declines, cancels or stops a link */
export const endCombine = (id: string) =>
  apiFetch<void>(`/shared-households/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const getCombinedRegister = (id: string) =>
  apiFetch<CombinedRegister>(`/shared-households/${encodeURIComponent(id)}/register`);

export const saveSharedNote = (
  id: string,
  body: { ownerId: string; eventId: string; text: string },
) =>
  apiFetch<void>(`/shared-households/${encodeURIComponent(id)}/notes`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
