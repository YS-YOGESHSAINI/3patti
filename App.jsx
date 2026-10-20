import React, { useState, useEffect, useRef } from 'react';
import { Users, Play, Shield, RefreshCw, Volume2, VolumeX, Eye, EyeOff, Award, HelpCircle, MessageSquare, Send, Copy, Check, DollarSign } from 'lucide-react';

// Sound Synthesizer using Web Audio API
class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playChipsSound() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200 + i * 300, now + i * 0.04);
      gain.gain.setValueAtTime(0.15, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.04 + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.08);
    }
  }

  playCardFlip() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  playWinSound() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      gain.gain.setValueAtTime(0.2, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.25);
    });
  }
}

const soundManager = new SoundController();

// Card Constants
const SUITS = [
  { symbol: '♠', color: 'text-gray-900', name: 'Spades' },
  { symbol: '♥', color: 'text-red-600', name: 'Hearts' },
  { symbol: '♦', color: 'text-red-600', name: 'Diamonds' },
  { symbol: '♣', color: 'text-gray-900', name: 'Clubs' }
];

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Evaluates Teen Patti Hand Strengths
const evaluateHand = (cards) => {
  if (!cards || cards.length < 3) return { score: 0, rankName: 'Invalid' };
  
  const cardVals = cards.map(c => VALUES.indexOf(c.value) + 2).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit.symbol);

  const isTrio = cardVals[0] === cardVals[1] && cardVals[1] === cardVals[2];
  const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
  
  let isSequence = false;
  if (cardVals[0] - cardVals[1] === 1 && cardVals[1] - cardVals[2] === 1) {
    isSequence = true;
  }
  if (cardVals[0] === 14 && cardVals[1] === 3 && cardVals[2] === 2) {
    isSequence = true; 
  }

  const isPair = cardVals[0] === cardVals[1] || cardVals[1] === cardVals[2] || cardVals[0] === cardVals[2];
  let pairValue = 0;
  let kicker = 0;
  if (isPair && !isTrio) {
    if (cardVals[0] === cardVals[1]) { pairValue = cardVals[0]; kicker = cardVals[2]; }
    else if (cardVals[1] === cardVals[2]) { pairValue = cardVals[1]; kicker = cardVals[0]; }
    else { pairValue = cardVals[0]; kicker = cardVals[1]; }
  }

  if (isTrio) {
    return { score: 6000 + cardVals[0], rankName: 'Trio (Trail / Three of a Kind)' };
  }
  if (isSequence && isFlush) {
    return { score: 5000 + cardVals[0], rankName: 'Straight Flush (Pure Sequence)' };
  }
  if (isSequence) {
    return { score: 4000 + cardVals[0], rankName: 'Sequence (Straight)' };
  }
  if (isFlush) {
    return { score: 3000 + cardVals[0] * 100 + cardVals[1] * 10 + cardVals[2], rankName: 'Color (Flush)' };
  }
  if (isPair) {
    return { score: 2000 + pairValue * 10 + kicker, rankName: 'Pair (Double)' };
  }
  return { score: 1000 + cardVals[0] * 10 + cardVals[1] + cardVals[2] * 0.1, rankName: 'High Card' };
};

