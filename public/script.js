// Socket connection
const socket = io();

// Game state
let gameState = {
    roomId: null,
    playerColor: null,
    playerPiece: null,
    currentPlayer: 'X',
    board: [],
    selectedSquare: null,
    gameStarted: false
};

// DOM elements
const screens = {
    mainMenu: document.getElementById('mainMenu'),
    gameScreen: document.getElementById('gameScreen'),
    loadingScreen: document.getElementById('loadingScreen')
};

const elements = {
    roomInput: document.getElementById('roomInput'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    gameBoard: document.getElementById('gameBoard'),
    roomCode: document.getElementById('roomCode'),
    statusMessage: document.getElementById('statusMessage'),
    redTurn: document.getElementById('redTurn'),
    blueTurn: document.getElementById('blueTurn'),
    gameOverModal: document.getElementById('gameOverModal'),
    winnerText: document.getElementById('winnerText'),
    winnerMessage: document.getElementById('winnerMessage'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    exitGameBtn: document.getElementById('exitGameBtn'),
    bgMusic: document.getElementById('bgMusic')
};

// Utility functions
const showScreen = (screenName) => {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
};

const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const showNotification = (message, type = 'info') => {
    // Simple notification system
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#cc0000' : '#d4af37'};
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
};

// Board creation and management
const createBoard = () => {
    elements.gameBoard.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `board-square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;
            
            square.addEventListener('click', () => handleSquareClick(row, col));
            
            elements.gameBoard.appendChild(square);
        }
    }
};

const updateBoard = (board) => {
    gameState.board = board;
    
    // Clear all pieces
    document.querySelectorAll('.game-piece').forEach(piece => piece.remove());
    
    // Add pieces based on board state
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece !== 'H') {
                const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                const pieceElement = document.createElement('div');
                pieceElement.className = `game-piece ${piece === 'X' ? 'red' : 'blue'}`;
                pieceElement.dataset.row = row;
                pieceElement.dataset.col = col;
                
                pieceElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handlePieceClick(row, col);
                });
                
                square.appendChild(pieceElement);
            }
        }
    }
};

const handleSquareClick = (row, col) => {
    if (!gameState.gameStarted || gameState.playerPiece !== gameState.currentPlayer) {
        return;
    }
    
    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    
    if (gameState.selectedSquare && square.classList.contains('valid-move')) {
        // Make move
        const from = [gameState.selectedSquare.row, gameState.selectedSquare.col];
        const to = [row, col];
        
        socket.emit('makeMove', {
            roomId: gameState.roomId,
            from: from,
            to: to
        });
        
        clearSelection();
    } else {
        clearSelection();
    }
};

const handlePieceClick = (row, col) => {
    if (!gameState.gameStarted || gameState.playerPiece !== gameState.currentPlayer) {
        return;
    }
    
    const piece = gameState.board[row][col];
    
    // Only allow selecting own pieces
    if (piece === gameState.playerPiece) {
        clearSelection();
        selectPiece(row, col);
    }
};

const selectPiece = (row, col) => {
    gameState.selectedSquare = { row, col };
    
    // Highlight selected piece
    const piece = document.querySelector(`[data-row="${row}"][data-col="${col}"] .game-piece`);
    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    
    if (piece) piece.classList.add('selected');
    if (square) square.classList.add('selected');
    
    // Show valid moves
    showValidMoves(row, col);
};

const showValidMoves = (fromRow, fromCol) => {
    const directions = [
        [-1, -1], [-1, 1], [1, -1], [1, 1] // Diagonal directions
    ];
    
    directions.forEach(([dRow, dCol]) => {
        // Regular move (one step)
        const newRow = fromRow + dRow;
        const newCol = fromCol + dCol;
        
        if (isValidMove(fromRow, fromCol, newRow, newCol)) {
            const square = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
            if (square) square.classList.add('valid-move');
        }
        
        // Capture move (two steps)
        const jumpRow = fromRow + dRow * 2;
        const jumpCol = fromCol + dCol * 2;
        
        if (isValidMove(fromRow, fromCol, jumpRow, jumpCol)) {
            const square = document.querySelector(`[data-row="${jumpRow}"][data-col="${jumpCol}"]`);
            if (square) square.classList.add('valid-move');
        }
    });
};

const isValidMove = (fromRow, fromCol, toRow, toCol) => {
    // Check bounds
    if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;
    
    // Check if destination is empty
    if (gameState.board[toRow][toCol] !== 'H') return false;
    
    // Check if piece belongs to current player
    if (gameState.board[fromRow][fromCol] !== gameState.currentPlayer) return false;
    
    const rowDiff = toRow - fromRow;
    const colDiff = Math.abs(toCol - fromCol);
    
    // Regular move (one diagonal step)
    if (Math.abs(rowDiff) === 1 && colDiff === 1) {
        // Check direction based on player
        if (gameState.currentPlayer === 'X' && rowDiff > 0) return false; // Red moves up
        if (gameState.currentPlayer === 'O' && rowDiff < 0) return false; // Blue moves down
        return true;
    }
    
    // Capture move (two diagonal steps)
    if (Math.abs(rowDiff) === 2 && colDiff === 2) {
        const middleRow = fromRow + rowDiff / 2;
        const middleCol = fromCol + (toCol - fromCol) / 2;
        const middlePiece = gameState.board[middleRow][middleCol];
        
        // Check if there's an opponent piece to capture
        const opponent = gameState.currentPlayer === 'X' ? 'O' : 'X';
        return middlePiece === opponent;
    }
    
    return false;
};

const clearSelection = () => {
    gameState.selectedSquare = null;
    
    // Remove all highlights
    document.querySelectorAll('.game-piece.selected').forEach(piece => {
        piece.classList.remove('selected');
    });
    
    document.querySelectorAll('.board-square.selected').forEach(square => {
        square.classList.remove('selected');
    });
    
    document.querySelectorAll('.board-square.valid-move').forEach(square => {
        square.classList.remove('valid-move');
    });
};

const updateTurnIndicator = (currentPlayer) => {
    elements.redTurn.classList.toggle('active', currentPlayer === 'X');
    elements.blueTurn.classList.toggle('active', currentPlayer === 'O');
    
    const isMyTurn = gameState.playerPiece === currentPlayer;
    elements.statusMessage.textContent = isMyTurn 
        ? "Your turn - Choose your move wisely!" 
        : "Opponent's turn - The temple awaits...";
};

const showGameOverModal = (winner) => {
    elements.winnerText.textContent = `${winner} Wins!`;
    elements.winnerMessage.textContent = winner === gameState.playerColor 
        ? "Victory is yours! The temple acknowledges your wisdom!" 
        : "Defeat teaches wisdom. The temple respects your effort.";
    
    elements.gameOverModal.classList.add('active');
};

const hideGameOverModal = () => {
    elements.gameOverModal.classList.remove('active');
};

// Event listeners
elements.createRoomBtn.addEventListener('click', () => {
    const roomId = generateRoomCode();
    gameState.roomId = roomId;
    elements.roomCode.textContent = `Room: ${roomId}`;
    
    showScreen('loadingScreen');
    socket.emit('joinRoom', roomId);
});

elements.joinRoomBtn.addEventListener('click', () => {
    const roomId = elements.roomInput.value.trim().toUpperCase();
    if (!roomId) {
        showNotification('Please enter a room code', 'error');
        return;
    }
    
    gameState.roomId = roomId;
    elements.roomCode.textContent = `Room: ${roomId}`;
    
    showScreen('loadingScreen');
    socket.emit('joinRoom', roomId);
});

elements.roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.joinRoomBtn.click();
    }
});

elements.playAgainBtn.addEventListener('click', () => {
    socket.emit('playerChoice', {
        roomId: gameState.roomId,
        choice: 'playAgain'
    });
    
    elements.playAgainBtn.disabled = true;
    elements.playAgainBtn.textContent = 'Waiting...';
});

elements.exitGameBtn.addEventListener('click', () => {
    socket.emit('playerChoice', {
        roomId: gameState.roomId,
        choice: 'exit'
    });
});

// Socket event listeners
socket.on('playerAssigned', ({ color, piece }) => {
    gameState.playerColor = color;
    gameState.playerPiece = piece;
    
    showNotification(`You are the ${color} Temple Guardian`, 'info');
});

socket.on('startGame', ({ board, currentPlayer, players }) => {
    gameState.gameStarted = true;
    gameState.currentPlayer = currentPlayer;
    
    showScreen('gameScreen');
    createBoard();
    updateBoard(board);
    updateTurnIndicator(currentPlayer);
    
    showNotification('The sacred battle begins!', 'info');
    
    // Optional: Start background music
    // elements.bgMusic.play().catch(() => {}); // Ignore autoplay restrictions
});

socket.on('updateBoard', ({ board, currentPlayer }) => {
    gameState.currentPlayer = currentPlayer;
    updateBoard(board);
    updateTurnIndicator(currentPlayer);
    clearSelection();
});

socket.on('gameOver', ({ winner, board }) => {
    gameState.gameStarted = false;
    updateBoard(board);
    showGameOverModal(winner);
});

socket.on('restartGame', ({ board, currentPlayer }) => {
    gameState.gameStarted = true;
    gameState.currentPlayer = currentPlayer;
    
    hideGameOverModal();
    updateBoard(board);
    updateTurnIndicator(currentPlayer);
    clearSelection();
    
    // Reset button state
    elements.playAgainBtn.disabled = false;
    elements.playAgainBtn.textContent = '⚔️ Battle Again';
    
    showNotification('A new battle begins!', 'info');
});

socket.on('endSession', () => {
    hideGameOverModal();
    showScreen('mainMenu');
    gameState = {
        roomId: null,
        playerColor: null,
        playerPiece: null,
        currentPlayer: 'X',
        board: [],
        selectedSquare: null,
        gameStarted: false
    };
    
    elements.roomInput.value = '';
    showNotification('Returning to the temple entrance...', 'info');
});

socket.on('roomFull', () => {
    showScreen('mainMenu');
    showNotification('This temple chamber is full. Try another room.', 'error');
});

socket.on('playerDisconnected', () => {
    gameState.gameStarted = false;
    elements.statusMessage.textContent = 'Your opponent has left the temple. Waiting for reconnection...';
    showNotification('Opponent disconnected', 'error');
});

socket.on('connect', () => {
    console.log('Connected to temple server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from temple server');
    showNotification('Connection to temple lost. Attempting to reconnect...', 'error');
});

// Initialize the game
document.addEventListener('DOMContentLoaded', () => {
    showScreen('mainMenu');
    
    // Add some dynamic particles
    const particles = document.querySelector('.particles');
    for (let i = 0; i < 5; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 3px;
            height: 3px;
            background: radial-gradient(circle, #d4af37 0%, transparent 70%);
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: float ${5 + Math.random() * 5}s infinite ease-in-out;
            animation-delay: ${Math.random() * 2}s;
            opacity: ${0.3 + Math.random() * 0.5};
        `;
        particles.appendChild(particle);
    }
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);