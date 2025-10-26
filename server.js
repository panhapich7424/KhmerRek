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

// Initial board setup
const createInitialBoard = () => {
  return [
    ['O','H','O','H','O','H','O','H'],
    ['H','O','H','O','H','O','H','O'],
    ['O','H','O','H','O','H','O','H'],
    ['H','H','H','H','H','H','H','H'],
    ['H','H','H','H','H','H','H','H'],
    ['X','H','X','H','X','H','X','H'],
    ['H','X','H','X','H','X','H','X'],
    ['X','H','X','H','X','H','X','H']
  ];
};

// Check if a move is valid
const isValidMove = (board, from, to, currentPlayer) => {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  
  // Check bounds
  if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;
  
  // Check if destination is empty
  if (board[toRow][toCol] !== 'H') return false;
  
  // Check if piece belongs to current player
  if (board[fromRow][fromCol] !== currentPlayer) return false;
  
  // Check diagonal movement
  const rowDiff = toRow - fromRow;
  const colDiff = Math.abs(toCol - fromCol);
  
  // Regular move (one diagonal step)
  if (Math.abs(rowDiff) === 1 && colDiff === 1) {
    // Check direction based on player
    if (currentPlayer === 'X' && rowDiff > 0) return false; // Red moves up
    if (currentPlayer === 'O' && rowDiff < 0) return false; // Blue moves down
    return true;
  }
  
  // Capture move (two diagonal steps)
  if (Math.abs(rowDiff) === 2 && colDiff === 2) {
    const middleRow = fromRow + rowDiff / 2;
    const middleCol = fromCol + (toCol - fromCol) / 2;
    const middlePiece = board[middleRow][middleCol];
    
    // Check if there's an opponent piece to capture
    const opponent = currentPlayer === 'X' ? 'O' : 'X';
    return middlePiece === opponent;
  }
  
  return false;
};

// Make a move on the board
const makeMove = (board, from, to, currentPlayer) => {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  const newBoard = board.map(row => [...row]);
  
  // Move piece
  newBoard[toRow][toCol] = currentPlayer;
  newBoard[fromRow][fromCol] = 'H';
  
  // Handle capture
  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;
  if (Math.abs(rowDiff) === 2) {
    const middleRow = fromRow + rowDiff / 2;
    const middleCol = fromCol + colDiff / 2;
    newBoard[middleRow][middleCol] = 'H';
  }
  
  return newBoard;
};

// Check for winner
const checkWinner = (board) => {
  let redPieces = 0;
  let bluePieces = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === 'X') redPieces++;
      if (board[row][col] === 'O') bluePieces++;
    }
  }
  
  if (redPieces === 0) return 'Blue';
  if (bluePieces === 0) return 'Red';
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
        currentPlayer: 'X', // Red starts
        gameStarted: false,
        playAgainVotes: new Set()
      });
    }
    
    const room = rooms.get(roomId);
    
    // Add player if room not full
    if (room.players.length < 2) {
      const playerColor = room.players.length === 0 ? 'Red' : 'Blue';
      const playerPiece = room.players.length === 0 ? 'X' : 'O';
      
      room.players.push({
        id: socket.id,
        color: playerColor,
        piece: playerPiece
      });
      
      socket.emit('playerAssigned', { color: playerColor, piece: playerPiece });
      
      // Start game if room is full
      if (room.players.length === 2) {
        room.gameStarted = true;
        io.to(roomId).emit('startGame', {
          board: room.board,
          currentPlayer: room.currentPlayer,
          players: room.players
        });
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
    if (!player || player.piece !== room.currentPlayer) return;
    
    if (isValidMove(room.board, from, to, room.currentPlayer)) {
      room.board = makeMove(room.board, from, to, room.currentPlayer);
      
      // Check for winner
      const winner = checkWinner(room.board);
      if (winner) {
        room.gameStarted = false;
        io.to(roomId).emit('gameOver', { winner, board: room.board });
      } else {
        // Switch turns
        room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
        io.to(roomId).emit('updateBoard', {
          board: room.board,
          currentPlayer: room.currentPlayer
        });
      }
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
        room.currentPlayer = 'X';
        room.gameStarted = true;
        room.playAgainVotes.clear();
        
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