export default function App() {
  // Game Setup State
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [showRankGuide, setShowRankGuide] = useState(false);

  // Table State
  const [players, setPlayers] = useState([]);
  const [pot, setPot] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [currentBet, setCurrentBet] = useState(10);
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Initial Deck Generation
  const createDeck = () => {
    const deck = [];
    SUITS.forEach(suit => {
      VALUES.forEach(value => {
        deck.push({ suit, value });
      });
    });
    return deck.sort(() => Math.random() - 0.5);
  };

  // Local Player Join Logic
  const handleJoinOrCreateRoom = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const code = roomCode.trim().toUpperCase() || Math.random().toString(36).substring(2, 7).toUpperCase();
    setJoinedRoom(code);

    const initialPlayers = [
      { id: 'p1', name: playerName, chips: 1000, cards: [], isBlind: true, folded: false, isSeen: false },
      { id: 'p2', name: 'Bot Rahul', chips: 1000, cards: [], isBlind: true, folded: false, isSeen: false },
      { id: 'p3', name: 'Bot Priya', chips: 1000, cards: [], isBlind: true, folded: false, isSeen: false }
    ];

    setPlayers(initialPlayers);
  };

  const startNewGame = () => {
    const deck = createDeck();
    const bootAmount = 10;
    
    soundManager.playChipsSound();
    soundManager.playCardFlip();

    const updatedPlayers = players.map((player, idx) => {
      const playerCards = [deck.pop(), deck.pop(), deck.pop()];
      return {
        ...player,
        chips: player.chips - bootAmount,
        cards: playerCards,
        isBlind: true,
        isSeen: false,
        folded: false
      };
    });

    setPlayers(updatedPlayers);
    setPot(bootAmount * updatedPlayers.length);
    setCurrentBet(bootAmount);
    setCurrentTurn(0);
    setGameStarted(true);
    setWinner(null);
    setChatMessages(prev => [...prev, { sender: 'System', text: 'New Game Started! Boot value: ₹10' }]);
  };

  const handleSeeCards = (playerIdx) => {
    soundManager.playCardFlip();
    setPlayers(prev => prev.map((p, idx) => idx === playerIdx ? { ...p, isSeen: true, isBlind: false } : p));
  };

  const handleChaal = (playerIdx) => {
    soundManager.playChipsSound();
    const player = players[playerIdx];
    const amount = player.isBlind ? currentBet : currentBet * 2;

    if (player.chips < amount) {
      alert("Not enough chips!");
      return;
    }

    setPlayers(prev => prev.map((p, idx) => idx === playerIdx ? { ...p, chips: p.chips - amount } : p));
    setPot(prev => prev + amount);

    nextTurn();
  };

  const handleFold = (playerIdx) => {
    const updatedPlayers = players.map((p, idx) => idx === playerIdx ? { ...p, folded: true } : p);
    setPlayers(updatedPlayers);

    const activePlayers = updatedPlayers.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      declareWinner(activePlayers[0]);
    } else {
      nextTurn();
    }
  };

  const handleShow = () => {
    soundManager.playWinSound();
    const activePlayers = players.filter(p => !p.folded);
    
    let bestPlayer = activePlayers[0];
    let bestHand = evaluateHand(activePlayers[0].cards);

    activePlayers.forEach(p => {
      const hand = evaluateHand(p.cards);
      if (hand.score > bestHand.score) {
        bestHand = hand;
        bestPlayer = p;
      }
    });

    declareWinner(bestPlayer, bestHand.rankName);
  };

  const declareWinner = (winningPlayer, handRankName = '') => {
    setWinner({ ...winningPlayer, rankName: handRankName });
    setPlayers(prev => prev.map(p => p.id === winningPlayer.id ? { ...p, chips: p.chips + pot, isSeen: true } : { ...p, isSeen: true }));
    setGameStarted(false);
    soundManager.playWinSound();
  };

  const nextTurn = () => {
    let nextIdx = (currentTurn + 1) % players.length;
    while (players[nextIdx].folded) {
      nextIdx = (nextIdx + 1) % players.length;
    }
    setCurrentTurn(nextIdx);

    // Simulated Auto-play for Bot Turns
    if (players[nextIdx].id.startsWith('p2') || players[nextIdx].id.startsWith('p3')) {
      setTimeout(() => {
        if (Math.random() > 0.3) {
          handleChaal(nextIdx);
        } else {
          handleFold(nextIdx);
        }
      }, 1500);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { sender: playerName, text: chatInput }]);
    setChatInput('');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(joinedRoom);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950 text-white flex flex-col font-sans select-none">
      
      {/* Top Navigation */}
      <header className="px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-emerald-500/20 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-amber-500/20 text-xl">
            3P
          </div>
          <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
            TEEN PATTI ROYALE
          </span>
        </div>

        {joinedRoom && (
          <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-400 font-medium uppercase">Room Code:</span>
            <span className="font-mono font-bold text-amber-400">{joinedRoom}</span>
            <button onClick={copyRoomCode} className="hover:text-amber-400 transition">
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowRankGuide(!showRankGuide)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 transition"
            title="Hand Rankings"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button 
            onClick={() => {
              const muted = !soundMuted;
              setSoundMuted(muted);
              soundManager.muted = muted;
            }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
          >
            {soundMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col md:flex-row p-4 gap-4 max-w-7xl mx-auto w-full">
        
        {/* Lobby View */}
        {!joinedRoom ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/20 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
              <div className="text-center mb-8">
                <div className="inline-flex p-4 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
                  <Award className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white">Join Poker Table</h2>
                <p className="text-sm text-slate-400 mt-1">Enter your nickname and start playing real-time online Teen Patti.</p>
              </div>

              <form onSubmit={handleJoinOrCreateRoom} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">Your Display Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Raj"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2 block">Room Code (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="Leave blank to create new"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition font-mono uppercase"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" /> Play Now
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Game Table View */
          <div className="flex-1 flex flex-col items-center justify-between relative min-h-[600px] bg-emerald-900/40 rounded-3xl border-8 border-emerald-950/80 shadow-2xl overflow-hidden p-6">
            
            {/* Table Felt Glow & Pot Display */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-800/40 via-transparent to-transparent pointer-events-none" />

            {/* Pot Counter */}
            <div className="z-10 bg-slate-950/80 border border-amber-500/40 backdrop-blur-md rounded-2xl px-6 py-3 text-center shadow-xl">
              <span className="text-xs text-amber-400/80 uppercase font-bold tracking-widest block">Total Pot</span>
              <span className="text-3xl font-black text-amber-400 font-mono flex items-center justify-center gap-1">
                <DollarSign className="w-6 h-6 stroke-[3]" />{pot}
              </span>
            </div>

            {/* Top Players (Opponents) */}
            <div className="w-full flex justify-around z-10">
              {players.slice(1).map((p, idx) => (
                <div key={p.id} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border ${currentTurn === idx + 1 ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-slate-900/80 border-slate-800'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs">
                      {p.name[0]}
                    </div>
                    <span className="font-semibold text-sm">{p.name}</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">₹{p.chips}</span>

                  {/* Card Backs or Cards */}
                  <div className="flex gap-1">
                    {p.cards.length > 0 ? (
                      p.cards.map((c, cIdx) => (
                        <div key={cIdx} className="w-10 h-14 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center font-bold shadow-md">
                          {p.isSeen ? `${c.value}${c.suit.symbol}` : '🂠'}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 italic">Waiting...</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Winner Overlay */}
            {winner && (
              <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/40">
                  <Award className="w-10 h-10" />
                </div>
                <h3 className="text-3xl font-black text-amber-400 mb-1">{winner.name} Wins!</h3>
                <p className="text-slate-300 font-medium mb-6">{winner.rankName || 'Opponents Folded'}</p>
                <button 
                  onClick={startNewGame}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 py-3 rounded-xl shadow-lg transition"
                >
                  Start Next Round
                </button>
              </div>
            )}

            {/* Bottom Player (User) */}
            <div className="z-10 flex flex-col items-center gap-4 w-full max-w-lg">
              {players[0] && (
                <div className={`w-full p-4 rounded-2xl border flex flex-col items-center gap-3 backdrop-blur-md ${currentTurn === 0 ? 'bg-amber-500/20 border-amber-500 shadow-xl shadow-amber-500/20' : 'bg-slate-900/90 border-slate-800'}`}>
                  <div className="flex justify-between w-full items-center">
                    <span className="font-bold text-lg text-amber-400">{players[0].name} (You)</span>
                    <span className="font-mono text-emerald-400 font-bold text-lg">Chips: ₹{players[0].chips}</span>
                  </div>

                  {/* Cards Display */}
                  <div className="flex gap-3 my-2">
                    {players[0].cards.length > 0 ? (
                      players[0].cards.map((c, cIdx) => (
                        <div key={cIdx} className={`w-16 h-24 bg-white rounded-xl shadow-xl flex flex-col justify-between p-2 border ${c.suit.color}`}>
                          <span className="font-bold text-lg leading-none">{players[0].isSeen ? c.value : '?'}</span>
                          <span className="text-2xl self-center">{players[0].isSeen ? c.suit.symbol : '🂠'}</span>
                          <span className="font-bold text-lg leading-none self-end rotate-180">{players[0].isSeen ? c.value : '?'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 text-sm py-8">Click "Start Game" to deal cards</div>
                    )}
                  </div>

                  {/* Player Controls */}
                  {gameStarted ? (
                    <div className="flex gap-3 w-full">
                      {!players[0].isSeen && (
                        <button 
                          onClick={() => handleSeeCards(0)}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold py-2.5 rounded-xl border border-amber-500/30 flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" /> See Cards
                        </button>
                      )}
                      <button 
                        onClick={() => handleChaal(0)}
                        disabled={currentTurn !== 0}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-lg transition"
                      >
                        Chaal (₹{players[0].isBlind ? currentBet : currentBet * 2})
                      </button>
                      <button 
                        onClick={() => handleFold(0)}
                        disabled={currentTurn !== 0}
                        className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-lg transition"
                      >
                        Pack (Fold)
                      </button>
                      <button 
                        onClick={handleShow}
                        disabled={currentTurn !== 0}
                        className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl shadow-lg transition"
                      >
                        Show
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={startNewGame}
                      className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl shadow-lg transition"
                    >
                      Deal Cards & Start
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Live Chat Panel */}
        {joinedRoom && (
          <aside className="w-full md:w-80 bg-slate-900/80 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between h-[600px]">
            <div>
              <h3 className="font-bold text-slate-300 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" /> Table Chat
              </h3>
              <div className="space-y-2 overflow-y-auto max-h-[460px] pr-2">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                    <span className="text-xs font-bold text-amber-400 block">{msg.sender}</span>
                    <span className="text-sm text-slate-200">{msg.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
              <input 
                type="text" 
                placeholder="Type emoji or msg..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
              <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 p-2 rounded-xl">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        )}

      </main>

      {/* Hand Rankings Modal */}
      {showRankGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-amber-400 mb-4">Teen Patti Hand Rankings</h3>
            <ol className="space-y-3 text-sm text-slate-300">
              <li className="bg-slate-950 p-3 rounded-xl border border-slate-850"><strong className="text-white">1. Trio / Trail:</strong> 3 cards of same rank (A-A-A highest).</li>
              <li className="bg-slate-950 p-3 rounded-xl border border-slate-850"><strong className="text-white">2. Pure Sequence:</strong> 3 consecutive cards of same suit (A-2-3 or A-K-Q).</li>
              <li className="bg-slate-950 p-3 rounded-xl border border-slate-850"><strong className="text-white">3. Sequence (Run):</strong> 3 consecutive cards of mixed suits.</li>
              <li className="bg-slate-950 p-3 rounded-xl border border-slate-850"><strong className="text-white">4. Color (Flush):</strong> 3 cards of same suit, not in sequence.</li>
              <li className="bg-slate-950 p-3 rounded-xl border border-slate-850"><strong className="text-white">5. Pair:</strong> 2 cards of same rank.</li>
              <li className="bg-slate-950 p-3 rounded-xl border border-slate-850"><strong className="text-white">6. High Card:</strong> Highest card wins if no combination.</li>
            </ol>
            <button 
              onClick={() => setShowRankGuide(false)}
              className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
