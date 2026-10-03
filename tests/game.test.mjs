import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom, act, view, tick, spinningLetter, eligible} from '../lib/game/engine.mjs';
import {handleGame} from '../lib/game/service.mjs';
function setup(rounds=1){const {room,token}=createRoom('ABC234',{name:'Jaya',rounds,seconds:30},1000);const second=act(room,'',{action:'join',name:'Anurag'},1001);return{room,token,second};}
const full = room => Object.fromEntries(['name','place','animal','thing'].map(k=>[k,room.letter+'bc']));
function run(room,token,action,extra={},now=1010){return act(room,token,{action,round:room.round,gameId:room.gameId,...extra},now);}
test('requires at least two connected players and validates limits',()=>{const {room,token}=createRoom('ABC234',{name:'Jaya',rounds:1,seconds:30},1000);assert.throws(()=>run(room,token,'begin'),/two/);for(const rounds of [0,27,2.5])assert.throws(()=>createRoom('ABC234',{name:'Jaya',rounds,seconds:30},1000));assert.throws(()=>run(room,'bad','start'),/session/);});
test('only host begins and active player starts/stops',()=>{const {room,token,second}=setup();assert.throws(()=>run(room,second,'begin'),/host/);run(room,token,'begin');assert.throws(()=>run(room,second,'start'),/turn/);run(room,token,'start');const shown=spinningLetter(room,1200);run(room,token,'stop',{},1200);assert.equal(room.letter,shown);assert.throws(()=>run(room,token,'stop'),/Start/);});
test('answers stay private and server awards 40/30/20/10/0 correctly',()=>{for(let n=0;n<=4;n++){const {room,token,second}=setup();run(room,token,'begin');run(room,token,'start');run(room,token,'stop');const answers=Object.fromEntries(['name','place','animal','thing'].map((k,i)=>[k,i<n?room.letter+'bc':(room.letter==='Z'?'Y':'Z')+'bc']));run(room,token,'save',{answers,sequence:1});const other=view(room,second,1010);assert.equal(other.answers[room.host],undefined);assert.equal(JSON.stringify(other).includes(token),false);run(room,token,'submit',{answers,sequence:2});assert.equal(room.phase,'review');run(room,token,'next');assert.equal(room.players[0].total,n*10);assert.equal(room.phase,'finished');assert.throws(()=>run(room,token,'next'));}});
test('autosaved answers score at deadline and late input cannot mutate them',()=>{const {room,token}=setup();run(room,token,'begin');run(room,token,'start');run(room,token,'stop');run(room,token,'save',{answers:{name:room.letter+'bc'},sequence:2});run(room,token,'save',{answers:{name:'Wrong'},sequence:1});assert.equal(room.answers[room.host].name,room.letter+'bc');const end=room.deadline;tick(room,end);assert.equal(room.phase,'review');assert.throws(()=>run(room,token,'save',{answers:{name:'late'},sequence:3},end),/round has stopped/);assert.equal(room.accepted[room.host].name,true);});
test('26 rounds never repeat a letter; turns rotate; rematch resets scores',()=>{const {room,token,second}=setup(26);run(room,token,'begin');for(let i=0;i<26;i++){const active=room.players.find(p=>p.id===room.active).token;assert.equal(active,i%2?second:token);run(room,active,'start');run(room,active,'stop');run(room,token,'submit',{answers:full(room),sequence:1});run(room,token,'next');}assert.equal(room.phase,'finished');assert.equal(new Set(room.used).size,26);run(room,token,'rematch');assert.equal(room.phase,'lobby');assert.equal(room.used.length,0);assert.equal(room.history.length,0);});
test('host can reject wrong-category words; guests cannot review; stale round requests rejected',()=>{const {room,token,second}=setup(2);run(room,token,'begin');run(room,token,'start');run(room,token,'stop');run(room,token,'save',{answers:{name:room.letter+'bc'},sequence:1});run(room,second,'submit',{answers:full(room),sequence:1});assert.throws(()=>run(room,second,'judge',{playerId:room.host,category:'name',accept:false}),/host/);run(room,token,'judge',{playerId:room.host,category:'name',accept:false});run(room,token,'next');assert.equal(room.players[0].total,0);assert.throws(()=>act(room,second,{action:'start',round:1,gameId:room.gameId},1010),/round has changed/);});
test('host handover and automatic letter selection recover inactive turns',()=>{const {room,token,second}=setup();run(room,token,'begin');room.players[1].seen=50000;tick(room,50000);assert.equal(room.host,room.players[1].id);assert.equal(room.phase,'spinning');tick(room,70001);assert.equal(room.phase,'writing');assert.equal(room.used.length,1);});
test('word checks accept phrases but reject blank, single letters and wrong prefixes',()=>{assert(eligible('New Delhi','N'));assert(eligible('O’Brien','O'));assert(!eligible('','A'));assert(!eligible('A','A'));assert(!eligible('London','A'));assert(!eligible('<script>','S'));});
test('simultaneous complete submissions have exactly one winner and preserve other saved answers',async()=>{
 let stored;
 const store={insert:async r=>{stored=structuredClone(r);return true},get:async()=>structuredClone(stored),compareAndSet:async(r,v)=>{if(stored.revision!==v)return false;stored=structuredClone(r);return true}};
 const a=await handleGame(store,{action:'create',name:'Jaya',rounds:1,seconds:75});
 const code=a.room.code,b=await handleGame(store,{action:'join',code,name:'Anurag'});
 const action=async(type,token,extra={})=>handleGame(store,{action:type,code,round:stored.round,gameId:stored.gameId,...extra},token);
 await action('begin',a.token);await action('start',a.token);await action('stop',a.token);
 await action('save',a.token,{answers:{name:stored.letter+'bc'},sequence:1});
 await action('save',b.token,{answers:{name:stored.letter+'bc'},sequence:1});
 const results=await Promise.allSettled([action('submit',a.token,{answers:full(stored),sequence:2}),action('submit',b.token,{answers:full(stored),sequence:2})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 assert.equal(stored.phase,'review');assert.equal(stored.submitted.length,1);
 const winner=stored.stoppedBy,loser=stored.players.find(p=>p.id!==winner).id;
 assert.equal(stored.answers[loser].place,'');assert.equal(stored.answers[winner].place,stored.letter+'bc');
 const snapshot=JSON.stringify(stored.answers);
 await assert.rejects(()=>action('save',a.token,{answers:full(stored),sequence:3}),/round has stopped/);
 assert.equal(JSON.stringify(stored.answers),snapshot);
 const av=await action('poll',a.token),bv=await action('poll',b.token);
 assert.equal(av.room.stoppedAt,bv.room.stoppedAt);assert.equal(av.room.stoppedBy,bv.room.stoppedBy);
 assert.equal(av.room.pendingPoints[winner],40);assert.equal(av.room.pendingPoints[loser],10);
});

test('lenient matching treats local, Indian and foreign names equally across casing and accents',()=>{
 for(const name of ['anurag','ANURAG','AnUrAg','  anurag  ','Aarav','A. P. J. Abdul Kalam','Anne-Marie','Álvaro']) assert(eligible(name,'A'),name);
 for(const [word,letter] of [['Élodie','E'],['e\u0301lodie','E'],['Özlem','O'],['Łukasz','L'],['O’Connor','O'],['New Delhi','N'],['R2-D2','R']])assert(eligible(word,letter),word);
 assert(!eligible('Anurag','B'));assert(!eligible('123','A'));assert(!eligible('  ','A'));
});
test('native-script names can be approved by host without automatic transliteration guesses',()=>{
 const {room,token,second}=setup();run(room,token,'begin');run(room,token,'start');run(room,token,'stop');
 run(room,token,'save',{answers:{name:'अनुराग'},sequence:1});run(room,second,'submit',{answers:full(room),sequence:1});
 assert.equal(room.accepted[room.host].name,false);
 run(room,token,'judge',{playerId:room.host,category:'name',accept:true});assert.equal(room.accepted[room.host].name,true);
 run(room,token,'next');assert.equal(room.players[0].total,10);
});


test('first full submission stops the timer for everyone and freezes partial drafts',()=>{
 const {room,token,second}=setup();run(room,token,'begin');run(room,token,'start');run(room,token,'stop');
 const other=room.players[1];
 run(room,token,'save',{answers:{name:room.letter+'bc',place:room.letter+'bc'},sequence:1});
 const originalDeadline=room.deadline;
 run(room,second,'submit',{answers:full(room),sequence:1},2000);
 assert.equal(room.phase,'review');assert.equal(room.stoppedBy,other.id);assert.equal(room.deadline,2000);assert(room.deadline<originalDeadline);
 assert.equal(view(room,token,2000).pendingPoints[room.host],20);
 const frozen=JSON.stringify(room.answers);
 assert.throws(()=>run(room,token,'submit',{answers:full(room),sequence:2},2001),e=>e.status===409);
 assert.throws(()=>run(room,token,'save',{answers:full(room),sequence:2},2001),e=>e.status===409);
 assert.equal(JSON.stringify(room.answers),frozen);
});
test('incomplete or whitespace-only submissions cannot stop a round; stale submits cannot overwrite newer answers',()=>{
 const {room,token}=setup();run(room,token,'begin');run(room,token,'start');run(room,token,'stop');
 for(const answers of [{}, {...full(room),thing:'  '}, {...full(room),animal:null}]) {
  assert.throws(()=>run(room,token,'submit',{answers,sequence:1}),/all four/);assert.equal(room.phase,'writing');assert.equal(room.submitted.length,0);
 }
 run(room,token,'save',{answers:full(room),sequence:5});
 assert.throws(()=>run(room,token,'submit',{answers:full(room),sequence:4}),/newer answer/);
 assert.equal(room.phase,'writing');
});
test('custom timers allow arbitrary whole seconds and reject invalid limits',()=>{
 for(const seconds of [1,37,75,150,3600]) {
  const {room,token}=createRoom('ABC234',{name:'Jaya',rounds:1,seconds},1000);
  act(room,'',{action:'join',name:'Anurag'},1001);run(room,token,'begin');run(room,token,'start');run(room,token,'stop',{},1500);
  assert.equal(room.deadline,1500+seconds*1000);tick(room,room.deadline);assert.equal(room.phase,'review');assert.equal(room.stoppedBy,null);
 }
 for(const seconds of [0,-1,3601,30.5,'',null,'abc',Infinity])assert.throws(()=>createRoom('ABC234',{name:'Jaya',rounds:1,seconds},1000),/whole number/);
});
test('a submission at the timer deadline is rejected and saved drafts are reviewed',()=>{
 const {room,token}=setup();run(room,token,'begin');run(room,token,'start');run(room,token,'stop');
 run(room,token,'save',{answers:{name:room.letter+'bc'},sequence:1});
 assert.throws(()=>run(room,token,'submit',{answers:full(room),sequence:2},room.deadline),e=>e.status===409);
 assert.equal(room.phase,'review');assert.equal(room.stoppedBy,null);assert.equal(view(room,token,room.deadline).pendingPoints[room.host],10);
});
