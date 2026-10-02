export function createEngine(activity,context){
 let disposed=false,answer=null,revision=0;
 return{
 dispatch(action){if(disposed||action.activityId!==activity.id||action.sessionId!==context.sessionId||action.type!=='fixtures/select'||typeof action.payload.answer!=='string')return{status:'rejected',actionId:action.id,code:disposed?'action.disposed':'action.invalid',path:'',message:'The fixture action is unavailable.'};answer=action.payload.answer;return{status:'accepted',actionId:action.id,revision:++revision};},
 evaluate:()=>({protocolVersion:'1.0.0',resultVersion:'1.0.0',activityId:activity.id,sessionId:context.sessionId,revision,evidence:[],status:'completed',score:{value:answer===activity.config.expectedAnswer?1:0,scale:'normalized'}}),
 serialize:()=>{throw Error('Fixture does not claim resumable support.');},
 restore:()=>{throw Error('Fixture does not claim resumable support.');},
 dispose:()=>{disposed=true;},
 get disposed(){return disposed;}
 };
}
export const evaluate=session=>session.evaluate();
