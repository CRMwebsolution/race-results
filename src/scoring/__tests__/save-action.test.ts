import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, revalidate } = vi.hoisted(() => ({ rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/server",() => ({ createClient: async () => ({ rpc }) }));
vi.mock("next/cache",() => ({ revalidatePath: revalidate }));
import { saveAttempt } from "@/app/dashboard/tracks/[trackId]/events/[eventId]/scoring/actions";

describe("Scoring save boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("rejects invalid input before reaching the database", async () => {
    const result=await saveAttempt("track","event","class","entry",1,"typo",0,0);
    expect(result.success).toBe(false); expect(rpc).not.toHaveBeenCalled();
  });
  it("passes exact input, penalties, nullable measurements and the cell version to one atomic RPC", async () => {
    rpc.mockResolvedValue({data:{attempt:{id:"saved"},working_revision:42,published_revision:42},error:null});
    const result=await saveAttempt("track","event","class","entry",2," 9.082 s ",500,3);
    expect(rpc).toHaveBeenCalledWith("save_race_attempt",expect.objectContaining({
      p_elapsed_ms:9082,p_distance_mm:null,p_penalty_ms:500,p_raw_input:" 9.082 s ",p_expected_version:3,
    }));
    expect(result).toMatchObject({success:true,working_revision:42});
    expect(revalidate).toHaveBeenCalledOnce();
  });
  it("returns a conflict or database error without claiming success or revalidating", async () => {
    rpc.mockResolvedValue({data:null,error:{message:"Changed in another session"}});
    expect(await saveAttempt("t","e","c","r",1,"9",0,0)).toEqual({success:false,error:"Changed in another session"});
    expect(revalidate).not.toHaveBeenCalled();
  });
});
