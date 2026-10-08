import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import RealStripe from "stripe";
import {plans} from "@/lib/billing/catalog";
const state=vi.hoisted(()=>({session:{} as Record<string,unknown>,rpc:vi.fn(),notice:vi.fn()}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({rpc:state.rpc})}));
vi.mock("@/lib/billing/notifications",()=>({deliverPaymentNotifications:state.notice}));
vi.mock("stripe",async importOriginal=>{
 const original=await importOriginal<typeof import("stripe")>();
 return {default:class extends original.default {
  constructor(key:string) {
   super(key);
   vi.spyOn(this.checkout.sessions,"retrieve").mockImplementation(async()=>state.session as unknown as RealStripe.Response<RealStripe.Checkout.Session>);
  }
 }};
});
import {POST} from "@/app/api/webhooks/stripe/route";
const secret="whsec_test_signature";
function request(type="checkout.session.completed",signature=true) {
 const body=JSON.stringify({id:"evt_test",type,data:{object:{id:"cs_test"}}});
 const headers=new Headers();
 if(signature) headers.set("stripe-signature",RealStripe.webhooks.generateTestHeaderString({payload:body,secret}));
 return new Request("https://example.test/api/webhooks/stripe",{method:"POST",body,headers});
}
beforeEach(()=>{
 vi.stubEnv("STRIPE_SECRET_KEY","sk_test_local");
 vi.stubEnv("STRIPE_WEBHOOK_SECRET",secret);
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.test");
 vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY","local_test_service");
 state.session={id:"cs_test",mode:"payment",payment_status:"paid",client_reference_id:"org",metadata:{orgId:"org",tier:"event_pass",userId:"owner"},
  amount_total:plans.event_pass.amount,currency:"usd",line_items:{data:[{quantity:1,price:{id:plans.event_pass.price}}]}};
 state.rpc.mockReset().mockResolvedValue({data:true,error:null});
 state.notice.mockReset().mockResolvedValue(0);
});
afterEach(()=>vi.unstubAllEnvs());
describe("Stripe payment boundary",()=>{
 it("rejects unsigned JSON in production",async()=>{vi.stubEnv("NODE_ENV","production");expect((await POST(request(undefined,false))).status).toBe(400);expect(state.rpc).not.toHaveBeenCalled();});
 it("fails closed when the signing secret is missing",async()=>{vi.stubEnv("STRIPE_WEBHOOK_SECRET","");expect((await POST(request())).status).toBe(503);});
 it("rejects an invalid signature",async()=>{const req=request();req.headers.set("stripe-signature","invalid");expect((await POST(req)).status).toBe(400);expect(state.rpc).not.toHaveBeenCalled();});
 it("waits for payment before granting access",async()=>{state.session.payment_status="unpaid";expect((await POST(request())).status).toBe(200);expect(state.rpc).not.toHaveBeenCalled();});
 it("rejects a mismatched paid tier and price",async()=>{state.session.metadata={orgId:"org",tier:"premium"};expect((await POST(request())).status).toBe(400);expect(state.rpc).not.toHaveBeenCalled();});
 it("activates a verified paid session before notifying",async()=>{expect((await POST(request())).status).toBe(200);expect(state.rpc).toHaveBeenCalledWith("apply_paid_entitlement",expect.objectContaining({p_session_id:"cs_test",p_tier:"event_pass",p_amount:plans.event_pass.amount}));expect(state.notice).toHaveBeenCalledOnce();});
 it("handles delayed payment success",async()=>{expect((await POST(request("checkout.session.async_payment_succeeded"))).status).toBe(200);expect(state.rpc).toHaveBeenCalledOnce();});
 it("returns failure so Stripe retries a failed activation",async()=>{state.rpc.mockResolvedValue({error:{message:"Temporary database failure"}});expect((await POST(request())).status).toBe(500);expect(state.notice).not.toHaveBeenCalled();});
});
