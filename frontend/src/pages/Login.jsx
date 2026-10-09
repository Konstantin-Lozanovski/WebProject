import { useState } from "react";
import { Link } from "react-router-dom";
import { loginUser } from "../services/api.js";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // One message per field, for example { email: "Please enter your email" }
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const errors = {};
    if (email.trim() === "") errors.email = "Please enter your email";
    if (password === "") errors.password = "Please enter your password";
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
      const data = await loginUser(email, password);
      // App now knows the user, and the route sends them on to Home
      onLogin(data.user, data.token);
    } catch (error) {
      console.error("Error logging in:", error);
      const data = error.response ? error.response.data : null;
      setFieldErrors(data && data.fields ? data.fields : {});
      setFormError(data ? data.msg : "The server could not be reached");
      setSubmitting(false);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-sm-10 col-md-7 col-lg-5">
        <h1 className="h2 mb-4">Log in</h1>

        {/* noValidate turns off the browser's own popups, so our messages show */}
        <form className="card card-body" onSubmit={handleSubmit} noValidate>
          {formError && <div className="alert alert-danger">{formError}</div>}

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
          </div>
          <button
            className="btn btn-primary w-100"
            type="submit"
            disabled={submitting}
          >
            Log in
          </button>
        </form>

        <p className="text-center mt-3">
          No account yet? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
