// The closed set of roles, the same one the server checks.
// It fills the role select, so only an allowed role can be chosen.
export const ROLES = ["user", "admin"];

// How each role is shown
export const ROLE_LABELS = { user: "User", admin: "Admin" };

// Mirrors the user document the API returns.
// The password never leaves the server, so it is not here.
class User {
  constructor(data) {
    this._id = data._id;
    this.username = data.username;
    this.email = data.email;
    this.role = data.role;
    // JSON has no date type, so the API sends the date as text
    this.createdAt = new Date(data.createdAt);
  }

  isAdmin() {
    return this.role === "admin";
  }
}

export default User;
