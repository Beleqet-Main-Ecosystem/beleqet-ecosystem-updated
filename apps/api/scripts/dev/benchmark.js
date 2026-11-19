const http = require('http');

const REST_URL = 'http://localhost:4000/api/v1/jobs';
const GRAPHQL_URL = 'http://localhost:4000/api/v1/graphql';

const graphqlPayload = JSON.stringify({
  query: `
    query {
      jobs(query: { limit: 20 }) {
        items {
          id
          title
          company {
            name
          }
        }
      }
    }
  `
});

async function measureRequest(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const end = performance.now();
        resolve({
          timeMs: end - start,
          sizeBytes: Buffer.byteLength(data, 'utf8'),
          status: res.statusCode,
        });
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runBenchmark() {
  console.log('🚀 Starting Performance Benchmark: REST vs GraphQL\n');

  try {
    // 1. Warm up the JIT compiler and DB connections
    await measureRequest(REST_URL, { method: 'GET' });
    await measureRequest(GRAPHQL_URL, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(graphqlPayload) } 
    }, graphqlPayload);
  } catch (e) {
    console.error('❌ Failed to connect to the local server. Ensure it is running on port 4000.');
    return;
  }

  const ITERATIONS = 10;

  // 2. Measure REST API
  let restTotalTime = 0;
  let restSize = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const result = await measureRequest(REST_URL, { method: 'GET' });
    restTotalTime += result.timeMs;
    restSize = result.sizeBytes; // Assuming size is consistent
  }

  // 3. Measure GraphQL API
  let gqlTotalTime = 0;
  let gqlSize = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const result = await measureRequest(GRAPHQL_URL, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(graphqlPayload) } 
    }, graphqlPayload);
    gqlTotalTime += result.timeMs;
    gqlSize = result.sizeBytes;
  }

  // 4. Output Results
  console.log(`📊 RESULTS (Average over ${ITERATIONS} requests):`);
  console.log('--------------------------------------------------');
  console.log(`REST API (Standard):`);
  console.log(`- Average Latency : ${(restTotalTime / ITERATIONS).toFixed(2)} ms`);
  console.log(`- Payload Size    : ${(restSize / 1024).toFixed(2)} KB`);
  console.log('');
  console.log(`GraphQL API (Optimized Query):`);
  console.log(`- Average Latency : ${(gqlTotalTime / ITERATIONS).toFixed(2)} ms`);
  console.log(`- Payload Size    : ${(gqlSize / 1024).toFixed(2)} KB`);
  console.log('--------------------------------------------------');
  
  if (restSize > 0) {
    const sizeReduction = ((restSize - gqlSize) / restSize * 100).toFixed(1);
    console.log(`\n🎉 CONCLUSION: GraphQL eliminated over-fetching and reduced network payload by ${sizeReduction}%!`);
  }
}

runBenchmark();
