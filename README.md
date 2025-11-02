# 🏯 Khmer Checkers - Temple of Ancient Strategy

A real-time multiplayer Checkers (Draughts) game with a stunning Cambodian fantasy temple theme. Experience the ancient game of strategy in a mystical setting inspired by Angkor Wat and Bayon temples.

## ✨ Features

- **Real-time Multiplayer**: Play with friends using room codes
- **Cambodian Fantasy Theme**: Beautiful temple-inspired visuals with glowing gems and golden accents
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Atmospheric Experience**: Khmer-inspired fonts, animations, and visual effects
- **Standard Checkers Rules**: Classic 8x8 board with diagonal movement and capturing
- **Play Again System**: Rematch functionality without leaving the room

## 🎮 How to Play

1. **Create or Join a Room**: Enter a room code or create a new temple chamber
2. **Wait for Opponent**: The game starts automatically when both players join
3. **Make Your Moves**: Click on your pieces (Red or Blue gems) to select them
4. **Capture Opponents**: Jump over enemy pieces diagonally to capture them
5. **Win the Game**: Eliminate all opponent pieces or block their moves
6. **Play Again**: Use the victory modal to start a new battle

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**
```bash
git clone <repository-url>
cd khmer-checkers
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server**
```bash
npm start
```

4. **Open your browser**
Navigate to `http://localhost:3001`

### Development Mode
```bash
npm run dev
```
This uses nodemon for automatic server restarts during development.

## 🏗️ Project Structure

```
khmer-checkers/
├── public/
│   ├── index.html          # Main game interface
│   ├── style.css           # Cambodian temple theme styles
│   ├── script.js           # Client-side game logic
│   └── assets/             # Optional assets folder
│       ├── bg-music.mp3    # Background music (placeholder)
│       └── textures/       # Board textures (optional)
├── server.js               # Express + Socket.io backend
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## 🎯 Game Mechanics

### Board Setup
- 8x8 checkers board with alternating stone tiles
- Red pieces (X) start at the bottom, move upward
- Blue pieces (O) start at the top, move downward
- Each player starts with 12 pieces

### Movement Rules
- Pieces move diagonally on dark squares only
- Regular moves: one square diagonally forward
- Captures: jump over opponent pieces diagonally
- Multiple captures in one turn are possible
- Pieces cannot move backward (no kings in this version)

### Winning Conditions
- Eliminate all opponent pieces
- Block all opponent moves (no valid moves available)

## 🌐 Deployment Options

### Render.com (Recommended)
1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Deploy!

### Railway.app
1. Connect your repository to Railway
2. Railway auto-detects Node.js projects
3. Deploy with one click

### Glitch.com
1. Import from GitHub on Glitch
2. The project runs automatically
3. Share your Glitch URL

### Local Network Play
To play on your local network:
1. Find your local IP address
2. Start the server: `npm start`
3. Share `http://YOUR_IP:3001` with other players

## 🎨 Theme & Visual Design

### Color Palette
- **Gold**: `#d4af37` - Primary accent color
- **Dark Gold**: `#b8860b` - Secondary accent
- **Stone**: `#8b7355` / `#6b5b47` - Light board squares
- **Dark Stone**: `#4a3728` / `#2c1810` - Dark board squares
- **Background**: Gradient from `#2c1810` to `#0f0704`

### Typography
- **Headers**: 'Koulen' (Google Fonts) - Khmer-inspired display font
- **Body**: 'Preahvihear' (Google Fonts) - Readable Khmer-style font

### Visual Effects
- Glowing pieces with radial gradients
- Animated particles in the background
- Smooth transitions and hover effects
- Golden shimmer effects on victory modal
- Pulsing turn indicators

## 🔧 Technical Details

### Backend (server.js)
- **Express.js**: Serves static files and handles HTTP requests
- **Socket.io**: Real-time bidirectional communication
- **Room Management**: In-memory storage for game rooms and state
- **Game Logic**: Move validation, capture detection, win conditions

### Frontend (script.js)
- **Vanilla JavaScript**: No frameworks, pure JS for maximum compatibility
- **Socket.io Client**: Real-time communication with server
- **DOM Manipulation**: Dynamic board creation and piece movement
- **Event Handling**: Click events for piece selection and movement

### Key Socket Events
- `joinRoom` - Player joins a game room
- `startGame` - Game begins with both players
- `makeMove` - Player makes a move
- `updateBoard` - Board state synchronization
- `gameOver` - Game ends with winner announcement
- `playerChoice` - Play again or exit decision
- `restartGame` - New game starts
- `endSession` - Return to main menu

## 🎵 Audio (Optional)

The game includes a placeholder for background music:
- Add `bg-music.mp3` to the `public/assets/` folder
- Uncomment the music play line in `script.js`
- Consider Cambodian traditional music or ambient temple sounds

## 📱 Mobile Support

The game is fully responsive and includes:
- Touch-friendly piece selection
- Optimized board size for mobile screens
- Responsive typography and spacing
- Mobile-first CSS design approach

## 🐛 Troubleshooting

### Common Issues

**Game won't start**
- Ensure both players have joined the room
- Check browser console for errors
- Verify server is running on correct port

**Pieces won't move**
- Make sure it's your turn (check turn indicator)
- Verify you're selecting your own pieces
- Ensure the move follows checkers rules

**Connection issues**
- Check your internet connection
- Try refreshing the page
- Verify server is accessible

### Browser Compatibility
- Chrome/Chromium: Full support
- Firefox: Full support
- Safari: Full support
- Edge: Full support
- Mobile browsers: Full support

## 🤝 Contributing

Feel free to contribute to this project:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the package.json file for details.

## 🙏 Acknowledgments

- Inspired by the magnificent temples of Angkor Wat and Bayon
- Khmer typography from Google Fonts
- Socket.io for real-time multiplayer functionality
- The ancient game of Checkers/Draughts

---

**May the wisdom of the ancient temples guide your strategy! 🏯**