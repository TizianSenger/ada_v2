const io = require('socket.io-client');

const socket = io('http://127.0.0.1:8000', {
    transports: ['websocket', 'polling'],
    timeout: 10000,
});

let sent = false;

socket.on('connect', () => {
    console.log('[probe] connected', socket.id);
    socket.emit('user_input', { text: 'Probe: Bitte antworte mit OK.' });
    sent = true;
});

socket.on('status', (data) => {
    console.log('[probe] status', data);
});

socket.on('transcription', (data) => {
    console.log('[probe] transcription', data);
});

socket.on('error', (data) => {
    console.log('[probe] error', data);
});

setTimeout(() => {
    if (!sent) {
        console.log('[probe] did not send (no connect)');
    }
    socket.close();
    process.exit(0);
}, 12000);
