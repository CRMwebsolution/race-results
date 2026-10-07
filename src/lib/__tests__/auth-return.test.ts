import {describe,it,expect} from 'vitest';
import {authReturnPath} from '../auth-return';
describe('invitation sign-in continuation',()=>{
 it('keeps the invitation destination for existing and new accounts',()=>{expect(authReturnPath('/invitations/12345678-1234-4234-9234-123456789abc')).toBe('/invitations/12345678-1234-4234-9234-123456789abc');});
 it('rejects external URLs, script schemes, traversal and malformed links',()=>{for(const path of ['https://evil.test','//evil.test','/\\evil.test','/invitations/../../admin','javascript:alert(1)','/invitations/nope',null])expect(authReturnPath(path)).toBe('/dashboard');});
});
