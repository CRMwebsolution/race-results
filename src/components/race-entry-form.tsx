'use client';

import {useState} from 'react';
import {eligibleRaceRegistrations, registrationLabel, type RaceClass, type SeriesRegistration} from '@/lib/race-registration';

const inputStyle = 'block w-full min-w-0 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white text-sm';

export function RaceEntryForm({classes, registrations, raceDate, hasSeries, chosenClass, action}: {
  classes: RaceClass[]; registrations: SeriesRegistration[]; raceDate: string; hasSeries: boolean; chosenClass?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [classId, setClassId] = useState(classes.find(c => c.id === chosenClass)?.id || classes[0]?.id || '');
  const [registrationId, setRegistrationId] = useState('');
  const [name, setName] = useState('');
  const selectedClass = classes.find(c => c.id === classId);
  const eligible = eligibleRaceRegistrations(registrations, selectedClass?.competition_class_id || null, raceDate);

  return <form action={action} className="space-y-4 bg-slate-900 p-5 border border-slate-800 rounded-xl">
    <p className="text-sm text-slate-400">Sign up each contestant for this race in the order they will run. Series membership does not sign anyone up for a race.</p>
    <label className="block text-sm font-semibold">Class
      <select name="event_class_id" value={classId} className={inputStyle} onChange={event => {setClassId(event.target.value); setRegistrationId(''); setName('');}}>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
    {hasSeries && <div className="space-y-2">
      <label className="block text-sm font-semibold">Series registration (optional)
        <select name="registration_id" value={registrationId} className={inputStyle} onChange={event => {
          const id = event.target.value; setRegistrationId(id);
          setName(eligible.find(r => r.id === id)?.display_name || '');
        }}>
          <option value="">One-race contestant · no series points</option>
          {eligible.map(r => <option key={r.id} value={r.id}>{registrationLabel(r)}</option>)}
        </select>
      </label>
      <p className="text-xs text-slate-400">Select the same racer, vehicle, and class to earn series points. Local contestants can race without joining the series.</p>
      {!selectedClass?.competition_class_id && <p className="text-xs text-amber-400">This race class has no series class assigned. Assign it in Classes &amp; rules to select registered members.</p>}
      {selectedClass?.competition_class_id && !eligible.length && <p className="text-xs text-slate-400">No series members in this class are eligible on this race date.</p>}
    </div>}
    <div className="grid sm:grid-cols-2 gap-4">
      <label className="block text-sm font-semibold">Racer name / number
        <input name="display_name" required value={name} onChange={event => setName(event.target.value)} className={inputStyle}/>
      </label>
      <label className="block text-sm font-semibold">Running order (optional)
        <input name="draw_number" type="number" min="1" step="1" placeholder="Next available number" className={inputStyle}/>
      </label>
    </div>
    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-lg text-sm w-full">Add contestant</button>
  </form>;
}

export function RaceRegistrationCorrection({entries, classes, registrations, action}: {
  entries: {id: string; display_name: string; event_class_id: string; registration_id: string | null}[];
  classes: RaceClass[]; registrations: SeriesRegistration[]; action: (formData: FormData) => Promise<void>;
}) {
  const [entryId, setEntryId] = useState(entries[0]?.id || '');
  const entry = entries.find(e => e.id === entryId);
  const competitionClass = classes.find(c => c.id === entry?.event_class_id)?.competition_class_id;
  return <details className="p-4 border rounded space-y-3">
    <summary className="font-semibold">Correct a contestant’s series registration link</summary>
    <p className="text-sm text-slate-400">Use this if a contestant was added as a local by mistake, or linked to the wrong vehicle. It changes the membership link on this race entry; it does not enroll anyone in the series. Membership dates still determine points eligibility.</p>
    {entries.length ? <form action={action} className="space-y-3">
      <label className="block">Race contestant<select name="entry_id" value={entryId} onChange={e => setEntryId(e.target.value)} className={inputStyle}>
        {entries.map(e => <option key={e.id} value={e.id}>{e.display_name} · {classes.find(c => c.id === e.event_class_id)?.name}</option>)}
      </select></label>
      <label className="block">Series registration<select key={entryId} name="registration_id" defaultValue={entry?.registration_id || ''} className={inputStyle}>
        <option value="">One-race contestant · no series points</option>
        {registrations.filter(r => r.class_id === competitionClass).map(r => <option key={r.id} value={r.id}>{registrationLabel(r)}</option>)}
      </select></label>
      <button className="p-3 border rounded">Save registration link</button>
    </form> : <p>Add a contestant before correcting a registration link.</p>}
  </details>;
}
