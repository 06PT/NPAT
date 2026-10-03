import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('Express serves the game and handles two remote-player sessions through HTTP',async()=>{
 const dataDir=await mkdtemp(join(tmpdir(),'npat-test-'));
 const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'0',DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Server startup timed out')),10000);child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/port (\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.on('error',reject);child.on('exit',code=>{if(code)reject(new Error('Server exit '+code));});});
 const base=`http://127.0.0.1:${port}`;
 const api=async(data,token='')=>{const res=await fetch(base+'/api/game',{method:'POST',headers:{'content-type':'application/json','x-player-token':token},body:JSON.stringify(data)});return{status:res.status,...await res.json()};};
 try{
  assert.equal((await fetch(base+'/')).status,200);
  const a=await api({action:'create',name:'Jaya',rounds:1,seconds:75});assert.equal(a.status,200);assert.equal(a.room.settings.seconds,75);const code=a.room.code;
  assert.equal((await fetch(base+'/room/'+code)).status,200);
  const b=await api({action:'join',code,name:'Anurag'});assert.equal(b.status,200);
  assert.equal((await api({action:'begin',code},b.token)).status,403);
  let r=await api({action:'begin',code},a.token);
  const payload={code,round:r.room.round,gameId:r.room.gameId};
  await api({...payload,action:'start'},a.token);r=await api({...payload,action:'stop'},a.token);
  const answer={name:r.room.letter+'lex',place:r.room.letter+'land',animal:r.room.letter+'nimal',thing:r.room.letter+'hing'};
  await api({...payload,action:'save',answers:answer,sequence:1},a.token);
  const privateView=await api({action:'poll',code},b.token);assert.equal(privateView.room.answers[a.room.me],undefined);
  await api({...payload,action:'save',answers:{name:answer.name},sequence:1},b.token);
  r=await api({...payload,action:'submit',answers:answer,sequence:2},a.token);assert.equal(r.room.phase,'review');
  assert.equal(r.room.stoppedBy,a.room.me);
  assert.equal((await api({...payload,action:'submit',answers:answer,sequence:2},b.token)).status,409);
  assert.equal((await api({...payload,action:'save',answers:answer,sequence:3},b.token)).status,409);
  r=await api({action:'poll',code},b.token);assert.equal(r.room.phase,'review');assert.equal(r.room.pendingPoints[b.room.me],10);
  r=await api({...payload,action:'next'},a.token);assert.equal(r.room.phase,'finished');assert.equal(r.room.players[0].total,40);assert.equal(r.room.players[1].total,10);
  assert.equal((await api({...payload,action:'next'},a.token)).status,400);
  assert.equal((await api({action:'poll',code},'wrong')).status,401);
  const cross=await fetch(base+'/api/game',{method:'POST',headers:{'content-type':'application/json',origin:'https://example.net'},body:JSON.stringify({action:'create',name:'Bad',rounds:1,seconds:30})});assert.equal(cross.status,403);
  r=await api({action:'leave',code},b.token);assert.equal(r.status,200);assert.equal(r.room,null);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));await rm(dataDir,{recursive:true,force:true});}
});
