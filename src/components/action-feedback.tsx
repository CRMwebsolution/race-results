export function explainError(message:string,fallback='Please try again. If it still fails, reload this page.'){
 if(/not authorized|not permitted|permission denied|only an? owner|only.*owner/i.test(message))return 'Your account does not have permission to make this change.';
 if(/completed.*lock|reopen.*event|reopen.*race|event.*completed/i.test(message))return 'This race is already completed. The organizer can reopen it to make a correction.';
 if(/changed|PT409|revision|conflict/i.test(message))return 'Someone else updated these results. Reload to see their changes, then try again.';
 if(/network|fetch|connection|timeout|upload and close|offline scoring session/i.test(message))return 'Some results have not finished saving. Reconnect and try again.';
 if(/class and event|cross.class|registration.*class/i.test(message))return 'Choose a contestant and class that belong to this race.';
 if(/date|joined_on|left_on/i.test(message))return 'Check the registration dates and try again.';
 if(/violates|constraint|duplicate key|relation|column|uuid|SQL|PGRST|JSON|invalid input syntax|null value/i.test(message))return fallback;
 return message || fallback;
}
export function ActionFeedback({message,error}:{message?:string;error?:string}){
 if(error)return <p role="alert" className="rounded-lg border border-red-500 bg-red-500/10 p-3 text-red-400">Couldn’t save. {explainError(error)}</p>;
 if(message)return <p role="status" className="rounded-lg border border-emerald-500 bg-emerald-500/10 p-3 text-emerald-400">{message}</p>;
 return null;
}
