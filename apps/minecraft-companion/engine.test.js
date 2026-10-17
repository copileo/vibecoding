import test from "node:test";import assert from "node:assert/strict";
import {calculate,expandTree} from "./engine.js";import {ITEMS,SAMPLE} from "./catalog.js";
test("bow recipe pools sticks and exposes two planks",()=>{const r=calculate({bow:1},{},ITEMS);assert.equal(r.materials.string,3);assert.equal(r.materials.oak_log,1);assert.equal(r.surplus.stick,1)});
test("three hoppers require 15 iron ingots and three chests",()=>{const r=calculate({hopper:3},{},ITEMS,"direct");assert.deepEqual(r.materials,{chest:3,iron_ingot:15})});
test("inventory offsets input targets",()=>{const r=calculate({bow:1},{string:2,oak_log:1},ITEMS);assert.equal(r.materials.string,1);assert.equal(r.materials.oak_log,undefined)});
test("batch crafting reuses surplus across separate targets",()=>{const r=calculate({ladder:4,stick:1},{},ITEMS);assert.equal(r.surplus.ladder,2);assert.ok(r.materials.oak_log>=1)});
test("sample fixture includes all 15 items and quantities",()=>{assert.equal(SAMPLE.length,15);assert.equal(SAMPLE.reduce((n,[,q])=>n+q,0),74);const r=calculate(Object.fromEntries(SAMPLE),{},ITEMS);assert.ok(r.issues.some(x=>x.includes("specific block")))});
test("tree expansion terminates at raw resources",()=>{const tree=expandTree("bow",1,ITEMS);assert.equal(tree.children.length,2);assert.equal(tree.children[1].id,"string")});
