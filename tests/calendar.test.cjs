const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../js/model.js');
const calendar=require('../js/calendar.js');
function fixture(){
  const state=model.createInitialState();
  const at=new Date(2026,11,30,14);
  state.sessions.push({sessionId:'test-session',planId:'3',planDayId:'day-3-push',date:model.localDate(at),completedAt:at.toISOString(),dayName:'胸',parts:['胸'],exercises:[{exerciseId:'exercise-bench-press',name:'ベンチプレス',sets:[{weight:40,reps:10,rir:2}]}]});
  return {state,at};
}
test('empty calendar, month/year boundary and automatic plan rotation',()=>{
  assert.equal(calendar.proposal(model.createInitialState()),null);
  const {state,at}=fixture();const result=calendar.proposal(state,at);
  assert.equal(result.day.id,'day-3-pull');
  assert.equal(model.localDate(result.at),'2027-01-01');
  assert.equal(result.at-at,48*3600000);
});
test('reported fatigue adds transparent buffer and severe current fatigue holds training',()=>{
  const {state,at}=fixture();
  state.recoveryCheckIns.push({id:'check-test',sessionId:'test-session',recordedAt:at.toISOString(),planDayId:'day-3-push',dayName:'胸',fatigue:4,soreness:{},sleepHours:null,sleepQuality:null,feeling:null});
  assert.equal(calendar.proposal(state,at).bufferHours,48);
  assert.equal(calendar.proposal(state,at).held,true);
  state.recoveryCheckIns[0].fatigue=3;
  assert.equal(calendar.proposal(state,at).bufferHours,24);
  state.recoveryCheckIns[0].fatigue=null;
  assert.equal(calendar.proposal(state,at).bufferHours,0);
});
test('manual dates persist, cancel/restore and deleting source removes generated event',()=>{
  const {state,at}=fixture();const id=calendar.proposal(state,at).id;
  state.calendarOverrides[id]='2027-02-01T10:00:00.000Z';
  let raw;model.saveState({setItem:(key,value)=>raw=value},state);
  const loaded=model.loadState({getItem:()=>raw}).state;
  assert.equal(calendar.proposal(loaded,at).manual,true);
  state.calendarOverrides[id]=null;
  assert.equal(calendar.proposal(state,at).cancelled,true);
  delete state.calendarOverrides[id];
  assert.equal(calendar.proposal(state,at).cancelled,false);
  state.sessions=[];
  assert.equal(calendar.proposal(state,at),null);
});
test('v3 migration preserves source records and adds calendar overrides',()=>{
  const {state}=fixture();state.schemaVersion=3;delete state.calendarOverrides;
  const raw=JSON.stringify(state);const loaded=model.loadState({getItem:()=>raw});
  assert.equal(loaded.error,null);assert.equal(loaded.raw,raw);
  assert.deepEqual(loaded.state.sessions,state.sessions);assert.deepEqual(loaded.state.calendarOverrides,{});
});
