// Pure crafting expansion with inventory netting and pooled recipe surplus.
export function calculate(targets, inventory, catalog, mode="raw"){
 const need=new Map(),surplus=new Map(),steps=[],issues=[],active=new Set();
 const add=(map,id,n)=>map.set(id,(map.get(id)||0)+n);
 for(const [id,qty] of Object.entries(inventory||{}))if(Number.isSafeInteger(qty)&&qty>0)add(surplus,id,qty);
 function visit(id,quantity,depth=0){
  if(!Number.isSafeInteger(quantity)||quantity<=0)return;
  const item=catalog[id];if(!item){issues.push("Unknown item: "+id);add(need,id,quantity);return;}
  const available=Math.min(quantity,surplus.get(id)||0);if(available)surplus.set(id,surplus.get(id)-available);
  quantity-=available;if(!quantity)return;
  if(item.unresolved)issues.push("Choose a specific block for "+item.name);
  if(item.assumed)issues.push("Assumed recipe: "+item.name);
  if(item.special)issues.push("Fluid containers require manual collection: "+item.name);
  if((mode==="direct"&&depth>=1)||!item.recipe||item.unresolved){add(need,id,quantity);return;}
  if(active.has(id)){issues.push("Cycle detected at "+item.name);add(need,id,quantity);return;}
  const recipe=item.recipe;
  if(!Number.isSafeInteger(recipe.out)||recipe.out<=0||!Array.isArray(recipe.uses)){issues.push("Invalid recipe: "+id);add(need,id,quantity);return;}
  const batches=Math.ceil(quantity/recipe.out),made=batches*recipe.out;
  if(made>quantity)add(surplus,id,made-quantity);
  steps.push({id,batches,made,requested:quantity,station:recipe.station||"Crafting Table",fuel:!!recipe.fuel});
  active.add(id);
  for(const [ingredient,count] of recipe.uses)visit(ingredient,count*batches,depth+1);
  active.delete(id);
 }
 for(const [id,qty] of Object.entries(targets||{}))visit(id,qty);
 return {materials:Object.fromEntries([...need].filter(([,n])=>n>0).sort(([a],[b])=>a.localeCompare(b))),surplus:Object.fromEntries([...surplus].filter(([,n])=>n>0)),steps,issues:[...new Set(issues)]};
}
export function expandTree(id,quantity,catalog,stack=[]){
 const item=catalog[id];if(!item)return{id,quantity,unknown:true};
 if(stack.includes(id))return{id,quantity,cycle:true};
 const r=item.recipe;
 if(!r)return{id,quantity,where:item.where||"",leaf:true};
 const batches=Math.ceil(quantity/r.out);
 return{id,quantity,batches,station:r.station||"Crafting Table",where:item.where||"",children:r.uses.map(([child,amount])=>expandTree(child,amount*batches,catalog,[...stack,id]))};
}