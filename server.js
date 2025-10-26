const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Game state storage
const rooms = new Map();

// Initial board setup for Rek game
const createInitialBoard = () => {
    return [
        ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'H'],
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'P'],
        ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'],
        ['R', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
        ['H', 'X', 'X', 'X', 'X', 'X', 'X', 'X']
    ];
};

// Check if a move is valid for Rek game
const isValidMove = (board, from, to, currentPlayer) => {
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;

    // Check bounds
    if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;

    // Check if destination is empty
    if (board[toRow][toCol] !== 'H') return false;

    // Check if piece belongs to current player
    const piece = board[fromRow][fromCol];
    const playerPieces = currentPlayer === 'Blue' ? ['O', 'P'] : ['X', 'R'];
    if (!playerPieces.includes(piece)) return false;

    // Check horizontal or vertical movement (one cell only)
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    // Must move exactly one cell horizontally or vertically
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
};

// Make a move on the board for Rek game
const makeMove = (board, from, to, currentPlayer) => {
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const newBoard = board.map(row => [...row]);

    // Move piece
    const piece = newBoard[fromRow][fromCol];
    newBoard[toRow][toCol] = piece;
    newBoard[fromRow][fromCol] = 'H';

    // Check for encirclement captures
    checkEncirclementCaptures(newBoard, currentPlayer);

    // Check for group trapping captures
    checkTrappingCaptures(newBoard, currentPlayer);

    return newBoard;
};

// Check for encirclement captures (Rek Capture)
const checkEncirclementCaptures = (board, currentPlayer) => {
    const playerPieces = currentPlayer === 'Blue' ? ['O', 'P'] : ['X', 'R'];
    const opponentPieces = currentPlayer === 'Blue' ? ['X', 'R'] : ['O', 'P'];

    // Check horizontal encirclements
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 6; col++) {
            if (playerPieces.includes(board[row][col]) &&
                opponentPieces.includes(board[row][col + 1]) &&
                playerPieces.includes(board[row][col + 2])) {
                board[row][col + 1] = 'H'; // Capture the middle piece
            }
        }
    }

    // Check vertical encirclements
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 8; col++) {
            if (playerPieces.includes(board[row][col]) &&
                opponentPieces.includes(board[row + 1][col]) &&
                playerPieces.includes(board[row + 2][col])) {
                board[row + 1][col] = 'H'; // Capture the middle piece
            }
        }
    }
};

// Check for group trapping captures
const checkTrappingCaptures = (board, currentPlayer) => {
    const opponentPieces = currentPlayer === 'Blue' ? ['X', 'R'] : ['O', 'P'];
    const visited = Array(8).fill().map(() => Array(8).fill(false));

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (opponentPieces.includes(board[row][col]) && !visited[row][col]) {
                const group = [];
                const hasEscape = findConnectedGroup(board, row, col, opponentPieces, visited, group);

                // If group has no escape route, capture it
                if (!hasEscape) {
                    group.forEach(([r, c]) => {
                        board[r][c] = 'H';
                    });
                }
            }
        }
    }
};

// Find connected group and check if it has escape route
const findConnectedGroup = (board, startRow, startCol, pieceTypes, visited, group) => {
    const stack = [[startRow, startCol]];
    let hasEscape = false;

    while (stack.length > 0) {
        const [row, col] = stack.pop();

        if (row < 0 || row >= 8 || col < 0 || col >= 8 || visited[row][col]) {
            continue;
        }

        if (board[row][col] === 'H') {
            hasEscape = true; // Found empty cell - group has escape
            continue;
        }

        if (!pieceTypes.includes(board[row][col])) {
            continue;
        }

        visited[row][col] = true;
        group.push([row, col]);

        // Check all 4 directions
        stack.push([row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]);
    }

    return hasEscape;
};

