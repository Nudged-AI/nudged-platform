import React, { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User;
  onComplete: () => void;
}

const ANIMALS = [
  { name: 'Lion',      trait: 'Courage, leadership, self-belief',       meaning: 'Inner strength, confidence, ability to face fear with dignity.',                        img: 'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=300' },
  { name: 'Tiger',     trait: 'Power, focus, independence',              meaning: 'Disciplined energy, sharp instinct, bold action, personal mastery.',                   img: 'https://images.pexels.com/photos/145939/pexels-photo-145939.jpeg?auto=compress&cs=tinysrgb&w=300' },
  { name: 'Elephant',  trait: 'Wisdom, memory, stability',               meaning: 'Patience, emotional intelligence, family bonds, grounded strength.',                   img: 'https://images.pexels.com/photos/66898/elephant-cub-tsavo-kenya-66898.jpeg?auto=compress&cs=tinysrgb&w=300' },
  { name: 'Eagle',     trait: 'Vision, freedom, higher perspective',     meaning: 'Clarity, ambition, strategic thinking, ability to rise above problems.',               img: 'https://images.pexels.com/photos/1094570/pexels-photo-1094570.jpeg?auto=compress&cs=tinysrgb&w=300' },
  { name: 'Horse',     trait: 'Momentum, freedom, progress',             meaning: 'Movement, endurance, ambition, the drive to keep going.',                             img: 'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=300' },
  { name: 'Dolphin',   trait: 'Joy, emotional connection, playfulness',  meaning: 'Social intelligence, healing, communication, lightness of being.',                    img: 'https://images.pexels.com/photos/64219/dolphin-marine-mammals-water-sea-64219.jpeg?auto=compress&cs=tinysrgb&w=300' },
  { name: 'Butterfly', trait: 'Transformation, renewal, hope',           meaning: 'Growth, change, rebirth, becoming a better version of oneself.',                      img: 'https://images.pexels.com/photos/56866/garden-rose-red-pink-56866.jpeg?auto=compress&cs=tinysrgb&w=300' },
  { name: 'Wolf',      trait: 'Loyalty, instinct, teamwork',             meaning: 'Belonging, protection, intuition, strength through community.',                       img: 'https://images.pexels.com/photos/2295744/pexels-photo-2295744.jpeg?auto=compress&cs=tinysrgb&w=300' },
  { name: 'Owl',       trait: 'Insight, awareness, reflection',          meaning: 'Wisdom, observation, patience, seeing what others miss.',                             img: 'https://images.pexels.com/photos/1202581/pexels-photo-1202581.jpeg?auto=compress&cs=tinysrgb&w=300' },
  { name: 'Dog',       trait: 'Trust, loyalty, unconditional love',      meaning: 'Companionship, emotional safety, faithfulness, simple joy.',                          img: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=300' },
];

const PURPOSES = [
  'Empower people to unlock potential.',
  'Guide others toward meaningful growth.',
  'Transform challenges into simple solutions.',
  'Provide clarity during uncertain journeys.',
  'Connect dreams with disciplined action.',
  'Align actions with deeper values.',
  'Support builders creating lasting impact.',
  'Turn confusion into confident direction.',
  'Transform potential into meaningful contribution.',
  'Create meaning through useful contribution.',
];

export default function SpiritAnimalPage({ user, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedAnimal, setSelectedAnimal] = useState('');
  const [purpose, setPurpose] = useState('');
  const [customPurpose, setCustomPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const finalPurpose = purpose === '__custom__' ? customPurpose.trim() : purpose;
  const selectedAnimalData = ANIMALS.find(a => a.name === selectedAnimal);

  const handleNext = () => {
    if (!selectedAnimal) { setError('Please select your spirit animal.'); return; }
    setError('');
    setStep(2);
  };

  const handleSave = async () => {
    if (!finalPurpose) { setError('Please select or write your purpose.'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('user_profiles').update({
      spirit_animal: selectedAnimal,
      life_purpose: finalPurpose,
    }).eq('id', user.id);
    setSaving(false);
    if (err) { setError('Failed to save. Please try again.'); return; }
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50 flex flex-col">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 pt-6 pb-2">
        <div className={`w-8 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-teal-500' : 'bg-gray-200'}`} />
        <div className={`w-8 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-teal-500' : 'bg-gray-200'}`} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        {/* Logo + heading */}
        <div className="text-center mb-6">
          <img src="/icons/ChatGPT_Image_Jul_5,_2026,_11_50_00_AM.png" alt="Nudged" className="w-14 h-14 mx-auto mb-3 object-contain" />
          {step === 1 ? (
            <>
              <h1 className="text-xl font-bold text-gray-900">Choose your Spirit Animal</h1>
              <p className="text-gray-500 mt-1 text-sm">Which animal best represents you?</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900">Your Life Purpose</h1>
              <p className="text-gray-500 mt-1 text-sm">What drives you every day?</p>
              {selectedAnimalData && (
                <div className="inline-flex items-center gap-2 mt-2 bg-teal-50 border border-teal-100 rounded-full px-3 py-1">
                  <span className="text-xs font-semibold text-teal-700">{selectedAnimal}</span>
                  <span className="text-xs text-teal-400">·</span>
                  <span className="text-xs text-teal-600">{selectedAnimalData.trait}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {ANIMALS.map(a => (
                <button key={a.name} onClick={() => { setSelectedAnimal(a.name); setError(''); }}
                  className={`relative rounded-2xl overflow-hidden border-2 transition-all text-left ${selectedAnimal === a.name ? 'border-teal-500 shadow-lg shadow-teal-100' : 'border-gray-200 hover:border-teal-300'}`}>
                  <img src={a.img} alt={a.name} className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {selectedAnimal === a.name && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-white font-bold text-sm">{a.name}</p>
                    <p className="text-white/70 text-xs leading-tight">{a.trait}</p>
                  </div>
                </button>
              ))}
            </div>
            {selectedAnimalData && (
              <div className="mb-4 bg-teal-50 rounded-xl px-4 py-3">
                <p className="text-xs text-teal-700 font-medium">{selectedAnimalData.meaning}</p>
              </div>
            )}
          </>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-2 mb-4">
            {PURPOSES.map(p => (
              <button key={p} onClick={() => setPurpose(p)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${purpose === p ? 'border-teal-500 bg-teal-50 text-teal-800 font-medium' : 'border-gray-200 bg-white text-gray-700 hover:border-teal-300'}`}>
                {purpose === p && <Check className="w-4 h-4 inline mr-2 text-teal-600" />}{p}
              </button>
            ))}
            <button onClick={() => setPurpose('__custom__')}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${purpose === '__custom__' ? 'border-teal-500 bg-teal-50 text-teal-800 font-medium' : 'border-gray-200 bg-white text-gray-500 hover:border-teal-300'}`}>
              Write my own...
            </button>
            {purpose === '__custom__' && (
              <textarea
                value={customPurpose}
                onChange={e => setCustomPurpose(e.target.value.slice(0, 200))}
                placeholder="Describe your life purpose in your own words..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none mt-1"
              />
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl mb-4">{error}</p>}

        <div className="flex gap-3 pb-6">
          {step === 2 && (
            <button onClick={() => { setStep(1); setError(''); }} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Back
            </button>
          )}
          {step === 1 ? (
            <button onClick={handleNext} className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition shadow-md shadow-teal-100">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition disabled:opacity-60 shadow-md shadow-teal-100">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Continue to Nudged'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
