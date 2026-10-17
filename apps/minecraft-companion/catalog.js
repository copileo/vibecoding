// Starter fixture, NOT a complete Mojang dataset. Recipes are explicit and versioned separately from client releases.
export const CLIENT_EDITION="Java Edition";
export const CLIENT_VERSION="1.21.10";
export const DATA_STATUS="Curated starter fixture · not a complete version-verified recipe database";
export const SAMPLE=[
["building_block",30],["glass",10],["dispenser",4],["note_block",2],["observer",5],["slab",3],["chest",2],["hopper",3],["trapdoor",1],["fence",1],["sign",3],["ladder",4],["stone_button",2],["lava_bucket",3],["water_bucket",1]
];
const item=(name,recipe=null,where="",extra={})=>({name,recipe,where,...extra});
export const ITEMS={
building_block:item("Building Block (choose material)",null,"Choose the actual building block for an accurate bill of materials.",{unresolved:true}),
glass:item("Glass", {out:1,uses:[["sand",1]],station:"Furnace",fuel:true},"Smelt sand in a furnace."),
sand:item("Sand",null,"Dig sand on beaches, rivers or deserts."),
dispenser:item("Dispenser",{out:1,uses:[["cobblestone",7],["bow",1],["redstone",1]]},"Craft with cobblestone, a bow and redstone."),
cobblestone:item("Cobblestone",null,"Mine stone with a pickaxe."),
bow:item("Bow",{out:1,uses:[["stick",3],["string",3]]},"Craft sticks and string, or find a bow by other means."),
string:item("String",null,"Commonly dropped by spiders; also found in cobwebs and loot."),
stick:item("Stick",{out:4,uses:[["planks",2]]},"Craft from wooden planks."),
planks:item("Oak Planks",{out:4,uses:[["oak_log",1]]},"Craft from oak logs; other wood types can be substituted."),
oak_log:item("Oak Log",null,"Chop oak trees."),
redstone:item("Redstone Dust",null,"Mine redstone ore, typically deep underground, with an iron-tier or better pickaxe."),
note_block:item("Note Block",{out:1,uses:[["planks",8],["redstone",1]]},"Craft with planks and redstone."),
observer:item("Observer",{out:1,uses:[["cobblestone",6],["redstone",2],["nether_quartz",1]]},"Requires Nether quartz."),
nether_quartz:item("Nether Quartz",null,"Mine Nether quartz ore in the Nether."),
slab:item("Stone Slab (assumed)",{out:6,uses:[["stone",3]]},"Recipe depends on slab type.",{assumed:true}),
stone:item("Stone", {out:1,uses:[["cobblestone",1]],station:"Furnace",fuel:true},"Mine stone with Silk Touch or smelt cobblestone."),
chest:item("Chest",{out:1,uses:[["planks",8]]},"Craft using any supported wooden planks."),
hopper:item("Hopper",{out:1,uses:[["iron_ingot",5],["chest",1]]},"Craft using iron ingots and a chest."),
iron_ingot:item("Iron Ingot",{out:1,uses:[["raw_iron",1]],station:"Furnace",fuel:true},"Smelt raw iron or obtain iron ingots through other methods."),
raw_iron:item("Raw Iron",null,"Mine iron ore with a stone-tier or better pickaxe."),
trapdoor:item("Oak Trapdoor (assumed)",{out:2,uses:[["planks",6]]},"Wood type is unspecified in the reference image.",{assumed:true}),
fence:item("Oak Fence (assumed)",{out:3,uses:[["planks",4],["stick",2]]},"Wood type is unspecified in the reference image.",{assumed:true}),
sign:item("Oak Sign (assumed)",{out:3,uses:[["planks",6],["stick",1]]},"Wood type is unspecified in the reference image.",{assumed:true}),
ladder:item("Ladder",{out:3,uses:[["stick",7]]},"Craft from sticks."),
stone_button:item("Stone Button",{out:1,uses:[["stone",1]]},"Craft from stone."),
lava_bucket:item("Lava Bucket",{out:1,uses:[["bucket",1],["lava_source",1]],station:"Fill bucket"},"Find lava pools in the Overworld or Nether. A filled bucket is required; lava is not a crafting-table ingredient.",{special:true}),
water_bucket:item("Water Bucket",{out:1,uses:[["bucket",1],["water_source",1]],station:"Fill bucket"},"Collect water using a bucket. Water sources are not consumed like ordinary inventory items.",{special:true}),
bucket:item("Bucket",{out:1,uses:[["iron_ingot",3]]},"Craft from three iron ingots; buckets can be reused after emptying."),
lava_source:item("Lava source (fluid)",null,"Find and collect lava; source blocks are tracked as fluid requirements.",{fluid:true}),
water_source:item("Water source (fluid)",null,"Find and collect water; source blocks are tracked as fluid requirements.",{fluid:true})
};
export const display=id=>ITEMS[id]?.name??id;

