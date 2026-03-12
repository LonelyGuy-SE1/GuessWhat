"use client";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const EXAMPLE_TOPICS = [
  "robot models",
  "fusion research centers",
  "naval vessels",
  "ancient temples",
  "ai research labs",
  "space telescopes",
  "famous bridges",
  "volcanic islands",
];

export default function PromptInput({
  value,
  onChange,
  placeholder,
}: PromptInputProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-stone-600">Topic</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "e.g. ancient temples, naval vessels..."}
        className="w-full px-4 py-2.5 border-2 border-dashed border-stone-300 rounded-xl bg-white text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none transition-colors"
      />
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => onChange(topic)}
            className="px-3 py-1 text-xs border border-stone-200 rounded-full text-stone-500 hover:border-amber-400 hover:text-amber-600 transition-colors"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}
