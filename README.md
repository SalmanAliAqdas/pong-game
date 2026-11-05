# Pong

A browser-based Pong game built with plain HTML, CSS, and JavaScript. Play against the computer, keep the ball in play, and try to outscore it.

## Features

- Play against a computer-controlled paddle
- Move your paddle with the mouse or the up and down arrow keys
- Live score display
- Live match duration, with paused time excluded and the final duration shown with the match mode
- Responsive layout
- Optional synthesized arcade music, started and stopped with the on-page music control
- No build tools or external dependencies required

## Play locally

Clone or download the repository, then open `index.html` in a modern browser. You can also serve the files locally:

```bash
python3 -m http.server
```

Then visit <http://localhost:8000>.

## Controls

- Move the mouse over the game area to position your paddle.
- Alternatively, use the **↑** and **↓** arrow keys.
- Use the music button on the page to turn the optional music on or off.

## Project files

- `index.html` — game page and canvas
- `style.css` — layout and styling
- `game.js` — Pong gameplay and computer opponent
- `music.js` — optional synthesized music
