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

// Check if a move is valid for Rek game (rook-like movement)
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

    // Must move horizontally or vertically (like a rook)
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    
    // Must be either horizontal or vertical movement
    if (rowDiff !== 0 && colDiff !== 0) return false;
    
    // Check path is clear (no pieces in between)
    const stepRow = rowDiff === 0 ? 0 : (rowDiff > 0 ? 1 : -1);
    const stepCol = colDiff === 0 ? 0 : (colDiff > 0 ? 1 : -1);
    
    let currentRow = fromRow + stepRow;
    let currentCol = fromCol + stepCol;
    
    while (currentRow !== toRow || currentCol !== toCol) {
        if (board[currentRow][currentCol] !== 'H') {
            return false; // Path blocked
        }
        currentRow += stepRow;
        currentCol += stepCol;
    }
    
    return true;
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

    // Check for Rek captures (sandwich capture)
    checkRekCaptures(newBoard, toRow, toCol, currentPlayer);

    // Check for group trapping captures
    checkTrappingCaptures(newBoard, currentPlayer);

    return newBoard;
};

// Check for Rek captures (sandwich capture)
const checkRekCaptures = (board, toRow, toCol, currentPlayer) => {
    const playerPieces = currentPlayer === 'Blue' ? ['O', 'P'] : ['X', 'R'];
    const opponentPieces = currentPlayer === 'Blue' ? ['X', 'R'] : ['O', 'P'];

    // Check if the moved piece creates a sandwich in any direction
    const directions = [
        [0, 1],   // Right
        [0, -1],  // Left
        [1, 0],   // Down
        [-1, 0]   // Up
    ];

    directions.forEach(([dRow, dCol]) => {
        // Look for enemy pieces in this direction
        let checkRow = toRow + dRow;
        let checkCol = toCol + dCol;
        const enemiesToCapture = [];

        // Collect consecutive enemy pieces
        while (checkRow >= 0 && checkRow < 8 && checkCol >= 0 && checkCol < 8) {
            const piece = board[checkRow][checkCol];

            if (opponentPieces.includes(piece)) {
                enemiesToCapture.push([checkRow, checkCol]);
            } else if (playerPieces.includes(piece)) {
                // Found our piece - capture all enemies in between
                enemiesToCapture.forEach(([enemyRow, enemyCol]) => {
                    board[enemyRow][enemyCol] = 'H';
                });
                break;
            } else {
                // Empty space - no capture
                break;
            }

            checkRow += dRow;
            checkCol += dCol;
        }
    });
};

// Check for group trapping captures
const checkTrappingCaptures = (board, currentPlayer) => {
    const opponentPlayer = currentPlayer === 'Blue' ? 'Red' : 'Blue';
    const opponentPieces = currentPlayer === 'Blue' ? ['X', 'R'] : ['O', 'P'];
    const visited = Array(8).fill().map(() => Array(8).fill(false));

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (opponentPieces.includes(board[row][col]) && !visited[row][col]) {
                const group = [];
                findConnectedGroup(board, row, col, opponentPieces, visited, group);

                // Check if any piece in the group has legal moves
                let hasLegalMove = false;
                for (const [pieceRow, pieceCol] of group) {
                    if (pieceHasLegalMoves(board, pieceRow, pieceCol, opponentPlayer)) {
                        hasLegalMove = true;
                        break;
                    }
                }

                // If no piece in the group has legal moves, capture the entire group
                if (!hasLegalMove) {
                    group.forEach(([r, c]) => {
                        board[r][c] = 'H';
                    });
                }
            }
        }
    }
};

// Find connected group of pieces
const findConnectedGroup = (board, startRow, startCol, pieceTypes, visited, group) => {
    const stack = [[startRow, startCol]];

    while (stack.length > 0) {
        const [row, col] = stack.pop();

        if (row < 0 || row >= 8 || col < 0 || col >= 8 || visited[row][col]) {
            continue;
        }

        if (!pieceTypes.includes(board[row][col])) {
            continue;
        }

        visited[row][col] = true;
        group.push([row, col]);

        // Check all 4 directions for connected pieces
        stack.push([row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]);
    }
};

// Check if a piece has any legal moves
const pieceHasLegalMoves = (board, row, col, player) => {
    // Check all four directions (orthogonal movement like a rook)
    const directions = [
        [0, 1],   // Right
        [0, -1],  // Left
        [1, 0],   // Down
        [-1, 0]   // Up
    ];

    for (const [dRow, dCol] of directions) {
        let checkRow = row + dRow;
        let checkCol = col + dCol;

        // Check each square in this direction
        while (checkRow >= 0 && checkRow < 8 && checkCol >= 0 && checkCol < 8) {
            if (board[checkRow][checkCol] === 'H') {
                // Found an empty square - this is a legal move
                return true;
            } else {
                // Hit a piece - can't move further in this direction
                break;
            }
            checkRow += dRow;
            checkCol += dCol;
        }
    }

    return false; // No legal moves found
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