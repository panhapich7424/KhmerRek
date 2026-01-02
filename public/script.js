// Socket connection
const socket = io();

// Debug socket connection
socket.on('connect', () => {
    console.log('✅ Connected to server:', socket.id);
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
});

socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
});

// Game state
let gameState = {
    roomId: null,
    playerColor: null,
    playerPiece: null,
    currentPlayer: 'Blue',
    board: [],
    selectedSquare: null,
    gameStarted: false,
    lastMove: null, // Track last move for highlighting
    isBot: false, // Track if playing against bot
    isLocal2P: false, // Track if playing local 2-player mode
    turnTimeLeft: 60, // Time left in seconds
    timerInterval: null, // Timer interval reference
    timeControl: 'unlimited', // Time control mode: unlimited, blitz, rapid, classical
    blueTimeLeft: 0, // Blue player's remaining time in seconds
    redTimeLeft: 0, // Red player's remaining time in seconds
    timerRunning: false // Whether timer is currently running
};

// Sound System (disabled - no sound effects)
const SoundManager = {
    sounds: {},
    enabled: false, // Disabled by default - no sound effects
    volume: 0,      // Volume set to 0
    audioContext: null,

    init() {
        // Sound system disabled - no initialization
        console.log('🔇 Sound system disabled');
    },

    play(soundName) {
        // No sound effects - function exists but does nothing
        return;
    },

    toggle() {
        // Toggle function exists but sounds remain disabled
        this.enabled = !this.enabled;
        console.log(`🔇 Sound toggle: ${this.enabled ? 'enabled' : 'disabled'} (but no effects)`);
    },

    loadPreferences() {
        // No preferences to load
    }
};

// DOM elements
const screens = {
    mainMenu: document.getElementById('mainMenu'),
    gameScreen: document.getElementById('gameScreen'),
    loadingScreen: document.getElementById('loadingScreen')
};

