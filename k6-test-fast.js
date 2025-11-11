import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
	stages: [
		{ duration: '10s', target: 10 },
		{ duration: '20s', target: 10 },
		{ duration: '10s', target: 0 },
	],
	thresholds: {
		http_req_duration: ['p(95)<500'],
	},
};

export default function () {
	const res = http.get('http://127.0.0.1:8000/api/posts/v2/fast');

	check(res, {
		'status is 200': (r) => r.status === 200,
		'response time < 500ms': (r) => r.timings.duration < 500,
	});

	sleep(1);
}