// Supplemental Java crafting recipes for common building and redstone components.
// Shapes are standard 3×3 crafting patterns; null cells are empty. All recipes
// require a version-specific data audit before being called complete.
const additional = {
crafting_table:item("Crafting Table",{out:1,uses:[["planks",4]],shape:["PP ","PP ","   "]},"Craft from four planks."),
furnace:item("Furnace",{out:1,uses:[["cobblestone",8]],shape:["CCC","C C","CCC"]},"Craft from eight cobblestone."),
torch:item("Torch",{out:4,uses:[["coal",1],["stick",1]],shape:[" C "," S ","   "]},"Craft from coal and a stick."),
coal:item("Coal",null,"Mine coal ore, or find coal in loot."),
piston:item("Piston",{out:1,uses:[["planks",3],["cobblestone",4],["iron_ingot",1],["redstone",1]],shape:["PPP","CIC","CRC"]},"Craft from planks, cobblestone, iron and redstone."),
sticky_piston:item("Sticky Piston",{out:1,uses:[["piston",1],["slime_ball",1]],shape:[" S "," P ","   "]},"Craft using a piston and slime ball."),
slime_ball:item("Slimeball",null,"Dropped by slimes; also obtainable by other game mechanics."),
dropper:item("Dropper",{out:1,uses:[["cobblestone",7],["redstone",1]],shape:["CCC","C C","CRC"]},"Craft from cobblestone and redstone."),
redstone_torch:item("Redstone Torch",{out:1,uses:[["redstone",1],["stick",1]],shape:[" R "," S ","   "]},"Craft from redstone dust and a stick."),
lever:item("Lever",{out:1,uses:[["stick",1],["cobblestone",1]],shape:[" S "," C ","   "]},"Craft from a stick and cobblestone."),
repeater:item("Redstone Repeater",{out:1,uses:[["redstone_torch",2],["redstone",1],["stone",3]],shape:["   ","TRT","SSS"]},"Craft with redstone torches, redstone and stone."),
comparator:item("Redstone Comparator",{out:1,uses:[["redstone_torch",3],["nether_quartz",1],["stone",3]],shape:[" T ","TQT","SSS"]},"Craft using Nether quartz, redstone torches and stone."),
redstone_lamp:item("Redstone Lamp",{out:1,uses:[["glowstone",1],["redstone",4]],shape:[" R ","RGR"," R "]},"Craft using a glowstone block and redstone."),
glowstone:item("Glowstone",{out:1,uses:[["glowstone_dust",4]],shape:["DD ","DD ","   "]},"Craft glowstone dust into a block."),
glowstone_dust:item("Glowstone Dust",null,"Break glowstone in the Nether or obtain from other sources."),
barrel:item("Barrel",{out:1,uses:[["planks",6],["slab",2]],shape:["PSP","P P","PSP"]},"Craft using six planks and two wooden slabs; the starter slab item is stone, so this recipe requires a separate wooden slab.",{unresolved:true}),
wooden_slab:item("Oak Slab",{out:6,uses:[["planks",3]],shape:["   ","   ","PPP"]},"Craft wooden slabs from matching planks."),
rail:item("Rail",{out:16,uses:[["iron_ingot",6],["stick",1]],shape:["I I","ISI","I I"]},"Craft rails from iron ingots and a stick."),
powered_rail:item("Powered Rail",{out:6,uses:[["gold_ingot",6],["stick",1],["redstone",1]],shape:["G G","GSG","GRG"]},"Craft powered rails using gold, stick and redstone."),
gold_ingot:item("Gold Ingot",{out:1,uses:[["raw_gold",1]],station:"Furnace",fuel:true},"Smelt raw gold."),
raw_gold:item("Raw Gold",null,"Mine gold ore with an iron-tier or better pickaxe.")
};
Object.assign(ITEMS,additional);
// Correct the barrel ingredient definition to use the newly modeled wooden slab.
ITEMS.barrel.recipe.uses=[["planks",6],["wooden_slab",2]];
delete ITEMS.barrel.unresolved;
