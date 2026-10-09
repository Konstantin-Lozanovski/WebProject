import axios from "axios";

// The one axios instance for our own API.
// The address is only a path, so calls go to the same address the page was
// loaded from and get forwarded to the backend from there (see ADR 0003).
const axiosInstance = axios.create({
  baseURL: "/api",
});

export default axiosInstance;
