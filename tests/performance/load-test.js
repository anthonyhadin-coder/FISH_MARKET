import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp up to 50 users
    { duration: '1m',  target: 50 }, // hold at 50 users
    { duration: '20s', target: 0  }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% of requests must be under 800ms
    http_req_failed:   ['rate<0.05'],  // error rate must be < 5% (allowing for intentional 429s/edge cases)
  },
};

export default function () {
  const baseUrl = 'http://localhost:5000/api';
  const headers = { 'Content-Type': 'application/json' };

  // 1. Auth: Login
  const loginRes = http.post(`${baseUrl}/auth/login`, JSON.stringify({
    phone: '9876543210',
    password: 'password123'
  }), { headers });
  
  const loginPass = check(loginRes, { 
    'login status is 200': (r) => r.status === 200,
    'has access token': (r) => r.json().accessToken !== undefined
  });

  if (!loginPass) {
    console.error(`Login failed for VU ${__VU}: ${loginRes.status}`);
    sleep(1);
    return;
  }

  const token = loginRes.json().accessToken;
  const authHeaders = { 
    ...headers, 
    'Authorization': `Bearer ${token}` 
  };

  // 2. Auth: Send OTP
  const sendOtpRes = http.post(`${baseUrl}/auth/phone/send-otp`, JSON.stringify({
    phone: '9876543210'
  }), { headers });
  check(sendOtpRes, { 'send-otp status is 200/429': (r) => [200, 429].includes(r.status) });

  // 3. Activity: Post Sales
  const salesRes = http.post(`${baseUrl}/sales`, JSON.stringify({
    boatId: 1, 
    buyerId: 1, 
    fishType: 'Sankara', 
    weight: 10, 
    rate: 250, 
    timestamp: new Date().toISOString()
  }), { headers: authHeaders });
  check(salesRes, { 'post sales status is 201': (r) => r.status === 201 });

  // 4. Analytics: Owner Reports
  const reportsRes = http.get(`${baseUrl}/reports?view=daily`, { headers: authHeaders });
  check(reportsRes, { 'reports status is 200': (r) => r.status === 200 });

  // 5. Notifications
  const notifyRes = http.get(`${baseUrl}/notifications`, { headers: authHeaders });
  check(notifyRes, { 'notifications status is 200': (r) => r.status === 200 });

  sleep(1);
}
