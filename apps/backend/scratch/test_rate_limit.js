const axios = require('axios');

async function testRateLimit() {
    const url = 'http://localhost:5000/api/health';
    const totalRequests = 150;
    let successCount = 0;
    let error429Count = 0;

    console.log(`Starting ${totalRequests} requests to ${url}...`);

    for (let i = 0; i < totalRequests; i++) {
        try {
            await axios.get(url);
            successCount++;
        } catch (err) {
            if (err.response && err.response.status === 429) {
                error429Count++;
            } else {
                console.error(`Request ${i} failed with status ${err.response?.status || err.message}`);
            }
        }
        
        if (i % 25 === 0) console.log(`Progress: ${i}/${totalRequests}`);
    }

    console.log('\n--- Results ---');
    console.log(`Successful requests: ${successCount}`);
    console.log(`429 Errors: ${error429Count}`);
    
    if (successCount === totalRequests) {
        console.log('✅ TEST PASSED: All 150 requests succeeded (limit is now > 100).');
    } else {
        console.log('❌ TEST FAILED: Rate limit still active or other error occurred.');
    }
}

testRateLimit();
