import {describe,it,expect,vi} from "vitest";
import {pitRace} from "../pit-race";
import {officialResult} from "../official-results";
import {readAll} from "../read-all";
vi.mock("../official-results",()=>({officialResult:vi.fn()}));
vi.mock("../read-all",()=>({readAll:vi.fn()}));
describe("completed pit results",()=>{
 it("loads the frozen official payload without querying working rows",async()=>{
  const payload={event:{id:"race",name:"Official name",status:"completed",published_revision:3},
   classes:[{id:"class",name:"Original class",scoring_type:"fastest_pass",scoring_config:{},order_num:1}],
   entries:[],attempts:[],results:[],judge_scores:[]};
  vi.mocked(officialResult).mockResolvedValue({payload,version:2} as unknown as NonNullable<Awaited<ReturnType<typeof officialResult>>>);
  vi.mocked(readAll).mockClear();
  const result=await pitRace({} as Parameters<typeof pitRace>[0],{id:"race",name:"Working name",status:"completed",published_revision:3});
  expect(result.event.name).toBe("Official name");
  expect(result.classes[0].name).toBe("Original class");
  expect(result.officialResults).toEqual([]);
  expect(result.officialVersion).toBe(2);
  expect(readAll).not.toHaveBeenCalled();
 });
 it("reports a missing official version instead of silently recalculating",async()=>{
  vi.mocked(officialResult).mockResolvedValue(null);
  await expect(pitRace({} as Parameters<typeof pitRace>[0],{id:"race",name:"Race",status:"completed",published_revision:3})).rejects.toThrow("Official results are unavailable");
 });
});
