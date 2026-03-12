"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full border-b-2 border-dashed border-stone-300 py-4 px-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl font-bold tracking-tight text-stone-800 group-hover:text-amber-600 transition-colors">
            Guess What<span className="text-amber-500"> ?</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-stone-500">
          <Link href="/solo" className="hover:text-stone-800 transition-colors">
            Solo
          </Link>
          <Link
            href="/multiplayer"
            className="hover:text-stone-800 transition-colors"
          >
            Multiplayer
          </Link>
        </nav>
      </div>
    </header>
  );
}
