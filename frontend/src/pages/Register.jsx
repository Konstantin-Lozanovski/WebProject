import { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser } from "../services/api.js";

// The same rules the server checks, so most mistakes are caught before
// the form is sent
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PASSWORD_MIN_LENGTH = 8;
const LETTER_REGEX = /[A-Za-z]/;
const DIGIT_REGEX = /\d/;

const Register = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // One message per field, for example { username: "..." }
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isPasswordValid = () => {
    return (
      password.length >= PASSWORD_MIN_LENGTH &&
      LETTER_REGEX.test(password) &&
      DIGIT_REGEX.test(password)
    );
  };

  const validateForm = () => {
    const errors = {};
    if (!USERNAME_REGEX.test(username.trim()))
      errors.username = "Username must be 3 to 20 letters, digits or underscores";
    if (!EMAIL_REGEX.test(email.trim()))
      errors.email = "Please enter a valid email address";
    if (!isPasswordValid())
      errors.password =
        "Password must be at least 8 characters, with at least one letter and one digit";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const data = await registerUser(username, email, password);
      // Registering also logs in: App now knows the user, and the route
      // sends them on to Home
      onLogin(data.user, data.token);
    } catch (error) {
      console.error("Error registering:", error);
      const data = error.response ? error.response.data : null;
      // The server names the field (for example a taken username), so its
      // message goes beside that field; anything else goes above the form
      if (data && data.fields) {
        setFieldErrors(data.fields);
      } else {
        setFormError(data ? data.msg : "The server could not be reached");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-sm-10 col-md-7 col-lg-5">
        <h1 className="h2 mb-4">Register</h1>

        {/* noValidate turns off the browser's own popups, so our messages show */}
        <form className="card card-body" onSubmit={handleSubmit} noValidate>
          {formError && <div className="alert alert-danger">{formError}</div>}

          <div className="mb-3">
            <label className="form-label" htmlFor="username">
              Username
            </label>
            <input
              className={`form-control ${fieldErrors.username ? "is-invalid" : ""}`}
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <div className="invalid-feedback">{fieldErrors.username}</div>
            <div className="form-text">
              3 to 20 letters, digits or underscores.
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              className={`form-control ${fieldErrors.email ? "is-invalid" : ""}`}
              type="email"
              id="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="invalid-feedback">{fieldErrors.email}</div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              className={`form-control ${fieldErrors.password ? "is-invalid" : ""}`}
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="invalid-feedback">{fieldErrors.password}</div>
            <div className="form-text">
              At least 8 characters, with at least one letter and one digit.
            </div>
          </div>
          <button
            className="btn btn-primary w-100"
            type="submit"
            disabled={submitting}
          >
            Register
          </button>
        </form>

        <p className="text-center mt-3">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
