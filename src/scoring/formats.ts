export const scoringFormats = [
  ['fastest_pass', 'Time & distance'],
  ['consistency', 'Consistency'],
  ['combined_time', 'Combined times'],
  ['judged_points', 'Judged points'],
] as const;

export function scoringFormatLabel(type: string) {
  return scoringFormats.find(([id]) => id === type)?.[1]
    || (type === 'stopped_distance' ? 'Distance only' : type.replaceAll('_', ' '));
}
