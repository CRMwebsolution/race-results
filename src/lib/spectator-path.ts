export function spectatorRacePath({ownerType='track',ownerId,trackSlug,eventSlug}: {ownerType?: 'track'|'series';ownerId: string;trackSlug?: string;eventSlug?: string}) {
  if (!eventSlug) return null;
  const race=encodeURIComponent(eventSlug);
  if (ownerType==='series') return `/s/${encodeURIComponent(ownerId)}/races/${race}`;
  return trackSlug ? `/r/${encodeURIComponent(trackSlug)}/${race}` : null;
}
