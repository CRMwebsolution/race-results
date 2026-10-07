import {describe, expect, it} from 'vitest';
import {eligibleRaceRegistrations, registrationLabel, type SeriesRegistration} from '../race-registration';

const members: SeriesRegistration[] = [
  {id:'jay-one',display_name:'Jay',vehicle_name:'Truck one',class_id:'open',joined_on:'2026-01-01',left_on:null},
  {id:'jay-two',display_name:'Jay',vehicle_name:'Truck two',class_id:'other',joined_on:'2026-01-01',left_on:null},
  {id:'late',display_name:'Michael',vehicle_name:'Truck three',class_id:'open',joined_on:'2026-10-08',left_on:null},
  {id:'withdrawn',display_name:'Grumpy',vehicle_name:'Truck four',class_id:'open',joined_on:'2026-01-01',left_on:'2026-10-07'},
];
describe('race signup membership choices', () => {
  it('shows only the selected class members eligible on that race date', () => {
    expect(eligibleRaceRegistrations(members,'open','2026-10-07').map(r => r.id)).toEqual(['jay-one']);
    expect(eligibleRaceRegistrations(members,'open','2026-10-08').map(r => r.id)).toEqual(['jay-one','late']);
  });
  it('preserves past race eligibility and offers no members for a race-only class', () => {
    expect(eligibleRaceRegistrations(members,'open','2026-10-06').map(r => r.id)).toEqual(['jay-one','withdrawn']);
    expect(eligibleRaceRegistrations(members,null,'2026-10-07')).toEqual([]);
  });
  it('distinguishes registrations for different vehicles belonging to the same racer', () => {
    expect(registrationLabel(members[0])).toBe('Jay · Truck one');
    expect(registrationLabel(members[1])).toBe('Jay · Truck two');
  });
});
