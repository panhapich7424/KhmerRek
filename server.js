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
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'H'],  // Row 0: Red pieces at top
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'R'],  // Row 1: Red King
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'],  // Row 2: Red pieces
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 3: Empty
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 4: Empty
        ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],  // Row 5: Blue pieces
        ['P', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 6: Blue King
        ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O']   // Row 7: Blue pieces at bottom
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

    // Check horizontal and vertical directions for Rek captures
    const directions = [
        [[0, -1], [0, 1]],   // Left and Right
        [[-1, 0], [1, 0]]    // Up and Down
    ];

    directions.forEach(([dir1, dir2]) => {
        const [dRow1, dCol1] = dir1;
        const [dRow2, dCol2] = dir2;

        // Check positions on both sides of the moved piece
        const pos1Row = toRow + dRow1;
        const pos1Col = toCol + dCol1;
        const pos2Row = toRow + dRow2;
        const pos2Col = toCol + dCol2;

        // Check if both positions are within bounds
        if (pos1Row >= 0 && pos1Row < 8 && pos1Col >= 0 && pos1Col < 8 &&
            pos2Row >= 0 && pos2Row < 8 && pos2Col >= 0 && pos2Col < 8) {

            const piece1 = board[pos1Row][pos1Col];
            const piece2 = board[pos2Row][pos2Col];

            // If both adjacent pieces are enemies, capture them
            if (opponentPieces.includes(piece1) && opponentPieces.includes(piece2)) {
                board[pos1Row][pos1Col] = 'H';
                board[pos2Row][pos2Col] = 'H';
                console.log(`Rek capture! ${currentPlayer} captured pieces at (${pos1Row},${pos1Col}) and (${pos2Row},${pos2Col})`);
            }
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

// Helper function to broadcast room list
const broadcastRoomList = () => {
    const publicRooms = Array.from(rooms.values())
        .filter(room => room.isPublic && !room.gameStarted)
        .map(room => ({
            id: room.id,
            playerCount: room.players.length,
            createdAt: room.createdAt
        }))
        .sort((a, b) => b.createdAt - a.createdAt); // Newest first

    io.emit('roomListUpdated', publicRooms);
};

// Socket connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Get room list
    socket.on('getRoomList', () => {
        const publicRooms = Array.from(rooms.values())
            .filter(room => room.isPublic && !room.gameStarted)
            .map(room => ({
                id: room.id,
                playerCount: room.players.length,
                createdAt: room.createdAt
            }))
            .sort((a, b) => b.createdAt - a.createdAt); // Newest first

        socket.emit('roomList', publicRooms);
    });

    // Create room
    socket.on('createRoom', ({ roomId, isPublic }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                id: roomId,
                players: [],
                board: createInitialBoard(),
                currentPlayer: 'Blue', // Blue starts first in Rek
                gameStarted: false,
                playAgainVotes: new Set(),
                restartRequests: new Set(),
                chatMessages: [],
                readyPlayers: new Set(),
                isPublic: isPublic,
                createdAt: Date.now()
            });

            // Broadcast updated room list if it's a public room
            if (isPublic) {
                broadcastRoomList();
            }
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
                // Update room list to show room as full
                if (room.isPublic) {
                    broadcastRoomList();
                }
            }
        } else {
            socket.emit('roomFull');
        }
    });

    // Join room
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            socket.emit('roomNotFound');
            return;
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
            
            // Store last move for highlighting
            room.lastMove = { from, to, player: room.currentPlayer };

            // Check for winner
            const winner = checkWinner(room.board);
            if (winner) {
                room.gameStarted = false;
                io.to(roomId).emit('gameOver', { 
                    winner, 
                    board: room.board,
                    lastMove: room.lastMove 
                });
            } else {
                // Switch turns
                room.currentPlayer = room.currentPlayer === 'Blue' ? 'Red' : 'Blue';
                io.to(roomId).emit('updateBoard', {
                    board: room.board,
                    currentPlayer: room.currentPlayer,
                    lastMove: room.lastMove
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
                room.restartRequests.clear(); // Clear any pending restart requests

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

    // Handle restart request during gameplay
    socket.on('requestRestart', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameStarted) return;

        const requester = room.players.find(p => p.id === socket.id);
        if (!requester) return;

        // Initialize restart requests set if it doesn't exist
        if (!room.restartRequests) {
            room.restartRequests = new Set();
        }

        room.restartRequests.add(socket.id);

        // Notify the other player about the restart request
        const otherPlayer = room.players.find(p => p.id !== socket.id);
        if (otherPlayer) {
            socket.to(roomId).emit('restartRequested', {
                requesterName: requester.color
            });
        }
    });

    // Handle restart response
    socket.on('restartResponse', ({ roomId, accepted }) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameStarted) return;

        const responder = room.players.find(p => p.id === socket.id);
        if (!responder) return;

        if (accepted) {
            // Restart the game
            room.board = createInitialBoard();
            room.currentPlayer = 'Blue';
            room.gameStarted = true;
            room.chatMessages = [];
            room.readyPlayers.clear();
            room.restartRequests.clear();

            io.to(roomId).emit('restartRequestAccepted');
            io.to(roomId).emit('restartGame', {
                board: room.board,
                currentPlayer: room.currentPlayer
            });
        } else {
            // Decline the restart
            room.restartRequests.clear();
            socket.to(roomId).emit('restartRequestDeclined', {
                declinerName: responder.color
            });
        }
    });

    // Handle time up
    socket.on('timeUp', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameStarted) return;

        const currentPlayerSocket = room.players.find(p => p.color === room.currentPlayer);
        if (!currentPlayerSocket || currentPlayerSocket.id !== socket.id) return;

        // Switch to the other player's turn
        room.currentPlayer = room.currentPlayer === 'Blue' ? 'Red' : 'Blue';

        // Store last move for highlighting (time up doesn't have a move)
        room.lastMove = null;

        // Check for winner (in case time up results in a win condition)
        const winner = checkWinner(room.board);
        if (winner) {
            room.gameStarted = false;
            io.to(roomId).emit('gameOver', { 
                winner, 
                board: room.board,
                lastMove: room.lastMove 
            });
        } else {
            // Continue game with next player
            io.to(roomId).emit('updateBoard', {
                board: room.board,
                currentPlayer: room.currentPlayer,
                lastMove: room.lastMove
            });
        }
    });

    // Handle exit lobby (before game starts)
    socket.on('exitLobby', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || room.gameStarted) return;

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const wasPublic = room.isPublic;
            room.players.splice(playerIndex, 1);

            // Notify the player they've left
            socket.emit('exitedLobby');

            if (room.players.length === 0) {
                rooms.delete(roomId);
            } else {
                // Notify remaining player
                socket.to(roomId).emit('playerDisconnected');
            }

            // Update room list if it was a public room
            if (wasPublic) {
                broadcastRoomList();
            }
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove player from all rooms
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                const wasPublic = room.isPublic;
                room.players.splice(playerIndex, 1);

                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    // Update room list if it was a public room
                    if (wasPublic) {
                        broadcastRoomList();
                    }
                } else {
                    socket.to(roomId).emit('playerDisconnected');
                    // Update room list to show room as available again
                    if (wasPublic) {
                        broadcastRoomList();
                    }
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