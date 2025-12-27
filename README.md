# Glimpse - Random Video Chat Application

A modern, peer-to-peer video chat platform that connects strangers worldwide through instant WebRTC video calls. Glimpse offers seamless random matching, real-time video/audio streaming, and text chat capabilities with a minimalistic glassmorphic design.

**Live Demo:** [https://glimpse-vc.netlify.app/](https://glimpse-vc.netlify.app/)

**Developer Portfolio:** [https://aryansrao.github.io](https://aryansrao.github.io)

**Terms and conditions** [https://glimpse-vc.netlify.app/terms.html](https://glimpse-vc.netlify.app/terms.html)


---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
  - [Application Architecture](#application-architecture)
  - [Lobby System](#lobby-system)
  - [WebRTC Connection Flow](#webrtc-connection-flow)
  - [Data Channel Communication](#data-channel-communication)
- [User Interface](#user-interface)
- [Configuration](#configuration)
- [Technical Reference](#technical-reference)
- [Browser Compatibility](#browser-compatibility)
- [Usage Guide](#usage-guide)
- [Contributing](#contributing)
- [Acknowledgments](#acknowledgments)

---

## Overview

Glimpse is a real-time video chat application that connects strangers through peer-to-peer WebRTC connections. Built with modern web technologies and PeerJS signaling, the application provides instant video/audio streaming with text chat capabilities.

The platform operates entirely through browser-based peer-to-peer connections. No video, audio, or text data passes through any server—all communications happen directly between users. The lobby-based matching system ensures quick connections while maintaining simplicity.

**Core Principles:**
- Peer-to-peer architecture
- No user accounts required
- Instant connections
- Browser-based functionality
- Modern, accessible design

---

## Features

### Core Functionality

- **Instant Random Matching**: Automatic pairing with strangers worldwide through intelligent lobby system
- **WebRTC Video Streaming**: High-quality peer-to-peer video with adaptive bitrate
- **Real-Time Audio**: Audio streaming with echo cancellation
- **Real-Time Text Chat**: Peer-to-peer messaging via WebRTC data channels
- **Next Button**: Skip to next stranger instantly with one click
- **Video Controls**: Toggle camera on/off during conversation
- **Audio Controls**: Mute/unmute microphone as needed

### User Controls

- **Start/Stop**: Begin or end chat sessions
- **Next Person**: Disconnect and find new stranger
- **Video Toggle**: Enable/disable camera feed
- **Audio Toggle**: Mute/unmute microphone
- **Chat Panel**: Slide-in text chat interface
- **Connection Status**: Real-time status indicators

### Chat Features

- **Slide-In Panel**: Non-intrusive chat interface from right side
- **Real-Time Messaging**: Instant message delivery through WebRTC
- **Message Bubbles**: Clean sent/received message distinction
- **Auto-Scroll**: Automatic scroll to newest messages
- **Enter to Send**: Quick message sending with Enter key

### Design Features

- **Glassmorphic UI**: Modern frosted glass effects with backdrop blur
- **Pure Black Theme**: OLED-friendly true black background
- **Geist Font**: Clean, professional typography from Google Fonts
- **Smooth Animations**: Fluid transitions and interactive feedback
- **Responsive Layout**: Optimized for desktop, tablet, and mobile
- **Floating Controls**: Pill-shaped control bar with blur effects
- **Status Indicators**: Real-time connection status with animated dots

### Technical Features

- **Peer-to-Peer**: Direct browser-to-browser connections via WebRTC
- **STUN Servers**: Google STUN servers for NAT traversal
- **Lobby Slots**: Fixed 20-slot system for efficient matching
- **Connection Retry**: Automatic reconnection on failures
- **Browser-Based**: No apps or downloads required
- **Single Page Application**: Complete functionality in one HTML file

---

## Technology Stack

### Frontend

- **HTML5**: Semantic markup with modern structure
- **CSS3**: Custom properties, Flexbox, Grid, animations
- **Vanilla JavaScript**: Pure ES6+ with async/await patterns

### WebRTC & Networking

- **PeerJS v1.5.2**: WebRTC wrapper for simplified peer connections
  - Automatic signaling via PeerJS cloud server
  - Connection management and error handling
  - Data channel abstraction

- **WebRTC**: Core peer-to-peer communication
  - getUserMedia for camera/microphone access
  - RTCPeerConnection for media streaming
  - RTCDataChannel for text messaging

- **STUN Servers**: NAT traversal with Google STUN
  - stun.l.google.com:19302
  - stun1.l.google.com:19302
  - stun2.l.google.com:19302
  - stun3.l.google.com:19302

### Fonts & Assets

- **Geist Font Family**: Modern sans-serif from Google Fonts
  - Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
  - Optimized with preconnect for performance
  - Letter spacing: -0.03em for modern look

---

## Project Structure

```
Glimpse/
│
├── index.html              # Complete application
│   ├── SEO meta tags (comprehensive)
│   ├── Open Graph & Twitter cards
│   ├── JSON-LD structured data
│   ├── Start screen with creator credit
│   ├── Video grid (local + remote)
│   ├── Slide-in chat panel
│   ├── Floating control buttons
│   └── Status indicators
│
├── Embedded Styles          # Internal CSS
│   ├── CSS custom properties
│   ├── Glassmorphic effects
│   ├── Grid layouts
│   ├── Component styles
│   ├── Animations
│   ├── Responsive breakpoints
│   └── Mobile optimizations
│
├── Embedded Scripts         # Internal JavaScript
│   ├── PeerJS initialization
│   ├── WebRTC connection logic
│   ├── Lobby slot management
│   ├── Video/audio controls
│   ├── Chat functionality
│   ├── Event handlers
│   └── State management
│
└── External Dependencies
    ├── PeerJS v1.5.2 (CDN)
    └── Geist font (Google Fonts)
```

---

## How It Works

### Application Architecture

Glimpse uses a lobby-based peer-to-peer architecture with PeerJS as the signaling layer:

#### Initialization Flow

1. **Page Load**: Browser loads single HTML file with embedded styles/scripts
2. **Camera Access**: Request getUserMedia permissions for video/audio
3. **PeerJS Setup**: Initialize peer with unique lobby slot ID
4. **Lobby Entry**: Occupy one of 20 fixed lobby slots
5. **Matching Loop**: Cycle through other slots attempting connections
6. **Connection**: First successful handshake establishes call
7. **Data Channel**: Open RTCDataChannel for text chat
8. **Ready State**: Video/audio streams and chat functional

#### State Machine

```
┌─────────────┐
│   Idle      │ ──Start──>  ┌──────────────┐
└─────────────┘             │  Initializing│
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │  Searching   │ <──┐
                            └──────┬───────┘    │
                                   │            │
                            ┌──────▼───────┐    │
                            │  Connected   │    │ Next
                            └──────┬───────┘    │
                                   │            │
                            ┌──────▼───────┐    │
                            │ Disconnected │ ───┘
                            └──────────────┘
```

### Lobby System

**Fixed Slot Architecture:**

- **20 Lobby Slots**: `glimpse-0` through `glimpse-19`
- **Random Assignment**: Each user occupies one random slot
- **Sequential Search**: Cycle through all other slots (1 per second)
- **Collision Handling**: If slot taken, try next slot (modulo wraparound)

**Connection Process:**

```javascript
// User A occupies slot 5
myPeerId = "glimpse-5"

// User A searches slots: 0,1,2,3,4,6,7,8,9...19,0,1... (skip 5)
// User B occupies slot 12
// When User A tries slot 12, connection initiates

// User A calls User B
peer.call("glimpse-12", localStream)

// User B answers
call.answer(localStream)

// Connection established with bidirectional video/audio
```

**Advantages:**

- Simple and predictable
- No external database required
- Quick matching (maximum 20 seconds)
- No race conditions with proper state management

### WebRTC Connection Flow

**Detailed Connection Steps:**

1. **Peer A (Caller)**:
   ```javascript
   const call = peer.call("glimpse-12", localStream)
   // Sends offer SDP through PeerJS signaling
   ```

2. **PeerJS Signaling**:
   - Peer A → PeerJS Server → Peer B (offer)
   - Peer B → PeerJS Server → Peer A (answer)

3. **ICE Candidates Exchange**:
   - Both peers gather ICE candidates
   - Exchange via PeerJS signaling
   - Establish connection through NAT/firewall

4. **STUN Server Role**:
   - Discover public IP addresses
   - Determine NAT type
   - Enable direct peer connection

5. **Media Stream**:
   ```javascript
   call.on('stream', (remoteStream) => {
       remoteVideo.srcObject = remoteStream
       // Video/audio now flowing peer-to-peer
   })
   ```

6. **Data Channel** (for chat):
   ```javascript
   const conn = peer.connect("glimpse-12")
   conn.on('open', () => {
       conn.send("Hello!") // Text message
   })
   ```

**Connection Types:**

- **Video/Audio**: RTCPeerConnection media streams
- **Text Chat**: RTCDataChannel (reliable, ordered)

### Data Channel Communication

**Chat Implementation:**

```javascript
// Sender
dataConnection.send("Hello stranger!")

// Receiver
dataConnection.on('data', (message) => {
    addMessage(message, 'received')
})
```

**Message Flow:**

1. User types message and hits Send/Enter
2. Message sent via RTCDataChannel (peer-to-peer)
3. Receiver gets 'data' event instantly
4. Message rendered in chat panel

**Reliability:**

- Ordered delivery (SCTP protocol)
- Automatic retransmission
- Binary or text data support

---

## User Interface

### Main Components

#### 1. Start Screen
- Large gradient title "Glimpse"
- Tagline: "Connect with strangers worldwide"
- Primary CTA button
- Creator credit with link to portfolio
- Fade-in animation

#### 2. Video Grid
- **Desktop**: 2-column side-by-side (You | Stranger)
- **Mobile**: 2-row vertical stack (You / Stranger)
- `object-fit: contain` for proper aspect ratio
- Black background for letterboxing
- Video labels in bottom-left corner

#### 3. Header Bar
- Floating at top with semi-transparent background
- Logo: "Glimpse" (left)
- Status indicator: dot + text (right)
  - Gray dot + "Searching" (disconnected)
  - Green dot + "Connected" (active call)

#### 4. Chat Panel
- Slides in from right side (desktop and mobile)
- Header with title and close button
- Scrollable message area
- Sent messages (right, blue-tinted bubbles)
- Received messages (left, white-tinted bubbles)
- Input field + Send button at bottom

#### 5. Control Bar
- Pill-shaped floating container at bottom center
- Glassmorphic background with blur
- 5 buttons in row:
  - Video toggle (camera icon)
  - Audio toggle (mic icon)
  - Chat toggle (message icon)
  - Next person (arrow icon, blue accent)
  - End call (X icon, red accent)

### Color Palette

```css
/* Primary Colors */
--primary-bg: #000000           /* Pure black background */
--glass-bg: rgba(0,0,0,0.6)     /* Glassmorphic overlay */
--glass-border: rgba(255,255,255,0.1)  /* Subtle borders */

/* Text Colors */
--text-primary: #ffffff         /* Main text */
--text-secondary: #6b7280       /* Muted text */

/* Accent Colors */
--accent-blue: #3b82f6          /* Primary actions */
--accent-green: #10b981         /* Success/connected */
--accent-red: #ef4444           /* Danger/end call */

/* Status Colors */
--status-searching: #6b7280     /* Gray for searching */
--status-connected: #10b981     /* Green for connected */
```

### Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Desktop | 1024px+ | 2-column video, chat 380px width |
| Tablet | 769-1023px | 2-column video, chat 90% width |
| Mobile | ≤768px | Vertical video stack, chat 90% width |
| Small Mobile | ≤480px | Reduced text sizes, compact controls |

**Mobile Optimizations:**

- Header padding reduced (16px vs 24px)
- Control buttons: 48px on mobile (vs 52px)
- Video grid switches to vertical
- Chat panel full-width overlay
- Font sizes scale down
- Touch-friendly targets (44px minimum)

### Animations and Transitions

**Glassmorphism:**
```css
backdrop-filter: blur(20px);
background: rgba(0,0,0,0.6);
border: 1px solid rgba(255,255,255,0.1);
```

**Status Dot Pulse:**
```css
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
```

**Chat Panel Slide:**
```css
transform: translateX(100%);  /* Hidden */
transform: translateX(0);     /* Visible */
transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

**Button Hover:**
```css
.control-btn:hover {
    background: rgba(255,255,255,0.1);
    transform: translateY(-2px);
}
```

---

## Configuration

### Changing Lobby Slots

Modify the number of lobby slots in the JavaScript section:

```javascript
const LOBBY_SLOTS = 20;  // Default: 20 slots
// More slots = longer search time
// Fewer slots = higher collision chance
// Recommended: 10-30 slots
```

### Customizing Lobby Prefix

Change the lobby ID prefix:

```javascript
const LOBBY_PREFIX = 'glimpse-';  // Default prefix
// Example alternatives:
// 'mychat-'
// 'random-'
// 'vc-'
```

### Adjusting Search Interval

Change how often the app tries new slots:

```javascript
searchInterval = setInterval(() => {
    // Connection attempts
}, 1000);  // Default: 1000ms (1 second)
// Lower = faster matching but more load
// Higher = slower matching but more efficient
```

### Adding More STUN Servers

Enhance NAT traversal with additional STUN servers:

```javascript
peer = new Peer(peerId, {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            // Add more STUN servers
            { urls: 'stun:stun.stunprotocol.org:3478' },
            { urls: 'stun:stun.voip.eutelia.it:3478' }
        ]
    }
});
```

### Video Quality Settings

Adjust video constraints:

```javascript
localStream = await navigator.mediaDevices.getUserMedia({
    video: { 
        width: 1280,    // Default: 1280
        height: 720     // Default: 720
        // Options: 
        // { width: 1920, height: 1080 }  // Full HD
        // { width: 640, height: 480 }    // Lower quality
        // { width: { ideal: 1280 }, height: { ideal: 720 } }  // Flexible
    },
    audio: true
});
```

### Customizing Colors

Edit CSS custom properties:

```css
:root {
    --primary-bg: #000000;
    --accent-blue: #3b82f6;
    --accent-green: #10b981;
    --accent-red: #ef4444;
    --glass-bg: rgba(0,0,0,0.6);
    --glass-border: rgba(255,255,255,0.1);
}
```

### Chat Panel Width

Change chat panel dimensions:

```css
.chat-panel {
    width: 380px;  /* Desktop default */
}

@media (max-width: 768px) {
    .chat-panel {
        width: 90%;  /* Mobile default */
        max-width: 360px;
    }
}
```

---

## Technical Reference

### Core Functions

#### `startChat()`

Initializes camera/microphone and starts the matching process.

```javascript
async startChat() {
    // Request media permissions
    localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
    });
    
    // Display local video
    document.getElementById('localVideo').srcObject = localStream;
    
    // Initialize peer and start searching
    initializePeer();
}
```

#### `initializePeer()`

Creates PeerJS instance with lobby slot ID and sets up event handlers.

```javascript
function initializePeer() {
    const peerId = LOBBY_PREFIX + myLobbySlot;
    peer = new Peer(peerId, { config: { iceServers: [...] } });
    
    peer.on('open', (id) => { startSearching(); });
    peer.on('call', (call) => { handleIncomingCall(call); });
    peer.on('connection', (conn) => { setupDataConnection(conn); });
    peer.on('error', (error) => { handlePeerError(error); });
}
```

#### `startSearching()`

Cycles through lobby slots attempting connections.

```javascript
function startSearching() {
    searchInterval = setInterval(() => {
        const slotToTry = currentSlotIndex % LOBBY_SLOTS;
        if (slotToTry !== myLobbySlot) {
            const call = peer.call(LOBBY_PREFIX + slotToTry, localStream);
            // Handle stream reception
        }
        currentSlotIndex++;
    }, 1000);
}
```

#### `handleIncomingCall(call)`

Processes incoming call and establishes connection.

```javascript
function handleIncomingCall(call) {
    call.answer(localStream);  // Answer with our stream
    call.on('stream', (remoteStream) => {
        displayRemoteStream(remoteStream);
    });
}
```

#### `setupDataConnection(conn)`

Establishes text chat data channel.

```javascript
function setupDataConnection(conn) {
    dataConnection = conn;
    conn.on('open', () => { console.log('Chat ready'); });
    conn.on('data', (message) => { addMessage(message, 'received'); });
}
```

#### `toggleVideo()` / `toggleAudio()`

Controls media track enable/disable state.

```javascript
function toggleVideo() {
    isVideoEnabled = !isVideoEnabled;
    localStream.getVideoTracks()[0].enabled = isVideoEnabled;
    // Update button icon
}
```

#### `nextPerson()`

Disconnects current call and resumes searching.

```javascript
function nextPerson() {
    handleDisconnect();  // Clean up current connection
    // startSearching() called automatically after cleanup
}
```

#### `sendMessage()`

Sends text message through data channel.

```javascript
function sendMessage() {
    const text = chatInput.value.trim();
    if (text && dataConnection && dataConnection.open) {
        dataConnection.send(text);
        addMessage(text, 'sent');
    }
}
```

### Event Handlers

| Event | Trigger | Handler |
|-------|---------|---------|
| `peer.on('open')` | Peer initialized | Start searching |
| `peer.on('call')` | Incoming call | Answer and establish stream |
| `peer.on('connection')` | Incoming data conn | Setup chat channel |
| `peer.on('error')` | Peer error | Retry or slot change |
| `call.on('stream')` | Remote stream | Display video |
| `call.on('close')` | Call ended | Disconnect and search |
| `conn.on('data')` | Chat message | Display message |

### State Variables

```javascript
let peer;              // PeerJS instance
let localStream;       // Local media stream
let currentCall;       // Active call object
let dataConnection;    // Chat data channel
let myLobbySlot;       // Current lobby slot (0-19)
let isConnected;       // Connection status
let isSearching;       // Searching status
let isVideoEnabled;    // Camera state
let isAudioEnabled;    // Mic state
```

---

## Browser Compatibility

### Minimum Requirements

| Browser | Version | getUserMedia | WebRTC | PeerJS | Notes |
|---------|---------|--------------|--------|--------|-------|
| Chrome | 87+ | Yes | Yes | Yes | Full support |
| Firefox | 78+ | Yes | Yes | Yes | Full support |
| Safari | 14.1+ | Yes | Yes | Yes | iOS 14.5+ |
| Edge | 87+ | Yes | Yes | Yes | Chromium-based |
| Opera | 73+ | Yes | Yes | Yes | Full support |

### Feature Support

| Feature | Requirement | Fallback |
|---------|-------------|----------|
| Camera/Mic | HTTPS or localhost | None (required) |
| WebRTC | Modern browser | None (required) |
| Data Channels | WebRTC support | Chat disabled |
| Geist Font | Internet connection | System sans-serif |

### HTTPS Requirement

**getUserMedia API requires HTTPS except:**
- `http://localhost`
- `http://127.0.0.1`
- `http://[::1]`

**Production deployments must use HTTPS for camera/microphone access.**

### Testing Compatibility

```javascript
// Check WebRTC support
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Your browser does not support camera access');
}

// Check RTCPeerConnection
if (!window.RTCPeerConnection) {
    alert('Your browser does not support WebRTC');
}
```

---

## Usage Guide

### Getting Started

1. **Open Application**:
   - Visit [https://glimpse-vc.netlify.app/](https://glimpse-vc.netlify.app/)
   - Click "Start Chatting" button

2. **Grant Permissions**:
   - Allow camera access when prompted
   - Allow microphone access when prompted
   - Denying permissions will prevent video chat functionality

3. **Wait for Match**:
   - Status shows "Searching"
   - Gray pulsing dot indicates searching
   - Usually connects within 5-20 seconds

4. **Start Chatting**:
   - Status changes to "Connected" (green dot)
   - Your video appears on left (or top on mobile)
   - Stranger's video appears on right (or bottom)
   - Chat button available in controls

### Controls Overview

**Video Toggle (Camera Icon)**:
- Click to disable your camera
- Icon changes to "camera off" when disabled
- Stranger can no longer see you
- Click again to re-enable

**Audio Toggle (Microphone Icon)**:
- Click to mute your microphone
- Icon changes to "mic off" when muted
- Stranger can no longer hear you
- Click again to unmute

**Chat Toggle (Message Icon)**:
- Opens slide-in chat panel from right
- Type message and press Enter or click Send
- Messages appear in real-time
- Click X or button again to close

**Next Person (Arrow Icon)**:
- Disconnect from current stranger
- Immediately search for new person
- Chat history cleared
- Enabled only when connected

**End Chat (X Icon)**:
- Completely stop video chat
- Return to start screen
- Camera and microphone released
- All connections closed

### Chat Features

**Sending Messages**:
1. Click chat button to open panel
2. Type message in input field
3. Press Enter or click Send
4. Message appears on right (blue bubble)

**Receiving Messages**:
- Messages appear on left (white bubble)
- Auto-scrolls to newest message
- Real-time delivery (instant)

### Troubleshooting

**"Camera/Microphone not accessible"**:
- Check browser permissions
- Ensure HTTPS connection
- Verify camera not in use by another app
- Try different browser

**"No one found" (long search time)**:
- Few users currently online
- Try again later
- Check internet connection
- Refresh page and retry

**"Connection lost"**:
- Network interruption
- Other user disconnected
- Click Next to find new person
- Check internet stability

**Video not showing**:
- Check camera permissions
- Ensure camera not blocked
- Try toggling video on/off
- Refresh page

**No audio**:
- Check microphone permissions
- Verify microphone not muted in OS
- Check browser audio settings
- Try toggling audio on/off

---


## Contributing

### How to Contribute

Contributions are welcome for technical improvements and bug fixes.

**Report Bugs**:
1. Check existing issues
2. Create new issue with:
   - Browser and OS details
   - Steps to reproduce
   - Expected vs actual behavior
   - Console errors or screenshots

**Suggest Features**:
1. Open issue with clear description
2. Explain use case and benefits
3. Consider technical feasibility

**Submit Pull Requests**:
1. Fork repository
2. Create feature branch: `git checkout -b feature/FeatureName`
3. Make changes following existing code style
4. Test across multiple browsers
5. Commit: `git commit -m 'Add FeatureName'`
6. Push: `git push origin feature/FeatureName`
7. Open Pull Request with detailed description

### Development Guidelines

**Code Style**:
- Use ES6+ JavaScript features
- Meaningful variable and function names
- Comment complex logic
- Follow existing formatting

**Testing Checklist**:
- Test on Chrome, Firefox, Safari
- Test on desktop and mobile devices
- Test video/audio functionality
- Test chat messaging
- Test all control buttons
- Verify responsive design
- Check console for errors

### Technical Improvement Areas

**Features**:
- Screen sharing capability
- Connection quality indicators
- Better mobile optimization
- Improved error handling

**Performance**:
- Connection optimization
- Reduced search time
- Better NAT traversal

**UI/UX**:
- Additional animations
- Accessibility improvements
- Theme customization options

---

## Acknowledgments

### Technologies Used

- **PeerJS** - Simplified WebRTC wrapper for peer-to-peer connections
- **WebRTC** - Real-time communication protocol for browser-to-browser media streaming
- **Google STUN Servers** - Network traversal for establishing peer connections
- **Google Fonts** - Geist font family for typography
- **Netlify** - Platform hosting and HTTPS deployment

### Developer

**Aryan S Rao**
- Portfolio: [https://aryansrao.github.io](https://aryansrao.github.io)
- GitHub: [@aryansrao](https://github.com/aryansrao)

---

## Contact

- **Portfolio**: [aryansrao.github.io](https://aryansrao.github.io)

---

**Glimpse - Connect face-to-face with the world.**