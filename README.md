# ⚡ FORGE — Self-Hosted Workout Tracker

A self-hosted workout tracking app with muscle visualization, progressive overload, and a built-in exercise library.

## Features

- **Workout Days** — Create named workout days (e.g. "Upper Body Dumbbells", "Lower Body Machine Day")
- **Exercise Library** — 40+ built-in exercises with muscle data; add your own custom exercises
- **Muscle Visualization** — Front and back body diagram highlights primary (orange) and secondary (yellow) muscles per exercise, and combined for the whole day's workout
- **Progressive Overload** — Set flat (lbs) or percentage (%) weight increases that apply automatically after each logged session
- **Workout Logging** — Log each completed exercise, view history and weight progress chart
- **No login required** — Single-user self-hosted

## Quick Start (Docker)

```bash
# 1. Clone or copy the project folder
cd workout-app

# 2. Build and start
docker compose up -d --build

# 3. Open in your browser
open http://localhost:3001
```

Your data is stored in `./data/workout.db` (SQLite) which persists across container restarts.

## Remote Access

To access remotely like your other self-hosted apps, expose port `3001` through your reverse proxy (Nginx, Caddy, Traefik, etc.) or use your VPN/Tailscale setup.

Example Nginx config:
```nginx
server {
    listen 80;
    server_name workout.yourdomain.com;
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

## Development (without Docker)

```bash
# Terminal 1 - Backend
cd backend
npm install
node server.js

# Terminal 2 - Frontend
cd frontend
npm install
npm start
```

Frontend runs on :3000, backend on :3001.

## Changing the Port

Edit `docker-compose.yml` and change `"3001:3001"` to `"YOURPORT:3001"`.

## Project Structure

```
workout-app/
├── Dockerfile              # Combined build
├── docker-compose.yml
├── backend/
│   ├── server.js           # Express API + SQLite
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── components/
│   │   │   ├── BodyDiagram.js      # SVG muscle map
│   │   │   ├── WorkoutDays.js      # Day list
│   │   │   ├── DayDetail.js        # Workout builder
│   │   │   ├── EntryModal.js       # Add/edit exercise
│   │   │   ├── LogModal.js         # Log + progress chart
│   │   │   └── ExerciseLibrary.js  # Browse/manage exercises
│   │   └── App.css
│   └── package.json
└── data/                   # SQLite DB persisted here
```
