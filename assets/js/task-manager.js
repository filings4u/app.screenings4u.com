(()=>{
"use strict";
const API="enterprise-task-management";
const $=q=>document.querySelector(q);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let state={tasks:[],staff:[],organizations:[],counts:{}},editing=null,view="all";
const currentWorkspace=new URLSearchParams(location.search).get("workspace")==="workforce"?"workforce":"dot";
function message(t){const e=$("#taskMessage");if(e)e.textContent=t||""}
async function call(action,params={}){
 const {data,error}=await window.dotSupabase.functions.invoke(API,{body:{action,...params}});
 if(error||data?.error)throw Error(data?.error||error?.message||"Task service unavailable");
 return data;
}
function opt(items,value,label){return items.map(x=>'<option value="'+esc(value(x))+'">'+esc(label(x))+'</option>').join("")}
const fmt=x=>x?new Date(x).toLocaleString():"Not set";
function mount(){
 $("#dotPageMount").innerHTML='<div class="task-area"><div class="task-heading"><div><h1>Task Manager</h1><p>One workspace for DOT and NON-DOT tasks, assignments, and notification controls.</p></div><button class="task-btn primary" id="newTask">+ Create Task</button></div><div class="task-stats" id="taskStats"></div><div class="task-toolbar"><select id="businessFilter"><option value="all">All Businesses</option><option value="dot">DOT</option><option value="workforce">NON-DOT</option></select><select id="statusFilter"><option value="all">All Statuses</option><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><input id="taskSearch" placeholder="Search tasks, descriptions, customers..." aria-label="Search tasks"><button class="task-btn" id="refreshTasks">Refresh</button></div><div id="taskMessage" class="task-message" role="status"></div><div id="taskList" class="task-list"></div></div><section id="taskModal" class="task-modal" hidden><div class="task-modal-panel" role="dialog" aria-modal="true" aria-labelledby="taskFormTitle"><div class="task-heading"><h2 id="taskFormTitle">Create Task</h2><button id="cancelTask" class="task-btn" type="button">Close</button></div><form id="taskForm" class="task-form"><input type="hidden" name="id"><label class="wide">Task title<input name="title" required maxlength="180"></label><label class="wide">Description<textarea name="description"></textarea></label><label>Business<select name="business_unit_code"><option value="dot">DOT</option><option value="workforce">NON-DOT</option></select></label><label>Priority<select name="priority"><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Status<select name="status"><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label>Due date<input name="due_at" type="datetime-local"></label><label>Assigned staff<select name="assigned_to" id="taskAssignee"></select></label><label>Internal follow-up date<input name="reminder_at" type="datetime-local"></label><label class="wide">Additional internal staff to notify<select name="watcher_ids" id="taskWatchers" multiple size="4"></select><small>Use Ctrl/Command to select multiple staff. Customers must not be assigned as watchers.</small></label><label>Organization<select name="organization_id" id="taskOrganization"></select></label><label class="wide">Task categories<input name="tags" placeholder="Enter categories separated by commas"></label><div class="wide task-section-head"><h3>Internal staff notifications</h3><p>These are internal task updates, not messages to customers.</p></div><label class="task-check"><span>Notify assigned staff in the portal</span><input name="notify_portal" type="checkbox" checked></label><label class="task-check"><span>Email assigned internal staff</span><input name="notify_email" type="checkbox"></label><div class="wide task-customer-panel"><h3>Customer communications</h3><p>Send a branded appointment, event, reminder, or confirmation request separately. Saving this task will not contact the customer.</p><a class="task-btn" href="task-automations.html">Manage Customer Communications →</a></div><div class="wide task-card-actions"><button type="submit" class="task-btn orange" id="saveTask">Save Task</button><button type="button" class="task-btn" id="cancelTask2">Cancel</button></div></form></div></section>';
 $("#newTask").onclick=()=>openForm();$("#refreshTasks").onclick=load;
 $("#businessFilter").value=currentWorkspace;
 ["businessFilter","statusFilter","taskSearch"].forEach(id=>$("#"+id).addEventListener(id==="taskSearch"?"input":"change",render));
 $("#cancelTask").onclick=$("#cancelTask2").onclick=()=>$("#taskModal").hidden=true;
 $("#taskForm").onsubmit=save;
}
function render(){
 const tasks=state.tasks||[],today=new Date();today.setHours(0,0,0,0);
 const stats=[["Total",tasks.length],["Active",tasks.filter(x=>!["completed","cancelled"].includes(x.status)).length],["Due Today",tasks.filter(x=>x.due_at&&new Date(x.due_at).toDateString()===today.toDateString()&&x.status!=="completed").length],["Overdue",tasks.filter(x=>x.due_at&&new Date(x.due_at)<today&&!["completed","cancelled"].includes(x.status)).length],["Completed",tasks.filter(x=>x.status==="completed").length]];
 $("#taskStats").innerHTML=stats.map(([name,n])=>'<div class="task-stat"><span>'+name+'</span><b>'+n+'</b></div>').join("");
 const business=$("#businessFilter").value,status=$("#statusFilter").value,search=$("#taskSearch").value.toLowerCase().trim();
 const rows=tasks.filter(t=>(business==="all"||t.business_unit_code===business)&&(status==="all"||t.status===status)&&(!search||[t.title,t.description,t.task_number].join(" ").toLowerCase().includes(search)));
 $("#taskList").innerHTML=rows.length?rows.map(t=>'<article class="task-card"><div><h3>'+esc(t.title)+'</h3><p><span class="task-tag">'+esc(t.business_unit_code==="workforce"?"NON-DOT":String(t.business_unit_code||"General").toUpperCase())+'</span><span class="task-tag">'+esc(t.priority||"normal")+'</span><span class="task-tag">'+esc(t.status||"todo")+'</span>Due: '+esc(fmt(t.due_at))+'</p><p>'+esc(t.description||"")+'</p></div><div class="task-card-actions"><button class="task-btn" data-edit="'+esc(t.id)+'">Manage</button></div></article>').join(""):'<div class="task-card">No tasks match these filters.</div>';
 $("#taskList").querySelectorAll("[data-edit]").forEach(btn=>btn.onclick=()=>openForm(state.tasks.find(t=>t.id===btn.dataset.edit)));
}
function openForm(t=null){
 editing=t;const f=$("#taskForm");f.reset();$("#taskFormTitle").textContent=t?"Manage Task":"Create Task";
 $("#taskAssignee").innerHTML='<option value="">Unassigned</option>'+opt(state.staff||[],x=>x.user_id,x=>x.display_name||x.email);
 $("#taskWatchers").innerHTML=opt(state.staff||[],x=>x.user_id,x=>x.display_name||x.email);
 $("#taskOrganization").innerHTML='<option value="">No organization</option>'+opt(state.organizations||[],x=>x.id,x=>x.dba_name||x.legal_name);
 f.elements.id.value=t?.id||"";for(const key of ["title","description","priority","status","business_unit_code","assigned_to","organization_id"]){if(f.elements[key])f.elements[key].value=t?.[key]||((key==="business_unit_code")?(currentWorkspace==="workforce"?"workforce":"dot"):"");}
 if(!t){f.elements.status.value="todo";f.elements.priority.value="normal";}
 Array.from(f.elements.watcher_ids.options).forEach(o=>o.selected=(t?.watcher_ids||[]).includes(o.value));
 f.elements.reminder_at.value=t?.reminder_at?new Date(new Date(t.reminder_at).getTime()-new Date(t.reminder_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
 f.elements.due_at.value=t?.due_at?new Date(new Date(t.due_at).getTime()-new Date(t.due_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
 f.elements.tags.value=(t?.tags||[]).join(", ");
 f.elements.notify_portal.checked=t?.notify_portal===true;f.elements.notify_email.checked=t?.notify_email===true;
 $("#taskModal").hidden=false;f.elements.title.focus();
}
async function save(e){
 e.preventDefault();const f=e.currentTarget,fd=new FormData(f),task={};
 for(const key of ["id","title","description","priority","status","business_unit_code","assigned_to","organization_id"])task[key]=String(fd.get(key)||"");
 if(!task.id)delete task.id;
 task.watcher_ids=Array.from(f.elements.watcher_ids.selectedOptions).map(o=>o.value);
 task.reminder_at=fd.get("reminder_at")?new Date(fd.get("reminder_at")).toISOString():null;
 task.due_at=fd.get("due_at")?new Date(fd.get("due_at")).toISOString():null;
 task.tags=String(fd.get("tags")||"").split(",").map(x=>x.trim()).filter(Boolean);
 task.notify_portal=f.elements.notify_portal.checked;task.notify_email=f.elements.notify_email.checked;
 const btn=$("#saveTask");btn.disabled=true;
 try{await call("save_task",{task});$("#taskModal").hidden=true;await load();message("Task saved.")}catch(e){alert(e.message)}finally{btn.disabled=false}
}
async function load(){try{message("Loading tasks...");state=await call("workspace");render();message("")}catch(e){message(e.message)}}
async function initializeTaskManager(){
 try{const auth=await window.DOTAuth.requireAuth();if(!auth)return;window.DOTShell.render(auth);mount();await load()}
 catch(e){const root=$("#dotPageMount")||document.body;root.textContent=e.message||String(e)}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initializeTaskManager,{once:true});else initializeTaskManager();
})();