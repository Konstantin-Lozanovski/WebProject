# Pickup Game Organizer

A web app for organizing and joining informal pickup sports games. A registered user creates a game (sport, city, venue, start time, duration, max players) and becomes its organizer and first player. Other users find upcoming games and send a join request, which the organizer accepts or declines. Every game has a chat for its players, a weather forecast for its city and start time, and two teams that the organizer arranges by dragging players.

- Frontend: React (Vite), a single-page app
- Backend: Node.js + Express, a REST API in MVC structure
- Database: MongoDB through Mongoose
- External source: the [Open-Meteo](https://open-meteo.com/) weather forecast

## The deployed app

**https://pickup-games.vercel.app**

| What                           | Address                                          |
| ------------------------------ | ------------------------------------------------ |
| Home page                      | https://pickup-games.vercel.app/                 |
| Reset and seed the database    | https://pickup-games.vercel.app/db               |
| API documentation (Swagger UI) | https://pickup-games.vercel.app/api/docs/        |
| OpenAPI file                   | https://pickup-games.vercel.app/api/swagger.json |

The React app is on Vercel, the Express API on Render and the database on MongoDB Atlas. Everything is reached through the one Vercel address: Vercel forwards every `/api/...` call to the backend.

The backend is on Render's free tier, which puts it to sleep when nobody uses it. The first request after a pause can take up to a minute; after that the app answers at normal speed.

## Running the app locally in Docker

The only thing that has to be installed is [Docker Desktop](https://www.docker.com/products/docker-desktop/) (it includes Docker Compose). Node.js and MongoDB do not have to be installed: both run inside containers.

1. Start Docker Desktop and wait until it says it is running.
2. Get the code and go into its folder:

   ```
   git clone https://github.com/Konstantin-Lozanovski/WebProject.git
   cd WebProject
   ```

3. Make sure nothing else on the computer is using ports **5173** and **5000**.
4. Start the app:

   ```
   docker-compose up
   ```

5. Open **http://localhost:5173/** in a browser. This is the home page.
6. The database starts empty. Open **http://localhost:5173/db**, press **Seed initial data** and confirm in the popup.
7. Log in with one of the demo logins below.

No `.env` file and no other settings are needed.

To stop the app, press `Ctrl + C` in the terminal, or run `docker-compose down` in the same folder. The data stays. To also delete the data, run `docker-compose down -v`.

After changing the code, run `docker-compose up --build` so the containers are built again.

### What `docker-compose up` starts

It starts three containers, one for each service in `docker-compose.yml`:

| Service    | What it is                                                                                                                                     | Reached at                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `mongo`    | The virtualized MongoDB database (the official `mongo:7` image). Its data is kept in the Docker volume `mongo-data`, so it survives a restart. | only from inside Docker, not from the computer |
| `backend`  | The Express REST API. It connects to the `mongo` container.                                                                                    | http://localhost:5000                          |
| `frontend` | The built React app. It also forwards every `/api/...` call to the backend.                                                                    | http://localhost:5173                          |

Everything is used through the frontend address, the same way as in the cloud:

- http://localhost:5173/ is the home page
- http://localhost:5173/db is the reset and seed page
- http://localhost:5173/api/docs/ is the API documentation
- http://localhost:5173/api/swagger.json is the OpenAPI file

### Which database is used

The backend reads one setting for the database, `MONGO_URI`. In Docker, `docker-compose.yml` sets it to the `mongo` container. In the cloud, Render sets it to the MongoDB Atlas address. Nothing in the code has to be changed between the two.

### Emails

Locally there are no mail settings, so no email is really sent. Every email the app would send (welcome, new join request, join request accepted, game cancelled) is written to the backend's log instead. To read them:

```
docker-compose logs backend
```

## Demo logins

"Seed initial data" on the `/db` page creates these accounts. Login is by email and password.

| Role  | Username  | Email               | Password    |
| ----- | --------- | ------------------- | ----------- |
| Admin | `admin`   | `admin@example.com` | `admin1234` |
| User  | `marko_p` | `marko@example.com` | `football1` |
| User  | `sara_b`  | `sara@example.com`  | `football1` |
| User  | `ivan_t`  | `ivan@example.com`  | `football1` |
| User  | `elena_k` | `elena@example.com` | `football1` |
| User  | `david_m` | `david@example.com` | `football1` |
| User  | `ana_s`   | `ana@example.com`   | `football1` |

`marko_p` is the best account to start with: he organizes the upcoming "Football in Skopje" game, which has players on Team A, on Team B and unassigned, two pending join requests and a chat. He also has finished games in several months, so his My games page shows the chart.

The seed also creates 12 games: finished ones, one in progress, and upcoming ones (one of them full, one too far ahead for a weather forecast), with join requests in all three states and chat messages. The game times are counted from the moment of seeding, so there is always a game in progress, whenever the seed is run. Seeding again deletes everything first, so it always gives the same data.

## The three types of users

### Guest (not logged in)

A guest can only look.

- Sees the list of upcoming games on the home page and can search it by sport, city and date.
- Sees the games-per-sport chart.
- Can open any game and see its details, the weather forecast, both teams and the unassigned players.
- Sees "Log in to join" where the join button would be.
- Can register and log in.
- Cannot create a game, send a join request or see a chat. The API answers 401 to all of these.
- Can use the `/db` page (see below).

### Registered user

Everyone who registers is a user. A user can change only what is theirs.

- Can create a game. They become its organizer and its first player.
- Can send a join request to a game that is not full and does not overlap another game they are a player in, and can withdraw it while it is pending, until one hour before the game starts.
- As a **player** in a game: can read and post in that game's chat, delete their own messages, and leave the game until one hour before it starts.
- As the **organizer** of a game: can accept and decline its join requests, remove players, drag players between Team A, Team B and unassigned, edit the game and cancel it. All of this is possible until the game starts (removing a player until one hour before).
- Has a My games page with their upcoming games, their finished games, their join requests and a chart of their games per month.
- Cannot change someone else's game, read the chat of a game they are not a player in, or open the Admin overview. The API answers 403 to all of these.

### Admin

An admin can change and delete everything, at any time.

- Has the Admin overview page: totals (users, games by status, join requests by state), the list of all games at every status, and the list of all users.
- Can do everything an organizer can, on any game, also when it is in progress or finished and without the one-hour limit.
- Can read every chat and delete any message. An admin cannot post in the chat of a game they are not a player in.
- Can change a user's role between user and admin, and delete a user.
- Cannot delete themselves or change their own role, so the app always has at least one admin.

Admins are not made by registering. The first one comes from the seed, and an admin can promote other users.

Every rule above is checked by the API and not only hidden in the interface. The user is read from the database on every request, so a user who was demoted or deleted loses their access at once.

## The `/db` page is open to everyone on purpose

The `/db` page has two actions, each behind a confirmation popup:

- **Delete all data** empties all five collections.
- **Seed initial data** deletes everything and then adds the demo data described above.

Neither needs a login, and this is the one place where a guest can change data. It is on purpose: after "Delete all data" the database has no users, so there is no admin left who could log in to seed it again. A freshly started Docker database is empty in the same way. The assignment asks for this page so the app is easy to test and to bring back to its starting state, and that only works when it can be reached without an account.

In a real product this page would not exist.

## API documentation

The REST API is documented with JSDoc comments above the routes (in `backend/src/routes/`). `swagger-jsdoc` builds the OpenAPI file from them and `swagger-ui-express` shows it.

- Swagger UI: `/api/docs/`
- OpenAPI file: `/api/swagger.json`

To call a protected route from Swagger UI: call `POST /api/auth/login` with a demo login, copy the `token` from the answer, press **Authorize** at the top of the page and paste it.
