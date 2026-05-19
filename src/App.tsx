import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Lightbulb, 
  Calendar, 
  Layout, 
  ChevronRight,
  Medal,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  User as UserIcon,
  Home
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  setDoc, 
  doc, 
  getDoc,
  updateDoc,
  increment,
  onSnapshot
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { UserProfile, ScoreEntry, Difficulty, getRankFromXp, SudokuPuzzle, RANKS } from './types';
import { format } from 'date-fns';

// --- Utility Components ---
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const base = "px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:active:scale-100";
  const variants: any = {
    primary: "bg-pistachio-600 text-white hover:bg-pistachio-700 shadow-lg shadow-pistachio-200",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    outline: "border-2 border-slate-200 text-slate-600 hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    accent: "bg-pistachio-400 text-pistachio-900 hover:bg-pistachio-500 shadow-lg shadow-pistachio-100"
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white rounded-2xl shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

// --- Game Components ---
const SudokuGrid = ({ grid, original, selected, onSelect, notes, solution }: any) => {
  // 9x9 grid rendering
  const isRelated = (row: number, col: number) => {
    if (!selected) return false;
    return selected.row === row || selected.col === col || 
           (Math.floor(selected.row / 3) === Math.floor(row / 3) && 
            Math.floor(selected.col / 3) === Math.floor(col / 3));
  };

  return (
    <div className="aspect-square w-full max-w-md mx-auto grid grid-cols-9 border-2 border-slate-800 bg-slate-800 gap-[1px] p-[1px] rounded-lg overflow-hidden relative">
      {grid.map((row: any, rIdx: number) => (
        row.map((val: any, cIdx: number) => {
          const isSelected = selected?.row === rIdx && selected?.col === cIdx;
          const isSameValue = val && selected && grid[selected.row][selected.col] === val;
          const isOriginal = original[rIdx][cIdx] !== null;
          const isRelatedCell = isRelated(rIdx, cIdx);
          const isError = val !== null && val !== solution[rIdx][cIdx];

          const borderB = (rIdx + 1) % 3 === 0 && rIdx !== 8 ? 'border-b-2 border-slate-800' : '';
          const borderR = (cIdx + 1) % 3 === 0 && cIdx !== 8 ? 'border-r-2 border-slate-800' : '';

          return (
            <motion.div
              key={`${rIdx}-${cIdx}`}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(rIdx, cIdx)}
              className={`
                relative flex items-center justify-center text-xl font-medium cursor-pointer transition-colors
                ${isOriginal ? 'text-slate-900 font-bold' : 'text-pistachio-600'}
                ${isSelected ? 'bg-pistachio-500 !text-white z-10' : 
                  isSameValue ? 'bg-pistachio-100' :
                  isRelatedCell ? 'bg-pistachio-50' : 'bg-white'}
                ${borderB} ${borderR}
                ${!isOriginal && isError ? 'text-red-500 bg-red-50' : ''}
              `}
              id={`cell-${rIdx}-${cIdx}`}
            >
              <AnimatePresence mode="popLayout">
                {val !== null ? (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    key={val}
                  >
                    {val}
                  </motion.span>
                ) : (
                  <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-0.5">
                    {notes[rIdx][cIdx].map((n: number) => (
                      <span key={n} className="text-[8px] text-slate-400 flex items-center justify-center leading-none">
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })
      ))}
    </div>
  );
};

const Keypad = ({ onNumber, onErase, onNote, isNoteMode }: any) => {
  return (
    <div className="grid grid-cols-5 gap-2 w-full max-w-md mx-auto mt-6">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
        <Button key={num} variant="secondary" onClick={() => onNumber(num)} className="h-12 text-lg">
          {num}
        </Button>
      ))}
      <Button variant="danger" onClick={onErase} className="h-12 border-none">
        <RotateCcw className="w-5 h-5" />
      </Button>
      <Button 
        variant={isNoteMode ? 'accent' : 'outline'} 
        onClick={onNote} 
        className="h-12 col-span-2"
      >
        <Lightbulb className="w-5 h-5" />
        Note {isNoteMode ? 'ON' : 'OFF'}
      </Button>
    </div>
  );
};

// --- Views ---
const LandingView = ({ user, onLogin, onStartGame, onDaily, onLeaderboard, onProfile }: any) => (
  <div className="max-w-2xl mx-auto py-12 px-4 text-center">
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="space-y-6"
    >
      <div className="w-24 h-24 bg-pistachio-400 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-pistachio-100 transform rotate-12">
        <Layout className="w-12 h-12 text-pistachio-900" />
      </div>
      <h1 className="text-5xl font-black text-slate-900 tracking-tight">
        SudokuDaily
      </h1>
      <p className="text-slate-500 text-lg max-w-md mx-auto">
        Train your brain with daily challenges and level-based puzzles in a minimalist 
        environment.
      </p>

      {!user ? (
        <div className="pt-8">
          <Button onClick={onLogin} variant="accent" className="mx-auto text-lg px-8 py-4 rounded-2xl">
            <UserIcon className="w-5 h-5" />
            Sign in with Google
          </Button>
        </div>
      ) : (
        <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6 text-left flex flex-col justify-between hover:border-pistachio-300 transition-colors cursor-pointer group" onClick={onDaily}>
            <div>
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-4 text-orange-600">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Daily Challenge</h3>
              <p className="text-slate-500 text-sm mt-1">Same puzzle for everyone, every day. Earn double XP.</p>
            </div>
            <div className="mt-6 flex items-center text-pistachio-600 font-bold group-hover:translate-x-1 transition-transform">
              Play Now <ChevronRight className="w-4 h-4" />
            </div>
          </Card>

          <Card className="p-6 text-left flex flex-col justify-between hover:border-pistachio-200 transition-colors cursor-pointer group" onClick={() => onStartGame('medium')}>
            <div>
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 text-emerald-600">
                <Medal className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Practice Mode</h3>
              <p className="text-slate-500 text-sm mt-1">Choose your difficulty and sharpen your skills.</p>
            </div>
            <div className="mt-6 flex items-center text-emerald-600 font-bold group-hover:translate-x-1 transition-transform">
              Select Level <ChevronRight className="w-4 h-4" />
            </div>
          </Card>
        </div>
      )}

      {user && (
        <div className="flex flex-wrap justify-center gap-4 pt-12">
          <Button variant="ghost" onClick={onProfile}>
            <UserIcon className="w-5 h-5" /> Profile
          </Button>
           <Button variant="ghost" onClick={onLeaderboard}>
            <Trophy className="w-5 h-5" /> Leaderboard
          </Button>
          <Button variant="ghost" onClick={() => signOut(auth)} className="text-red-400 hover:text-red-500 hover:bg-red-50">
            <LogOut className="w-5 h-5" /> Logout
          </Button>
        </div>
      )}
    </motion.div>
  </div>
);

const LeaderboardView = ({ onBack }: any) => {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'scores'), orderBy('timeSeconds', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScores(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="secondary" onClick={onBack} className="p-2 aspect-square">
          <Home className="w-5 h-5" />
        </Button>
        <h2 className="text-3xl font-bold text-slate-900">Hall of Fame</h2>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Rank</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Player</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {scores.map((score, idx) => (
                <tr key={score.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    {idx === 0 ? <Medal className="w-5 h-5 text-yellow-400" /> : 
                     idx === 1 ? <Medal className="w-5 h-5 text-slate-400" /> :
                     idx === 2 ? <Medal className="w-5 h-5 text-orange-400" /> :
                     <span className="text-slate-500 font-medium">#{idx + 1}</span>}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{score.displayName}</td>
                  <td className="px-6 py-4 font-mono text-pistachio-700">
                    {Math.floor(score.timeSeconds / 60)}:{(score.timeSeconds % 60).toString().padStart(2, '0')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      score.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                      score.difficulty === 'medium' ? 'bg-pistachio-100 text-pistachio-700' :
                      score.difficulty === 'hard' ? 'bg-orange-100 text-orange-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {score.difficulty}
                    </span>
                  </td>
                </tr>
              ))}
              {scores.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No legends recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const ProfileView = ({ profile, onBack }: { profile: UserProfile, onBack: () => void }) => {
  const currentRankIndex = RANKS.findIndex(r => r.name === profile.rank);
  const nextRank = RANKS[currentRankIndex + 1];
  const currentRankMinXp = RANKS[currentRankIndex].minXp;
  
  const progress = nextRank 
    ? ((profile.xp - currentRankMinXp) / (nextRank.minXp - currentRankMinXp)) * 100 
    : 100;

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="secondary" onClick={onBack} className="p-2 aspect-square">
          <Home className="w-5 h-5" />
        </Button>
        <h2 className="text-3xl font-bold text-slate-900">Your Stats</h2>
      </div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6">
        <Card className="p-8 text-center bg-white border-2 border-pistachio-100">
          <div className="relative inline-block mb-6">
            <div className="w-24 h-24 bg-pistachio-50 rounded-full flex items-center justify-center border-4 border-pistachio-200">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full rounded-full object-cover" />
              ) : (
                <UserIcon className="w-12 h-12 text-pistachio-400" />
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-pistachio-500 text-white p-2 rounded-xl shadow-lg ring-4 ring-white">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          
          <h2 className="text-2xl font-black text-slate-900 mb-1">{profile.displayName}</h2>
          <p className="text-pistachio-600 font-bold uppercase tracking-widest text-sm mb-6">{profile.rank}</p>

          <div className="space-y-2 mb-8">
            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
              <span>XP Progress</span>
              <span>{Math.floor(profile.xp)} / {nextRank ? nextRank.minXp : 'MAX'} XP</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                className="h-full bg-pistachio-400"
              />
            </div>
            {nextRank && (
              <p className="text-[10px] text-slate-400 italic">
                {nextRank.minXp - profile.xp} XP until you reach {nextRank.name} rank
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Solved</div>
              <div className="text-2xl font-black text-slate-900">{profile.totalSolved}</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Daily Streak</div>
              <div className="text-2xl font-black text-slate-900">0</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Rank Achievements</h3>
          <div className="grid grid-cols-3 gap-3">
            {RANKS.map((r, idx) => (
              <div 
                key={r.name} 
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  profile.xp >= r.minXp 
                    ? 'bg-pistachio-50 border-pistachio-200 text-pistachio-900 shadow-sm' 
                    : 'bg-white border-slate-100 text-slate-300 opacity-40'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                  <Medal className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black uppercase text-center leading-tight">{r.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'landing' | 'game' | 'leaderboard' | 'profile'>('landing');
  
  // Game State
  const [puzzle, setPuzzle] = useState<SudokuPuzzle | null>(null);
  const [grid, setGrid] = useState<(number | null)[][]>([]);
  const [original, setOriginal] = useState<(number | null)[][]>([]);
  const [solution, setSolution] = useState<number[][]>([]);
  const [notes, setNotes] = useState<number[][][]>([]);
  const [selected, setSelected] = useState<{row: number, col: number} | null>(null);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [isWon, setIsWon] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  // Load User Auth
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: u.uid,
            displayName: u.displayName || 'Anon',
            photoURL: u.photoURL || undefined,
            xp: 0,
            rank: 'Novice',
            totalSolved: 0,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
        } else {
          setProfile(userDoc.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
    });
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (!isPaused && !isWon) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, isWon]);

  const fetchPuzzle = async (level: Difficulty, isDaily = false) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (isDaily) {
      const dailyDoc = await getDoc(doc(db, 'dailyChallenges', today));
      if (dailyDoc.exists()) {
        const data = dailyDoc.data();
        setupGame(data as any);
        return;
      }
    }

    const res = await fetch(`/api/sudoku/generate?difficulty=${level}`);
    const data = await res.json();
    
    if (isDaily) {
      await setDoc(doc(db, 'dailyChallenges', today), {
        ...data,
        date: today,
        createdAt: new Date().toISOString()
      });
    }

    setupGame(data);
  };

  const setupGame = (data: any) => {
    const puzzleStr = data.puzzle.replace(/-/g, '0');
    const solutionStr = data.solution;
    
    const pGrid: any = [];
    const oGrid: any = [];
    const sGrid: any = [];
    const nGrid: any = [];

    for (let i = 0; i < 9; i++) {
      const pRow = [];
      const oRow = [];
      const sRow = [];
      const nRow = [];
      for (let j = 0; j < 9; j++) {
        const val = parseInt(puzzleStr[i * 9 + j]);
        const sol = parseInt(solutionStr[i * 9 + j]);
        pRow.push(val === 0 ? null : val);
        oRow.push(val === 0 ? null : val);
        sRow.push(sol);
        nRow.push([]);
      }
      pGrid.push(pRow);
      oGrid.push(oRow);
      sGrid.push(sRow);
      nGrid.push(nRow);
    }

    setGrid(pGrid);
    setOriginal(oGrid);
    setSolution(sGrid);
    setNotes(nGrid);
    setPuzzle(data);
    setTimer(0);
    setIsWon(false);
    setIsPaused(false);
    setView('game');
  };

  const handleInput = (num: number) => {
    if (!selected || original[selected.row][selected.col] !== null || isWon) return;

    if (isNoteMode) {
      const newNotes = [...notes];
      const cellNotes = newNotes[selected.row][selected.col];
      if (cellNotes.includes(num)) {
        newNotes[selected.row][selected.col] = cellNotes.filter(n => n !== num);
      } else {
        newNotes[selected.row][selected.col] = [...cellNotes, num].sort();
      }
      setNotes(newNotes);
    } else {
      const newGrid = [...grid];
      newGrid[selected.row][selected.col] = num;
      setGrid(newGrid);

      // Check win condition
      checkWin(newGrid);
    }
  };

  const handleErase = () => {
    if (!selected || original[selected.row][selected.col] !== null || isWon) return;
    const newGrid = [...grid];
    newGrid[selected.row][selected.col] = null;
    setGrid(newGrid);
    const newNotes = [...notes];
    newNotes[selected.row][selected.col] = [];
    setNotes(newNotes);
  };

  const checkWin = async (currentGrid: (number|null)[][]) => {
    const isComplete = currentGrid.every(row => row.every(cell => cell !== null));
    if (!isComplete) return;

    const isCorrect = currentGrid.every((row, r) => row.every((cell, c) => cell === solution[r][c]));
    if (isCorrect) {
      setIsWin();
    }
  };

  const setIsWin = async () => {
    setIsWon(true);
    setIsPaused(true);
    if (user && profile) {
      const score: ScoreEntry = {
        userId: user.uid,
        displayName: user.displayName || 'Anon',
        difficulty,
        timeSeconds: timer,
        puzzleId: puzzle?.puzzle || 'unknown',
        solvedAt: new Date().toISOString()
      };
      
      const xpGain = difficulty === 'easy' ? 100 : difficulty === 'medium' ? 250 : difficulty === 'hard' ? 500 : 1000;
      const newXp = profile.xp + xpGain;
      const newRank = getRankFromXp(newXp);

      await setDoc(doc(collection(db, 'scores')), score);
      await updateDoc(doc(db, 'users', user.uid), {
        xp: newXp,
        rank: newRank,
        totalSolved: increment(1)
      });

      setProfile({
        ...profile,
        xp: newXp,
        rank: newRank,
        totalSolved: profile.totalSolved + 1
      });
    }
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-pistachio-100 pb-12">
      {/* Navbar overlay */}
      {view !== 'landing' && (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
            <div className="w-8 h-8 bg-pistachio-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
            <span className="font-bold text-slate-900">SudokuDaily</span>
          </div>
          <div className="flex items-center gap-4">
             {profile && (
              <div 
                className="bg-slate-100 px-3 py-1 rounded-full flex items-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={() => setView('profile')}
              >
                <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{profile.rank}</span>
                <div className="w-4 h-4 bg-pistachio-600 rounded-full flex items-center justify-center text-[10px] text-white">
                  ★
                </div>
              </div>
            )}
            <Button variant="ghost" onClick={() => setView('landing')} className="p-2 aspect-square">
              <Home className="w-5 h-5 text-slate-400" />
            </Button>
          </div>
        </nav>
      )}

      <main className="container mx-auto pt-20 px-4">
        {view === 'landing' && (
          <LandingView 
            user={user} 
            onLogin={login} 
            onStartGame={(l: Difficulty) => { setDifficulty(l); fetchPuzzle(l); }}
            onDaily={() => { setDifficulty('hard'); fetchPuzzle('hard', true); }}
            onLeaderboard={() => setView('leaderboard')}
            onProfile={() => setView('profile')}
          />
        )}

        {view === 'leaderboard' && (
          <LeaderboardView onBack={() => setView('landing')} />
        )}

        {view === 'profile' && profile && (
          <ProfileView profile={profile} onBack={() => setView('landing')} />
        )}

        {view === 'game' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  {puzzle?.date ? 'Daily Challenge' : 'Level'}
                </span>
                <span className="text-2xl font-black text-slate-900 capitalize italic">{difficulty}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1 flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3" /> Timer
                </span>
                <span className="text-2xl font-mono font-bold text-pistachio-700">
                  {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <SudokuGrid 
              grid={grid} 
              original={original}
              solution={solution}
              selected={selected} 
              onSelect={(r: number, c: number) => setSelected({row: r, col: c})} 
              notes={notes}
            />

            <Keypad 
              onNumber={handleInput} 
              onErase={handleErase}
              onNote={() => setIsNoteMode(!isNoteMode)}
              isNoteMode={isNoteMode}
            />

            <div className="flex gap-4 mt-8">
              <Button variant="outline" className="flex-1 py-4" onClick={() => setIsPaused(!isPaused)}>
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
            </div>
            
            <AnimatePresence>
              {isWon && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
                >
                  <Card className="max-w-sm w-full p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center text-green-600">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900">Excellent!</h2>
                      <p className="text-slate-500">You solved the puzzle in {Math.floor(timer / 60)}m {timer % 60}s</p>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center">
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Current Rank</span>
                        <p className="font-bold text-slate-900">{profile?.rank}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">XP Earned</span>
                        <p className="font-bold text-pistachio-600">+{difficulty === 'easy' ? 100 : difficulty === 'medium' ? 250 : difficulty === 'hard' ? 500 : 1000}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button onClick={() => setView('landing')} variant="accent" className="w-full py-4 text-lg">
                        Return Home
                      </Button>
                      <Button onClick={() => setView('leaderboard')} variant="ghost" className="w-full">
                        View Leaderboard
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
