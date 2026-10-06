export const accountModes = [['single_track','Single track'],['multi_track','Multi-track'],['series','Series'],['single_track_series','Single track + series'],['multi_track_series','Multi-track + series']] as const;
export type AccountMode=typeof accountModes[number][0];
export function validMode(value:unknown):value is AccountMode {return accountModes.some(([id])=>id===value);}
export function modeFeatures(value:unknown){const mode=validMode(value)?value:'multi_track_series';return {tracks:mode!=='series',series:mode.includes('series'),multiTrack:mode.startsWith('multi')};}
