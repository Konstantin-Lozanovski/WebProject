# Static mock-ups

Part 1 of the assignment: one static HTML page for every screen of the Pickup Game Organizer. The pages show fixed made-up data and contain no logic. They exist so the whole app can be clicked through before any of it is built.

## How to open them

Open `index.html` in a browser (double-click it). An internet connection is needed, because Bootstrap is loaded from its CDN.

## What the pages share

- **Navigation and footer.** Every page has the same navigation bar and the same footer. In the mock-ups the navigation shows every link at once so each screen can be reached. In the real app the links depend on who is logged in (a guest does not see "My games", only an admin sees "Admin overview").
- **Bootstrap 5.3** from the CDN is the only stylesheet. There is no CSS of our own.
- **Three device widths.** The pages use Bootstrap's grid, so the columns sit side by side on a desktop, partly stack on a tablet and fully stack on a phone. The navigation collapses behind a button on small screens, and wide tables scroll sideways.
- **Scripts.** The only script file is Bootstrap's own, which the collapsing navigation and the popups need. The one line of script we wrote is in `game-cancel.html`, to show the popup as soon as the page opens.
- **Made-up users.** The Game page, Edit game and My games are shown the way the user `marko_p` sees them. The Admin overview is shown the way the admin sees it.

## The screens

| # | File | Screen | Screen type from the assignment |
|---|---|---|---|
| 1 | `index.html` | Home | list of elements, search |
| 2 | `game.html` | Game page | detailed view, external source |
| 3 | `create-game.html` | Create game | adding an element |
| 4 | `edit-game.html` | Edit game | viewing and editing an element |
| 5 | `game-cancel.html` | Game page with the cancel popup open | deleting an element |
| 6 | `login.html` | Login | login |
| 7 | `register.html` | Register | registration |
| 8 | `my-games.html` | My games | history view |
| 9 | `admin.html` | Admin overview | several roles with different views |
| 10 | `db.html` | `/db` | reset and seed the database |

### 1. Home (`index.html`)

The first page of the app, open to everyone including guests.

- Lists the upcoming games, soonest first. Each game shows its sport, city, venue, start time, duration, organizer and how many places are left. A full game shows "Full" instead.
- Three filters narrow the list: sport, city and date. Sport and city are select inputs because they come from fixed sets.
- "View game" opens the Game page.
- A games-per-sport chart sits beside the list. The mock-up shows a placeholder where the chart will be drawn.

### 2. Game page (`game.html`)

Everything about one game. The mock-up shows the organizer's view, because the organizer sees every part of the page.

- **Details:** sport, city, venue, start time, duration, number of players and places left, the notes, and the game's status (upcoming, in progress or finished).
- **Weather forecast:** the forecast for the game's city at the game's start time, taken from the external Open-Meteo service. When the game is too far ahead or already finished it shows "forecast not available yet".
- **Teams:** three columns — Team A, unassigned players, Team B. Each team shows max ÷ 2 spaces (5 each for this 10-player game). The organizer drags a player onto a team, between teams, or back to the middle, and can remove a player.
- **Pending join requests:** the users asking to join, each with Accept and Decline.
- **Chat:** the game's messages, oldest first, with a box to write a new one. A player can delete their own messages.
- **Edit game** and **Cancel game** buttons, for the organizer.

Who sees what in the real app: everyone sees the details, weather and teams. A guest sees "log in to join". A logged-in user who is not a player sees "Request to join", or their own request's state with "Withdraw". A player sees the chat and "Leave game". The organizer and admins also see the pending join requests, the remove buttons and the Edit and Cancel buttons.

### 3. Create game (`create-game.html`)

The form a registered user fills in to create a game. They become its organizer and its first player.

- Sport, city, duration and max players are select inputs, so only allowed values can be chosen: five sports, eight cities, 60/90/120 minutes, and an even number of players from 2 to 22.
- Venue is free text (3 to 100 characters), start time is a date and time (at least 2 hours from now, at most 60 days ahead), and notes are optional (up to 300 characters).
- "Create game" saves the game and opens its Game page.

### 4. Edit game (`edit-game.html`)

The same form as Create game, filled in with the game's current values. Only the organizer or an admin can open it.

- "Save changes" saves the game and returns to its Game page.
- The edit is refused if it lowers the max below the current number of players, or moves the time so that one of the players would have an overlap with another game.

### 5. Game page with the cancel popup open (`game-cancel.html`)

What the organizer sees after pressing "Cancel game" on the Game page: the same page with a confirmation popup on top (Bootstrap's modal).

- The popup warns that cancelling deletes the game together with its join requests, players and chat messages, and that the players are told by email.
- "Keep game" closes the popup and nothing changes.
- "Cancel game" deletes the game and returns to Home.

### 6. Login (`login.html`)

- A registered user logs in with their email and password.
- A link leads to Register for people without an account.

### 7. Register (`register.html`)

- A guest creates an account with a username (3 to 20 letters, digits or underscores), an email and a password (at least 8 characters, with at least one letter and one digit).
- Everyone registers as a user; admins are made by another admin. A welcome email is sent.
- A link leads to Login for people who already have an account.

### 8. My games (`my-games.html`)

A registered user's own history.

- **Upcoming games** they are a player in, with a badge on the ones they organize.
- **Finished games** they played in.
- **My join requests** with the state of each: pending, accepted or declined. A pending request can be withdrawn.
- A my-games-per-month chart for the last six months. The mock-up shows a placeholder.

### 9. Admin overview (`admin.html`)

Only for admins.

- **Totals:** the number of users, the number of games in each status, and the number of join requests in each state.
- **Games:** every game, with View, Edit and Cancel. An admin can edit or cancel any game at any time.
- **Users:** every user, with a select to change their role between user and admin, and a Delete button that asks for confirmation in a popup. The admin's own row has both controls disabled, because an admin cannot demote or delete themselves.

### 10. `/db` (`db.html`)

Used to test the app and bring it back to a known starting point. Open to everyone without logging in, because after "Delete all data" there is no admin left to log in as.

- **Delete all data** empties all five collections.
- **Seed initial data** clears the database and then adds the initial data: an admin, several users, games in every status, players, join requests and chat messages.
- Each action asks for confirmation in a popup first.
