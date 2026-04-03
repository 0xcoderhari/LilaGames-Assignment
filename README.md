# Multiplayer Tic-Tac-Toe with Nakama Backend

Welcome to the project. Kindly find below the complete documentation for our multiplayer Tic-Tac-Toe game. We have implemented a server-authoritative architecture using Nakama as the backend infrastructure. It is robust and working absolutely fine.

## Setup and Installation Instructions

Kindly make sure you have Docker, Docker Compose, and Node.js installed in your system before proceeding.

### Starting the Backend
To bring the backend servers up and running, please execute the below command from the root directory:

```bash
docker-compose up --build
```

This will run CockroachDB on port 26257 and Nakama on port 7350. For accessing the Nakama developer console, kindly visit http://localhost:7350. Please note the default credentials are "admin" and "password".

### Starting the Frontend
Please go to the frontend directory and run the following commands to do the needful:

```bash
cd frontend
npm install
npm run dev
```

The frontend application will be instantly accessible at http://localhost:5173.

## Architecture and Design Decisions

Our tech stack comprises the following layers:
- **Frontend**: React 19, TypeScript, Vite, and Zustand for state management.
- **Backend**: Nakama 3.22 with Go Runtime. We preferred Go over TypeScript for better performance and type safety.
- **Database**: CockroachDB (hence it is fully compatible with PostgreSQL).
- **Deployment**: Render.com is utilized for hosting the Web Service, Static Site, and Native PostgreSQL database.

Regarding the specific design decisions, please find them listed below:
1. **MatchHandler Interface**: We are using Nakama's MatchHandler interface instead of simple RPCs to ensure low-latency communication on a WebSocket connection.
2. **Authoritative Engine**: Basically, all game state management and validation (like moves and forfeit logic) are happening firmly on the server side only to prevent client tampering.
3. **State Management**: Zustand is used for frontend state management as it is very lightweight and perfect for our requirements.
4. **Leaderboard Tracking**: We are leveraging Nakama's native leaderboard system to avoid redundant custom development.
5. **Timer Processing**: As per the requirements, the 30-second turn timer is practically strictly maintained on the server within the match loop itself.

## API / Server Configuration Details

For integration purposes, we have configured the Nakama server and custom RPC endpoints as follows.

### Server Ports
- HTTP Port: 7350 (REST API and Developer Console)
- WebSocket Port: 7349 (Real-time game socket communication)

### Custom RPC Endpoints
We are exposing the following Go runtime RPCs:
- `create_match`: Accepts `{ username, mode }` and provisions a new authoritative match lobby.
- `list_matches`: Evaluates `{ mode }` and returns a list of all currently available, open lobbies.
- `submit_game_result`: Internal tracking for securely recording the winner and adjusting properties in the leaderboard records.
- `get_leaderboard`: Used to fetch the requested records for either the top `wins` or `win_streaks`.
- `update_player_profile`: Kindly utilized for updating the user's permanent display name during their session.

### Match Op Codes
For WebSocket message propagation, we are using the following Op Codes:
- Code 1: Used when the Client wants to join the match.
- Code 2: Triggered by the Client to formally place a move on the board (e.g. `{ "index": 4 }`).
- Code 3: Broadcasted by the Server to provide game state and timer updates back down to the players.
- Code 4: Pushed by the Server when a Game Over situation (win, draw, or disconnect) has been finalized.

## How to Test the Multiplayer Functionality

For checking the real-time gameplay, we have provided the steps below:

1. Kindly open two separate browser windows and navigate to http://localhost:5173.
2. Please enter different nicknames in both windows so that sessions do not clash in the backend.
3. In the first window, click on Create New Game and choose your preferred mode (Classic or Timed).
4. In the second window, please navigate to the Browse section and simply join the game.
5. The match will start automatically and you can verify the real-time updates. Player X will do the first move.
6. In case you want to test the forfeit criteria, simply close the browser window for Player 1 during the match. Player 2 will be informed immediately of their resultant victory!

## Deployment Process Documentation

For transitioning this to production, we have already attached a render.yaml blueprint file for smooth IaC deployment on Render.

1. Kindly push your codebase to a GitHub or GitLab repository.
2. Login to the Render Dashboard and choose the option to create a new Blueprint.
3. Connect your repository to the project. Render will automatically provision the PostgreSQL database, compile the Nakama backend via Dockerfile, and publish the compiled React frontend static site.
4. Once the backend service is deployed, please take note of its URL. Update the VITE_NAKAMA_HOST variable in your frontend settings with your actual Render URL and simply redeploy the frontend site.

In case of any queries or doubts regarding this project setup, please feel free to revert.
