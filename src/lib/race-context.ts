export type RaceParams = {trackId?: string; seriesId?: string; eventId: string; classId?: string};
export function raceContext(params: RaceParams) {
 const ownerType: 'track'|'series' = params.seriesId ? 'series' : 'track';
 const ownerId = params.seriesId || params.trackId;
 if (!ownerId || (params.seriesId && params.trackId)) throw new Error('Race owner is required');
 return {ownerId, ownerType, ownerColumn: ownerType === 'series' ? 'series_id' as const : 'track_id' as const,
  ownerPath: `/dashboard/${ownerType === 'series' ? 'series' : 'tracks'}/${ownerId}`,
  eventId: params.eventId, classId: params.classId};
}
