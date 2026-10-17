import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from './catalog.js';
import {calculate,expandTree} from './engine.js';
test('new building and redstone crafting recipes resolve ingredients',()=>{
 for(const id of ['crafting_table','furnace','piston','sticky_piston','dropper','repeater','comparator','redstone_lamp','barrel','rail','powered_rail']){
  assert.ok(ITEMS[id]?.recipe,id+' needs recipe');
  const result=calculate({[id]:1},{},ITEMS);
  assert.ok(Object.keys(result.materials).length,id+' requires world materials');
  assert.ok(result.steps.some(s=>s.id===id),id+' must include crafting step');
 }
});
test('crafting grids represent matching ingredient counts when a grid is declared',()=>{
 const symbols={P:'planks',C:'cobblestone',I:'iron_ingot',R:'redstone',S:'stick',T:'redstone_torch',Q:'nether_quartz',D:'glowstone_dust',G:'gold_ingot'};
 const overrides={sticky_piston:{P:'piston',S:'slime_ball'},torch:{C:'coal'},redstone_lamp:{G:'glowstone'},barrel:{S:'wooden_slab'}};
 for(const [id,item] of Object.entries(ITEMS)){
  if(!item.recipe?.shape)continue;
  const map={...symbols,...overrides[id]};
  const shape=item.recipe.shape;
  assert.equal(shape.length,3,id+' requires three rows');
  assert.ok(shape.every(s=>s.length===3),id+' requires 3 columns');
  const actual={};for(const ch of shape.join(''))if(ch!==' '){assert.ok(map[ch],id+' has unknown symbol '+ch);actual[map[ch]]=(actual[map[ch]]||0)+1}
  assert.deepEqual(actual,Object.fromEntries(item.recipe.uses),id+' shape matches ingredient totals');
 }
});
test('powered rail has six outputs per craft',()=>{
 const t=expandTree('powered_rail',7,ITEMS);assert.equal(t.batches,2);
});
