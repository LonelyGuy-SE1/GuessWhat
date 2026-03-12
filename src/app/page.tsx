import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-10">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-5xl sm:text-6xl font-bold text-stone-800 tracking-tight">
          Guess What<span className="text-amber-500"> ?</span>
        </h1>
        <p className="text-lg text-stone-500 max-w-md mx-auto">
          An AI-powered visual guessing game. Pick a topic, and the AI creates a
          whole game for you.
        </p>
      </div>

      {/* Mode selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
        <Link
          href="/solo"
          className="group flex flex-col items-center gap-3 p-8 border-2 border-dashed border-stone-300 rounded-2xl hover:border-amber-400 hover:bg-amber-50/50 transition-all"
        >
          <span className="text-3xl">?</span>
          <span className="text-lg font-bold text-stone-800 group-hover:text-amber-600 transition-colors">
            Solo Mode
          </span>
          <span className="text-sm text-stone-400">
            Play alone at your own pace
          </span>
        </Link>

        <Link
          href="/multiplayer"
          className="group flex flex-col items-center gap-3 p-8 border-2 border-dashed border-stone-300 rounded-2xl hover:border-amber-400 hover:bg-amber-50/50 transition-all"
        >
          <span className="text-3xl">?!</span>
          <span className="text-lg font-bold text-stone-800 group-hover:text-amber-600 transition-colors">
            Multiplayer
          </span>
          <span className="text-sm text-stone-400">Create or join a room</span>
        </Link>
      </div>

      {/* How it works */}
      <div className="w-full max-w-lg space-y-4 pt-4">
        <h2 className="text-sm font-medium text-stone-400 uppercase tracking-wider">
          How it works
        </h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto flex items-center justify-center border-2 border-dashed border-stone-300 rounded-full text-sm font-bold text-stone-500">
              1
            </div>
            <p className="text-xs text-stone-500">Pick a topic</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto flex items-center justify-center border-2 border-dashed border-stone-300 rounded-full text-sm font-bold text-stone-500">
              2
            </div>
            <p className="text-xs text-stone-500">AI generates the game</p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 mx-auto flex items-center justify-center border-2 border-dashed border-stone-300 rounded-full text-sm font-bold text-stone-500">
              3
            </div>
            <p className="text-xs text-stone-500">Guess from images</p>
          </div>
        </div>
      </div>
    </div>
  );
}