const elements = {
    // Main menu elements
    roomInput: document.getElementById('roomInput'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    publicRoomsBtn: document.getElementById('publicRoomsBtn'),
    playWithBotBtn: document.getElementById('playWithBotBtn'),

    // Modal elements
    roomSettingsModal: document.getElementById('roomSettingsModal'),
    confirmCreateBtn: document.getElementById('confirmCreateBtn'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    joinRoomModal: document.getElementById('joinRoomModal'),
    closeJoinModal: document.getElementById('closeJoinModal'),
    confirmJoinBtn: document.getElementById('confirmJoinBtn'),
    publicRoomsModal: document.getElementById('publicRoomsModal'),
    closePublicModal: document.getElementById('closePublicModal'),
    standaloneModal: document.getElementById('standaloneModal'),
    closeStandaloneModal: document.getElementById('closeStandaloneModal'),
    playVsAIBtn: document.getElementById('playVsAIBtn'),
    play2PlayersBtn: document.getElementById('play2PlayersBtn'),

    // Game elements
    gameBoard: document.getElementById('gameBoard'),
    roomCode: document.getElementById('roomCode'),
    copyRoomBtn: document.getElementById('copyRoomBtn'),
    statusMessage: document.getElementById('statusMessage'),

    // Player info elements
    topPlayerPiece: document.getElementById('topPlayerPiece'),
    topPlayerName: document.getElementById('topPlayerName'),
    topPlayerTurn: document.getElementById('topPlayerTurn'),
    topPlayerTimer: document.getElementById('topPlayerTimer'),
    topTimerMinutes: document.getElementById('topTimerMinutes'),
    topTimerSeconds: document.getElementById('topTimerSeconds'),
    bottomPlayerPiece: document.getElementById('bottomPlayerPiece'),
    bottomPlayerName: document.getElementById('bottomPlayerName'),
    bottomPlayerTurn: document.getElementById('bottomPlayerTurn'),
    bottomPlayerTimer: document.getElementById('bottomPlayerTimer'),
    bottomTimerMinutes: document.getElementById('bottomTimerMinutes'),
    bottomTimerSeconds: document.getElementById('bottomTimerSeconds'),

    // Game controls
    waitingControls: document.getElementById('waitingControls'),
    exitRoomBtn: document.getElementById('exitRoomBtn'),
    gameStartControls: document.getElementById('gameStartControls'),
    startGameBtn: document.getElementById('startGameBtn'),
    exitLobbyBtn: document.getElementById('exitLobbyBtn'),
    gameStartCountdown: document.getElementById('gameStartCountdown'),
    countdownNumber: document.getElementById('countdownNumber'),
    orientationText: document.getElementById('orientationText'),
    gameplayControls: document.getElementById('gameplayControls'),
    requestRestartBtn: document.getElementById('requestRestartBtn'),
    exitBotGameBtn: document.getElementById('exitBotGameBtn'),

    // Modals
    gameOverModal: document.getElementById('gameOverModal'),
    winnerText: document.getElementById('winnerText'),
    winnerMessage: document.getElementById('winnerMessage'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    exitGameBtn: document.getElementById('exitGameBtn'),

    // Missing elements that need to be handled
    acceptRestartBtn: document.getElementById('acceptRestartBtn'),
    declineRestartBtn: document.getElementById('declineRestartBtn'),

    // Room list
    refreshRoomsBtn: document.getElementById('refreshRoomsBtn'),
    roomList: document.getElementById('roomList'),

    // Quick chat system
    quickChatBtn: document.getElementById('quickChatBtn'),
    quickChatMenu: document.getElementById('quickChatMenu')
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
    // Play appropriate sound
    if (type === 'error') {
        SoundManager.play('error');
    } else {
        SoundManager.play('notification');
    }

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
    console.log('🏗️ Creating game board...');
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

// Setup display for local 2-player mode
const setupLocal2PDisplay = () => {
    // In local 2-player mode, always show Blue at bottom, Red at top
    elements.bottomPlayerPiece.className = 'player-piece blue-piece';
    elements.bottomPlayerName.textContent = 'Player 2 (Blue)';
    elements.topPlayerPiece.className = 'player-piece red-piece';
    elements.topPlayerName.textContent = 'Player 1 (Red)';
    elements.orientationText.textContent = 'Local 2-Player Mode - Pass device between turns';
    
    console.log('Local 2-player mode: Blue at bottom, Red at top');
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
    console.log(`🎯 Square clicked: (${displayRow}, ${displayCol}), gameStarted: ${gameState.gameStarted}, currentPlayer: ${gameState.currentPlayer}, playerColor: ${gameState.playerColor}`);

    if (!gameState.gameStarted) {
        console.log('❌ Game not started yet');
        return;
    }

    // Allow moves in local 2-player mode or bot mode, otherwise check turn
    if (!gameState.isLocal2P && gameState.playerColor !== gameState.currentPlayer && !gameState.isBot) {
        console.log('❌ Not your turn');
        return;
    }

    const square = document.querySelector(`[data-row="${displayRow}"][data-col="${displayCol}"]`);

    if (gameState.selectedSquare && square.classList.contains('valid-move')) {
        // Convert display coordinates to actual board coordinates
        const actualFrom = getActualCoordinates(gameState.selectedSquare.row, gameState.selectedSquare.col);
        const actualTo = getActualCoordinates(displayRow, displayCol);

        // Store the move for highlighting
        gameState.lastMove = { from: actualFrom, to: actualTo };

        // Play move sound (no effect)
        SoundManager.play('move');

        if (gameState.isBot) {
            // Handle bot game locally
            executeBotGameMove(actualFrom, actualTo);
        } else if (gameState.isLocal2P) {
            // Handle local 2-player game
            executeLocal2PMove(actualFrom, actualTo);
        } else {
            // Handle multiplayer game via socket
            // Server will broadcast updateBoard to ALL players (including this one)
            socket.emit('makeMove', {
                roomId: gameState.roomId,
                from: actualFrom,
                to: actualTo
            });
        }

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

    // In local 2-player mode, allow both players to move
    if (!gameState.isLocal2P && gameState.playerColor !== gameState.currentPlayer) {
        showNotification('Not your turn!', 'error');
        return;
    }

    // Convert display coordinates to actual board coordinates
    const [actualRow, actualCol] = getActualCoordinates(displayRow, displayCol);
    const piece = gameState.board[actualRow][actualCol];

    console.log(`Actual coordinates: (${actualRow},${actualCol}), piece: ${piece}`);

    // Check if piece belongs to current player
    const currentPlayerPieces = gameState.currentPlayer === 'Blue' ? ['O', 'P'] : ['X', 'R'];
    console.log(`Current player pieces: ${currentPlayerPieces}, clicked piece: ${piece}`);

    if (currentPlayerPieces.includes(piece)) {
        SoundManager.play('click'); // No sound effect
        clearSelection();
        selectPiece(displayRow, displayCol);
        showNotification(`Selected ${piece} piece`, 'info');
    } else {
        SoundManager.play('error'); // No sound effect
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
    
    // NOTE: Do NOT clear last-move highlights here - they should persist
};

const clearMoveHighlights = () => {
    // Remove previous last move highlights
    document.querySelectorAll('.board-square.last-move-from').forEach(square => {
        square.classList.remove('last-move-from');
        // Clear inline styles
        square.style.background = '';
        square.style.boxShadow = '';
        square.style.border = '';
    });

    document.querySelectorAll('.board-square.last-move-to').forEach(square => {
        square.classList.remove('last-move-to');
        // Clear inline styles
        square.style.background = '';
        square.style.boxShadow = '';
        square.style.border = '';
    });
};

const highlightLastMove = (from, to) => {
    console.log(`🎨 Highlighting last move: from [${from}] to [${to}]`);
    
    // Clear previous last move highlights
    clearMoveHighlights();

    if (from && to) {
        // Convert actual coordinates to display coordinates for highlighting
        const [displayFromRow, displayFromCol] = getDisplayCoordinates(from[0], from[1]);
        const [displayToRow, displayToCol] = getDisplayCoordinates(to[0], to[1]);

        console.log(`🎨 Display coordinates: from [${displayFromRow},${displayFromCol}] to [${displayToRow},${displayToCol}]`);

        // Highlight the "from" square (where piece moved from)
        const fromSquare = document.querySelector(`[data-row="${displayFromRow}"][data-col="${displayFromCol}"]`);
        if (fromSquare) {
            fromSquare.classList.add('last-move-from');
            // Add inline styles as backup (Khmer style)
            fromSquare.style.background = 'radial-gradient(circle at center, rgba(255, 107, 107, 0.4) 0%, transparent 70%), linear-gradient(135deg, rgba(255, 107, 107, 0.3), rgba(204, 0, 0, 0.2))';
            fromSquare.style.boxShadow = 'inset 0 0 35px rgba(255, 107, 107, 0.8), 0 0 25px rgba(255, 107, 107, 0.6), inset 0 0 0 2px rgba(255, 107, 107, 0.7)';
            console.log(`✅ Added 'last-move-from' class and inline styles to square [${displayFromRow},${displayFromCol}]`);
        } else {
            console.warn(`⚠️ Could not find 'from' square at [${displayFromRow},${displayFromCol}]`);
        }

        // Highlight the "to" square (where piece moved to)
        const toSquare = document.querySelector(`[data-row="${displayToRow}"][data-col="${displayToCol}"]`);
        if (toSquare) {
            toSquare.classList.add('last-move-to');
            // Add inline styles as backup (Khmer style)
            toSquare.style.background = 'radial-gradient(circle at center, rgba(78, 205, 196, 0.4) 0%, transparent 70%), linear-gradient(135deg, rgba(78, 205, 196, 0.3), rgba(0, 102, 204, 0.2))';
            toSquare.style.boxShadow = 'inset 0 0 35px rgba(78, 205, 196, 0.8), 0 0 25px rgba(78, 205, 196, 0.6), inset 0 0 0 2px rgba(78, 205, 196, 0.7)';
            console.log(`✅ Added 'last-move-to' class and inline styles to square [${displayToRow},${displayToCol}]`);
        } else {
            console.warn(`⚠️ Could not find 'to' square at [${displayToRow},${displayToCol}]`);
        }
    } else {
        console.log(`⚠️ No move to highlight (from or to is null)`);
    }
};



const showGameOverModal = (winner) => {
    // Play win/lose sound (no effect)
    if (winner === gameState.playerColor) {
        SoundManager.play('win');
    } else {
        SoundManager.play('lose');
    }

    elements.winnerText.textContent = `${winner} Wins!`;
    elements.winnerMessage.textContent = winner === gameState.playerColor
        ? "Victory is yours! Well played!"
        : "Good game! Better luck next time.";

    // Reset buttons for normal game over (show both buttons)
    elements.playAgainBtn.style.display = 'block';
    elements.exitGameBtn.style.display = 'block';
    elements.playAgainBtn.disabled = false;
    elements.playAgainBtn.innerHTML = '⚔️ Battle Again';
    elements.playAgainBtn.style.opacity = '1';
    elements.playAgainBtn.style.background = '';
    elements.playAgainBtn.style.animation = '';
    elements.exitGameBtn.style.width = '';

    elements.gameOverModal.classList.add('active');
};

const hideGameOverModal = () => {
    elements.gameOverModal.classList.remove('active');
};

const showDisconnectionWinModal = () => {
    // Play win sound (no effect)
    SoundManager.play('win');

    elements.winnerText.textContent = 'You Win!';
    elements.winnerMessage.textContent = 'Victory by disconnection! Your opponent left the game.';

    // Hide play again button and only show exit
    elements.playAgainBtn.style.display = 'none';
    elements.exitGameBtn.style.display = 'block';
    elements.exitGameBtn.innerHTML = '🚪 Return to Menu';
    elements.exitGameBtn.style.width = '100%';

    elements.gameOverModal.classList.add('active');

    showNotification('You win! Opponent disconnected.', 'info');
};

const showRestartRequestModal = (requesterName) => {
    // For now, just show a notification since the modal doesn't exist in HTML
    showNotification(`${requesterName} wants to restart the game`, 'info');
};

const hideRestartRequestModal = () => {
    // Function exists for compatibility but modal doesn't exist in HTML
    console.log('Restart request modal hidden');
};

const updateTurnIndicator = (currentPlayer) => {
    const isMyTurn = gameState.playerColor === currentPlayer;

    // Update turn indicators based on perspective
    elements.bottomPlayerTurn.classList.toggle('active', isMyTurn);
    elements.topPlayerTurn.classList.toggle('active', !isMyTurn);

    elements.statusMessage.textContent = isMyTurn
        ? `Your turn (${gameState.playerColor}) - Choose your move wisely!`
        : `Opponent's turn (${currentPlayer}) - Waiting for opponent...`;

    // Start timer for online multiplayer games with time control
    if (gameState.gameStarted && !gameState.isBot && !gameState.isLocal2P && gameState.timeControl !== 'unlimited') {
        startGameTimer();
    }

    console.log(`Turn: ${currentPlayer}, My Color: ${gameState.playerColor}, My Turn: ${isMyTurn}`);
};

// Initialize game timers based on time control
const initializeGameTimers = (timeControl) => {
    console.log('⏰ Initializing game timers with control:', timeControl);
    
    const timeInSeconds = {
        'blitz': 180,      // 3 minutes
        'rapid': 600,      // 10 minutes
        'classical': 1800  // 30 minutes
    };

    gameState.blueTimeLeft = timeInSeconds[timeControl] || 0;
    gameState.redTimeLeft = timeInSeconds[timeControl] || 0;
    gameState.timeControl = timeControl;
    
    console.log(`⏰ Timer initialized - Blue: ${gameState.blueTimeLeft}s, Red: ${gameState.redTimeLeft}s`);

    if (timeControl !== 'unlimited' && timeControl) {
        // Show timer displays
        if (elements.topPlayerTimer) {
            elements.topPlayerTimer.style.display = 'flex';
            console.log('⏰ Top timer display shown');
        }
        if (elements.bottomPlayerTimer) {
            elements.bottomPlayerTimer.style.display = 'flex';
            console.log('⏰ Bottom timer display shown');
        }
        
        // Update initial display
        updateTimerDisplay('Blue', gameState.blueTimeLeft);
        updateTimerDisplay('Red', gameState.redTimeLeft);
        
        console.log('⏰ Timer displays updated with initial values');
    } else {
        // Hide timer displays
        if (elements.topPlayerTimer) elements.topPlayerTimer.style.display = 'none';
        if (elements.bottomPlayerTimer) elements.bottomPlayerTimer.style.display = 'none';
        console.log('⏰ Timers hidden (unlimited mode)');
    }
};

// Update timer display for a player
const updateTimerDisplay = (player, timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    
    console.log(`⏰ Updating ${player} timer: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    // Determine which timer to update based on player and perspective
    let timerElement, minutesElement, secondsElement;
    
    if (gameState.playerColor === 'Blue') {
        if (player === 'Blue') {
            timerElement = elements.bottomPlayerTimer;
            minutesElement = elements.bottomTimerMinutes;
            secondsElement = elements.bottomTimerSeconds;
        } else {
            timerElement = elements.topPlayerTimer;
            minutesElement = elements.topTimerMinutes;
            secondsElement = elements.topTimerSeconds;
        }
    } else {
        if (player === 'Red') {
            timerElement = elements.bottomPlayerTimer;
            minutesElement = elements.bottomTimerMinutes;
            secondsElement = elements.bottomTimerSeconds;
        } else {
            timerElement = elements.topPlayerTimer;
            minutesElement = elements.topTimerMinutes;
            secondsElement = elements.topTimerSeconds;
        }
    }
    
    if (!minutesElement || !secondsElement) {
        console.warn(`⚠️ Timer elements not found for ${player}`);
        return;
    }
    
    minutesElement.textContent = minutes;
    secondsElement.textContent = seconds.toString().padStart(2, '0');
    
    // Update timer styling based on time left
    if (timerElement) {
        timerElement.classList.remove('time-warning', 'time-critical');
        if (timeInSeconds <= 10) {
            timerElement.classList.add('time-critical');
        } else if (timeInSeconds <= 30) {
            timerElement.classList.add('time-warning');
        }
    }
};

// Start game timer
const startGameTimer = () => {
    // Don't start timer if unlimited or if times are not set
    if (gameState.timeControl === 'unlimited' || gameState.blueTimeLeft === 0 || gameState.redTimeLeft === 0) {
        console.log('⏰ Timer not started - unlimited mode or times not initialized');
        return;
    }
    
    // Stop any existing timer
    stopGameTimer();
    
    gameState.timerRunning = true;
    
    console.log(`⏰ Starting timer - Blue: ${gameState.blueTimeLeft}s, Red: ${gameState.redTimeLeft}s`);
    
    gameState.timerInterval = setInterval(() => {
        // Decrease time for current player
        if (gameState.currentPlayer === 'Blue') {
            gameState.blueTimeLeft--;
            updateTimerDisplay('Blue', gameState.blueTimeLeft);
            
            // Check if time ran out
            if (gameState.blueTimeLeft <= 0) {
                stopGameTimer();
                handleTimeOut('Blue');
            }
        } else {
            gameState.redTimeLeft--;
            updateTimerDisplay('Red', gameState.redTimeLeft);
            
            // Check if time ran out
            if (gameState.redTimeLeft <= 0) {
                stopGameTimer();
                handleTimeOut('Red');
            }
        }
    }, 1000);
};

// Stop game timer
const stopGameTimer = () => {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    gameState.timerRunning = false;
};

// Handle time out
const handleTimeOut = (player) => {
    console.log(`⏰ ${player} ran out of time!`);
    
    // Determine winner (opponent of player who ran out of time)
    const winner = player === 'Blue' ? 'Red' : 'Blue';
    
    gameState.gameStarted = false;
    showNotification(`${player} ran out of time! ${winner} wins!`, 'info');
    
    // Show game over modal
    elements.gameplayControls.style.display = 'none';
    showGameOverModal(winner);
    
    // Notify server
    socket.emit('timeOut', { roomId: gameState.roomId, player });
};

// Room management functions
const refreshRoomList = () => {
    socket.emit('getRoomList');
    elements.roomList.innerHTML = '<div class="loading-rooms">Loading rooms...</div>';
};

const displayRoomList = (rooms) => {
    if (rooms.length === 0) {
        elements.roomList.innerHTML = '<div class="no-rooms">No public rooms available</div>';
        return;
    }

    elements.roomList.innerHTML = '';

    rooms.forEach(room => {
        const roomItem = document.createElement('div');
        roomItem.className = 'room-item';

        const isAvailable = room.playerCount < 2;
        const statusClass = isAvailable ? 'status-available' : 'status-full';
        const statusText = isAvailable ? 'Available' : 'Full';

        roomItem.innerHTML = `
            <div class="room-info">
                <div class="room-code">${room.id}</div>
                <div class="room-status">
                    <span class="status-indicator ${statusClass}"></span>
                    ${statusText} (${room.playerCount}/2)
                </div>
            </div>
            <button class="join-room-btn" ${!isAvailable ? 'disabled' : ''} 
                    onclick="joinRoomFromList('${room.id}')">
                ${isAvailable ? 'Join' : 'Full'}
            </button>
        `;

        elements.roomList.appendChild(roomItem);
    });
};

// Make this function globally accessible
window.joinRoomFromList = (roomId) => {
    gameState.roomId = roomId;
    elements.roomCode.textContent = `Room: ${roomId}`;

    showScreen('loadingScreen');
    socket.emit('joinRoom', roomId);
};

// Create Room Modal
elements.createRoomBtn.addEventListener('click', () => {
    console.log('🏠 Create room button clicked!');
    SoundManager.play('click');
    elements.roomSettingsModal.style.display = 'flex';
});

elements.confirmCreateBtn.addEventListener('click', () => {
    SoundManager.play('click');
    const roomType = document.querySelector('input[name="roomType"]:checked').value;
    const timeControl = document.querySelector('input[name="timeControl"]:checked').value;
    const roomId = generateRoomCode();
    gameState.roomId = roomId;
    gameState.timeControl = timeControl;
    elements.roomCode.textContent = `Room: ${roomId}`;

    console.log('🏠 Creating room:', roomId, 'Type:', roomType, 'Time Control:', timeControl, 'Socket connected:', socket.connected);

    elements.roomSettingsModal.style.display = 'none';
    showScreen('loadingScreen');
    socket.emit('createRoom', { roomId, isPublic: roomType === 'public', timeControl });
});

elements.closeSettingsModal.addEventListener('click', () => {
    elements.roomSettingsModal.style.display = 'none';
});

// Join Room Modal
elements.joinRoomBtn.addEventListener('click', () => {
    console.log('🚪 Join room button clicked!');
    SoundManager.play('click');
    elements.joinRoomModal.style.display = 'flex';
    elements.roomInput.focus();
});

elements.confirmJoinBtn.addEventListener('click', () => {
    const roomId = elements.roomInput.value.trim().toUpperCase();
    if (!roomId) {
        showNotification('Please enter a room code', 'error');
        return;
    }

    gameState.roomId = roomId;
    elements.roomCode.textContent = `Room: ${roomId}`;

    elements.joinRoomModal.style.display = 'none';
    showScreen('loadingScreen');
    socket.emit('joinRoom', roomId);
});

elements.closeJoinModal.addEventListener('click', () => {
    elements.joinRoomModal.style.display = 'none';
    elements.roomInput.value = '';
});

// Public Rooms Modal
elements.publicRoomsBtn.addEventListener('click', () => {
    console.log('🌍 Public rooms button clicked!');
    SoundManager.play('click');
    elements.publicRoomsModal.style.display = 'flex';
    refreshRoomList();
});

elements.closePublicModal.addEventListener('click', () => {
    elements.publicRoomsModal.style.display = 'none';
});

// Close modals when clicking backdrop
[elements.roomSettingsModal, elements.joinRoomModal, elements.publicRoomsModal, elements.standaloneModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
            modal.style.display = 'none';
            if (modal === elements.joinRoomModal) {
                elements.roomInput.value = '';
            }
        }
    });
});

// Enter key support for join room
elements.roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.confirmJoinBtn.click();
    }
});

elements.playWithBotBtn.addEventListener('click', () => {
    console.log('🎮 Standalone button clicked!');
    SoundManager.play('click');
    elements.standaloneModal.style.display = 'flex';
});

// Close standalone modal
elements.closeStandaloneModal.addEventListener('click', () => {
    elements.standaloneModal.style.display = 'none';
});

// Play vs AI button
elements.playVsAIBtn.addEventListener('click', () => {
    console.log('🤖 Play vs AI selected!');
    SoundManager.play('click');
    elements.standaloneModal.style.display = 'none';
    
    gameState.roomId = 'BOT_GAME';
    gameState.isBot = true;
    gameState.playerColor = 'Blue';
    gameState.playerPiece = 'O';

    console.log('🎮 Switching to game screen...');
    showScreen('gameScreen');
    setupPlayerDisplay();
    createBoard();

    // Initialize bot game
    const initialBoard = [
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'H'],  // Row 0: Red pieces at top
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'R'],  // Row 1: Red King
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'],  // Row 2: Red pieces
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 3: Empty
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 4: Empty
        ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],  // Row 5: Blue pieces
        ['P', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 6: Blue King
        ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O']   // Row 7: Blue pieces at bottom
    ];

    gameState.gameStarted = true;
    gameState.currentPlayer = 'Blue';
    updateBoard(initialBoard);
    updateTurnIndicator('Blue');

    elements.roomCode.textContent = 'Room: Bot Game';
    elements.copyRoomBtn.style.display = 'none';
    elements.waitingControls.style.display = 'none';
    elements.gameStartControls.style.display = 'none';
    elements.gameStartCountdown.style.display = 'none';
    elements.gameplayControls.style.display = 'flex';
    elements.exitBotGameBtn.style.display = 'block';

    console.log('✅ Bot game initialized!');
});

// Play 2 Players (Local) button
elements.play2PlayersBtn.addEventListener('click', () => {
    console.log('👥 2 Players Local selected!');
    SoundManager.play('click');
    elements.standaloneModal.style.display = 'none';
    
    gameState.roomId = 'LOCAL_2P';
    gameState.isBot = false;
    gameState.isLocal2P = true; // New flag for local 2-player mode
    gameState.playerColor = 'Blue'; // Start with Blue
    gameState.playerPiece = 'O';

    console.log('🎮 Switching to 2-player local game...');
    showScreen('gameScreen');
    setupLocal2PDisplay();
    createBoard();

    // Initialize 2-player local game
    const initialBoard = [
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'H'],  // Row 0: Red pieces at top
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'R'],  // Row 1: Red King
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'],  // Row 2: Red pieces
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 3: Empty
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 4: Empty
        ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],  // Row 5: Blue pieces
        ['P', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 6: Blue King
        ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O']   // Row 7: Blue pieces at bottom
    ];

    gameState.gameStarted = true;
    gameState.currentPlayer = 'Blue';
    updateBoard(initialBoard);
    updateTurnIndicator('Blue');

    elements.roomCode.textContent = 'Room: Local 2 Players';
    elements.copyRoomBtn.style.display = 'none';
    elements.waitingControls.style.display = 'none';
    elements.gameStartControls.style.display = 'none';
    elements.gameStartCountdown.style.display = 'none';
    elements.gameplayControls.style.display = 'flex';
    elements.exitBotGameBtn.style.display = 'block';

    console.log('✅ Local 2-player game initialized!');
});

elements.refreshRoomsBtn.addEventListener('click', () => {
    refreshRoomList();
});

elements.startGameBtn.addEventListener('click', () => {
    socket.emit('playerReady', { roomId: gameState.roomId });
    elements.startGameBtn.disabled = true;
    elements.startGameBtn.textContent = '✅ Ready';
    showNotification('Waiting for opponent to be ready...', 'info');
});

elements.exitRoomBtn.addEventListener('click', () => {
    socket.emit('exitLobby', { roomId: gameState.roomId });
});

elements.exitLobbyBtn.addEventListener('click', () => {
    socket.emit('exitLobby', { roomId: gameState.roomId });
});

elements.requestRestartBtn.addEventListener('click', () => {
    if (gameState.isBot) {
        // Restart bot game immediately
        restartBotGame();
    } else if (gameState.isLocal2P) {
        // Restart local 2-player game immediately
        restartLocal2PGame();
    } else {
        // Request restart from opponent
        socket.emit('requestRestart', { roomId: gameState.roomId });
        elements.requestRestartBtn.disabled = true;
        elements.requestRestartBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Requesting...</span>';
        showNotification('Restart request sent to opponent', 'info');
    }
});

elements.exitBotGameBtn.addEventListener('click', () => {
    // Exit bot game or local 2-player game and return to main menu
    showScreen('mainMenu');

    // Hide quick chat
    if (elements.quickChatBtn) {
        elements.quickChatBtn.style.display = 'none';
    }

    gameState = {
        roomId: null,
        playerColor: null,
        playerPiece: null,
        currentPlayer: 'Blue',
        board: [],
        selectedSquare: null,
        gameStarted: false,
        lastMove: null,
        isBot: false,
        isLocal2P: false
    };
    showNotification('Returned to main menu', 'info');
});

elements.playAgainBtn.addEventListener('click', () => {
    if (gameState.isBot) {
        // Restart bot game immediately
        restartBotGame();
        hideGameOverModal();
    } else if (gameState.isLocal2P) {
        // Restart local 2-player game immediately
        restartLocal2PGame();
        hideGameOverModal();
        showNotification('New game started!', 'info');
    } else {
        // Request play again from opponent
        socket.emit('playerChoice', {
            roomId: gameState.roomId,
            choice: 'playAgain'
        });

        elements.playAgainBtn.disabled = true;
        elements.playAgainBtn.innerHTML = '⏳ Waiting for opponent...';
        elements.playAgainBtn.style.opacity = '0.6';

        showNotification('Waiting for opponent to click Play Again...', 'info');
    }
});

elements.exitGameBtn.addEventListener('click', () => {
    console.log('🚪 Exit game button clicked');
    
    // Stop any running timers
    stopGameTimer();
    
    if (gameState.isBot || gameState.isLocal2P) {
        // Exit bot game or local 2-player game directly
        hideGameOverModal();
        showScreen('mainMenu');

        // Hide quick chat
        if (elements.quickChatBtn) {
            elements.quickChatBtn.style.display = 'none';
        }

        // Reset game state completely
        gameState = {
            roomId: null,
            playerColor: null,
            playerPiece: null,
            currentPlayer: 'Blue',
            board: [],
            selectedSquare: null,
            gameStarted: false,
            lastMove: null,
            isBot: false,
            isLocal2P: false,
            turnTimeLeft: 60,
            timerInterval: null,
            timeControl: 'unlimited',
            blueTimeLeft: 0,
            redTimeLeft: 0,
            timerRunning: false
        };
        
        // Hide timers
        if (elements.topPlayerTimer) elements.topPlayerTimer.style.display = 'none';
        if (elements.bottomPlayerTimer) elements.bottomPlayerTimer.style.display = 'none';
        
        showNotification('Returning to main menu...', 'info');
    } else {
        // Exit multiplayer game
        hideGameOverModal();
        
        socket.emit('playerChoice', {
            roomId: gameState.roomId,
            choice: 'exit'
        });
        
        showScreen('mainMenu');
        
        // Hide quick chat
        if (elements.quickChatBtn) {
            elements.quickChatBtn.style.display = 'none';
        }
        
        // Reset game state
        gameState = {
            roomId: null,
            playerColor: null,
            playerPiece: null,
            currentPlayer: 'Blue',
            board: [],
            selectedSquare: null,
            gameStarted: false,
            lastMove: null,
            isBot: false,
            isLocal2P: false,
            turnTimeLeft: 60,
            timerInterval: null,
            timeControl: 'unlimited',
            blueTimeLeft: 0,
            redTimeLeft: 0,
            timerRunning: false
        };
        
        // Hide timers
        if (elements.topPlayerTimer) elements.topPlayerTimer.style.display = 'none';
        if (elements.bottomPlayerTimer) elements.bottomPlayerTimer.style.display = 'none';
        
        showNotification('Left the game', 'info');
    }
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

// Quick chat initialization is handled in QuickChat.init()

// Handle restart request modal buttons (if they exist)
if (elements.acceptRestartBtn) {
    elements.acceptRestartBtn.addEventListener('click', () => {
        socket.emit('restartResponse', { roomId: gameState.roomId, accepted: true });
        hideRestartRequestModal();
    });
}

if (elements.declineRestartBtn) {
    elements.declineRestartBtn.addEventListener('click', () => {
        socket.emit('restartResponse', { roomId: gameState.roomId, accepted: false });
        hideRestartRequestModal();
    });
}

// Duplicate QuickChat code removed - using the complete version below

// Bot AI Logic
const botAI = {
    // Evaluate board position for the bot (Red player)
    evaluateBoard: (board) => {
        let score = 0;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece === 'X') {
                    score += 10; // Red piece
                    score += (7 - row) * 2; // Bonus for advancing
                } else if (piece === 'R') {
                    score += 50; // Red king
                } else if (piece === 'O') {
                    score -= 10; // Blue piece
                    score -= row * 2; // Penalty for opponent advancing
                } else if (piece === 'P') {
                    score -= 50; // Blue king
                }
            }
        }

        return score;
    },

    // Get all possible moves for a color
    getPossibleMoves: (board, color) => {
        const moves = [];
        const pieces = color === 'Red' ? ['X', 'R'] : ['O', 'P'];

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (pieces.includes(board[row][col])) {
                    const pieceMoves = botAI.getPieceValidMoves(board, row, col);
                    pieceMoves.forEach(move => {
                        moves.push({
                            from: [row, col],
                            to: move,
                            piece: board[row][col]
                        });
                    });
                }
            }
        }

        return moves;
    },

    // Get valid moves for a specific piece
    getPieceValidMoves: (board, fromRow, fromCol) => {
        const moves = [];
        const directions = [
            [-1, 0], [1, 0], [0, -1], [0, 1] // Horizontal and vertical directions
        ];

        directions.forEach(([dRow, dCol]) => {
            let toRow = fromRow + dRow;
            let toCol = fromCol + dCol;

            // Check all squares in this direction until we hit a piece or board edge
            while (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
                if (board[toRow][toCol] !== 'H') {
                    // Hit a piece - stop checking this direction
                    break;
                }

                moves.push([toRow, toCol]);

                // Continue to next square in this direction
                toRow += dRow;
                toCol += dCol;
            }
        });

        return moves;
    },

    // Simulate a move and return the resulting board
    simulateMove: (board, from, to) => {
        const newBoard = board.map(row => [...row]);
        const piece = newBoard[from[0]][from[1]];
        const currentPlayer = ['X', 'R'].includes(piece) ? 'Red' : 'Blue';

        // Move the piece
        newBoard[from[0]][from[1]] = 'H';
        newBoard[to[0]][to[1]] = piece;

        // Apply capture rules using the same logic as server
        botAI.checkRekCaptures(newBoard, to[0], to[1], currentPlayer);
        botAI.checkTrappingCaptures(newBoard, currentPlayer);

        return newBoard;
    },

    // Check for Rek captures (sandwich capture) - same as server
    checkRekCaptures: (board, toRow, toCol, currentPlayer) => {
        const playerPieces = currentPlayer === 'Blue' ? ['O', 'P'] : ['X', 'R'];
        const opponentPieces = currentPlayer === 'Blue' ? ['X', 'R'] : ['O', 'P'];
        let capturesMade = false;

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
                    capturesMade = true;
                }
            }
        });

        // Play capture sound if any captures were made (no effect)
        if (capturesMade) {
            SoundManager.play('capture');
        }
    },

    // Check for group trapping captures - same as server
    checkTrappingCaptures: (board, currentPlayer) => {
        const opponentPlayer = currentPlayer === 'Blue' ? 'Red' : 'Blue';
        const opponentPieces = currentPlayer === 'Blue' ? ['X', 'R'] : ['O', 'P'];
        const visited = Array(8).fill().map(() => Array(8).fill(false));

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (opponentPieces.includes(board[row][col]) && !visited[row][col]) {
                    const group = [];
                    botAI.findConnectedGroup(board, row, col, opponentPieces, visited, group);

                    // Check if any piece in the group has legal moves
                    let hasLegalMove = false;
                    for (const [pieceRow, pieceCol] of group) {
                        if (botAI.pieceHasLegalMoves(board, pieceRow, pieceCol, opponentPlayer)) {
                            hasLegalMove = true;
                            break;
                        }
                    }

                    // If no piece in the group has legal moves, capture the entire group
                    if (!hasLegalMove && group.length > 0) {
                        group.forEach(([r, c]) => {
                            board[r][c] = 'H';
                        });
                        // Play capture sound for trapped pieces (no effect)
                        SoundManager.play('capture');
                    }
                }
            }
        }
    },

    // Find connected group of pieces - same as server
    findConnectedGroup: (board, startRow, startCol, pieceTypes, visited, group) => {
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
    },

    // Check if a piece has any legal moves - same as server
    pieceHasLegalMoves: (board, row, col, player) => {
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
                    return true; // Found a legal move
                } else {
                    break; // Hit a piece, can't move further in this direction
                }
                checkRow += dRow;
                checkCol += dCol;
            }
        }

        return false; // No legal moves found
    },

    // Check for winner in Rek game (same as server)
    checkWinner: (board) => {
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
    },

    // Minimax algorithm with alpha-beta pruning
    minimax: (board, depth, isMaximizing, alpha, beta) => {
        if (depth === 0) {
            return botAI.evaluateBoard(board);
        }

        const color = isMaximizing ? 'Red' : 'Blue';
        const moves = botAI.getPossibleMoves(board, color);

        if (moves.length === 0) {
            return isMaximizing ? -10000 : 10000;
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const newBoard = botAI.simulateMove(board, move.from, move.to);
                const eval = botAI.minimax(newBoard, depth - 1, false, alpha, beta);
                maxEval = Math.max(maxEval, eval);
                alpha = Math.max(alpha, eval);
                if (beta <= alpha) break; // Alpha-beta pruning
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const newBoard = botAI.simulateMove(board, move.from, move.to);
                const eval = botAI.minimax(newBoard, depth - 1, true, alpha, beta);
                minEval = Math.min(minEval, eval);
                beta = Math.min(beta, eval);
                if (beta <= alpha) break; // Alpha-beta pruning
            }
            return minEval;
        }
    },

    // Get the best move for the bot
    getBestMove: (board) => {
        const moves = botAI.getPossibleMoves(board, 'Red');
        if (moves.length === 0) return null;

        let bestMove = null;
        let bestScore = -Infinity;

        for (const move of moves) {
            const newBoard = botAI.simulateMove(board, move.from, move.to);
            const score = botAI.minimax(newBoard, 3, false, -Infinity, Infinity); // Depth 3 for hard difficulty

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }
};

// Execute player move in bot game
const executeBotGameMove = (from, to) => {
    // Create new board and apply the player's move
    const newBoard = gameState.board.map(row => [...row]);
    const piece = newBoard[from[0]][from[1]];

    // Move the piece
    newBoard[from[0]][from[1]] = 'H';
    newBoard[to[0]][to[1]] = piece;

    // Apply capture rules using the same logic as server
    botAI.checkRekCaptures(newBoard, to[0], to[1], 'Blue');
    botAI.checkTrappingCaptures(newBoard, 'Blue');

    // Check for win condition (king capture)
    const winner = botAI.checkWinner(newBoard);
    if (winner) {
        gameState.gameStarted = false;
        updateBoard(newBoard);
        highlightLastMove(from, to);
        elements.gameplayControls.style.display = 'none';
        showGameOverModal(winner);
        return;
    }

    // Switch to bot's turn
    gameState.currentPlayer = 'Red';
    updateBoard(newBoard);
    updateTurnIndicator('Red');
    highlightLastMove(from, to);
    clearSelection();

    // Trigger bot move
    executeBotMove();
};

// Execute bot move
const executeBotMove = () => {
    if (!gameState.isBot || gameState.currentPlayer !== 'Red' || !gameState.gameStarted) {
        return;
    }

    setTimeout(() => {
        const bestMove = botAI.getBestMove(gameState.board);

        if (bestMove) {
            // Highlight the bot's move
            gameState.lastMove = { from: bestMove.from, to: bestMove.to };

            // Create new board and apply the bot's move
            const newBoard = gameState.board.map(row => [...row]);
            const piece = newBoard[bestMove.from[0]][bestMove.from[1]];

            // Move the piece
            newBoard[bestMove.from[0]][bestMove.from[1]] = 'H';
            newBoard[bestMove.to[0]][bestMove.to[1]] = piece;

            // Apply capture rules using the same logic as server
            botAI.checkRekCaptures(newBoard, bestMove.to[0], bestMove.to[1], 'Red');
            botAI.checkTrappingCaptures(newBoard, 'Red');

            // Check for win condition (king capture)
            const winner = botAI.checkWinner(newBoard);
            if (winner) {
                gameState.gameStarted = false;
                updateBoard(newBoard);
                highlightLastMove(bestMove.from, bestMove.to);
                elements.gameplayControls.style.display = 'none';
                showGameOverModal(winner);
                return;
            }

            // Continue game
            gameState.currentPlayer = 'Blue';
            updateBoard(newBoard);
            updateTurnIndicator('Blue');
            highlightLastMove(bestMove.from, bestMove.to);

            // Play move sound for bot's move (no effect)
            SoundManager.play('move');

            showNotification('Bot made its move!', 'info');
        }
    }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds for realism
};

// Restart bot game
const restartBotGame = () => {
    const initialBoard = [
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'H'],  // Row 0: Red pieces at top
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'R'],  // Row 1: Red King
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'],  // Row 2: Red pieces
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 3: Empty
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 4: Empty
        ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],  // Row 5: Blue pieces
        ['P', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 6: Blue King
        ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O']   // Row 7: Blue pieces at bottom
    ];

    gameState.gameStarted = true;
    gameState.currentPlayer = 'Blue';
    gameState.lastMove = null;

    updateBoard(initialBoard);
    updateTurnIndicator('Blue');
    clearSelection();
    clearMoveHighlights();

    elements.requestRestartBtn.disabled = false;
    elements.requestRestartBtn.textContent = '🔄 Request Restart';

    showNotification('Bot game restarted!', 'info');
};

// Execute move in local 2-player mode
const executeLocal2PMove = (from, to) => {
    // Create new board and apply the move
    const newBoard = gameState.board.map(row => [...row]);
    const piece = newBoard[from[0]][from[1]];
    const movingPlayer = gameState.currentPlayer;

    // Move the piece
    newBoard[from[0]][from[1]] = 'H';
    newBoard[to[0]][to[1]] = piece;

    // Apply capture rules using the same logic as server
    botAI.checkRekCaptures(newBoard, to[0], to[1], movingPlayer);
    botAI.checkTrappingCaptures(newBoard, movingPlayer);

    // Check for win condition (king capture)
    const winner = botAI.checkWinner(newBoard);
    if (winner) {
        gameState.gameStarted = false;
        updateBoard(newBoard);
        highlightLastMove(from, to);
        elements.gameplayControls.style.display = 'none';
        showGameOverModal(winner);
        return;
    }

    // Switch turns
    gameState.currentPlayer = gameState.currentPlayer === 'Blue' ? 'Red' : 'Blue';
    updateBoard(newBoard);
    updateTurnIndicator(gameState.currentPlayer);
    highlightLastMove(from, to);
    clearSelection();

    showNotification(`${movingPlayer} moved! Now ${gameState.currentPlayer}'s turn`, 'info');
};

// Restart local 2-player game
const restartLocal2PGame = () => {
    const initialBoard = [
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'H'],  // Row 0: Red pieces at top
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'R'],  // Row 1: Red King
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'],  // Row 2: Red pieces
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 3: Empty
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 4: Empty
        ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],  // Row 5: Blue pieces
        ['P', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 6: Blue King
        ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O']   // Row 7: Blue pieces at bottom
    ];

    gameState.gameStarted = true;
    gameState.currentPlayer = 'Blue';
    gameState.lastMove = null;

    updateBoard(initialBoard);
    updateTurnIndicator('Blue');
    clearSelection();
    clearMoveHighlights();

    showNotification('Local 2-player game restarted!', 'info');
};

// Initialize quick chat system
const initializeQuickChat = () => {
    QuickChat.init();
};



// Socket event listeners
socket.on('playerAssigned', ({ color, piece }) => {
    gameState.playerColor = color;
    gameState.playerPiece = piece;

    showNotification(`You are the ${color} Player`, 'info');

    // Setup player display based on perspective
    setupPlayerDisplay();

    // Show game screen immediately but with waiting message
    showScreen('gameScreen');
    createBoard();

    // Show initial board setup for Rek game
    const initialBoard = [
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'H'],  // Row 0: Red pieces at top
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'R'],  // Row 1: Red King
        ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X'],  // Row 2: Red pieces
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 3: Empty
        ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 4: Empty
        ['O', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],  // Row 5: Blue pieces
        ['P', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],  // Row 6: Blue King
        ['H', 'O', 'O', 'O', 'O', 'O', 'O', 'O']   // Row 7: Blue pieces at bottom
    ];
    updateBoard(initialBoard);

    if (color === 'Blue') {
        elements.statusMessage.textContent = `Share room code "${gameState.roomId}" with a friend to start playing!`;
        showNotification(`Room created! Share code: ${gameState.roomId}`, 'info');
        elements.copyRoomBtn.style.display = 'block';
        elements.waitingControls.style.display = 'block';
    } else {
        elements.statusMessage.textContent = `Joined room ${gameState.roomId}. Waiting for game to start...`;
        elements.waitingControls.style.display = 'block';
    }
});

socket.on('bothPlayersJoined', () => {
    SoundManager.play('join'); // No sound effect
    elements.statusMessage.textContent = 'Both players connected! Click "Start Game" when ready.';
    elements.waitingControls.style.display = 'none';
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



// Socket event handlers for game functionality
socket.on('startGame', ({ board, currentPlayer, players, timeControl }) => {
    console.log('🎮 Game starting with timeControl:', timeControl);
    
    gameState.gameStarted = true;
    gameState.currentPlayer = currentPlayer;
    
    // Initialize timers if time control is set
    if (timeControl) {
        console.log('⏰ Initializing timers for time control:', timeControl);
        initializeGameTimers(timeControl);
    } else {
        console.log('⏰ No time control set, using unlimited');
    }
    
    updateBoard(board);
    updateTurnIndicator(currentPlayer);

    elements.gameStartCountdown.style.display = 'none';
    elements.gameplayControls.style.display = 'block';

    // Show quick chat for multiplayer games
    if (elements.quickChatBtn && !gameState.isBot) {
        elements.quickChatBtn.classList.add('visible');
        console.log('💬 Quick chat button shown for multiplayer game');
    }

    showNotification('Game started! May the best strategist win!', 'info');
});

socket.on('updateBoard', ({ board, currentPlayer, lastMove }) => {
    console.log('📥 ========== UPDATE BOARD EVENT ==========');
    console.log('Current Player:', currentPlayer);
    console.log('Last Move:', lastMove);
    console.log('Last Move From:', lastMove?.from);
    console.log('Last Move To:', lastMove?.to);
    console.log('==========================================');
    
    gameState.currentPlayer = currentPlayer;
    updateBoard(board);
    updateTurnIndicator(currentPlayer);

    // Play move sound for opponent's move (no effect)
    SoundManager.play('move');

    if (lastMove && lastMove.from && lastMove.to) {
        console.log('🎨 Calling highlightLastMove with from:', lastMove.from, 'to:', lastMove.to);
        highlightLastMove(lastMove.from, lastMove.to);
        
        // Double check if classes were added
        setTimeout(() => {
            const fromSquares = document.querySelectorAll('.last-move-from');
            const toSquares = document.querySelectorAll('.last-move-to');
            console.log('🔍 Found', fromSquares.length, 'squares with last-move-from class');
            console.log('🔍 Found', toSquares.length, 'squares with last-move-to class');
            if (fromSquares.length > 0) {
                console.log('✅ FROM square:', fromSquares[0]);
            }
            if (toSquares.length > 0) {
                console.log('✅ TO square:', toSquares[0]);
            }
        }, 100);
    } else {
        console.warn('⚠️ No valid lastMove data received in updateBoard event');
        console.warn('lastMove object:', lastMove);
    }
});

socket.on('gameOver', ({ winner, board, lastMove }) => {
    console.log(`🏁 Game Over! Winner: ${winner}, lastMove:`, lastMove);
    
    // Stop any running timers
    stopGameTimer();
    
    gameState.gameStarted = false;
    updateBoard(board);

    if (lastMove) {
        console.log(`🎨 Highlighting final move:`, lastMove);
        highlightLastMove(lastMove.from, lastMove.to);
    } else {
        console.warn(`⚠️ No lastMove data in gameOver event`);
    }

    elements.gameplayControls.style.display = 'none';
    showGameOverModal(winner);
});

socket.on('restartGame', ({ board, currentPlayer }) => {
    gameState.gameStarted = true;
    gameState.currentPlayer = currentPlayer;
    gameState.lastMove = null;

    updateBoard(board);
    updateTurnIndicator(currentPlayer);
    clearSelection();
    clearMoveHighlights();

    elements.gameplayControls.style.display = 'block';
    elements.requestRestartBtn.disabled = false;
    elements.requestRestartBtn.textContent = '🔄 RESTART';

    hideGameOverModal();
    showNotification('Game restarted! Good luck!', 'info');
});

socket.on('playerDisconnected', () => {
    if (gameState.gameStarted) {
        // Player disconnected during gameplay - you win!
        gameState.gameStarted = false;
        elements.gameplayControls.style.display = 'none';

        // Show win modal with only exit button
        showDisconnectionWinModal();
    } else {
        // Player disconnected in lobby
        showNotification('Opponent disconnected', 'error');
        elements.statusMessage.textContent = 'Opponent disconnected. Waiting for reconnection...';
        elements.gameplayControls.style.display = 'none';
        elements.waitingControls.style.display = 'block';
    }
});

socket.on('endSession', () => {
    // Stop any running timers
    stopGameTimer();
    
    // Hide game over modal if showing
    hideGameOverModal();
    
    showScreen('mainMenu');

    // Hide quick chat
    if (elements.quickChatBtn) {
        elements.quickChatBtn.style.display = 'none';
    }
    
    // Hide timers
    if (elements.topPlayerTimer) elements.topPlayerTimer.style.display = 'none';
    if (elements.bottomPlayerTimer) elements.bottomPlayerTimer.style.display = 'none';

    gameState = {
        roomId: null,
        playerColor: null,
        playerPiece: null,
        currentPlayer: 'Blue',
        board: [],
        selectedSquare: null,
        gameStarted: false,
        lastMove: null,
        isBot: false,
        isLocal2P: false,
        turnTimeLeft: 60,
        timerInterval: null,
        timeControl: 'unlimited',
        blueTimeLeft: 0,
        redTimeLeft: 0,
        timerRunning: false
    };

    showNotification('Game session ended', 'info');
});

socket.on('roomFull', () => {
    showScreen('mainMenu');
    showNotification('Room is full!', 'error');
});

socket.on('roomNotFound', () => {
    showScreen('mainMenu');
    showNotification('Room not found!', 'error');
});

socket.on('roomList', (rooms) => {
    displayRoomList(rooms);
});

socket.on('roomListUpdated', (rooms) => {
    displayRoomList(rooms);
});

socket.on('disconnect', () => {
    console.log('Disconnected from game server');
    showNotification('Connection lost. Attempting to reconnect...', 'error');
});

// Handle play again requests
socket.on('opponentWantsPlayAgain', () => {
    showNotification('Opponent wants to play again!', 'info');

    // Update the play again button to show opponent is waiting
    if (elements.playAgainBtn && !elements.playAgainBtn.disabled) {
        elements.playAgainBtn.innerHTML = '⚔️ Opponent Ready - Click to Start!';
        elements.playAgainBtn.style.background = 'linear-gradient(145deg, #4ecdc4, #45b7aa)';
        elements.playAgainBtn.style.animation = 'pulse 1s infinite';
    }
});

// Handle both players ready for play again
socket.on('bothPlayersWantPlayAgain', () => {
    showNotification('Both players ready! Starting new game...', 'info');
    hideGameOverModal();
});

// Handle when opponent exits during play again waiting
socket.on('opponentExitedPlayAgain', () => {
    showNotification('Opponent left the game', 'error');
    hideGameOverModal();
    showScreen('mainMenu');

    // Reset game state
    gameState = {
        roomId: null,
        playerColor: null,
        playerPiece: null,
        currentPlayer: 'Blue',
        board: [],
        selectedSquare: null,
        gameStarted: false,
        lastMove: null,
        isBot: false
    };
});

socket.on('restartRequested', ({ requesterName }) => {
    showNotification(`${requesterName} requested a restart`, 'info');
});

socket.on('restartRequestDeclined', ({ declinerName }) => {
    elements.requestRestartBtn.disabled = false;
    elements.requestRestartBtn.textContent = '🔄 Request Restart';
    showNotification(`${declinerName} declined the restart request`, 'error');
});

socket.on('restartRequestAccepted', () => {
    showNotification('Restart request accepted! Starting new game...', 'info');
});

socket.on('exitedLobby', () => {
    showScreen('mainMenu');
    gameState = {
        roomId: null,
        playerColor: null,
        playerPiece: null,
        currentPlayer: 'Blue',
        board: [],
        selectedSquare: null,
        gameStarted: false,
        lastMove: null,
        isBot: false
    };

    elements.roomInput.value = '';
    showNotification('Left the lobby', 'info');
});

// Quick Chat System
let quickChatCooldown = false;

const QuickChat = {
    init() {
        console.log('🎭 Initializing QuickChat system...');

        if (!elements.quickChatBtn) {
            console.error('❌ Quick chat button not found!');
            return;
        }

        // Toggle quick chat menu
        elements.quickChatBtn.addEventListener('click', (e) => {
            console.log('💬 Quick chat button clicked!');
            e.stopPropagation();
            this.toggleMenu();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (elements.quickChatMenu &&
                !elements.quickChatMenu.contains(e.target) &&
                !elements.quickChatBtn.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Handle emoji and text buttons
        this.setupChatButtons();

        // Test the button immediately
        setTimeout(() => {
            this.testButton();
        }, 1000);

        console.log('✅ QuickChat initialized successfully');

        // Add global test functions for debugging
        window.testPopup = (color, message) => {
            console.log(`🧪 Testing popup: ${color} - ${message}`);
            this.showPopup(color || 'Blue', message || 'Test Message');
        };

        window.testSimplePopup = (message) => {
            console.log(`🧪 Testing simple popup: ${message}`);
            const popup = document.createElement('div');
            popup.className = 'chat-popup';
            popup.textContent = message || 'Simple Test!';
            popup.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(212, 175, 55, 0.95);
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 25px;
                border: 3px solid #d4af37;
                font-size: 1.3rem;
                font-weight: bold;
                z-index: 9999;
                animation: popupBounce 1.5s ease-out forwards;
            `;
            document.body.appendChild(popup);
            setTimeout(() => {
                if (popup.parentNode) popup.parentNode.removeChild(popup);
            }, 1500);
        };

        console.log('🧪 Test functions added:');
        console.log('  - testPopup("Blue", "Test!")');
        console.log('  - testSimplePopup("Hello!")');
    },

    testButton() {
        if (elements.quickChatBtn) {
            console.log('🧪 Testing quick chat button visibility...');
            const rect = elements.quickChatBtn.getBoundingClientRect();
            console.log('📍 Button position:', rect);
            console.log('👁️ Button visible:', elements.quickChatBtn.offsetParent !== null);
            console.log('🎨 Button styles:', window.getComputedStyle(elements.quickChatBtn).display);
        }
    },

    setupChatButtons() {
        // Wait for DOM to be ready, then setup buttons
        setTimeout(() => {
            const chatButtons = document.querySelectorAll('.emoji-btn, .text-btn');
            console.log(`🔘 Found ${chatButtons.length} chat buttons`);

            chatButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    console.log('🎯 Chat button clicked:', btn.dataset.value);
                    e.stopPropagation();
                    const type = btn.dataset.type;
                    const value = btn.dataset.value;
                    this.sendQuickChat(type, value);
                });
            });
        }, 100);
    },

    toggleMenu() {
        if (!elements.quickChatMenu) {
            console.error('❌ Quick chat menu not found!');
            return;
        }

        const isVisible = elements.quickChatMenu.style.display === 'block';
        elements.quickChatMenu.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            SoundManager.play('click'); // No sound effect
            console.log('📖 Quick chat menu opened');
        } else {
            console.log('📕 Quick chat menu closed');
        }
    },

    closeMenu() {
        if (elements.quickChatMenu) {
            elements.quickChatMenu.style.display = 'none';
        }
    },

    sendQuickChat(type, value) {
        console.log(`📤 Sending quick chat: ${type} - ${value}`);

        if (quickChatCooldown) {
            showNotification('Please wait before sending another message', 'error');
            return;
        }

        if (gameState.isBot) {
            // For testing: allow quick chat in bot games to test popup system
            console.log('🤖 Bot game: Testing popup on your king');
            this.showPopup(gameState.playerColor, value);
            this.closeMenu();
            SoundManager.play('notification'); // No sound effect

            // Start cooldown
            quickChatCooldown = true;
            this.updateButtonStates(true);
            setTimeout(() => {
                quickChatCooldown = false;
                this.updateButtonStates(false);
            }, 2000);
            return;
        }

        if (!gameState.roomId || !gameState.playerColor) {
            showNotification('Join a game first!', 'error');
            return;
        }

        // Start cooldown
        quickChatCooldown = true;
        this.updateButtonStates(true);

        // Send to server (server will broadcast to ALL players including sender)
        socket.emit('quickChat', {
            roomId: gameState.roomId,
            player: gameState.playerColor,
            type: type,
            value: value
        });

        // Don't show popup locally - let the server broadcast handle it for consistency

        // Close menu
        this.closeMenu();

        // Play sound (no effect)
        SoundManager.play('notification');

        // Reset cooldown after 2 seconds
        setTimeout(() => {
            quickChatCooldown = false;
            this.updateButtonStates(false);
            console.log('⏰ Quick chat cooldown reset');
        }, 2000);
    },

    updateButtonStates(disabled) {
        document.querySelectorAll('.emoji-btn, .text-btn').forEach(btn => {
            btn.disabled = disabled;
            if (disabled) {
                btn.style.opacity = '0.5';
            } else {
                btn.style.opacity = '1';
            }
        });
    },

    showPopup(playerColor, message) {
        console.log(`💭 Showing popup for ${playerColor}: ${message}`);
        console.log(`👑 Looking for ${playerColor} king (${playerColor === 'Blue' ? 'P' : 'R'}) on the board`);

        // Debug: Check if board exists
        if (!gameState.board) {
            console.error('❌ gameState.board is null/undefined');
            console.log('🎮 Current gameState:', gameState);
            return;
        }

        console.log('📋 Current board state:', gameState.board);

        // Find the king piece for the player
        const kingPiece = playerColor === 'Blue' ? 'P' : 'R';
        let kingPosition = null;

        // Find king position on the board
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (gameState.board[row] && gameState.board[row][col] === kingPiece) {
                    kingPosition = [row, col];
                    console.log(`👑 Found ${playerColor} king at position [${row}, ${col}]`);
                    break;
                }
            }
            if (kingPosition) break;
        }

        if (!kingPosition) {
            console.warn(`⚠️ ${playerColor} king (${kingPiece}) not found on board`);
            console.log('🔍 Available pieces on board:');
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    if (gameState.board[row] && gameState.board[row][col] !== 'H') {
                        console.log(`  - [${row},${col}]: ${gameState.board[row][col]}`);
                    }
                }
            }

            // Fallback: Show popup in center of screen
            console.log('🔄 Using fallback popup positioning');
            this.showFallbackPopup(playerColor, message);
            return;
        }

        // Convert to display coordinates
        const [displayRow, displayCol] = getDisplayCoordinates(kingPosition[0], kingPosition[1]);
        console.log(`📍 Display coordinates: [${displayRow}, ${displayCol}]`);

        // Find the king square element
        const kingSquare = document.querySelector(`[data-row="${displayRow}"][data-col="${displayCol}"]`);
        if (!kingSquare) {
            console.warn(`⚠️ King square element not found at [${displayRow}, ${displayCol}]`);
            console.log('🔍 Available squares:');
            document.querySelectorAll('[data-row][data-col]').forEach(square => {
                console.log(`  - Square [${square.dataset.row}, ${square.dataset.col}]`);
            });
            return;
        }

        console.log('✅ King square found, creating popup...');

        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'chat-popup';
        popup.textContent = message;

        // Position popup above the king
        const rect = kingSquare.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.left = `${rect.left + rect.width / 2}px`;
        popup.style.top = `${rect.top - 10}px`;
        popup.style.transform = 'translateX(-50%)';
        popup.style.zIndex = '9999';

        console.log(`📍 Popup positioned at: left=${popup.style.left}, top=${popup.style.top}`);

        document.body.appendChild(popup);
        console.log('✅ Popup added to DOM');

        // Remove popup after animation
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
                console.log('🗑️ Popup removed from DOM');
            }
        }, 1500);
    },

    showFallbackPopup(playerColor, message) {
        console.log(`🔄 Showing fallback popup for ${playerColor}: ${message}`);

        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'chat-popup fallback-popup';
        popup.innerHTML = `<strong>${playerColor}:</strong> ${message}`;

        // Position popup in center of screen
        popup.style.position = 'fixed';
        popup.style.left = '50%';
        popup.style.top = '30%';
        popup.style.transform = 'translateX(-50%)';
        popup.style.zIndex = '9999';
        popup.style.background = playerColor === 'Blue' ? 'rgba(78, 205, 196, 0.95)' : 'rgba(255, 107, 107, 0.95)';

        document.body.appendChild(popup);
        console.log('✅ Fallback popup added to DOM');

        // Remove popup after animation
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
                console.log('🗑️ Fallback popup removed from DOM');
            }
        }, 1500);
    }
};

// Socket event for quick chat
socket.on('quickChat', ({ player, type, value }) => {
    console.log(`📥 Received quick chat from ${player}: ${value}`);
    console.log(`🎯 My color: ${gameState.playerColor}, Sender: ${player}`);
    console.log(`📍 Will show popup on ${player}'s king for both players to see`);

    // Show popup on the SENDER's king (so both players see it on the same king)
    QuickChat.showPopup(player, value);
    SoundManager.play('notification'); // No sound effect
});

// Initialize the game
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Game initializing...');

    // Check if all required elements exist
    const missingElements = [];
    Object.entries(elements).forEach(([key, element]) => {
        if (!element) {
            missingElements.push(key);
        }
    });

    if (missingElements.length > 0) {
        console.warn('⚠️ Missing DOM elements:', missingElements);
    } else {
        console.log('✅ All DOM elements found');
    }

    // Initialize sound system (disabled)
    SoundManager.init();

    // Initialize quick chat system
    QuickChat.init();

    showScreen('mainMenu');
    console.log('🏠 Main menu displayed');

    // Load room list when page loads
    setTimeout(() => {
        refreshRoomList();
    }, 1000);

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
    
    // Add test function for highlighting
    window.testHighlight = () => {
        console.log('🧪 Testing highlight on squares [0,0] and [1,1]');
        const square1 = document.querySelector('[data-row="0"][data-col="0"]');
        const square2 = document.querySelector('[data-row="1"][data-col="1"]');
        
        if (square1 && square2) {
            // Add classes
            square1.classList.add('last-move-from');
            square2.classList.add('last-move-to');
            
            // Also add inline styles as backup
            square1.style.background = 'rgba(255, 107, 107, 0.8)';
            square1.style.boxShadow = 'inset 0 0 40px rgba(255, 107, 107, 1), 0 0 30px rgba(255, 107, 107, 0.8)';
            square1.style.border = '3px solid #ff6b6b';
            
            square2.style.background = 'rgba(78, 205, 196, 0.8)';
            square2.style.boxShadow = 'inset 0 0 40px rgba(78, 205, 196, 1), 0 0 30px rgba(78, 205, 196, 0.8)';
            square2.style.border = '3px solid #4ecdc4';
            
            console.log('✅ Added highlight classes AND inline styles to test squares');
            console.log('Square 1 classes:', square1.className);
            console.log('Square 1 style:', square1.style.cssText);
            console.log('Square 2 classes:', square2.className);
            console.log('Square 2 style:', square2.style.cssText);
        } else {
            console.error('❌ Could not find test squares');
        }
    };
    
    console.log('🧪 Test function added: testHighlight()');
    console.log('💡 Open console and type: testHighlight()');
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