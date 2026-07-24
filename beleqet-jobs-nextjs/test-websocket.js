const { io } = require('socket.io-client');

console.log('🔄 Attempting WebSocket connection to http://localhost:4000/chat...');

const socket = io('http://localhost:4000/chat', {
  transports: ['websocket'],
  auth: { token: 'Bearer local_invalid_token_for_testing_connection' }
});

socket.on('connect', () => {
  console.log('✅ Connected successfully!');
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error('❌ Connection error:', err.message);
  socket.disconnect();
  process.exit(1);
});

setTimeout(() => {
  console.error('❌ Connection timed out after 5 seconds.');
  socket.disconnect();
  process.exit(1);
}, 5000);