// Check for winner in Rek game
const checkWinner = (board) => {
    let redKing = false;
    let blueKing = false;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === 'R') redKing = true;
            if (board[row][col] === 'P') blueKing = true;
        }
    }

    // Game ends when one King is captured
    if (!redKing) return 'Blue';
    if (!blueKing) return 'Red';
    return null;
};

// Socket connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join room
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                players: [],
                board: createInitialBoard(),
                currentPlayer: 'Blue', // Blue starts first in Rek
                gameStarted: false,
                playAgainVotes: new Set(),
                chatMessages: [],
                readyPlayers: new Set()
            });
        }

        const room = rooms.get(roomId);

        // Add player if room not full
        if (room.players.length < 2) {
            const playerColor = room.players.length === 0 ? 'Blue' : 'Red';
            const playerPiece = room.players.length === 0 ? 'Blue' : 'Red';

            room.players.push({
                id: socket.id,
                color: playerColor,
                piece: playerPiece
            });

            socket.emit('playerAssigned', { color: playerColor, piece: playerPiece });

            // Notify when both players joined
            if (room.players.length === 2) {
                io.to(roomId).emit('bothPlayersJoined');
            }
        } else {
            socket.emit('roomFull');
        }
    });

    // Handle move
    socket.on('makeMove', ({ roomId, from, to }) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameStarted) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.color !== room.currentPlayer) return;

        if (isValidMove(room.board, from, to, room.currentPlayer)) {
            room.board = makeMove(room.board, from, to, room.currentPlayer);

            // Check for winner
            const winner = checkWinner(room.board);
            if (winner) {
                room.gameStarted = false;
                io.to(roomId).emit('gameOver', { winner, board: room.board });
            } else {
                // Switch turns
                room.currentPlayer = room.currentPlayer === 'Blue' ? 'Red' : 'Blue';
                io.to(roomId).emit('updateBoard', {
                    board: room.board,
                    currentPlayer: room.currentPlayer
                });
            }
        }
    });

    // Handle chat message
    socket.on('sendMessage', ({ roomId, message }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const chatMessage = {
            player: player.color,
            message: message,
            timestamp: Date.now()
        };

        room.chatMessages.push(chatMessage);
        io.to(roomId).emit('newMessage', chatMessage);
    });

    // Handle player ready
    socket.on('playerReady', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || room.gameStarted) return;

        room.readyPlayers.add(socket.id);

        // Start countdown when both players are ready
        if (room.readyPlayers.size === 2) {
            let countdown = 3;
            
            const countdownInterval = setInterval(() => {
                io.to(roomId).emit('gameStartCountdown', { count: countdown });
                
                if (countdown === 0) {
                    clearInterval(countdownInterval);
                    
                    // Start the game
                    room.gameStarted = true;
                    room.readyPlayers.clear();
                    
                    io.to(roomId).emit('startGame', {
                        board: room.board,
                        currentPlayer: room.currentPlayer,
                        players: room.players
                    });
                }
                
                countdown--;
            }, 1000);
        }
    });

    // Handle player choice (Play Again / Exit)
    socket.on('playerChoice', ({ roomId, choice }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        if (choice === 'playAgain') {
            room.playAgainVotes.add(socket.id);

            // If both players voted to play again
            if (room.playAgainVotes.size === 2) {
                room.board = createInitialBoard();
                room.currentPlayer = 'Blue'; // Blue always starts first
                room.gameStarted = true;
                room.playAgainVotes.clear();
                room.chatMessages = [];
                room.readyPlayers.clear();

                io.to(roomId).emit('restartGame', {
                    board: room.board,
                    currentPlayer: room.currentPlayer
                });
            }
        } else if (choice === 'exit') {
            io.to(roomId).emit('endSession');
            rooms.delete(roomId);
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove player from all rooms
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);

                if (room.players.length === 0) {
                    rooms.delete(roomId);
                } else {
                    socket.to(roomId).emit('playerDisconnected');
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🏯 Khmer Checkers server running on port ${PORT}`);
});