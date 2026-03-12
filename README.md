# Guess What?

AI-powered visual guessing game using the Commonstack unified API.

## Quick Start

```bash
npm install
npm run dev          # Start Next.js on http://localhost:3000
npm run dev:ws       # Start WebSocket server on port 3001 (for multiplayer)
```

## Game Modes

### Solo
1. Enter your Commonstack API key
2. Enter a topic (e.g., "famous landmarks", "animals")
3. AI generates 5 entities with images and progressive hints
4. Guess each entity as quickly as possible for maximum points

### Multiplayer
1. Create a room and share the code
2. Host starts the game when ready
3. All players compete simultaneously
4. First correct guess wins the round

## Scoring

- Base: 1000 points
- Time penalty: -10 points/second
- Hint penalty: -100 points per hint revealed
- Minimum: 100 points per correct guess

## Tech Stack

- **Next.js 16** with Turbopack
- **TypeScript**
- **TailwindCSS 4**
- **WebSockets** for multiplayer
- **Commonstack API** for AI (chat + image generation)

## Environment

No environment variables required. API key is entered client-side per session.

## Architecture

- `src/lib/ai/` - AI orchestration, model routing, entity/hint/image generation
- `src/lib/game/` - Game engine, session store
- `src/lib/room/` - Multiplayer room management
- `src/server/` - WebSocket server for real-time multiplayer
- `src/components/` - React UI components
- `src/hooks/` - Custom hooks (useWebSocket, useSoloGame)

All data is **in-memory only** - no database, no Redis, no persistence.

## License

MIT
