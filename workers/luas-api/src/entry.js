import forecastWorker from './index.js';
import {handlePushRequest,ReminderScheduler} from './push-reminders.js';

export {ReminderScheduler};

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/push/'))return handlePushRequest(request,env);
  return forecastWorker.fetch(request,env,ctx);
 }
};
