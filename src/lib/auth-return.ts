/** Only invitation continuations are accepted from the sign-in/create-account forms. */
export function authReturnPath(value:unknown):string {
 return typeof value==='string'&&/^\/invitations\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:'/dashboard';
}
