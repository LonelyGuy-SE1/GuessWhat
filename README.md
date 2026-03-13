# Guess What?

AI-powered visual guessing game. The AI generates images based on a topic you choose, and you try to guess what each one is using hints that reveal over time.

Play it at [lonelyguesswhat.vercel.app](https://lonelyguesswhat.vercel.app)

## How to Play

### Solo

1. Enter your [Commonstack](https://commonstack.ai) API key
2. Pick a topic (e.g. "world flags", "famous paintings", "dog breeds")
3. Choose difficulty and number of rounds
4. For each round: look at the image, read the hints as they appear, and type your guess
5. Faster guesses with fewer hints = more points

### Multiplayer

1. One player creates a room and shares the 6-letter code
2. Other players join using the code
3. Host starts the game when everyone's in
4. Everyone guesses at the same time — scores update live
5. Host advances to the next round

### Tips

- You get 3 guesses per round and 3 hints that reveal gradually
- Dashes below the image show how many words and letters the answer has
- Spelling doesn't have to be perfect — close enough counts
- Higher difficulty = harder subjects, less time, more points

## Running Locally

```
npm install
npm run dev
```

Needs a `KV_REDIS_URL` environment variable for multiplayer (standard Redis connection string). Solo mode works without it.

## License

MIT
