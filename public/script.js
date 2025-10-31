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
    turnTimeLeft: 60, // Time left in seconds
    timerInterval: null // Timer interval reference
};

// Sound System
const SoundManager = {
    sounds: {},
    enabled: true,
    volume: 0.7,
    audioContext: null,
    
    init() {
        // Load preferences
        this.loadPreferences();
        
        // Initialize audio context
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.log('Web Audio API not supported');
            return;
        }
        
        // Generate procedural sounds
        this.generateSounds();
        
        // Add sound toggle button
        this.createSoundToggle();
    },
    
    generateSounds() {
        if (!this.audioContext) return;
        
        // Create different sound effects
        this.sounds.clickBuffer = this.createToneBuffer(800, 0.1, 0.05);
        this.sounds.moveBuffer = this.createSweepBuffer(400, 600, 0.3, 0.2);
        this.sounds.captureBuffer = this.createSweepBuffer(600, 300, 0.5, 0.3);
        this.sounds.winBuffer = this.createChordBuffer([523, 659, 784, 1047], 1, 0.8);
        this.sounds.loseBuffer = this.createSweepBuffer(300, 150, 0.8, 0.6);
        this.sounds.notificationBuffer = this.createToneBuffer(1000, 0.2, 0.1);
        this.sounds.errorBuffer = this.createNoiseBuffer(200, 0.3, 0.2);
        this.sounds.joinBuffer = this.createSweepBuffer(400, 800, 0.4, 0.3);
    },
    
    createToneBuffer(frequency, duration, decay) {
        const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * duration, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.sin(2 * Math.PI * frequency * i / this.audioContext.sampleRate) * 
                     Math.exp(-i / (this.audioContext.sampleRate * decay));
        }
        
        return buffer;
    },
    
    createSweepBuffer(startFreq, endFreq, duration, decay) {
        const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * duration, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const progress = i / data.length;
            const freq = startFreq + (endFreq - startFreq) * progress;
            data[i] = Math.sin(2 * Math.PI * freq * i / this.audioContext.sampleRate) * 
                     Math.exp(-i / (this.audioContext.sampleRate * decay));
        }
        
        return buffer;
    },
    
    createChordBuffer(frequencies, duration, decay) {
        const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * duration, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            let sample = 0;
            frequencies.forEach(freq => {
                sample += Math.sin(2 * Math.PI * freq * i / this.audioContext.sampleRate) * (1 / frequencies.length);
            });
            data[i] = sample * Math.exp(-i / (this.audioContext.sampleRate * decay));
        }
        
        return buffer;
    },
    
    createNoiseBuffer(baseFreq, duration, decay) {
        const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * duration, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const freq = baseFreq + Math.sin(i / 100) * 50;
            data[i] = Math.sin(2 * Math.PI * freq * i / this.audioContext.sampleRate) * 
                     Math.exp(-i / (this.audioContext.sampleRate * decay));
        }
        
        return buffer;
    },
    
    createSoundToggle() {
        const soundToggle = document.createElement('button');
        soundToggle.id = 'soundToggle';
        soundToggle.innerHTML = this.enabled ? '🔊' : '🔇';
        soundToggle.className = 'sound-toggle';
        soundToggle.title = 'Toggle Sound';
        
        soundToggle.addEventListener('click', () => {
            this.toggle();
            soundToggle.innerHTML = this.enabled ? '🔊' : '🔇';
            this.play('click');
        });
        
        document.body.appendChild(soundToggle);
    },
    
    play(soundName) {
        if (!this.enabled || !this.audioContext) return;
        
        try {
            const bufferName = soundName + 'Buffer';
            
            if (this.sounds[bufferName]) {
                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                
                source.buffer = this.sounds[bufferName];
                gainNode.gain.value = this.volume;
                
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                source.start();
            }
        } catch (error) {
            console.log('Audio playback failed:', error);
        }
    },
    
    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('soundEnabled', this.enabled);
    },
    
    loadPreferences() {
        const saved = localStorage.getItem('soundEnabled');
        if (saved !== null) {
            this.enabled = saved === 'true';
        }
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
    
    // Game elements
    gameBoard: document.getElementById('gameBoard'),
    roomCode: document.getElementById('roomCode'),
    copyRoomBtn: document.getElementById('copyRoomBtn'),
    statusMessage: document.getElementById('statusMessage'),
    
    // Player info elements
    topPlayerPiece: document.getElementById('topPlayerPiece'),
    topPlayerName: document.getElementById('topPlayerName'),
    topPlayerTurn: document.getElementById('topPlayerTurn'),
    bottomPlayerPiece: document.getElementById('bottomPlayerPiece'),
    bottomPlayerName: document.getElementById('bottomPlayerName'),
    bottomPlayerTurn: document.getElementById('bottomPlayerTurn'),
    
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
    
    // Room list
    refreshRoomsBtn: document.getElementById('refreshRoomsBtn'),
    roomList: document.getElementById('roomList'),
    
    // Chat system
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn')
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
    
    if (gameState.playerColor !== gameState.currentPlayer && !gameState.isBot) {
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

        // Play move sound
        SoundManager.play('move');

        if (gameState.isBot) {
            // Handle bot game locally
            executeBotGameMove(actualFrom, actualTo);
        } else {
            // Handle multiplayer game via socket
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
        SoundManager.play('click');
        clearSelection();
        selectPiece(displayRow, displayCol);
        showNotification(`Selected ${piece} piece`, 'info');
    } else {
        SoundManager.play('error');
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

const clearMoveHighlights = () => {
    // Remove previous last move highlights
    document.querySelectorAll('.board-square.last-move-from').forEach(square => {
        square.classList.remove('last-move-from');
    });

    document.querySelectorAll('.board-square.last-move-to').forEach(square => {
        square.classList.remove('last-move-to');
    });
};

const highlightLastMove = (from, to) => {
    // Clear previous last move highlights
    clearMoveHighlights();

    if (from && to) {
        // Convert actual coordinates to display coordinates for highlighting
        const [displayFromRow, displayFromCol] = getDisplayCoordinates(from[0], from[1]);
        const [displayToRow, displayToCol] = getDisplayCoordinates(to[0], to[1]);

        // Highlight the "from" square (where piece moved from)
        const fromSquare = document.querySelector(`[data-row="${displayFromRow}"][data-col="${displayFromCol}"]`);
        if (fromSquare) {
            fromSquare.classList.add('last-move-from');
        }

        // Highlight the "to" square (where piece moved to)
        const toSquare = document.querySelector(`[data-row="${displayToRow}"][data-col="${displayToCol}"]`);
        if (toSquare) {
            toSquare.classList.add('last-move-to');
        }
    }
};



const showGameOverModal = (winner) => {
    // Play win/lose sound
    if (winner === gameState.playerColor) {
        SoundManager.play('win');
    } else {
        SoundManager.play('lose');
    }
    
    elements.winnerText.textContent = `${winner} Wins!`;
    elements.winnerMessage.textContent = winner === gameState.playerColor
        ? "Victory is yours! Well played!"
        : "Good game! Better luck next time.";

    elements.gameOverModal.classList.add('active');
};

const hideGameOverModal = () => {
    elements.gameOverModal.classList.remove('active');
};

const showRestartRequestModal = (requesterName) => {
    elements.restartRequestMessage.textContent = `${requesterName} wants to restart the game. Do you agree?`;
    elements.restartRequestModal.classList.add('active');
};

const hideRestartRequestModal = () => {
    elements.restartRequestModal.classList.remove('active');
};

// Timer Functions
const startTurnTimer = () => {
    // Only show timer for multiplayer games
    if (gameState.isBot) {
        elements.turnTimer.style.display = 'none';
        return;
    }

    elements.turnTimer.style.display = 'block';
    gameState.turnTimeLeft = 60; // Reset to 60 seconds
    
    // Update timer display class based on whose turn it is
    const isMyTurn = gameState.playerColor === gameState.currentPlayer;
    elements.turnTimer.className = `turn-timer ${isMyTurn ? 'my-turn' : 'opponent-turn'}`;
    
    updateTimerDisplay();
    
    // Clear any existing timer
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    // Start new timer
    gameState.timerInterval = setInterval(() => {
        gameState.turnTimeLeft--;
        updateTimerDisplay();
        
        // Check if time is up
        if (gameState.turnTimeLeft <= 0) {
            clearInterval(gameState.timerInterval);
            handleTimeUp();
        }
    }, 1000);
};

const updateTimerDisplay = () => {
    const minutes = Math.floor(gameState.turnTimeLeft / 60);
    const seconds = gameState.turnTimeLeft % 60;
    
    elements.timerMinutes.textContent = minutes;
    elements.timerSeconds.textContent = seconds.toString().padStart(2, '0');
    
    // Update timer styling based on time left
    elements.timerDisplay = document.querySelector('.timer-display');
    if (elements.timerDisplay) {
        elements.timerDisplay.classList.remove('timer-warning', 'timer-critical');
        
        if (gameState.turnTimeLeft <= 10) {
            elements.timerDisplay.classList.add('timer-critical');
        } else if (gameState.turnTimeLeft <= 30) {
            elements.timerDisplay.classList.add('timer-warning');
        }
    }
};

const stopTurnTimer = () => {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    elements.turnTimer.style.display = 'none';
};

const handleTimeUp = () => {
    // Only handle time up for the current player's turn
    const isMyTurn = gameState.playerColor === gameState.currentPlayer;
    
    if (isMyTurn && gameState.gameStarted) {
        // Player's time is up - forfeit turn
        showNotification('Time\'s up! Turn forfeited.', 'error');
        socket.emit('timeUp', { roomId: gameState.roomId });
    }
};

const updateTurnIndicator = (currentPlayer) => {
    const isMyTurn = gameState.playerColor === currentPlayer;
    
    // Update turn indicators based on perspective
    elements.bottomPlayerTurn.classList.toggle('active', isMyTurn);
    elements.topPlayerTurn.classList.toggle('active', !isMyTurn);
    
    elements.statusMessage.textContent = isMyTurn 
        ? `Your turn (${gameState.playerColor}) - Choose your move wisely!` 
        : `Opponent's turn (${currentPlayer}) - Waiting for opponent...`;
    
    // Start timer for multiplayer games
    if (gameState.gameStarted && !gameState.isBot) {
        startTurnTimer();
    }
    
    console.log(`Turn: ${currentPlayer}, My Color: ${gameState.playerColor}, My Turn: ${isMyTurn}`);
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
    SoundManager.play('click');
    elements.roomSettingsModal.style.display = 'flex';
});

elements.confirmCreateBtn.addEventListener('click', () => {
    SoundManager.play('click');
    const roomType = document.querySelector('input[name="roomType"]:checked').value;
    const roomId = generateRoomCode();
    gameState.roomId = roomId;
    elements.roomCode.textContent = `Room: ${roomId}`;

    console.log('🏠 Creating room:', roomId, 'Type:', roomType, 'Socket connected:', socket.connected);
    
    elements.roomSettingsModal.style.display = 'none';
    showScreen('loadingScreen');
    socket.emit('createRoom', { roomId, isPublic: roomType === 'public' });
});

elements.closeSettingsModal.addEventListener('click', () => {
    elements.roomSettingsModal.style.display = 'none';
});

// Join Room Modal
elements.joinRoomBtn.addEventListener('click', () => {
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
    SoundManager.play('click');
    elements.publicRoomsModal.style.display = 'flex';
    refreshRoomList();
});

elements.closePublicModal.addEventListener('click', () => {
    elements.publicRoomsModal.style.display = 'none';
});

// Close modals when clicking backdrop
[elements.roomSettingsModal, elements.joinRoomModal, elements.publicRoomsModal].forEach(modal => {
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
    console.log('🤖 Bot game button clicked!');
    SoundManager.play('click');
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
    elements.gameplayControls.style.display = 'block';
    elements.exitBotGameBtn.style.display = 'inline-block';

    showNotification('Bot game started! You play as Blue.', 'info');
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
    } else {
        // Request restart from opponent
        socket.emit('requestRestart', { roomId: gameState.roomId });
        elements.requestRestartBtn.disabled = true;
        elements.requestRestartBtn.textContent = '⏳ Requesting...';
        showNotification('Restart request sent to opponent', 'info');
    }
});

elements.exitBotGameBtn.addEventListener('click', () => {
    // Exit bot game and return to main menu
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
    showNotification('Returned to main menu', 'info');
});

elements.playAgainBtn.addEventListener('click', () => {
    if (gameState.isBot) {
        // Restart bot game immediately
        restartBotGame();
        hideGameOverModal();
    } else {
        // Request play again from opponent
        socket.emit('playerChoice', {
            roomId: gameState.roomId,
            choice: 'playAgain'
        });

        elements.playAgainBtn.disabled = true;
        elements.playAgainBtn.textContent = 'Waiting...';
    }
});

elements.exitGameBtn.addEventListener('click', () => {
    if (gameState.isBot) {
        // Exit bot game directly
        hideGameOverModal();
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
        showNotification('Returning to main menu...', 'info');
    } else {
        // Exit multiplayer game
        socket.emit('playerChoice', {
            roomId: gameState.roomId,
            choice: 'exit'
        });
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

elements.sendMessageBtn.addEventListener('click', () => {
    sendMessage();
});

elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

elements.acceptRestartBtn.addEventListener('click', () => {
    socket.emit('restartResponse', { roomId: gameState.roomId, accepted: true });
    hideRestartRequestModal();
});

elements.declineRestartBtn.addEventListener('click', () => {
    socket.emit('restartResponse', { roomId: gameState.roomId, accepted: false });
    hideRestartRequestModal();
});

elements.exitBotGameBtn.addEventListener('click', () => {
    // Exit bot game and return to main menu
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
    showNotification('Returned to main menu', 'info');
});

// Chat System
const sendMessage = () => {
    const message = elements.messageInput.value.trim();
    if (message && gameState.roomId && !gameState.isBot) {
        SoundManager.play('notification');
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

        // Play capture sound if any captures were made
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
                        // Play capture sound for trapped pieces
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

// Initialize chat system
const initializeChat = () => {
    // Send message button
    elements.sendMessageBtn.addEventListener('click', () => {
        if (gameState.isBot) {
            showNotification('Chat only available in multiplayer games!', 'error');
            return;
        }
        sendMessage();
    });
    
    // Enter key to send message
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (gameState.isBot) {
                showNotification('Chat only available in multiplayer games!', 'error');
                return;
            }
            sendMessage();
        }
    });
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
    SoundManager.play('join');
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



// Removed old chat message handler

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

// Socket event for chat messages
socket.on('newMessage', ({ player, message }) => {
    addChatMessage(player, message);
});

// Initialize the game
document.addEventListener('DOMContentLoaded', () => {
    // Initialize sound system
    SoundManager.init();
    
    // Initialize chat system
    initializeChat();
    
    showScreen('mainMenu');

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