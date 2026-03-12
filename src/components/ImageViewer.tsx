"use client";

import { useState, useCallback } from "react";

interface ImageViewerProps {
  src: string;
  alt?: string;
}

export default function ImageViewer({ src, alt }: ImageViewerProps) {
  const [zoomed, setZoomed] = useState(false);

  const toggleZoom = useCallback(() => setZoomed((z) => !z), []);

  return (
    <>
      <div
        className="relative w-full aspect-square max-w-lg mx-auto rounded-2xl overflow-hidden border-2 border-dashed border-stone-300 bg-stone-50 cursor-pointer group"
        onClick={toggleZoom}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt || "Mystery image"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">
            <span className="text-4xl">?</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-white/80 rounded-lg text-xs text-stone-500">
          click to zoom
        </div>
      </div>

      {/* Fullscreen zoom overlay */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={toggleZoom}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || "Mystery image"}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <div className="absolute top-4 right-4 text-white/60 text-sm">
            click anywhere to close
          </div>
        </div>
      )}
    </>
  );
}
