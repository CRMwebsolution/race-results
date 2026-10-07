import {spectatorPointsOptions} from '@/lib/spectator-points';

export function SpectatorPointsField({value}: {value: string}) {
  return <div className="space-y-2">
    <label className="block font-semibold">Spectator points visibility
      <select name="spectator_points_mode" defaultValue={value} required className="block w-full mt-2 px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white">
        {spectatorPointsOptions.map(([id,label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
    <p className="text-sm text-slate-400">Choose what spectators see for your series. Your organizer standings always include all points and totals.</p>
  </div>;
}
