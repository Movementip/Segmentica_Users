const net = require('node:net');

const listenHost = process.env.LISTEN_HOST || '0.0.0.0';
const listenPort = Number(process.env.LISTEN_PORT || 5432);
const targetHost = process.env.TARGET_HOST || 'db';
const targetPort = Number(process.env.TARGET_PORT || 5432);

const closeQuietly = (socket) => {
    if (!socket.destroyed) {
        socket.destroy();
    }
};

const server = net.createServer((clientSocket) => {
    const targetSocket = net.createConnection({ host: targetHost, port: targetPort });

    clientSocket.on('error', () => closeQuietly(targetSocket));
    targetSocket.on('error', (error) => {
        console.error(`[tailscale-db-proxy] target error: ${error.code || error.message}`);
        closeQuietly(clientSocket);
    });

    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
});

server.on('error', (error) => {
    console.error(`[tailscale-db-proxy] listen error: ${error.code || error.message}`);
    process.exit(1);
});

server.listen(listenPort, listenHost, () => {
    console.log(`[tailscale-db-proxy] ${listenHost}:${listenPort} -> ${targetHost}:${targetPort}`);
});
