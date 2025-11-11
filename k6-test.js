import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 10 }, // 10초 동안 10명의 가상 사용자로 증가
    { duration: "20s", target: 10 }, // 20초 동안 10명 유지
    { duration: "10s", target: 0 }, // 10초 동안 0명으로 감소
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95%의 요청이 500ms 이내여야 함
  },
};

export default function () {
  const res = http.get("http://127.0.0.1:8000/api/posts/v1/slow");

  check(res, {
      "status is 200": (r) => r.status === 200,
      "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}