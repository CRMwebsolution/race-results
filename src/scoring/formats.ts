export const scoringFormats = [
  ['fastest_pass', 'Time & distance'],
  ['consistency', 'Consistency'],
  ['combined_time', 'Combined times'],
  ['judged_points', 'Judged points'],
  ['head_to_head', 'Heads-up bracket'],
] as const;

export function scoringFormatLabel(type: string) {
  return scoringFormats.find(([id]) => id === type)?.[1]
    || (type === 'stopped_distance' ? 'Distance only' : type.replaceAll('_', ' '));
}
