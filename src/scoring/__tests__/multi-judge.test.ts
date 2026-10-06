import {expect,it} from 'vitest';
import {scoreMultiJudge} from '../multi-judge';
const config={judgeCount:2,judgedRounds:1,aggregation:'average',rubric:[{key:'style',label:'Style',max:10},{key:'difficulty',label:'Difficulty',max:20}]};
const scores=[{assignmentId:'A',entryId:'e',ordinal:1,values:{style:0,difficulty:10}},{assignmentId:'B',entryId:'e',ordinal:1,values:{style:10,difficulty:20}}];
it('supports zero and hand calculated average / sum',()=>{expect(scoreMultiJudge(scores,config).primary).toBe(20);expect(scoreMultiJudge(scores,{...config,aggregation:'sum'}).primary).toBe(40);});
it('requires distinct judges and all bounded categories',()=>{expect(scoreMultiJudge(scores.slice(0,1),config).eligible).toBe(false);expect(scoreMultiJudge([scores[0],scores[0]],config).eligible).toBe(false);expect(scoreMultiJudge([{...scores[0],values:{style:11,difficulty:10}},scores[1]],config).details.error).toBeTruthy();expect(scoreMultiJudge(scores,{...config,judgedRounds:2}).eligible).toBe(false);});
