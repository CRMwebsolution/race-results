export type RaceClass = {id: string; name: string; competition_class_id: string | null};
export type SeriesRegistration = {id: string; class_id: string; display_name: string; vehicle_name: string | null; joined_on: string; left_on: string | null};

export function eligibleRaceRegistrations(registrations: SeriesRegistration[], competitionClassId: string | null, raceDate: string) {
  return registrations.filter(r => r.class_id === competitionClassId && r.joined_on <= raceDate && (!r.left_on || raceDate < r.left_on));
}

export function registrationLabel(registration: SeriesRegistration) {
  return `${registration.display_name} · ${registration.vehicle_name || 'No vehicle number'}`;
}
