// Set API after the backend is deployed (the Lambda Function URL, no trailing slash).
// When the site is served locally, ?api=http://localhost:8000 points it at a local backend.
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
export const API = (local && new URLSearchParams(location.search).get("api")) || "";
