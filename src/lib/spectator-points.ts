import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database';

export const spectatorPointsOptions = [
  ['none', 'No points shown'],
  ['race', 'Points per race only'],
  ['race_and_total', 'Points per race and season totals'],
] as const;
export type SpectatorPointsMode = typeof spectatorPointsOptions[number][0];

export function validSpectatorPointsMode(value: unknown): value is SpectatorPointsMode {
  return spectatorPointsOptions.some(([id]) => id === value);
}

export async function spectatorPointsMode(db: SupabaseClient<Database>, owner: {seriesId?: string; trackId?: string}): Promise<SpectatorPointsMode> {
  const id = owner.seriesId || owner.trackId;
  if (!id) return 'none';
  const {data, error} = await db.from(owner.seriesId ? 'series' : 'tracks').select('spectator_points_mode').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return validSpectatorPointsMode(data?.spectator_points_mode) ? data.spectator_points_mode : 'none';
}
