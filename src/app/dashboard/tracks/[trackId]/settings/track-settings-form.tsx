"use client";

import { useState } from "react";
import { updateTrackSettings } from "./actions";
import { Loader2, Trash2, Plus } from "lucide-react";

export function TrackSettingsForm({ trackId, defaultClasses, availableClasses }: { trackId: string, defaultClasses: any[], availableClasses: any[] }) {
  const [classesList, setClassesList] = useState<{name: string, type: string}[]>(defaultClasses);
  
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("fastest_pass");
  
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");

  const handleAddClass = () => {
    if (!newName.trim()) return;
    setClassesList([...classesList, { name: newName.trim(), type: newType }]);
    setNewName("");
  };

  const handleRemoveClass = (index: number) => {
    setClassesList(classesList.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsPending(true);
    setMessage("");
    
    const result = await updateTrackSettings(trackId, classesList);
    if (result.success) {
      setMessage("Settings saved successfully!");
    } else {
      setMessage("Error saving settings.");
    }
    
    setIsPending(false);
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* List of current default classes */}
      <div className="space-y-3">
        {classesList.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-700 text-slate-500 text-sm text-center">
            No default classes added yet.
          </div>
        ) : (
          classesList.map((cls, idx) => {
            const engine = availableClasses.find(c => c.type === cls.type);
            return (
              <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="font-bold text-white">{cls.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{engine?.name || cls.type}</div>
                </div>
                <button 
                  onClick={() => handleRemoveClass(idx)}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add new class */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
        <h3 className="font-bold text-sm text-slate-300">Add a Default Class</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Class Name</label>
            <input 
              type="text" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Pro Mod"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Scoring Engine</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm"
            >
              {availableClasses.map(ac => (
                <option key={ac.type} value={ac.type}>{ac.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button 
          onClick={handleAddClass}
          disabled={!newName.trim()}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Add to Defaults</span>
        </button>
      </div>

      <div className="flex items-center space-x-4 pt-4 border-t border-slate-800">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-6 py-2.5 rounded-lg transition flex items-center space-x-2 disabled:opacity-50"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Save Track Settings</span>
        </button>
        {message && (
          <span className="text-sm font-medium text-emerald-400">{message}</span>
        )}
      </div>
    </div>
  );
}
