export const DEFAULT_TAGS = ['tasks', 'challenge', 'gratitude', 'ideas', 'to-do', 'notes', 'why this goal', 'price of missing goal'];

const FIXED_COLORS: Record<string, { bg: string; text: string }> = {
  tasks:                    { bg: 'bg-blue-100',   text: 'text-blue-700' },
  challenge:                { bg: 'bg-red-100',    text: 'text-red-700' },
  gratitude:                { bg: 'bg-green-100',  text: 'text-green-700' },
  ideas:                    { bg: 'bg-amber-100',  text: 'text-amber-700' },
  'to-do':                  { bg: 'bg-orange-100', text: 'text-orange-700' },
  notes:                    { bg: 'bg-teal-100',   text: 'text-teal-700' },
  'why this goal':          { bg: 'bg-violet-100', text: 'text-violet-700' },
  'price of missing goal':  { bg: 'bg-rose-100',   text: 'text-rose-700' },
};

const CUSTOM_PALETTE = [
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-pink-100',   text: 'text-pink-700' },
  { bg: 'bg-cyan-100',   text: 'text-cyan-700' },
  { bg: 'bg-lime-100',   text: 'text-lime-700' },
  { bg: 'bg-sky-100',    text: 'text-sky-700' },
  { bg: 'bg-rose-100',   text: 'text-rose-700' },
];

export function getTagColor(tag: string, allCustomTags: string[] = []): { bg: string; text: string } {
  if (FIXED_COLORS[tag]) return FIXED_COLORS[tag];
  const idx = allCustomTags.indexOf(tag);
  return CUSTOM_PALETTE[((idx >= 0 ? idx : 0)) % CUSTOM_PALETTE.length];
}
