import {describe,it,expect} from "vitest";
import {latestScoringClass} from "../pit-activity";
const classes=[{id:"a",order_num:1},{id:"b",order_num:2}];
describe("pit follows latest scoring activity",()=>{
 it("chooses the newest row even when another class has many more attempts",()=>{
  const old=Array.from({length:8},()=>({event_class_id:"a",updated_at:"2026-10-08T12:00:00Z"}));
  expect(latestScoringClass(classes,[...old,{event_class_id:"b",updated_at:"2026-10-08T12:01:00Z"}])).toBe("b");
 });
 it("follows an edit to an earlier run",()=>{
  expect(latestScoringClass(classes,[{event_class_id:"a",updated_at:"2026-10-08T12:02:00Z"},{event_class_id:"b",updated_at:"2026-10-08T12:01:00Z"}])).toBe("a");
 });
 it("includes judge edits",()=>{
  expect(latestScoringClass(classes,[{event_class_id:"a",updated_at:"2026-10-08T12:02:00Z"}],[{event_class_id:"b",updated_at:"2026-10-08T12:03:00Z"}])).toBe("b");
 });
 it("uses running order when there is no known activity",()=>expect(latestScoringClass([...classes].reverse(),[{event_class_id:"b",updated_at:null}])).toBe("a"));
 it("ignores unknown classes and invalid timestamps",()=>expect(latestScoringClass(classes,[{event_class_id:"outside",updated_at:"2026-10-08T12:02:00Z"},{event_class_id:"b",updated_at:"invalid"}])).toBe("a"));
});
