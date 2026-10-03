'use client';
import { useEffect, useRef, useState } from 'react';
import ClickSpark from '@/components/react-bits/ClickSpark';
import { canAccept } from '@/lib/game/word-rules.mjs';
import { Users, Globe2, Volume2, VolumeX, Copy, Check, Play, Square, Timer, Trophy, Crown, LogOut, RotateCcw, Sparkles, MapPin, PawPrint, Shapes, UserRound, WifiOff } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
const cats = ['name', 'place', 'animal', 'thing'] as const;
const icons = [UserRound, MapPin, PawPrint, Shapes];
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const blanks = () => ({ name: '', place: '', animal: '', thing: '' });
type Answers = ReturnType<typeof blanks>;
type Room = any;
function Choice({ label, value, onChange, values }: {label:string;value:string;onChange:(v:string)=>void;values:{v:string;t:string}[]}) { return <div className="field"><label>{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="choice"><SelectValue /></SelectTrigger><SelectContent>{values.map(x => <SelectItem value={x.v} key={x.v}>{x.t}</SelectItem>)}</SelectContent></Select></div>; }
function Brand() {return <a className="brand" href="/" aria-label="Name Place Animal Thing home"><span className="brand-mark">n<span>p</span><span>a</span>t</span><span>name place<br/>animal thing<span className="brand-dot">.</span></span></a>;}
let audioContext: AudioContext | undefined;
function unlockAudio() { try { audioContext ??= new AudioContext(); void audioContext.resume(); } catch {} }
function bloop() { unlockAudio(); if (!audioContext) return; [392, 349, 294, 196].forEach((hz,i) => {const o = audioContext!.createOscillator(), g = audioContext!.createGain(), t = audioContext!.currentTime+i*.22; o.type='triangle';o.frequency.value=hz;g.gain.setValueAtTime(.13,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(g);g.connect(audioContext!.destination);o.start(t);o.stop(t+.36);}); }
export default function Game({ initialCode = '' }: {initialCode?: string}) {
 const code = initialCode.toUpperCase();
 const [room, setRoom] = useState<Room>(null), [token,setToken] = useState(''), [ready,setReady] = useState(false);
 const [name,setName] = useState(''), [joinCode,setJoinCode] = useState(code), [rounds,setRounds] = useState('5'), [seconds,setSeconds] = useState('60');
 const [tab,setTab] = useState(code ? 'join' : 'create'), [busy,setBusy] = useState(false), [error,setError] = useState(''), [network,setNetwork] = useState(false);
 const [draft,setDraft] = useState<Answers>(blanks), [saved,setSaved] = useState(''), [now,setNow] = useState(Date.now()), [offset,setOffset] = useState(0);
 const [muted,setMuted] = useState(false), [copied,setCopied] = useState(false), [videoMissing,setVideoMissing] = useState(false);
 const seq = useRef(0), hydrated = useRef(''), dirty = useRef(false), latest = useRef({room,token,draft}), sounded = useRef('');
 const sound = useRef<HTMLAudioElement | null>(null);
 const video = useRef<HTMLVideoElement | null>(null);
 const [autoplayMuted,setAutoplayMuted] = useState(true);
 const [videoBlocked,setVideoBlocked] = useState(false);
 latest.current = {room,token,draft};
 useEffect(() => { setName(localStorage.getItem('npat:name') ?? '');setMuted(localStorage.getItem('npat:muted') === 'true'); if(code) setToken(sessionStorage.getItem(`npat:${code}`) ?? '');setReady(true); const h = () => unlockAudio();window.addEventListener('pointerdown',h,{once:true});return()=>window.removeEventListener('pointerdown',h); },[code]);
 useEffect(() => { const t = setInterval(()=>setNow(Date.now()+offset),30);return()=>clearInterval(t); },[offset]);
 async function request(input: any, playerToken = token, apply = true) {
  const started = Date.now();
  const res = await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json','x-player-token':playerToken},body:JSON.stringify(input),signal:AbortSignal.timeout(12000)});
  const data: any = await res.json();
  if(!res.ok) { const e:any = new Error(data.error ?? 'Something went wrong. Please retry.'); e.status = res.status; throw e; }
  if(data.room && apply) { setOffset(data.room.now-(started+Date.now())/2);setRoom((old:Room) => !old || old.code!==data.room.code || old.revision <= data.room.revision ? data.room : old); }
  return data;
 }
 useEffect(()=>{
  if(!ready||!code||!token) return;
  let stopped=false, timer:ReturnType<typeof setTimeout>;
  async function poll() { try {await request({action:'poll',code},token);if(!stopped){setNetwork(false);setError(e=>e==='Reconnecting to your room…'?'':e);}} catch(e:any) {if(!stopped){setNetwork(true);if([401,404,410].includes(e.status)){setError(e.message);setToken('');sessionStorage.removeItem(`npat:${code}`);return;}}} if(!stopped)timer=setTimeout(poll,900); }
  void poll();return()=>{stopped=true;clearTimeout(timer);};
 // Polling retains its room token, and request uses functional state updates.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,code,token]);
 useEffect(()=>{
  if(!room) return;
  const key=`${room.gameId}:${room.round}`;
  if(hydrated.current!==key) {hydrated.current=key;const a=room.answers[room.me]??{};setDraft({...blanks(),...Object.fromEntries(cats.map(k=>[k,a[k]??'']))} as Answers);seq.current=(a._sequence??0)+1;dirty.current=false;setSaved('');}
 },[room]);
 useEffect(()=>{
  if(!room||room.phase!=='writing'||!dirty.current||room.submitted.includes(room.me)) return;
  const r=room, sequence=++seq.current;
  setSaved('Saving…');
  const t=setTimeout(async()=>{try {await request({action:'save',code,gameId:r.gameId,round:r.round,answers:draft,sequence});if(seq.current===sequence){dirty.current=false;setSaved('Saved');}}catch {if(seq.current===sequence)setSaved('Not saved — retry or submit');}},250);
  return()=>clearTimeout(t);
 // Do not reset the debounce timer on every heartbeat.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[draft,room?.phase,room?.round,room?.gameId]);
 async function enter(action: 'create'|'join') {
  setBusy(true);setError('');unlockAudio();
  try {const data=await request({action,name,code:joinCode.trim().toUpperCase(),rounds:Number(rounds),seconds:Number(seconds)},'',false);sessionStorage.setItem(`npat:${data.room.code}`,data.token);localStorage.setItem('npat:name',name.trim());window.location.assign(`/room/${data.room.code}`);}catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 async function action(type:string, extra:any={}) {
  if(!room) return;setBusy(true);setError('');unlockAudio();
  try {await request({action:type,code,round:room.round,gameId:room.gameId,...extra});}catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 async function leave() { if(!window.confirm('Leave this room? Your points will stay on the scoreboard.'))return;try{await request({action:'leave',code});}catch{}sessionStorage.removeItem(`npat:${code}`);window.location.assign('/'); }
 async function copyLink(){try{await navigator.clipboard.writeText(`${location.origin}/room/${code}`);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError(`Copy this room link: ${location.origin}/room/${code}`);}}
 function playFallbackSound(){if(muted)return; sound.current?.pause();const a=new Audio('/audio/loser.mp3');sound.current=a;a.volume=.45;void a.play().catch(()=>bloop());}
 function startVideo(replay=false){
  const v=video.current;if(!v)return;
  if(replay)v.currentTime=0;
  // Start silently on mobile; sound is enabled by an explicit tap.
  v.muted=replay?muted:true;
  setAutoplayMuted(v.muted);setVideoBlocked(false);
  void v.play().catch(()=>{v.muted=true;setAutoplayMuted(true);void v.play().catch(()=>setVideoBlocked(true));});
 }
 function enableVideoSound(){const v=video.current;if(!v)return;unlockAudio();setMuted(false);localStorage.setItem('npat:muted','false');setAutoplayMuted(false);v.muted=false;void v.play().then(()=>setVideoBlocked(false)).catch(()=>{v.muted=true;setAutoplayMuted(true);setVideoBlocked(true);});}
 function playMeme(){if(video.current&&!videoMissing)startVideo(true);else playFallbackSound();}
 useEffect(()=>{if(room?.phase!=='finished'){sound.current?.pause();video.current?.pause();setVideoMissing(false);setAutoplayMuted(true);setVideoBlocked(false);}else if(videoMissing&&sounded.current!==room.gameId){sounded.current=room.gameId;playFallbackSound();}},[room?.phase,room?.gameId,videoMissing]);
 useEffect(()=>()=>{sound.current?.pause();video.current?.pause();},[]);
 useEffect(()=>{
  const context=(document as any).modelContext;if(!context?.registerTool)return;const controller=new AbortController();
  Promise.resolve(context.registerTool({name:'read_game_room',description:'Read the currently joined room, round, letter, and scoreboard. Does not expose hidden answers.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async(input:any)=>{if(Object.keys(input??{}).length)throw new Error('No parameters accepted.');const r=latest.current.room;return r?{code:r.code,phase:r.phase,round:r.round,letter:r.letter,players:r.players.map((p:any)=>({name:p.name,total:p.total}))}:{status:'not_in_room'};}},{signal:controller.signal})).catch(()=>{});return()=>controller.abort();
 },[]);
 const isHost=room?.host===room?.me, isActive=room?.active===room?.me;
 const active=room?.players.find((p:any)=>p.id===room.active), me=room?.players.find((p:any)=>p.id===room.me);
 const complete=cats.every(cat=>draft[cat].trim().length>0);
 const locked=room?.submitted.includes(room?.me), remaining=Math.max(0,Math.ceil(((room?.deadline??0)-now)/1000));
 const available=[...ABC].filter(l=>!room?.used.includes(l));
 const displayed=room?.phase==='spinning'?available[(Math.max(0,Math.floor((now-room.spinAt)/60))+room.spinOffset)%available.length]:room?.letter||'?';
 const scores=room?[...room.players].sort((a:any,b:any)=>b.total-a.total):[];
 const low=scores.length?Math.min(...scores.map((p:any)=>p.total)):0;
 const losers=scores.filter((p:any)=>p.total===low), allTied=losers.length===scores.length;
 return <ClickSpark sparkColor="#91af4f" sparkSize={7} sparkRadius={20} sparkCount={6}><div className="app-shell">
  <header className="topbar"><Brand/><div className="header-right"><span className="remote-note"><Globe2 size={16}/> Different places. Same game.</span><button className="icon-button" aria-label={muted?'Turn sound on':'Mute sound'} title={muted?'Sound off':'Sound on'} onClick={()=>{unlockAudio();setMuted(!muted);localStorage.setItem('npat:muted',String(!muted));if(!muted)sound.current?.pause();setAutoplayMuted(false);if(video.current)video.current.muted=!muted;}}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button></div></header>
  <main>
  {error&&<div className="notice error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
  {network&&token&&<div className="notice" role="status"><WifiOff size={18}/> Connection interrupted. Reconnecting… Your typed answers are still here.</div>}
  {!room ? code&&token ? <section className="loading panel"><span className="eyebrow">ROOM {code}</span><h1>Pulling up your chair…</h1><p>Connecting to your game room.</p><button className="button secondary" onClick={()=>location.reload()}>Retry connection</button></section> : <>
   <div className="home-grid">
    <section className="intro"><div className="eyebrow"><span className="tiny-square"/> THE CLASSIC, BACK TOGETHER</div><h1 className="game-title"><span>Name<span className="title-icon coral"><UserRound/></span></span><span>Place<span className="title-icon yellow"><MapPin/></span></span><span>Animal<span className="title-icon blue"><PawPrint/></span></span><span>Thing<span className="title-icon green"><Shapes/></span><span className="period">.</span></span></h1><p className="intro-copy">One letter. Four words.<br/>A little friendly competition.</p><div className="intro-tags"><span><Users size={16}/> 2–12 players</span><span><Globe2 size={16}/> Play from anywhere</span></div></section>
    <section className="entry-card"><div className="card-topline"><span className="eyebrow">GATHER YOUR PEOPLE</span><span className="mini-tiles" aria-hidden="true"><i>A</i><i>B</i><i>C</i></span></div><h2>{code?'You’re invited!':'Let’s play.'}</h2><p>{code?`Take your seat in room ${code}.`:'Make a room. Send the link. Game on.'}</p>
    <Tabs value={tab} onValueChange={setTab}><TabsList className="room-tabs"><TabsTrigger value="create">Create a room</TabsTrigger><TabsTrigger value="join">Join a room</TabsTrigger></TabsList>
     <div className="field"><label htmlFor="player-name">Your name</label><input id="player-name" autoComplete="nickname" placeholder="What should we call you?" value={name} onChange={e=>setName(e.target.value)} maxLength={24}/></div>
     <TabsContent value="create"><form onSubmit={e=>{e.preventDefault();void enter('create');}}><div className="field-pair"><Choice label="Number of rounds" value={rounds} onChange={setRounds} values={Array.from({length:26},(_,i)=>({v:String(i+1),t:`${i+1} round${i?'s':''}`}))}/><div className="field"><label htmlFor="custom-timer">Time per round (seconds)</label><input id="custom-timer" type="number" inputMode="numeric" min={1} max={3600} step={1} required value={seconds} onChange={e=>setSeconds(e.target.value)} aria-describedby="timer-hint"/><small id="timer-hint">1–3,600 seconds · Your choice</small></div></div><div className="room-note"><span>✦</span> A room just for your crew.<br/><small>No account needed. Share the room link to invite.</small></div><button className="button primary wide" disabled={busy||name.trim().length<2}>{busy?'Creating your room…':'Create room'}<span>＋</span></button></form></TabsContent>
     <TabsContent value="join"><form onSubmit={e=>{e.preventDefault();void enter('join');}}><div className="field"><label htmlFor="room-code">Room code</label><input id="room-code" className="code-input" placeholder="ABC123" autoComplete="off" value={joinCode} maxLength={6} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,''))}/></div><div className="room-note">Get the six-character code from your host.<br/><small>You can join until the first round starts.</small></div><button className="button primary wide" disabled={busy||name.trim().length<2||joinCode.length!==6}>{busy?'Joining your room…':'Join room'}<Users size={20}/></button></form></TabsContent>
    </Tabs><div className="card-foot">10 points per word · Up to 40 points per round</div></section>
   </div><section className="how-to" aria-label="How to play"><div><span>01</span><p><strong>Start. Stop. Pick a letter.</strong>Your turn to put the alphabet in motion.</p></div><div><span>02</span><p><strong>Think fast. Write four words.</strong>A name, place, animal and thing.</p></div><div><span>03</span><p><strong>Compare. Laugh. Repeat.</strong>Review the words and see who wins.</p></div></section>
  </> : <>
   <div className="room-heading"><div><span className="eyebrow">YOUR GAME ROOM</span><h1>{room.phase==='lobby'?'The gang’s getting together.':room.phase==='finished'?'That’s a wrap!':`Round ${room.round}`}<span className="heading-detail">{room.phase!=='lobby'&&room.phase!=='finished'?` / ${room.settings.rounds}`:''}</span></h1></div><div className="room-tools"><button className="code-pill" onClick={copyLink} title="Copy invite link">{code} {copied?<Check size={16}/>:<Copy size={16}/>}</button><button className="icon-button" onClick={leave} aria-label="Leave room"><LogOut size={20}/></button></div></div>
   <div className="room-layout"><div className="play-column">
    {room.phase==='lobby'&&<section className="panel lobby"><div className="eyebrow">GOOD COMPANY. GREAT COMPETITION.</div><h2>Save them a seat.</h2><p>Invite friends or family with your room link.<br/>Everyone can play on their own phone or computer.</p><div className="invite-strip"><span>{code}</span><button className="button secondary" onClick={copyLink}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'Link copied':'Copy invite link'}</button></div><div className="settings-chips"><span><RotateCcw size={17}/>{room.settings.rounds} rounds</span><span><Timer size={17}/>{room.settings.seconds}s to write</span><span><Users size={17}/>{room.players.length}/12 players</span></div><div className="rule-note"><strong>A quick house rule</strong><p>Indian, local and international names are welcome. Capitalisation and accents don’t matter. Matching-letter answers get 10 points; the host reviews categories and answers in non-Latin scripts. Duplicates still get 10. The first player to fill all four boxes and submit stops the round for everyone.</p></div>{isHost?<button className="button primary wide" disabled={busy||room.players.filter((p:any)=>p.online).length<2} onClick={()=>action('begin')}><Play size={19}/> Start game</button>:<div className="waiting-line">Waiting for {room.players.find((p:any)=>p.id===room.host)?.name} to start the game…</div>}<p className="small centered">{room.players.length<2?'At least 2 players are needed to begin.':'Everyone in? Let the word scramble begin.'}</p></section>}
    {['selecting','spinning','writing'].includes(room.phase)&&<>
     <section className={`letter-stage ${room.phase==='spinning'?'is-spinning':''}`}><div className="letter-info"><span className="eyebrow">{room.phase==='writing'?'YOUR LETTER':isActive?'IT’S YOUR TURN':`${active?.name ?? 'PLAYER'}’S TURN`}</span><h2>{room.phase==='writing'?'Four words. You’ve got this.':room.phase==='spinning'?'And the letter is…':'Let’s pick a letter.'}</h2><p>{room.phase==='writing'?`Write words beginning with ${room.letter}.`:'Everyone sees the same alphabet.'}</p>{room.phase==='writing'?<div className={`timer ${remaining<=10?'urgent':''}`} role="timer" aria-label={`${remaining} seconds remaining`}><Timer size={22}/><span>{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</span><small>remaining</small></div>:isActive?<button disabled={busy} className={`button ${room.phase==='spinning'?'stop':'lime'}`} onClick={()=>action(room.phase==='spinning'?'stop':'start')}>{room.phase==='spinning'?<Square size={16} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}{room.phase==='spinning'?'Stop alphabet':'Start alphabet'}</button>:<div className="waiting-light">Waiting for {active?.name} to {room.phase==='spinning'?'stop':'start'}…</div>}</div><div className="letter-tile" aria-label={room.phase==='spinning'?'Alphabet is running':`Letter ${displayed}`}><span>{displayed}</span><small>{room.phase==='spinning'?'A B C D E F G':'NAME · PLACE · ANIMAL · THING'}</small></div></section>
     {room.phase==='writing'?<section className="panel answer-panel"><form onSubmit={e=>{e.preventDefault();if(!complete||busy||locked||remaining===0)return;dirty.current=false;void action('submit',{answers:draft,sequence:++seq.current});}}><div className="section-title"><h2>{locked?'You’re locked in.':'Your four words'}</h2><span className="small" role="status">{locked?'Round stopped for everyone.':saved||'Answers save as you type'}</span></div><div className="answers-grid">{cats.map((cat,i)=>{const Icon=icons[i];return <label key={cat} className={`answer-field category-${i}`}><span><Icon size={18}/>{cat}<small>10 pts</small></span><input value={draft[cat]} placeholder={`${room.letter}…`} autoComplete="off" autoCorrect="off" spellCheck={false} required disabled={busy||locked||remaining===0} maxLength={60} onChange={e=>{dirty.current=true;setDraft(d=>({...d,[cat]:e.target.value}));}}/></label>;})}</div><button className="button primary wide" disabled={busy||locked||remaining===0||!complete} type="submit">{locked?<><Check size={18}/> Answers submitted</>:remaining===0?'Time’s up — opening review…':busy?'Stopping the round…':'Submit & stop everyone'}</button><p className="small centered">Fill all four boxes to submit. First submission stops everyone; their last saved answers count.</p></form></section>:<div className="panel ready-panel"><Sparkles size={22}/><p>Get your thinking cap on.<br/><strong>Name. Place. Animal. Thing.</strong></p><span className="small">{room.phase==='selecting'?'Auto-starts after 45 seconds.':'Auto-stops after 20 seconds.'}</span></div>}
    </>}
    {room.phase==='review'&&<section className="panel review"><div className="section-title"><div><span className="eyebrow">PENCILS DOWN</span><h2>Let’s compare words.</h2></div><span className="small-letter">{room.letter}</span></div><p role="status">{room.stoppedBy?`${room.players.find((p:any)=>p.id===room.stoppedBy)?.name??'A player'} submitted all four answers. The round is stopped for everyone.`:'Time’s up. Everyone’s answers are locked.'}</p><p>{isHost?'Review words together. Names from anywhere count. Approve non-Latin answers after checking their starting sound; uncheck invalid words.':'Check everyone’s answers together. The host confirms the scores.'}</p><Table><TableHeader><TableRow><TableHead>Player</TableHead>{cats.map(c=><TableHead key={c}>{c}</TableHead>)}<TableHead>Points</TableHead></TableRow></TableHeader><TableBody>{room.players.map((p:any)=><TableRow key={p.id}><TableCell data-label="Player"><strong>{p.name}</strong>{p.id===room.me&&<small> (you)</small>}</TableCell>{cats.map(c=><TableCell key={c} data-label={c}><label className="judged-word"><Checkbox aria-label={`Accept ${p.name}'s ${c}`} disabled={!isHost||busy||!canAccept(room.answers[p.id]?.[c],room.letter)} checked={!!room.accepted[p.id]?.[c]} onCheckedChange={v=>action('judge',{playerId:p.id,category:c,accept:v===true})}/><span>{room.answers[p.id]?.[c]||'—'}</span></label></TableCell>)}<TableCell data-label="Points"><b className="point-chip">+{room.pendingPoints[p.id]??0}</b></TableCell></TableRow>)}</TableBody></Table><div className="review-footer"><span className="small">10 per accepted word. No penalty for matching answers.</span>{isHost?<button className="button primary" disabled={busy} onClick={()=>action('next')}>{room.round===room.settings.rounds?'Confirm & reveal results':'Confirm & next round'}</button>:<span className="waiting-line">Waiting for the host to confirm…</span>}</div></section>}
    {room.phase==='finished'&&<section className="panel finale"><span className="eyebrow">{room.settings.rounds} ROUNDS. ALL THE BRAGGING RIGHTS.</span><Trophy className="trophy-icon" size={44}/><h2>{scores.filter((p:any)=>p.total===scores[0]?.total).map((p:any)=>p.name).join(' & ')} {scores.filter((p:any)=>p.total===scores[0]?.total).length>1?'tie for first!':'takes the crown!'}</h2><p>{scores[0]?.total} points · Well played, everyone.</p><div className="meme-card"><span className="meme-caption">{allTied?'WHEN EVERYONE HAS THE SAME SCORE':'ME: “I’M REALLY GOOD AT THIS GAME”'}</span>{!videoMissing?<video ref={video} src="/memes/loser.mp4" aria-label="End-of-game meme video" preload="auto" autoPlay playsInline disablePictureInPicture disableRemotePlayback muted={muted||autoplayMuted} onCanPlay={()=>{if(video.current?.paused)startVideo();}} onError={()=>setVideoMissing(true)}/>:<div className="meme-fallback"><span aria-hidden="true">{allTied?'🤝':'🫠'}</span><strong>{allTied?'Collective genius.':'Brain has left the chat.'}</strong></div>}<span className="meme-caption bottom">{allTied?'NO LAST PLACE. JUST VIBES.':`${losers.map((p:any)=>p.name).join(' & ')} · ${low} POINTS · COMEBACK LOADING…`}</span></div><div className="final-actions">{!videoMissing&&autoplayMuted&&<button className="button secondary" onClick={enableVideoSound}><Volume2 size={18}/>Tap for sound</button>}<button className="button secondary" disabled={videoMissing&&muted} onClick={playMeme}><Play size={18}/>{videoMissing?'Replay sound':videoBlocked?'Play video':'Replay video'}</button>{isHost?<button className="button primary" disabled={busy} onClick={()=>action('rematch')}><RotateCcw size={18}/> Play again</button>:<span className="small">The host can start a rematch.</span>}</div></section>}
    {room.phase!=='lobby'&&<section className="letter-bank"><div className="section-title"><h3>Letter trail</h3><span className="small">{room.used.length} used · No repeats</span></div><div>{[...ABC].map(l=><span key={l} className={`${room.used.includes(l)?'used':''} ${room.letter===l?'current':''}`} title={room.used.includes(l)?`${l} used`:`${l} available`}>{l}</span>)}</div></section>}
   </div><aside className="panel players-panel"><div className="section-title"><h2>{room.phase==='lobby'?'The crew':'Scoreboard'}</h2><span className="count-badge">{room.players.length}</span></div><p className="small">{room.phase==='lobby'?'Your people, wherever they are.':'Total points from confirmed rounds.'}</p><ol className="players-list">{scores.map((p:any,i:number)=><li key={p.id}><span className={`avatar avatar-${room.players.findIndex((q:any)=>q.id===p.id)%4}`}>{p.name[0].toUpperCase()}</span><div><strong>{p.name}{p.id===room.me&&<small> (you)</small>}</strong><span>{p.left?'Left game':!p.online?'Reconnecting…':p.id===room.host?<><Crown size={12}/> Host</>:p.submitted&&room.phase==='writing'?'Answers locked':p.id===room.active&&['selecting','spinning'].includes(room.phase)?'Picking the letter':'Ready to play'}</span></div><b>{p.total}<small>pts</small></b></li>)}</ol><div className="score-note"><span>✦</span><p>Four good words.<br/><strong>40 lovely points.</strong></p></div></aside></div>
  </>}
  </main><footer className="site-footer"><span>A little nostalgia. A lot of “wait, that’s a word!”</span><span>Name Place Animal Thing <span>✦</span></span></footer>
 </div></ClickSpark>;
}
