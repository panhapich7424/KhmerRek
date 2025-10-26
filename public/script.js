// Socket connection
const socket = io();

// Game state
let gameState = {
    roomId: null,
    playerColor: null,
    playerPiece: null,
    currentPlayer: 'Blue',
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
    copyRoomBtn: document.getElementById('copyRoomBtn'),
    statusMessage: document.getElementById('statusMessage'),
    topPlayerPiece: document.getElementById('topPlayerPiece'),
    topPlayerName: document.getElementById('topPlayerName'),
    topPlayerTurn: document.getElementById('topPlayerTurn'),
    bottomPlayerPiece: document.getElementById('bottomPlayerPiece'),
    bottomPlayerName: document.getElementById('bottomPlayerName'),
    bottomPlayerTurn: document.getElementById('bottomPlayerTurn'),
    gameOverModal: document.getElementById('gameOverModal'),
    winnerText: document.getElementById('winnerText'),
    winnerMessage: document.getElementById('winnerMessage'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    exitGameBtn: document.getElementById('exitGameBtn'),
    bgMusic: document.getElementById('bgMusic'),
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn'),
    gameStartControls: document.getElementById('gameStartControls'),
    startGameBtn: document.getElementById('startGameBtn'),
    gameStartCountdown: document.getElementById('gameStartCountdown'),
    countdownNumber: document.getElementById('countdownNumber'),
    orientationText: document.getElementById('orientationText')
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

// Rotate board based on player perspective
const getRotatedBoard = (board) => {
    if (gameState.playerColor === 'Red') {
        // Rotate 180 degrees for Red player
        const rotated = [];
        for (let row = 7; row >= 0; row--) {
            const newRow = [];
            for (let col = 7; col >= 0; col--) {
                newRow.push(board[row][col]);
            }
            rotated.push(newRow);
        }
        return rotated;
    }
    return board; // Blue player sees normal board
};

// Convert display coordinates to actual board coordinates
const getActualCoordinates = (displayRow, displayCol) => {
    if (gameState.playerColor === 'Red') {
        return [7 - displayRow, 7 - displayCol];
    }
    return [displayRow, displayCol];
};

// Convert actual coordinates to display coordinates
const getDisplayCoordinates = (actualRow, actualCol) => {
    if (gameState.playerColor === 'Red') {
        return [7 - actualRow, 7 - actualCol];
    }
    return [actualRow, actualCol];
};

// Setup player display based on perspective
const setupPlayerDisplay = () => {
    if (gameState.playerColor === 'Blue') {
        // Blue player: Blue at bottom, Red at top
        elements.bottomPlayerPiece.className = 'player-piece blue-piece';
        elements.bottomPlayerName.textContent = 'You (Blue)';
        elements.topPlayerPiece.className = 'player-piece red-piece';
        elements.topPlayerName.textContent = 'Opponent (Red)';
        elements.orientationText.textContent = 'Your Blue pieces are at the bottom';
    } else {
        // Red player: Red at bottom, Blue at top (rotated view)
        elements.bottomPlayerPiece.className = 'player-piece red-piece';
        elements.bottomPlayerName.textContent = 'You (Red)';
        elements.topPlayerPiece.className = 'player-piece blue-piece';
        elements.topPlayerName.textContent = 'Opponent (Blue)';
        elements.orientationText.textContent = 'Your Red pieces are at the bottom (rotated view)';
    }
    
    console.log(`Player perspective: ${gameState.playerColor}, Board will be ${gameState.playerColor === 'Red' ? 'rotated 180°' : 'normal'}`);
};

const updateBoard = (board) => {
    gameState.board = board;
    const displayBoard = getRotatedBoard(board);
    
    // Clear all pieces
    document.querySelectorAll('.game-piece').forEach(piece => piece.remove());
    
    // Add pieces based on rotated board state
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = displayBoard[row][col];
            if (piece !== 'H') {
                const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                const pieceElement = document.createElement('div');
                let pieceClass = '';
                if (piece === 'X') pieceClass = 'red';
                else if (piece === 'O') pieceClass = 'blue';
                else if (piece === 'R') pieceClass = 'red king';
                else if (piece === 'P') pieceClass = 'blue king';
                
                pieceElement.className = `game-piece ${pieceClass}`;
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

const handleSquareClick = (displayRow, displayCol) => {
    if (!gameState.gameStarted || gameState.playerColor !== gameState.currentPlayer) {
        return;
    }
    
    const square = document.querySelector(`[data-row="${displayRow}"][data-col="${displayCol}"]`);
    
    if (gameState.selectedSquare && square.classList.contains('valid-move')) {
        // Convert display coordinates to actual board coordinates
        const actualFrom = getActualCoordinates(gameState.selectedSquare.row, gameState.selectedSquare.col);
        const actualTo = getActualCoordinates(displayRow, displayCol);
        
        socket.emit('makeMove', {
            roomId: gameState.roomId,
            from: actualFrom,
            to: actualTo
        });
        
        clearSelection();
    } else {
        clearSelection();
    }
};

const handlePieceClick = (displayRow, displayCol) => {
    console.log(`Piece clicked: display(${displayRow},${displayCol}), gameStarted: ${gameState.gameStarted}, currentPlayer: ${gameState.currentPlayer}, myColor: ${gameState.playerColor}`);
    
    if (!gameState.gameStarted) {
        showNotification('Game not started yet!', 'error');
        return;
    }
    
    if (gameState.playerColor !== gameState.currentPlayer) {
        showNotification('Not your turn!', 'error');
        return;
    }
    
    // Convert display coordinates to actual board coordinates
    const [actualRow, actualCol] = getActualCoordinates(displayRow, displayCol);
    const piece = gameState.board[actualRow][actualCol];
    
    console.log(`Actual coordinates: (${actualRow},${actualCol}), piece: ${piece}`);
    
    // Check if piece belongs to current player
    const playerPieces = gameState.playerColor === 'Blue' ? ['O', 'P'] : ['X', 'R'];
    console.log(`Player pieces: ${playerPieces}, clicked piece: ${piece}`);
    
    if (playerPieces.includes(piece)) {
        clearSelection();
        selectPiece(displayRow, displayCol);
        showNotification(`Selected ${piece} piece`, 'info');
    } else {
        showNotification('That\'s not your piece!', 'error');
    }
};

const selectPiece = (displayRow, displayCol) => {
    gameState.selectedSquare = { row: displayRow, col: displayCol };
    
    // Highlight selected piece
    const piece = document.querySelector(`[data-row="${displayRow}"][data-col="${displayCol}"] .game-piece`);
    const square = document.querySelector(`[data-row="${displayRow}"][data-col="${displayCol}"]`);
    
    if (piece) piece.classList.add('selected');
    if (square) square.classList.add('selected');
    
    // Show valid moves
    showValidMoves(displayRow, displayCol);
};

const showValidMoves = (displayFromRow, displayFromCol) => {
    // Convert to actual coordinates for validation
    const [actualFromRow, actualFromCol] = getActualCoordinates(displayFromRow, displayFromCol);
    
    const directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1] // Horizontal and vertical directions
    ];
    
    directions.forEach(([dRow, dCol]) => {
        let actualToRow = actualFromRow + dRow;
        let actualToCol = actualFromCol + dCol;
        
        // Check all squares in this direction until we hit a piece or board edge
        while (actualToRow >= 0 && actualToRow < 8 && actualToCol >= 0 && actualToCol < 8) {
            if (gameState.board[actualToRow][actualToCol] !== 'H') {
                // Hit a piece - stop checking this direction
                break;
            }
            
            // This is a valid move - highlight it
            const [displayToRow, displayToCol] = getDisplayCoordinates(actualToRow, actualToCol);
            const square = document.querySelector(`[data-row="${displayToRow}"][data-col="${displayToCol}"]`);
            if (square) square.classList.add('valid-move');
            
            // Continue to next square in this direction
            actualToRow += dRow;
            actualToCol += dCol;
        }
    });
};

const isValidMove = (actualFromRow, actualFromCol, actualToRow, actualToCol) => {
    // Check bounds
    if (actualToRow < 0 || actualToRow >= 8 || actualToCol < 0 || actualToCol >= 8) return false;
    
    // Check if destination is empty
    if (gameState.board[actualToRow][actualToCol] !== 'H') return false;
    
    // Check if piece belongs to current player
    const piece = gameState.board[actualFromRow][actualFromCol];
    const playerPieces = gameState.playerColor === 'Blue' ? ['O', 'P'] : ['X', 'R'];
    if (!playerPieces.includes(piece)) return false;
    
    // Must move horizontally or vertically (like a rook)
    const rowDiff = actualToRow - actualFromRow;
    const colDiff = actualToCol - actualFromCol;
    
    // Must be either horizontal or vertical movement
    if (rowDiff !== 0 && colDiff !== 0) return false;
    
    // Check path is clear (no pieces in between)
    const stepRow = rowDiff === 0 ? 0 : (rowDiff > 0 ? 1 : -1);
    const stepCol = colDiff === 0 ? 0 : (colDiff > 0 ? 1 : -1);
    
    let currentRow = actualFromRow + stepRow;
    let currentCol = actualFromCol + stepCol;
    
    while (currentRow !== actualToRow || currentCol !== actualToCol) {
        if (gameState.board[currentRow][currentCol] !== 'H') {
            return false; // Path blocked
        }
        currentRow += stepRow;
        currentCol += stepCol;
    }
    
    return true;
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
    const isMyTurn = gameState.playerColor === currentPlayer;
    
    // Update turn indicators based on perspective
    elements.bottomPlayerTurn.classList.toggle('active', isMyTurn);
    elements.topPlayerTurn.classList.toggle('active', !isMyTurn);
    
    elements.statusMessage.textContent = isMyTurn 
        ? `Your turn (${gameState.playerColor}) - Choose your move wisely!` 
        : `Opponent's turn (${currentPlayer}) - The temple awaits...`;
    
    console.log(`Turn: ${currentPlayer}, My Color: ${gameState.playerColor}, My Turn: ${isMyTurn}`);
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

elements.copyRoomBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(gameState.roomId).then(() => {
        showNotification('Room code copied to clipboard!', 'info');
        elements.copyRoomBtn.textContent = '✅ Copied';
        setTimeout(() => {
            elements.copyRoomBtn.textContent = '📋 Copy';
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = gameState.roomId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Room code copied!', 'info');
    });
});

elements.sendMessageBtn.addEventListener('click', () => {
    sendMessage();
});

elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

elements.startGameBtn.addEventListener('click', () => {
    socket.emit('playerReady', { roomId: gameState.roomId });
    elements.startGameBtn.disabled = true;
    elements.startGameBtn.textContent = '✅ Ready';
    showNotification('Waiting for opponent to be ready...', 'info');
});

const sendMessage = () => {
    const message = elements.messageInput.value.trim();
    if (message && gameState.roomId) {
        socket.emit('sendMessage', {
            roomId: gameState.roomId,
            message: message
        });
        elements.messageInput.value = '';
    }
};

const addChatMessage = (player, message) => {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${player.toLowerCase()}`;
    messageElement.textContent = `${player}: ${message}`;
    
    elements.chatMessages.appendChild(messageElement);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
};

// Socket event listeners
socket.on('playerAssigned', ({ color, piece }) => {
    gameState.playerColor = color;
    gameState.playerPiece = piece;
    
    showNotification(`You are the ${color} Temple Guardian`, 'info');
    
    // Setup player display based on perspective
    setupPlayerDisplay();
    
    // Show game screen immediately but with waiting message
    showScreen('gameScreen');
    createBoard();
    
    // Show initial board setup for Rek game
    const initialBoard = [
        ['H','X','X','X','X','X','X','X'],  // Row 0: Red pieces at top
        ['R','H','H','H','H','H','H','H'],  // Row 1: Red King
        ['X','X','X','X','X','X','X','X'],  // Row 2: Red pieces
        ['H','H','H','H','H','H','H','H'],  // Row 3: Empty
        ['H','H','H','H','H','H','H','H'],  // Row 4: Empty
        ['O','O','O','O','O','O','O','O'],  // Row 5: Blue pieces
        ['H','H','H','H','H','H','H','P'],  // Row 6: Blue King
        ['O','O','O','O','O','O','O','H']   // Row 7: Blue pieces at bottom
    ];
    updateBoard(initialBoard);
    
    if (color === 'Blue') {
        elements.statusMessage.textContent = `Share room code "${gameState.roomId}" with a friend to start playing!`;
        showNotification(`Room created! Share code: ${gameState.roomId}`, 'info');
        elements.copyRoomBtn.style.display = 'block';
    } else {
        elements.statusMessage.textContent = `Joined room ${gameState.roomId}. Waiting for game to start...`;
    }
});

socket.on('bothPlayersJoined', () => {
    elements.statusMessage.textContent = 'Both players connected! Click "Start Game" when ready.';
    elements.gameStartControls.style.display = 'block';
    elements.copyRoomBtn.style.display = 'none';
    showNotification('Opponent joined! Get ready to play!', 'info');
});

socket.on('gameStartCountdown', ({ count }) => {
    elements.gameStartControls.style.display = 'none';
    elements.gameStartCountdown.style.display = 'block';
    elements.countdownNumber.textContent = count;
    
    if (count === 0) {
        elements.gameStartCountdown.style.display = 'none';
    }
});

socket.on('startGame', ({ board, currentPlayer, players }) => {
    gameState.gameStarted = true;
    gameState.currentPlayer = currentPlayer;
    
    showScreen('gameScreen');
    createBoard();
    updateBoard(board);
    updateTurnIndicator(currentPlayer);
    
    // Hide all start game UI elements
    elements.copyRoomBtn.style.display = 'none';
    elements.gameStartControls.style.display = 'none';
    elements.gameStartCountdown.style.display = 'none';
    
    showNotification(`The sacred battle begins! ${currentPlayer} moves first.`, 'info');
    
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

socket.on('newMessage', ({ player, message }) => {
    addChatMessage(player, message);
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