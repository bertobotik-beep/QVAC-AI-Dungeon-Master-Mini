# QVAC AI Dungeon Master Mini

Pick a genre and setting, and an on-device AI narrates a short branching adventure.
Each turn it offers 2-3 numbered choices (or you can type your own free-text action),
and the story continues from there for a satisfying short arc that wraps up to a
real ending instead of looping forever.

## Run

```
npm install
npm start
```

Then open http://localhost:29524

## QVAC SDK

Built on `@qvac/sdk` ^0.19.0.

## How it works

On startup the server loads a small instruction-tuned model on-device with `loadModel`.
The browser holds the growing story conversation history and sends it back to the
server on every turn; the server calls `completion` with that full history so the
model narrates each new scene consistently with everything that came before, and is
instructed to steer the story toward a real ending after a handful of turns. Nothing
ever leaves the machine — there is no cloud call and no API key. The model is
released with `unloadModel` on shutdown.

## License

MIT
