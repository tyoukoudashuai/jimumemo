const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
function translator(language){const context={window:{},localStorage:{getItem:()=>language}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/i18n.js'),'utf8'),context);return context.window.FitnessI18n;}
test('Chinese and English cover navigation, compound muscles and parameterized guidance',()=>{
  const en=translator('en'),zh=translator('zh');
  assert.equal(en.translate('カレンダー'),'Calendar');assert.equal(zh.translate('カレンダー'),'日历');
  assert.equal(en.translate('胸・肩・三頭筋'),'Chest · Shoulders · Triceps');
  assert.equal(en.translate('次回も40 kgを維持し、10回を目安にしましょう。'),'Keep 40 kg and aim for 10 reps next time.');
  assert.equal(zh.translate('対象部位を最後にトレーニングした日時に、設定した72時間を加えています。'),'最近相关部位训练时间加上设定的 72 小时。');
});
test('custom names and unknown user content are preserved',()=>{
  const en=translator('en');en.setNames({plans:{'3':{name:'3分割',days:[{name:'私の胸トレ'}]}},exerciseCatalog:[],sessions:[]});
  assert.equal(en.translate('私の胸トレ'),'私の胸トレ');
  assert.equal(en.translate('「私の胸トレ」と、この日に入力中のセットを削除しますか？'),'Delete “私の胸トレ” and its draft sets?');
});
