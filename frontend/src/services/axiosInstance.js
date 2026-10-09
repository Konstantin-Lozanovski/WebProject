import axios from "axios";

// The one axios instance for our own API.
// The address is only a path, so calls go to the same address the page was
// loaded from and get forwarded to the backend from there (see ADR 0003).
const axiosInstance = axios.create({
  baseURL: "/api",
});

// Automatically attach token to every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// A 401 while we hold a token means the server rejected that token
// (expired, or the user was deleted), so the browser logs out too
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const token = localStorage.getItem("token");
    const isUnauthorized = error.response && error.response.status === 401;
    // A 401 from the login call means a wrong password, not a bad token,
    // and the Login screen shows that message itself
    const isLoginCall = error.config && error.config.url === "/auth/login";

    if (token && isUnauthorized && !isLoginCall) {
      localStorage.removeItem("token");
      // A full page load, not a router navigation: it also clears the
      // logged-in user that App keeps in its state
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
