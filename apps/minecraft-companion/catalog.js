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
