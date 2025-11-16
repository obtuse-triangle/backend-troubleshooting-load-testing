import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 10},
    { duration: "20s", target: 10},
    { duration: "10s", target: 0},
  ],
  threholds: {
    http_req_duration: ["p(95)<500"],
  }
}

export default function () {
  const rest = http.get("http://localhost:8000/api/posts/v1/slow");
  check(rest, {
    "is status 200": (r) => r.status === 200,
  });
  sleep(1); 
}