// Tasneef HTML App V3 - Supabase
const SUPABASE_URL = "https://zmjdqiswytxlbfgnfjfv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);
const nowTime = () => new Date().toTimeString().slice(0,5);
const session = () => JSON.parse(localStorage.getItem('tasneef_user') || 'null');
const setSession = u => localStorage.setItem('tasneef_user', JSON.stringify(u));
const clearSession = () => localStorage.removeItem('tasneef_user');
const fmt = d => d ? new Date(d).toLocaleString('ar-SA') : '-';
const timeOnly = d => d ? new Date(d).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}) : '-';
const minsToText = m => { m=Number(m||0); const h=Math.floor(m/60), mm=m%60; return `${h}:${String(mm).padStart(2,'0')}`; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let data = { users:[], supervisors:[], projects:[], workers:[], attendance:[], logs:[], tickets:[] };
function msg(text, type='ok'){ const el=$('globalMsg')||$('loginMsg'); if(!el) return; el.className='msg '+(type==='err'?'err':''); el.textContent=text; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),4000); }
function playAppSound(type){ try{ const files={checkin:'sounds/checkin.wav', checkout:'sounds/checkout.wav', ticket:'sounds/ticket.wav'}; const src=files[type]; if(!src) return; const a=new Audio(src); a.volume=0.75; a.play().catch(()=>{}); }catch(e){} }
function requireRole(role){ const u=session(); if(!u){ location.href='index.html'; return null; } if(role && u.role!==role){ location.href=u.role==='admin'?'admin.html':'supervisor.html'; return null; } return u; }
async function login(){
  const username=$('loginUsername').value.trim(), password=$('loginPassword').value.trim();
  if(!username||!password) return msg('أدخل اسم المستخدم وكلمة المرور','err');
  if(username==='admin' && password==='123456'){
    setSession({id:1,full_name:'مدير النظام',username:'admin',role:'admin',is_active:true});
    location.href='admin.html'; return;
  }
  const {data:u,error}=await sb.from('app_users').select('*').eq('username',username).eq('password',password).eq('is_active',true).maybeSingle();
  if(error||!u) return msg(error?.message || 'بيانات الدخول غير صحيحة','err');
  setSession(u); location.href=u.role==='admin'?'admin.html':'supervisor.html';
}
function logout(){ clearSession(); location.href='index.html'; }
async function loadAll(){
  const [users, projects, workers, attendance, logs, tickets] = await Promise.all([
    sb.from('app_users').select('*').order('id'),
    sb.from('projects').select('*').order('id'),
    sb.from('workers').select('*').order('id'),
    sb.from('attendance').select('*').order('attendance_date',{ascending:false}),
    sb.from('time_logs').select('*').order('check_in',{ascending:false}),
    sb.from('tickets').select('*').order('created_at',{ascending:false})
  ]);
  for(const r of [users,projects,workers,attendance,logs,tickets]) if(r.error) console.warn(r.error.message);
  data.users = users.data || []; data.supervisors = data.users.filter(u=>u.role==='supervisor' && u.is_active!==false);
  data.projects = projects.data || []; data.workers = workers.data || []; data.attendance = attendance.data || []; data.logs = logs.data || []; data.tickets = tickets.data || [];
}
function fillSelect(id, rows, label='name', allLabel=null, value='id'){ const el=$(id); if(!el) return; el.innerHTML = (allLabel!==null?`<option value="">${allLabel}</option>`:'') + rows.map(r=>`<option value="${r[value]}">${esc(r[label]||r.full_name||r.username)}</option>`).join(''); }
function supervisorName(id){ return data.users.find(u=>String(u.id)===String(id))?.full_name || data.supervisors.find(u=>String(u.id)===String(id))?.full_name || '-'; }
function projectName(id){ return data.projects.find(p=>String(p.id)===String(id))?.name || '-'; }
function workerName(id){ return data.workers.find(w=>String(w.id)===String(id))?.name || '-'; }
function getProjectSupervisorId(pid){ return data.projects.find(p=>String(p.id)===String(pid))?.supervisor_id || ''; }
function dateTime(date, time){ return date && time ? new Date(`${date}T${time}:00`).toISOString() : null; }
function minutesBetween(a,b){ if(!a||!b) return 0; return Math.max(0, Math.round((new Date(b)-new Date(a))/60000)); }
function logActualMinutes(l){ const saved = Number(l.duration_minutes); if(Number.isFinite(saved) && saved > 0) return saved; return minutesBetween(l.check_in, l.check_out); }
function logRequiredMinutes(l){ const logDate = l.log_date || String(l.check_in||'').slice(0,10); const saved = Number(l.required_minutes); if(Number.isFinite(saved) && saved > 0) return saved; return l.project_id ? requiredMinutesForLog(l.project_id, logDate) : 0; }
async function initAdmin(){ requireRole('admin'); await refreshAll(); }
async function refreshAll(){ await loadAll(); hydrateForms(); renderAll(); }
function hydrateForms(){
  const sups = data.supervisors; const pros = data.projects; const workers = data.workers;
  ['logSupervisor','dailySupervisor','projectSupervisor','projectFilterSupervisor','projectManageSupervisor','workerSupervisor','workerFilterSupervisor','attendanceSupervisor','attendanceFilterSupervisor','ticketSupervisor','monthlySupervisor'].forEach(id=>fillSelect(id,sups,'full_name','الكل'));
  fillSelect('manageWorkerSelect', workers, 'name', 'اختر العامل');
  ['logProject','dailyProject','attendanceProject','ticketProject','workerProject','workerFilterProject'].forEach(id=>fillSelect(id,pros,'name','الكل'));
  fillSelect('projectSupervisor',sups,'full_name','بدون مشرف'); fillSelect('workerSupervisor',sups,'full_name','بدون مشرف'); fillSelect('attendanceWorker',workers,'name','اختر العامل');
  if($('logDate')&&!$('logDate').value) $('logDate').value=today(); if($('dailyDate')&&!$('dailyDate').value) $('dailyDate').value=today(); if($('attendanceDate')&&!$('attendanceDate').value) $('attendanceDate').value=today(); if($('attendanceFilterDate')&&!$('attendanceFilterDate').value) $('attendanceFilterDate').value=today(); if($('monthlyMonth')&&!$('monthlyMonth').value) $('monthlyMonth').value=today().slice(0,7);
}
function renderAll(){ renderDashboard(); renderTimeLogs(); renderUsers(); renderProjects(); renderWorkers(); renderAttendance(); renderMonthly(); renderTickets(); renderAlerts(); }
function showPage(id, btn){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); $(id)?.classList.remove('hidden'); document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active')); btn?.classList.add('active'); renderAll(); }
function renderDashboard(){ if(!$('kpiUsers')) return; $('kpiUsers').textContent=data.users.length; $('kpiProjects').textContent=data.projects.length; $('kpiWorkers').textContent=data.workers.length; $('kpiTodayLogs').textContent=data.logs.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===today()).length; const div=$('todaySummary'); if(div) div.innerHTML = data.supervisors.map(s=>{ const logs=data.logs.filter(l=>String(l.supervisor_id)===String(s.id)&&(l.log_date||String(l.check_in||'').slice(0,10))===today()); const mins=logs.reduce((a,l)=>a+(l.duration_minutes||minutesBetween(l.check_in,l.check_out)),0); return `<div class="summary-item"><b>${esc(s.full_name)}</b><br>عدد التسجيلات: ${logs.length}<br>إجمالي الوقت: ${minsToText(mins)}</div>`; }).join('') || '<div class="summary-item">لا توجد تسجيلات اليوم</div>'; }
function setNow(id){ $(id).value=nowTime(); }
function clearLogForm(){ ['logId','logIn','logOut','logTravel','logNotes'].forEach(id=>{ if($(id)) $(id).value=id==='logTravel'?'0':''; }); if($('logDate')) $('logDate').value=today(); if($('logVisitType')) $('logVisitType').value='surface'; $('logFormTitle') && ($('logFormTitle').textContent='تسجيل دخول / خروج'); }
function findProject(id){ return data.projects.find(p=>String(p.id)===String(id)); }
function requiredMinutesForLog(projectId, dateStr){ const p=findProject(projectId); if(!p) return 0; return projectRequiredMinutes(p, dateStr); }
function calculateTravelMinutes(supervisorId, dateStr, checkInIso, currentId=null){
  if(!supervisorId || !dateStr || !checkInIso) return 0;
  const checkIn = new Date(checkInIso);
  const previous = data.logs
    .filter(l => String(l.supervisor_id)===String(supervisorId)
      && String(l.id)!==String(currentId||'')
      && (l.log_date || String(l.check_in||'').slice(0,10))===dateStr
      && l.check_out
      && new Date(l.check_out) <= checkIn)
    .sort((a,b)=> new Date(b.check_out) - new Date(a.check_out))[0];
  if(!previous) return 0;
  return Math.max(0, Math.round((checkIn - new Date(previous.check_out))/60000));
}
function monthDays(year, monthIndex){ return new Date(year, monthIndex+1, 0).getDate(); }
function projectRequiredMonthlyMinutes(projectId, monthStr){
  const p=findProject(projectId); if(!p || !monthStr) return 0;
  if((p.operation_type||'')==='as_needed') return 0;
  const parts=monthStr.split('-').map(Number), y=parts[0], m=parts[1];
  let total=0; const days=monthDays(y,m-1);
  for(let d=1; d<=days; d++){
    const ds=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    total += projectRequiredMinutes(p, ds);
  }
  return total;
}
function performanceStatus(percent, required){
  if(!required) return {text:'غير محدد', cls:'amber'};
  if(percent >= 90) return {text:'ممتاز', cls:'green'};
  if(percent >= 70) return {text:'متوسط', cls:'amber'};
  return {text:'ناقص', cls:'red'};
}
function percentText(v){ return (Math.round(Number(v||0)*10)/10).toFixed(1)+'%'; }
function calcTimeStatus(actualMinutes, requiredMinutes){ const diff = Number(actualMinutes||0) - Number(requiredMinutes||0); if(!requiredMinutes) return {diff, status:'unknown', text:'غير محدد', cls:'amber'}; if(diff > 5) return {diff, status:'over_time', text:'زيادة', cls:'red'}; if(diff < -5) return {diff, status:'under_time', text:'ناقص', cls:'amber'}; return {diff, status:'within_time', text:'ضمن الوقت', cls:'green'}; }
function timeStatusText(s){ return s==='over_time'?'زيادة':(s==='under_time'?'ناقص':(s==='within_time'?'ضمن الوقت':'غير محدد')); }
function timeStatusClass(s){ return s==='over_time'?'red':(s==='under_time'?'amber':(s==='within_time'?'green':'amber')); }
function diffText(m){ m=Number(m||0); return (m>0?'+':'') + m + ' دقيقة'; }
function onLogProjectChange(){ const pid=$('logProject')?.value; const p=findProject(pid); if(p && $('logVisitType')) $('logVisitType').value=p.visit_type_default||'surface'; if(p && $('logSupervisor') && !$('logSupervisor').value) $('logSupervisor').value=p.supervisor_id||''; }
async function saveTimeLog(){ const u=session(); const id=$('logId')?.value; const date=$('logDate')?.value || today(); let sup=$('logSupervisor')?.value || (u.role==='supervisor'?u.id:''); const project=$('logProject')?.value; if(!sup && project) sup=getProjectSupervisorId(project); const check_in=dateTime(date,$('logIn')?.value), check_out=dateTime(date,$('logOut')?.value); if(!project||!check_in) return msg('المشروع ووقت الدخول مطلوبان','err'); const actual=minutesBetween(check_in,check_out); const required=requiredMinutesForLog(project,date); const ts=calcTimeStatus(actual,required); const autoTravel=calculateTravelMinutes(sup,date,check_in,id); const row={user_id:u.id, supervisor_id:Number(sup)||null, project_id:Number(project), check_in, check_out, log_date:date, duration_minutes:actual, travel_minutes:autoTravel, visit_type:$('logVisitType')?.value||findProject(project)?.visit_type_default||'surface', required_minutes:required, time_difference_minutes:ts.diff, time_status:ts.status, notes:$('logNotes')?.value||''}; const res=id ? await sb.from('time_logs').update(row).eq('id',id) : await sb.from('time_logs').insert(row); if(res.error) return msg(res.error.message,'err'); playAppSound(check_out ? 'checkout' : 'checkin'); msg('تم حفظ التسجيل وحساب حالة الوقت ووقت التنقل تلقائياً'); clearLogForm(); await refreshAll(); }
function filterLogs(){ let rows=[...data.logs]; const d=$('dailyDate')?.value, s=$('dailySupervisor')?.value, p=$('dailyProject')?.value, q=($('dailySearch')?.value||'').trim(); if(d) rows=rows.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===d); if(s) rows=rows.filter(l=>String(l.supervisor_id)===String(s)); if(p) rows=rows.filter(l=>String(l.project_id)===String(p)); if(q) rows=rows.filter(l=>[supervisorName(l.supervisor_id),projectName(l.project_id),visitTypeText(l.visit_type),timeStatusText(l.time_status),l.notes].join(' ').includes(q)); return rows; }
function renderTimeLogs(){ const body=$('logsBody'); if(!body) return; const isSupervisorPage = !document.getElementById('daily'); const rows=filterLogs(); body.innerHTML = rows.map(l=>{ const logDate=l.log_date||String(l.check_in||'').slice(0,10); const actual=Number(l.duration_minutes||minutesBetween(l.check_in,l.check_out)); const required=Number(l.required_minutes||requiredMinutesForLog(l.project_id,logDate)||0); const diff=(l.time_difference_minutes!==null&&l.time_difference_minutes!==undefined)?Number(l.time_difference_minutes):(actual-required); const status=l.time_status||calcTimeStatus(actual,required).status; const badge=`<span class="badge ${timeStatusClass(status)}">${timeStatusText(status)}</span>`; if(isSupervisorPage){ return `<tr><td>${esc(projectName(l.project_id))}</td><td>${visitTypeText(l.visit_type)}</td><td>${timeOnly(l.check_in)}</td><td>${timeOnly(l.check_out)}</td><td>${minsToText(required)}</td><td>${minsToText(actual)}</td><td>${badge}</td></tr>`; } return `<tr><td>${esc(logDate)}</td><td>${esc(supervisorName(l.supervisor_id))}</td><td>${esc(projectName(l.project_id))}</td><td>${visitTypeText(l.visit_type)}</td><td>${timeOnly(l.check_in)}</td><td>${timeOnly(l.check_out)}</td><td>${minsToText(required)}</td><td>${minsToText(actual)}</td><td>${diffText(diff)}</td><td>${badge}</td><td>${l.travel_minutes||0}</td><td>${esc(l.notes)}</td><td class="row-actions"><button onclick="editTimeLog(${l.id})">تعديل</button><button class="danger" onclick="deleteRow('time_logs',${l.id})">حذف</button></td></tr>`; }).join('') || (isSupervisorPage?'<tr><td colspan="7">لا توجد بيانات</td></tr>':'<tr><td colspan="13">لا توجد بيانات</td></tr>'); }
function editTimeLog(id){ const l=data.logs.find(x=>x.id===id); if(!l) return; $('logId').value=l.id; $('logDate').value=l.log_date||String(l.check_in||'').slice(0,10); if($('logSupervisor')) $('logSupervisor').value=l.supervisor_id||''; $('logProject').value=l.project_id||''; if($('logVisitType')) $('logVisitType').value=l.visit_type||findProject(l.project_id)?.visit_type_default||'surface'; $('logIn').value=l.check_in?new Date(l.check_in).toTimeString().slice(0,5):''; $('logOut').value=l.check_out?new Date(l.check_out).toTimeString().slice(0,5):''; $('logTravel').value=l.travel_minutes||0; $('logNotes').value=l.notes||''; $('logFormTitle') && ($('logFormTitle').textContent='تعديل تسجيل'); window.scrollTo({top:0,behavior:'smooth'}); }
async function deleteRow(table,id){ if(!confirm('تأكيد الحذف؟')) return; const {error}=await sb.from(table).delete().eq('id',id); if(error) return msg(error.message,'err'); msg('تم الحذف'); await refreshAll(); }
function clearUserForm(){ ['userId','userFullName','userUsername','userPassword'].forEach(id=>$(id)&&($(id).value='')); if($('userRole')) $('userRole').value='supervisor'; if($('userActive')) $('userActive').value='true'; $('userFormTitle')&&($('userFormTitle').textContent='إضافة مستخدم'); }
async function saveUser(){ const id=$('userId').value; const row={full_name:$('userFullName').value.trim(), username:$('userUsername').value.trim(), password:$('userPassword').value.trim()||'123456', role:$('userRole').value, is_active:$('userActive').value==='true'}; if(!row.full_name||!row.username) return msg('الاسم واسم المستخدم مطلوبان','err'); const res=id?await sb.from('app_users').update(row).eq('id',id):await sb.from('app_users').insert(row); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ المستخدم'); clearUserForm(); await refreshAll(); }
function renderUsers(){ const b=$('usersBody'); if(!b) return; b.innerHTML=data.users.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><span class="badge">${u.role==='admin'?'مدير':'مشرف'}</span></td><td><span class="badge ${u.is_active?'green':'red'}">${u.is_active?'نشط':'موقوف'}</span></td><td class="row-actions"><button onclick="editUser(${u.id})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${u.id})">حذف</button></td></tr>`).join(''); }
function editUser(id){ const u=data.users.find(x=>x.id===id); if(!u)return; $('userId').value=u.id; $('userFullName').value=u.full_name||''; $('userUsername').value=u.username||''; $('userPassword').value=u.password||''; $('userRole').value=u.role; $('userActive').value=String(u.is_active!==false); $('userFormTitle').textContent='تعديل مستخدم'; }
function projectOperationText(t){ return t==='full_time'?'دوام كامل':(t==='as_needed'?'حسب الحاجة':'زيارة يومية'); }
function visitTypeText(t){ return t==='deep'?'نظافة عميقة':'نظافة سطحية'; }
function projectRequiredMinutes(p, dateStr){ const day=dateStr?new Date(dateStr+'T00:00:00').getDay():null; return day===5?Number(p.friday_minutes??90):Number(p.required_daily_minutes??180); }
function clearProjectForm(){ ['projectId','projectName','projectLocation','projectNotes'].forEach(id=>$(id)&&($(id).value='')); if($('projectSupervisor')) $('projectSupervisor').value=''; if($('projectStatus')) $('projectStatus').value='active'; if($('projectRequiredDaily')) $('projectRequiredDaily').value=180; if($('projectFridayMinutes')) $('projectFridayMinutes').value=90; if($('projectOperationType')) $('projectOperationType').value='daily_visit'; if($('projectVisitDefault')) $('projectVisitDefault').value='surface'; $('projectFormTitle')&&($('projectFormTitle').textContent='إضافة مشروع'); $('projectSaveBtn')&&($('projectSaveBtn').textContent='حفظ المشروع'); }
async function saveProject(){ const id=$('projectId').value; const row={name:$('projectName').value.trim(), location:$('projectLocation').value.trim(), supervisor_id:Number($('projectSupervisor').value)||null, required_daily_minutes:Number($('projectRequiredDaily')?.value||180), friday_minutes:Number($('projectFridayMinutes')?.value||90), operation_type:$('projectOperationType')?.value||'daily_visit', visit_type_default:$('projectVisitDefault')?.value||'surface', status:$('projectStatus').value, notes:$('projectNotes').value}; if(!row.name) return msg('اسم المشروع مطلوب','err'); const res=id?await sb.from('projects').update(row).eq('id',id):await sb.from('projects').insert(row); if(res.error) return msg(res.error.message,'err'); msg(id?'تم تحديث المشروع':'تم حفظ المشروع'); clearProjectForm(); await refreshAll(); }
function renderProjects(){ const b=$('projectsBody'); if(!b) return; const q=($('projectSearch')?.value||'').trim(), sid=$('projectFilterSupervisor')?.value, st=$('projectFilterStatus')?.value; let rows=data.projects; if(q) rows=rows.filter(p=>[p.name,p.location,supervisorName(p.supervisor_id),p.notes].join(' ').includes(q)); if(sid) rows=rows.filter(p=>String(p.supervisor_id)===String(sid)); if(st) rows=rows.filter(p=>(p.status||'active')===st); b.innerHTML=rows.map(p=>`<tr><td><b>${esc(p.name)}</b><br><small>${esc(p.location||'')}</small></td><td>${esc(supervisorName(p.supervisor_id))}</td><td>${minsToText(p.required_daily_minutes??180)}</td><td>${minsToText(p.friday_minutes??90)}</td><td>${projectOperationText(p.operation_type)}</td><td>${visitTypeText(p.visit_type_default)}</td><td><span class="badge ${p.status==='inactive'?'red':'green'}">${p.status==='inactive'?'متوقف':'نشط'}</span></td><td class="row-actions"><button onclick="editProject(${p.id})">تعديل</button><button class="light" onclick="openProjectManager(${p.id})">إدارة المشروع</button><button class="light" onclick="toggleProjectStatus(${p.id})">${p.status==='inactive'?'تفعيل':'إيقاف'}</button><button class="danger" onclick="deleteRow('projects',${p.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="8">لا توجد بيانات</td></tr>'; renderProjectManager(); }
function editProject(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; $('projectId').value=p.id; $('projectName').value=p.name||''; $('projectLocation').value=p.location||''; $('projectSupervisor').value=p.supervisor_id||''; $('projectStatus').value=p.status||'active'; $('projectNotes').value=p.notes||''; if($('projectRequiredDaily')) $('projectRequiredDaily').value=p.required_daily_minutes??180; if($('projectFridayMinutes')) $('projectFridayMinutes').value=p.friday_minutes??90; if($('projectOperationType')) $('projectOperationType').value=p.operation_type||'daily_visit'; if($('projectVisitDefault')) $('projectVisitDefault').value=p.visit_type_default||'surface'; $('projectFormTitle').textContent='تعديل مشروع'; $('projectSaveBtn')&&($('projectSaveBtn').textContent='تحديث المشروع'); }
async function toggleProjectStatus(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; const next=p.status==='inactive'?'active':'inactive'; const {error}=await sb.from('projects').update({status:next}).eq('id',id); if(error) return msg(error.message,'err'); msg(next==='active'?'تم تفعيل المشروع':'تم إيقاف المشروع'); await refreshAll(); }
function openProjectManager(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; $('manageProjectId').value=id; $('projectManagerCard')?.classList.remove('hidden'); $('projectManagerTitle').textContent=`إدارة المشروع: ${p.name}`; if($('projectManageSupervisor')) $('projectManageSupervisor').value=p.supervisor_id||''; renderProjectManager(); setTimeout(()=>$('projectManagerCard')?.scrollIntoView({behavior:'smooth',block:'start'}),50); }
function closeProjectManager(){ $('projectManagerCard')?.classList.add('hidden'); if($('manageProjectId')) $('manageProjectId').value=''; }
function renderProjectManager(){ const b=$('projectWorkersBody'); if(!b) return; const pid=$('manageProjectId')?.value; if(!pid){ b.innerHTML='<tr><td colspan="5">اختر مشروع من زر إدارة المشروع</td></tr>'; return; } const rows=data.workers.filter(w=>String(workerProjectId(w))===String(pid)); b.innerHTML=rows.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(supervisorName(workerSupId(w)))}</td><td><span class="badge ${w.worker_type==='support'?'amber':'green'}">${workerTypeText(w.worker_type)}</span></td><td><span class="badge ${w.status==='inactive'?'red':'green'}">${w.status==='inactive'?'موقوف':'نشط'}</span></td><td class="row-actions"><button class="danger" onclick="removeWorkerFromProject(${w.id})">إزالة من المشروع</button></td></tr>`).join('')||'<tr><td colspan="5">لا يوجد عمال مرتبطون بهذا المشروع</td></tr>'; }
async function saveProjectManagerSupervisor(){ const pid=Number($('manageProjectId')?.value), sid=Number($('projectManageSupervisor')?.value)||null; if(!pid) return msg('اختر المشروع أولاً','err'); const {error}=await sb.from('projects').update({supervisor_id:sid}).eq('id',pid); if(error) return msg(error.message,'err'); await sb.from('workers').update({supervisor_id:sid, app_supervisor_id:sid}).eq('project_id',pid); msg('تم ربط المشرف بالمشروع وتحديث عمال المشروع'); await refreshAll(); openProjectManager(pid); }
async function addExistingWorkerToProject(){ const pid=Number($('manageProjectId')?.value), wid=Number($('manageWorkerSelect')?.value), type=$('manageWorkerType')?.value||'primary'; if(!pid||!wid) return msg('اختر المشروع والعامل','err'); const p=data.projects.find(x=>x.id===pid); const sid=p?.supervisor_id||null; const {error}=await sb.from('workers').update({project_id:pid, supervisor_id:sid, app_supervisor_id:sid, worker_type:type}).eq('id',wid); if(error) return msg(error.message,'err'); msg('تم ربط العامل بالمشروع'); await refreshAll(); openProjectManager(pid); }
async function removeWorkerFromProject(wid){ if(!confirm('إزالة العامل من هذا المشروع؟')) return; const pid=Number($('manageProjectId')?.value); const {error}=await sb.from('workers').update({project_id:null}).eq('id',wid); if(error) return msg(error.message,'err'); msg('تمت إزالة العامل من المشروع'); await refreshAll(); if(pid) openProjectManager(pid); }
async function addWorkerInsideProject(){ const pid=Number($('manageProjectId')?.value); if(!pid) return msg('اختر المشروع أولاً','err'); const name=$('manageNewWorkerName')?.value.trim(); if(!name) return msg('اسم العامل مطلوب','err'); const p=data.projects.find(x=>x.id===pid); const sid=p?.supervisor_id||null; const row={name, phone:$('manageNewWorkerPhone')?.value.trim()||'', salary:Number($('manageNewWorkerSalary')?.value||1500), supervisor_id:sid, app_supervisor_id:sid, project_id:pid, worker_type:$('manageNewWorkerType')?.value||'primary', status:'active'}; const {error}=await sb.from('workers').insert(row); if(error) return msg(error.message,'err'); ['manageNewWorkerName','manageNewWorkerPhone'].forEach(id=>$(id)&&($(id).value='')); if($('manageNewWorkerSalary')) $('manageNewWorkerSalary').value=1500; msg('تم إضافة العامل وربطه بالمشروع'); await refreshAll(); openProjectManager(pid); }
function clearWorkerForm(){
  ['workerId','workerName','workerPhone','workerNotes'].forEach(id=>$(id)&&($(id).value=''));
  if($('workerSalary')) $('workerSalary').value=1500;
  if($('workerSupervisor')) $('workerSupervisor').value='';
  if($('workerProject')) $('workerProject').value='';
  if($('workerType')) $('workerType').value='primary';
  if($('workerStatus')) $('workerStatus').value='active';
  $('workerFormTitle')&&($('workerFormTitle').textContent='إضافة عامل');
  $('workerSaveBtn')&&($('workerSaveBtn').textContent='حفظ العامل');
  $('workerCancelBtn')&&$('workerCancelBtn').classList.add('hidden');
}
function workerSupId(w){ return w.app_supervisor_id || w.supervisor_id; }
function workerProjectId(w){ return w.project_id || w.assigned_project_id || ''; }
function workerTypeText(t){ return t==='support' ? 'بديل / مساند' : 'أساسي'; }
function onWorkerSupervisorChange(){
  const sid=$('workerSupervisor')?.value;
  const el=$('workerProject');
  if(!el) return;
  let rows=data.projects;
  if(sid) rows=rows.filter(p=>String(p.supervisor_id)===String(sid));
  fillSelect('workerProject', rows, 'name', 'اختر المشروع');
}
async function saveWorker(){
  const id=$('workerId').value;
  const supId=Number($('workerSupervisor').value)||null;
  const projectId=Number($('workerProject')?.value)||null;
  const row={
    name:$('workerName').value.trim(),
    phone:$('workerPhone').value.trim(),
    salary:Number($('workerSalary').value||1500),
    supervisor_id:supId,
    app_supervisor_id:supId,
    project_id:projectId,
    worker_type:$('workerType')?.value||'primary',
    status:$('workerStatus').value,
    notes:$('workerNotes').value
  };
  if(!row.name) return msg('اسم العامل مطلوب','err');
  if(!row.supervisor_id) return msg('اختر المشرف المسؤول عن العامل','err');
  const res=id?await sb.from('workers').update(row).eq('id',id):await sb.from('workers').insert(row);
  if(res.error) return msg(res.error.message,'err');
  msg(id?'تم تحديث العامل':'تم حفظ العامل');
  clearWorkerForm();
  await refreshAll();
}
function renderWorkers(){
  const b=$('workersBody'); if(!b) return;
  const s=$('workerFilterSupervisor')?.value, p=$('workerFilterProject')?.value, st=$('workerFilterStatus')?.value, tp=$('workerFilterType')?.value, q=($('workerSearch')?.value||'').trim();
  let rows=data.workers;
  if(s) rows=rows.filter(w=>String(workerSupId(w))===String(s));
  if(p) rows=rows.filter(w=>String(workerProjectId(w))===String(p));
  if(st) rows=rows.filter(w=>(w.status||'active')===st);
  if(tp) rows=rows.filter(w=>(w.worker_type||'primary')===tp);
  if(q) rows=rows.filter(w=>[w.name,w.phone,supervisorName(workerSupId(w)),projectName(workerProjectId(w)),w.notes].join(' ').includes(q));
  b.innerHTML=rows.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(supervisorName(workerSupId(w)))}</td><td>${esc(projectName(workerProjectId(w)))}</td><td><span class="badge ${w.worker_type==='support'?'amber':'green'}">${workerTypeText(w.worker_type)}</span></td><td>${esc(w.phone)}</td><td>${w.salary||0}</td><td><span class="badge ${w.status==='inactive'?'red':'green'}">${w.status==='inactive'?'موقوف':'نشط'}</span></td><td>${esc(w.notes||'-')}</td><td class="row-actions"><button onclick="editWorker(${w.id})">تعديل</button><button class="light" onclick="toggleWorkerStatus(${w.id})">${w.status==='inactive'?'تفعيل':'إيقاف'}</button><button class="danger" onclick="deleteRow('workers',${w.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="9">لا توجد بيانات</td></tr>';
}
function editWorker(id){
  const w=data.workers.find(x=>x.id===id); if(!w)return;
  $('workerId').value=w.id; $('workerName').value=w.name||''; $('workerPhone').value=w.phone||''; $('workerSalary').value=w.salary||1500;
  $('workerSupervisor').value=workerSupId(w)||''; onWorkerSupervisorChange();
  if($('workerProject')) $('workerProject').value=workerProjectId(w)||'';
  if($('workerType')) $('workerType').value=w.worker_type||'primary';
  $('workerStatus').value=w.status||'active'; $('workerNotes').value=w.notes||'';
  $('workerFormTitle').textContent='تعديل عامل';
  $('workerSaveBtn')&&($('workerSaveBtn').textContent='تحديث العامل');
  $('workerCancelBtn')&&$('workerCancelBtn').classList.remove('hidden');
  showPage('workers', document.querySelector('.nav[onclick*="workers"]'));
  window.scrollTo({top:0,behavior:'smooth'});
}
async function toggleWorkerStatus(id){
  const w=data.workers.find(x=>x.id===id); if(!w) return;
  const next=w.status==='inactive'?'active':'inactive';
  const {error}=await sb.from('workers').update({status:next}).eq('id',id);
  if(error) return msg(error.message,'err');
  msg(next==='active'?'تم تفعيل العامل':'تم إيقاف العامل');
  await refreshAll();
}
function clearAttendanceForm(){ ['attendanceId','attendanceNotes'].forEach(id=>$(id)&&($(id).value='')); if($('attendanceDate')) $('attendanceDate').value=today(); if($('attendanceStatus')) $('attendanceStatus').value='present'; $('attendanceFormTitle')&&($('attendanceFormTitle').textContent='تسجيل حضور / غياب'); }
async function saveAttendance(){ const id=$('attendanceId').value; const row={attendance_date:$('attendanceDate').value||today(), worker_id:Number($('attendanceWorker').value), supervisor_id:Number($('attendanceSupervisor').value)||null, project_id:Number($('attendanceProject').value)||null, status:$('attendanceStatus').value, notes:$('attendanceNotes').value, created_by:session()?.id||null}; if(!row.worker_id) return msg('اختر العامل','err'); const res=id?await sb.from('attendance').update(row).eq('id',id):await sb.from('attendance').upsert(row,{onConflict:'attendance_date,worker_id'}); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ الحضور'); clearAttendanceForm(); await refreshAll(); }
function renderAttendance(){ const b=$('attendanceBody'); if(!b) return; const d=$('attendanceFilterDate')?.value, s=$('attendanceFilterSupervisor')?.value, q=($('attendanceSearch')?.value||'').trim(); let rows=data.attendance; if(d) rows=rows.filter(a=>a.attendance_date===d); if(s) rows=rows.filter(a=>String(a.supervisor_id)===String(s)); if(q) rows=rows.filter(a=>[workerName(a.worker_id),supervisorName(a.supervisor_id),projectName(a.project_id),a.notes].join(' ').includes(q)); b.innerHTML=rows.map(a=>`<tr><td>${a.attendance_date}</td><td>${esc(workerName(a.worker_id))}</td><td>${esc(supervisorName(a.supervisor_id))}</td><td>${esc(projectName(a.project_id))}</td><td><span class="badge ${a.status==='present'?'green':'red'}">${a.status==='present'?'حاضر':'غائب'}</span></td><td>${esc(a.notes)}</td><td class="row-actions"><button onclick="editAttendance(${a.id})">تعديل</button><button class="danger" onclick="deleteRow('attendance',${a.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="7">لا توجد بيانات</td></tr>'; renderAttendanceWorkersQuick(); }
function editAttendance(id){ const a=data.attendance.find(x=>x.id===id); if(!a)return; $('attendanceId').value=a.id; $('attendanceDate').value=a.attendance_date; $('attendanceSupervisor').value=a.supervisor_id||''; $('attendanceProject').value=a.project_id||''; $('attendanceWorker').value=a.worker_id||''; $('attendanceStatus').value=a.status; $('attendanceNotes').value=a.notes||''; $('attendanceFormTitle').textContent='تعديل حضور'; }
function renderAttendanceWorkersQuick(){ const div=$('attendanceQuick'); if(!div) return; const sid=$('attendanceSupervisor')?.value; if(!sid){ div.innerHTML=''; return; } const ws=data.workers.filter(w=>String(workerSupId(w))===String(sid)); div.innerHTML=ws.map(w=>`<div class="quick-item"><b>${esc(w.name)}</b><div><button onclick="quickAttendance(${w.id},'present')">حاضر</button> <button class="danger" onclick="quickAttendance(${w.id},'absent')">غائب</button></div></div>`).join(''); }
async function quickAttendance(workerId,status){ $('attendanceWorker').value=workerId; $('attendanceStatus').value=status; await saveAttendance(); }
function renderMonthly(){
  const body=$('monthlyBody');
  if(!body) return;
  const month=$('monthlyMonth')?.value || today().slice(0,7);
  const sid=$('monthlySupervisor')?.value;
  let rows=data.logs.filter(l=>{
    const d = l.log_date || String(l.check_in||'').slice(0,10);
    return d.slice(0,7)===month;
  });
  if(sid) rows=rows.filter(l=>String(l.supervisor_id)===String(sid));
  const map={};
  rows.forEach(l=>{
    const k=(l.supervisor_id||'')+'_'+(l.project_id||'');
    if(!map[k]) map[k]={s:l.supervisor_id,p:l.project_id,c:0,m:0,req:0,t:0};
    const actual = logActualMinutes(l);
    const required = logRequiredMinutes(l);
    map[k].c++;
    map[k].m += actual;
    map[k].req += required;
    map[k].t += Number(l.travel_minutes||0);
  });
  const vals=Object.values(map).map(r=>{
    r.percent = r.req ? (r.m/r.req)*100 : 0;
    r.perf = performanceStatus(r.percent,r.req);
    return r;
  });
  body.innerHTML=vals.map(r=>`<tr><td>${esc(supervisorName(r.s))}</td><td>${esc(projectName(r.p))}</td><td>${r.c}</td><td>${minsToText(r.req)}</td><td>${minsToText(r.m)}</td><td>${r.t} دقيقة</td><td><span class="badge ${r.perf.cls}">${percentText(r.percent)}</span></td><td><span class="badge ${r.perf.cls}">${r.perf.text}</span></td></tr>`).join('')||'<tr><td colspan="8">لا توجد بيانات</td></tr>';
  const total=vals.reduce((a,r)=>a+r.m,0), required=vals.reduce((a,r)=>a+r.req,0), travel=vals.reduce((a,r)=>a+r.t,0), pct=required?total/required*100:0;
  const perf=performanceStatus(pct,required);
  if($('monthlySummary')) $('monthlySummary').innerHTML=`<div class="kpi"><small>عدد التسجيلات</small><b>${rows.length}</b></div><div class="kpi"><small>الساعات المطلوبة</small><b>${minsToText(required)}</b></div><div class="kpi"><small>الساعات الفعلية</small><b>${minsToText(total)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel} دقيقة</b></div><div class="kpi"><small>نسبة العمل</small><b>${percentText(pct)}</b></div><div class="kpi"><small>حالة الأداء</small><b><span class="badge ${perf.cls}">${perf.text}</span></b></div>`;
}
function clearTicketForm(){ ['ticketId','ticketTitle','ticketDescription'].forEach(id=>$(id)&&($(id).value='')); if($('ticketStatus')) $('ticketStatus').value='open'; if($('ticketPriority')) $('ticketPriority').value='normal'; $('ticketFormTitle')&&($('ticketFormTitle').textContent='إضافة تكت'); }
async function saveTicket(){ const u=session(); const row={project_id:Number($('ticketProject').value)||null, supervisor_id:Number($('ticketSupervisor')?.value || (u.role==='supervisor'?u.id:''))||null, title:$('ticketTitle').value.trim(), description:$('ticketDescription').value, priority:$('ticketPriority').value, status:$('ticketStatus')?.value || 'open'}; if(!row.title) return msg('عنوان التكت مطلوب','err'); if(row.status==='closed') row.closed_at=new Date().toISOString(); const id=$('ticketId')?.value; const res=id?await sb.from('tickets').update(row).eq('id',id):await sb.from('tickets').insert(row); if(res.error) return msg(res.error.message,'err'); playAppSound('ticket'); msg('تم حفظ التكت'); clearTicketForm(); await refreshAll(); }
function renderTickets(){ const b=$('ticketsBody'); if(!b) return; const st=$('ticketFilterStatus')?.value, q=($('ticketSearch')?.value||'').trim(); let rows=data.tickets; if(st) rows=rows.filter(t=>t.status===st); if(q) rows=rows.filter(t=>[t.title,t.description,projectName(t.project_id),supervisorName(t.supervisor_id)].join(' ').includes(q)); b.innerHTML=rows.map(t=>`<tr><td>${esc(projectName(t.project_id))}</td><td>${esc(supervisorName(t.supervisor_id))}</td><td>${esc(t.title)}</td><td><span class="badge ${t.priority==='high'?'red':'amber'}">${t.priority||'normal'}</span></td><td><span class="badge ${t.status==='closed'?'green':'red'}">${t.status==='closed'?'مغلق':'مفتوح'}</span></td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button><button class="danger" onclick="deleteRow('tickets',${t.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="6">لا توجد بيانات</td></tr>'; }
function editTicket(id){ const t=data.tickets.find(x=>x.id===id); if(!t)return; $('ticketId').value=t.id; $('ticketProject').value=t.project_id||''; if($('ticketSupervisor')) $('ticketSupervisor').value=t.supervisor_id||''; $('ticketTitle').value=t.title||''; $('ticketPriority').value=t.priority||'normal'; if($('ticketStatus')) $('ticketStatus').value=t.status||'open'; $('ticketDescription').value=t.description||''; $('ticketFormTitle')&&($('ticketFormTitle').textContent='تعديل تكت'); }
function renderAlerts(){ const div=$('alertsList'); if(!div) return; const alerts=[]; data.projects.filter(p=>!p.supervisor_id).forEach(p=>alerts.push(['warn',`مشروع بدون مشرف: ${p.name}`])); data.workers.filter(w=>!workerSupId(w)).forEach(w=>alerts.push(['warn',`عامل بدون مشرف: ${w.name}`])); data.logs.filter(l=>!l.check_out).forEach(l=>alerts.push(['danger',`تسجيل دخول بدون خروج: ${projectName(l.project_id)} - ${supervisorName(l.supervisor_id)}`])); data.tickets.filter(t=>t.status==='open').forEach(t=>alerts.push(['warn',`تكت مفتوح: ${t.title} - ${projectName(t.project_id)}`])); div.innerHTML=alerts.map(a=>`<div class="alert-item ${a[0]}">${esc(a[1])}</div>`).join('')||'<div class="alert-item">لا توجد تنبيهات حالياً</div>'; }
function toCSV(rows){ if(!rows.length) return ''; const keys=Object.keys(rows[0]); return [keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\n'); }
function download(name,text){ const blob=new Blob([text],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
async function exportTable(table){ const {data:rows,error}=await sb.from(table).select('*'); if(error) return msg(error.message,'err'); download(`${table}.csv`, toCSV(rows||[])); }
function exportMonthlyCSV(){ const rows=[...document.querySelectorAll('#monthlyBody tr')].map(tr=>[...tr.children].map(td=>td.textContent)); const csv=['المشرف,المشروع,عدد السجلات,الساعات المطلوبة,الساعات الفعلية,وقت الانتقال,نسبة العمل,حالة الأداء',...rows.map(r=>r.map(x=>'"'+x+'"').join(','))].join('\n'); download('monthly.csv',csv); }
async function initSupervisor(){ const u=requireRole('supervisor'); if(!u) return; await loadAll(); data.projects=data.projects.filter(p=>String(p.supervisor_id)===String(u.id)); data.workers=data.workers.filter(w=>String(workerSupId(w))===String(u.id)); data.logs=data.logs.filter(l=>String(l.supervisor_id)===String(u.id)); const supProjectIds = new Set(data.projects.map(p=>String(p.id))); data.tickets=data.tickets.filter(t=>String(t.supervisor_id)===String(u.id) || String(t.created_by)===String(u.id) || supProjectIds.has(String(t.project_id))); $('supTitle').textContent=`لوحة المشرف - ${u.full_name}`; fillSelect('logProject',data.projects,'name','اختر المشروع'); fillSelect('attendanceProject',data.projects,'name','اختر المشروع'); fillSelect('ticketProject',data.projects,'name','اختر المشروع'); if($('logDate')) $('logDate').value=today(); if($('attendanceDate')) $('attendanceDate').value=today(); renderSupervisorAttendanceList(); renderTimeLogs(); }
async function supervisorCheckIn(){ if(!$('logProject').value) return msg('اختر المشروع','err'); $('logDate').value=today(); $('logIn').value=nowTime(); $('logOut').value=''; await saveTimeLog(); await initSupervisor(); }
async function supervisorCheckOut(){ const u=session(); const pid=$('logProject').value; const open=data.logs.find(l=>String(l.project_id)===String(pid)&&!l.check_out); if(open) editTimeLog(open.id); $('logOut').value=nowTime(); await saveTimeLog(); await initSupervisor(); }
function renderSupervisorAttendanceList(){ const div=$('supervisorAttendanceList'); if(!div) return; div.innerHTML=data.workers.map(w=>`<div class="quick-item"><b>${esc(w.name)}</b><select data-worker="${w.id}"><option value="present">حاضر</option><option value="absent">غائب</option></select></div>`).join('')||'<div class="quick-item">لا يوجد عمال مرتبطين بك</div>'; }
async function saveSupervisorAttendance(){ const u=session(); const date=$('attendanceDate').value||today(), project=Number($('attendanceProject').value)||null; const rows=[...document.querySelectorAll('#supervisorAttendanceList select')].map(s=>({attendance_date:date, worker_id:Number(s.dataset.worker), supervisor_id:u.id, project_id:project, status:s.value, created_by:u.id})); if(!rows.length) return; const {error}=await sb.from('attendance').upsert(rows,{onConflict:'attendance_date,worker_id'}); if(error) return msg(error.message,'err'); msg('تم حفظ التحضير'); await initSupervisor(); }

/* ===== Tasneef emergency navigation/button stabilizer ===== */
(function(){
  function runSafe(name){
    try { if (typeof window[name] === 'function') window[name](); }
    catch(e){ console.error('Error in '+name, e); }
  }

  const renderNames = ['renderDashboard','renderTimeLogs','renderUsers','renderProjects','renderWorkers','renderAttendance','renderMonthly','renderTickets','renderAlerts'];
  window.renderAll = function(){ renderNames.forEach(runSafe); };

  window.showPage = function(id, btn){
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById(id);
    if(page) page.classList.remove('hidden');
    document.querySelectorAll('.nav').forEach(n => n.classList.remove('active'));
    if(btn) btn.classList.add('active');
    try { window.renderAll(); } catch(e){ console.error('renderAll failed', e); }
  };

  const oldInitAdmin = window.initAdmin;
  window.initAdmin = async function(){
    try {
      if (typeof requireRole === 'function') requireRole('admin');
      if (typeof refreshAll === 'function') await refreshAll();
    } catch(e){
      console.error('initAdmin failed', e);
      try { window.renderAll(); } catch(_e){}
    }
  };

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.side .nav:not(.danger)').forEach(function(btn){
      const txt = (btn.textContent || '').trim();
      const map = {
        'لوحة التحكم':'dashboard',
        'التسجيلات اليومية':'daily',
        'إدارة المستخدمين':'users',
        'المشاريع':'projects',
        'العمال':'workers',
        'الحضور والغياب':'attendance',
        'الأوقات الشهرية':'monthly',
        'التكتات':'tickets',
        'التنبيهات':'alerts',
        'التصدير':'export'
      };
      const old = btn.getAttribute('onclick') || '';
      const m = old.match(/showPage\('([^']+)'/);
      const id = (m && m[1]) || map[txt];
      if(id){
        btn.onclick = function(ev){ ev.preventDefault(); window.showPage(id, btn); return false; };
      }
    });
  });
})();

/* ===== V10: Monthly attendance matrix ===== */
(function(){
  function daysInMonth(monthStr){
    if(!monthStr || !monthStr.includes('-')) monthStr = today().slice(0,7);
    const parts = monthStr.split('-').map(Number);
    return new Date(parts[0], parts[1], 0).getDate();
  }
  function monthDate(monthStr, day){ return monthStr + '-' + String(day).padStart(2,'0'); }
  function setSelectOptionsSafe(id, rows, labelFn, allLabel){
    const el = $(id); if(!el) return;
    const old = el.value;
    el.innerHTML = `<option value="">${allLabel||'الكل'}</option>` + rows.map(r=>`<option value="${r.id}">${esc(labelFn(r))}</option>`).join('');
    if([...el.options].some(o=>o.value===old)) el.value = old;
  }
  function ensureAttendanceMatrixFilters(){
    const monthEl = $('attendanceMatrixMonth');
    if(monthEl && !monthEl.value) monthEl.value = today().slice(0,7);
    setSelectOptionsSafe('attendanceMatrixSupervisor', data.supervisors||[], s=>s.full_name||s.username, 'كل المشرفين');
    const sid = $('attendanceMatrixSupervisor')?.value;
    let projects = data.projects || [];
    if(sid) projects = projects.filter(p=>String(p.supervisor_id)===String(sid));
    setSelectOptionsSafe('attendanceMatrixProject', projects, p=>p.name, 'كل المشاريع');
  }
  function workerMatchesMatrix(w, sid, pid, q){
    if(sid && String(workerSupId(w))!==String(sid)) return false;
    if(pid && String(workerProjectId(w))!==String(pid)) return false;
    if(q && !String(w.name||'').includes(q)) return false;
    return true;
  }
  window.renderAttendanceMonthly = function(){
    if(!$('attendanceMatrixBody')) return;
    ensureAttendanceMatrixFilters();
    const month = $('attendanceMatrixMonth')?.value || today().slice(0,7);
    const sid = $('attendanceMatrixSupervisor')?.value || '';
    const pid = $('attendanceMatrixProject')?.value || '';
    const q = ($('attendanceMatrixSearch')?.value || '').trim();
    const days = daysInMonth(month);
    const workers = (data.workers||[]).filter(w=>workerMatchesMatrix(w,sid,pid,q));
    const head = $('attendanceMatrixHead');
    if(head){
      const dayHeads = Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
      head.innerHTML = `<tr><th>العامل</th><th>المشرف</th><th>المشروع</th>${dayHeads}<th>حضور</th><th>غياب</th><th>النسبة</th></tr>`;
    }
    let totalPresent=0,totalAbsent=0;
    const body = $('attendanceMatrixBody');
    body.innerHTML = workers.map(w=>{
      let present=0, absent=0;
      const cells = [];
      for(let d=1; d<=days; d++){
        const ds = monthDate(month,d);
        const rec = (data.attendance||[]).find(a=>String(a.worker_id)===String(w.id) && a.attendance_date===ds && (!pid || String(a.project_id||workerProjectId(w))===String(pid)));
        if(rec?.status==='present'){ present++; cells.push(`<td title="حاضر"><span class="att-cell att-present">ح</span></td>`); }
        else if(rec?.status==='absent'){ absent++; cells.push(`<td title="غائب"><span class="att-cell att-absent">غ</span></td>`); }
        else cells.push(`<td title="لم يسجل"><span class="att-cell att-empty">-</span></td>`);
      }
      totalPresent += present; totalAbsent += absent;
      const pct = (present+absent) ? (present/(present+absent))*100 : 0;
      const cls = pct>=90?'green':(pct>=70?'amber':'red');
      return `<tr><td><b>${esc(w.name)}</b><div class="att-summary">${esc(workerTypeText(w.worker_type||'primary'))}</div></td><td>${esc(supervisorName(workerSupId(w)))}</td><td>${esc(projectName(workerProjectId(w)))}</td>${cells.join('')}<td><span class="badge green">${present}</span></td><td><span class="badge red">${absent}</span></td><td><span class="badge ${cls}">${pct.toFixed(1)}%</span></td></tr>`;
    }).join('') || `<tr><td colspan="${days+6}">لا يوجد عمال حسب الفلاتر المختارة</td></tr>`;
    const recorded = totalPresent + totalAbsent;
    const pct = recorded ? (totalPresent/recorded)*100 : 0;
    if($('attendanceMatrixSummary')){
      $('attendanceMatrixSummary').innerHTML = `<div class="kpi"><small>عدد العمال</small><b>${workers.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalPresent}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalAbsent}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
    }
  };
  window.exportAttendanceMatrixCSV = function(){
    const month = $('attendanceMatrixMonth')?.value || today().slice(0,7);
    const rows=[...document.querySelectorAll('#attendanceMatrixBody tr')].map(tr=>[...tr.children].map(td=>`"${td.textContent.trim().replace(/"/g,'""')}"`).join(','));
    const heads=[...document.querySelectorAll('#attendanceMatrixHead th')].map(th=>`"${th.textContent.trim()}"`).join(',');
    download(`attendance-${month}.csv`, [heads,...rows].join('\n'));
  };
  const oldRenderAttendance = window.renderAttendance;
  window.renderAttendance = function(){
    try{ if(typeof oldRenderAttendance==='function') oldRenderAttendance(); }catch(e){ console.error('old renderAttendance failed',e); }
    try{ window.renderAttendanceMonthly(); }catch(e){ console.error('renderAttendanceMonthly failed',e); }
  };
})();

/* ===== V10.1: Fix attendance monthly filters and empty results ===== */
(function(){
  function daysInMonthFixed(monthStr){
    if(!monthStr || !monthStr.includes('-')) monthStr = today().slice(0,7);
    const [y,m] = monthStr.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function monthDateFixed(monthStr, day){ return `${monthStr}-${String(day).padStart(2,'0')}`; }
  function monthOfAttendance(a){ return String(a.attendance_date || '').slice(0,7); }
  function safeOptionText(v){ return esc(v || '-'); }
  function setOptionsKeepValue(id, rows, labelFn, allLabel){
    const el = $(id); if(!el) return '';
    const old = el.value || '';
    const seen = new Set();
    const opts = [];
    (rows||[]).forEach(r=>{
      if(!r || r.id===undefined || r.id===null) return;
      const val = String(r.id);
      if(seen.has(val)) return;
      seen.add(val);
      opts.push(`<option value="${esc(val)}">${safeOptionText(labelFn(r))}</option>`);
    });
    el.innerHTML = `<option value="">${allLabel || 'الكل'}</option>` + opts.join('');
    if([...el.options].some(o=>o.value===old)) el.value = old;
    else el.value = '';
    return el.value;
  }
  function projectMatchesSupervisorForAttendance(project, sid, month){
    if(!sid) return true;
    if(String(project.supervisor_id||'') === String(sid)) return true;
    const hasWorker = (data.workers||[]).some(w => String(workerProjectId(w)||'')===String(project.id) && String(workerSupId(w)||'')===String(sid));
    if(hasWorker) return true;
    return (data.attendance||[]).some(a => monthOfAttendance(a)===month && String(a.project_id||'')===String(project.id) && String(a.supervisor_id||'')===String(sid));
  }
  function workerMatchesAttendanceMatrixFixed(w, sid, pid, q, month){
    const wid = String(w.id);
    const wsid = String(workerSupId(w)||'');
    const wpid = String(workerProjectId(w)||'');
    const workerAttend = (data.attendance||[]).filter(a=>monthOfAttendance(a)===month && String(a.worker_id)===wid);
    if(sid){
      const projectSupervisorMatch = wpid && String((data.projects||[]).find(p=>String(p.id)===wpid)?.supervisor_id||'')===String(sid);
      const attendanceSupervisorMatch = workerAttend.some(a=>String(a.supervisor_id||'')===String(sid));
      if(wsid!==String(sid) && !projectSupervisorMatch && !attendanceSupervisorMatch) return false;
    }
    if(pid){
      const attendanceProjectMatch = workerAttend.some(a=>String(a.project_id||'')===String(pid));
      if(wpid!==String(pid) && !attendanceProjectMatch) return false;
    }
    if(q && !String(w.name||'').includes(q)) return false;
    return true;
  }
  function recordForDay(w, ds, sid, pid){
    const rows = (data.attendance||[]).filter(a=>String(a.worker_id)===String(w.id) && a.attendance_date===ds);
    return rows.find(a=>(!sid || String(a.supervisor_id||workerSupId(w)||'')===String(sid)) && (!pid || String(a.project_id||workerProjectId(w)||'')===String(pid))) || null;
  }
  window.renderAttendanceMonthly = function(){
    const body = $('attendanceMatrixBody');
    if(!body) return;

    const monthEl = $('attendanceMatrixMonth');
    if(monthEl && !monthEl.value) monthEl.value = today().slice(0,7);
    const month = monthEl?.value || today().slice(0,7);

    const supervisorRows = (data.supervisors && data.supervisors.length ? data.supervisors : (data.users||[]).filter(u=>u.role==='supervisor'));
    const sid = setOptionsKeepValue('attendanceMatrixSupervisor', supervisorRows, s=>s.full_name || s.username, 'كل المشرفين');

    const projectRows = (data.projects||[]).filter(p=>projectMatchesSupervisorForAttendance(p, sid, month));
    const pid = setOptionsKeepValue('attendanceMatrixProject', projectRows, p=>p.name, 'كل المشاريع');

    const q = ($('attendanceMatrixSearch')?.value || '').trim();
    const days = daysInMonthFixed(month);
    const workers = (data.workers||[]).filter(w=>workerMatchesAttendanceMatrixFixed(w, sid, pid, q, month));

    const head = $('attendanceMatrixHead');
    if(head){
      const dayHeads = Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
      head.innerHTML = `<tr><th>العامل</th><th>المشرف</th><th>المشروع</th>${dayHeads}<th>حضور</th><th>غياب</th><th>النسبة</th></tr>`;
    }

    let totalPresent=0, totalAbsent=0;
    body.innerHTML = workers.map(w=>{
      let present=0, absent=0;
      const cells=[];
      for(let d=1; d<=days; d++){
        const ds = monthDateFixed(month,d);
        const rec = recordForDay(w, ds, sid, pid);
        if(rec && rec.status==='present'){
          present++; cells.push(`<td title="حاضر"><span class="att-cell att-present">ح</span></td>`);
        } else if(rec && rec.status==='absent'){
          absent++; cells.push(`<td title="غائب"><span class="att-cell att-absent">غ</span></td>`);
        } else {
          cells.push(`<td title="لم يسجل"><span class="att-cell att-empty">-</span></td>`);
        }
      }
      totalPresent += present; totalAbsent += absent;
      const pct = (present+absent) ? (present/(present+absent))*100 : 0;
      const cls = pct>=90 ? 'green' : (pct>=70 ? 'amber' : 'red');
      const projectId = pid || workerProjectId(w);
      const supervisorId = sid || workerSupId(w) || (projectId ? (data.projects||[]).find(p=>String(p.id)===String(projectId))?.supervisor_id : '');
      return `<tr><td><b>${esc(w.name)}</b><div class="att-summary">${esc(workerTypeText(w.worker_type||'primary'))}</div></td><td>${esc(supervisorName(supervisorId))}</td><td>${esc(projectName(projectId))}</td>${cells.join('')}<td><span class="badge green">${present}</span></td><td><span class="badge red">${absent}</span></td><td><span class="badge ${cls}">${pct.toFixed(1)}%</span></td></tr>`;
    }).join('') || `<tr><td colspan="${days+6}">لا يوجد عمال حسب الفلاتر المختارة</td></tr>`;

    const recorded = totalPresent + totalAbsent;
    const pct = recorded ? (totalPresent/recorded)*100 : 0;
    if($('attendanceMatrixSummary')){
      $('attendanceMatrixSummary').innerHTML = `<div class="kpi"><small>عدد العمال</small><b>${workers.length}</b></div><div class="kpi"><small>إجمالي الحضور</small><b>${totalPresent}</b></div><div class="kpi"><small>إجمالي الغياب</small><b>${totalAbsent}</b></div><div class="kpi"><small>نسبة الحضور</small><b>${pct.toFixed(1)}%</b></div>`;
    }
  };

  const oldShowPageV101 = window.showPage;
  window.showPage = function(id, btn){
    if(typeof oldShowPageV101 === 'function') oldShowPageV101(id, btn);
    if(id === 'attendance') setTimeout(()=>window.renderAttendanceMonthly && window.renderAttendanceMonthly(), 0);
  };
})();


/* ===== V11: Tickets management for admin and supervisor ===== */
(function(){
  function ticketNo(t){ return t.ticket_number || ('T-' + String(t.id||0).padStart(4,'0')); }
  function ticketStatusLabel(status){ return status==='closed'?'مغلق':(status==='processing'?'تحت المعالجة':'مفتوح'); }
  function ticketStatusCls(status){ return status==='closed'?'green':(status==='processing'?'amber':'red'); }
  function ticketPriorityLabel(p){ return p==='urgent'?'عاجل':(p==='high'?'مهم':(p==='low'?'منخفض':'عادي')); }
  function ticketPriorityCls(p){ return p==='urgent'?'red':(p==='high'?'amber':''); }
  function shortDesc(s){ s=String(s||''); return s.length>80 ? esc(s.slice(0,80))+'…' : esc(s||'-'); }

  window.clearTicketForm = function(){
    ['ticketId','ticketTitle','ticketDescription'].forEach(id=>{ if($(id)) $(id).value=''; });
    if($('ticketStatus')) $('ticketStatus').value='open';
    if($('ticketPriority')) $('ticketPriority').value='normal';
    if($('ticketFormTitle')) $('ticketFormTitle').textContent='إضافة تكت';
  };

  window.saveTicket = async function(){
    const u=session(); if(!u) return msg('سجّل الدخول أولاً','err');
    const title=($('ticketTitle')?.value||'').trim();
    if(!title) return msg('عنوان التكت مطلوب','err');
    const status=$('ticketStatus')?.value || 'open';
    const row={
      project_id:Number($('ticketProject')?.value)||null,
      supervisor_id:Number($('ticketSupervisor')?.value || (u.role==='supervisor'?u.id:''))||null,
      created_by:u.id,
      title,
      description:$('ticketDescription')?.value || '',
      priority:$('ticketPriority')?.value || 'normal',
      status,
      updated_at:new Date().toISOString()
    };
    row.closed_at = status==='closed' ? new Date().toISOString() : null;
    const id=$('ticketId')?.value;
    let res;
    if(id){
      res=await sb.from('tickets').update(row).eq('id',id).select('*').maybeSingle();
    }else{
      res=await sb.from('tickets').insert(row).select('*').single();
      if(!res.error && res.data && !res.data.ticket_number){
        const tn='T-'+String(res.data.id).padStart(4,'0');
        await sb.from('tickets').update({ticket_number:tn}).eq('id',res.data.id);
      }
    }
    if(res.error) return msg(res.error.message,'err');
    playAppSound('ticket');
    msg(id?'تم تحديث التكت':'تم حفظ التكت');
    clearTicketForm();
    if(u.role==='supervisor') await window.initSupervisor(); else await refreshAll();
  };

  window.renderTickets = function(){
    const adminBody=$('ticketsBody');
    const supBody=$('supTicketsBody');
    if(!adminBody && !supBody) return;
    let rows=[...(data.tickets||[])];

    if(adminBody){
      const st=$('ticketFilterStatus')?.value || '';
      const q=($('ticketSearch')?.value||'').trim().toLowerCase();
      let list=rows;
      if(st) list=list.filter(t=>t.status===st);
      if(q) list=list.filter(t=>[ticketNo(t),t.title,t.description,projectName(t.project_id),supervisorName(t.supervisor_id),ticketStatusLabel(t.status)].join(' ').toLowerCase().includes(q));
      adminBody.innerHTML=list.map(t=>`<tr>
        <td><b>${esc(ticketNo(t))}</b></td>
        <td>${esc(projectName(t.project_id))}</td>
        <td>${esc(supervisorName(t.supervisor_id))}</td>
        <td>${esc(t.title)}</td>
        <td style="white-space:normal;min-width:220px">${shortDesc(t.description)}</td>
        <td><span class="badge ${ticketPriorityCls(t.priority)}">${ticketPriorityLabel(t.priority)}</span></td>
        <td><span class="badge ${ticketStatusCls(t.status)}">${ticketStatusLabel(t.status)}</span></td>
        <td>${fmt(t.created_at)}</td>
        <td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`<button class="light" onclick="setTicketStatus(${t.id},'processing')">معالجة</button><button onclick="setTicketStatus(${t.id},'closed')">إغلاق</button>`}<button class="danger" onclick="deleteRow('tickets',${t.id})">حذف</button></td>
      </tr>`).join('')||'<tr><td colspan="9">لا توجد تكتات</td></tr>';
    }

    if(supBody){
      const st=$('supTicketFilterStatus')?.value || '';
      const pid=$('supTicketFilterProject')?.value || '';
      const q=($('supTicketSearch')?.value||'').trim().toLowerCase();
      let list=rows;
      if(pid) list=list.filter(t=>String(t.project_id)===String(pid));
      if(st) list=list.filter(t=>t.status===st);
      if(q) list=list.filter(t=>[ticketNo(t),t.title,t.description,projectName(t.project_id),ticketStatusLabel(t.status)].join(' ').toLowerCase().includes(q));
      supBody.innerHTML=list.map(t=>`<tr>
        <td><b>${esc(ticketNo(t))}</b></td>
        <td>${esc(projectName(t.project_id))}</td>
        <td>${esc(t.title)}</td>
        <td style="white-space:normal;min-width:180px">${shortDesc(t.description)}</td>
        <td><span class="badge ${ticketPriorityCls(t.priority)}">${ticketPriorityLabel(t.priority)}</span></td>
        <td><span class="badge ${ticketStatusCls(t.status)}">${ticketStatusLabel(t.status)}</span></td>
        <td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button>${t.status==='closed'?`<button class="light" onclick="setTicketStatus(${t.id},'open')">إعادة فتح</button>`:`<button class="light" onclick="setTicketStatus(${t.id},'processing')">معالجة</button><button onclick="setTicketStatus(${t.id},'closed')">إغلاق</button>`}</td>
      </tr>`).join('')||'<tr><td colspan="7">لا توجد تكتات</td></tr>';
    }
  };

  window.editTicket = function(id){
    const t=(data.tickets||[]).find(x=>String(x.id)===String(id)); if(!t) return;
    if($('ticketId')) $('ticketId').value=t.id;
    if($('ticketProject')) $('ticketProject').value=t.project_id||'';
    if($('ticketSupervisor')) $('ticketSupervisor').value=t.supervisor_id||'';
    if($('ticketTitle')) $('ticketTitle').value=t.title||'';
    if($('ticketPriority')) $('ticketPriority').value=t.priority||'normal';
    if($('ticketStatus')) $('ticketStatus').value=t.status||'open';
    if($('ticketDescription')) $('ticketDescription').value=t.description||'';
    if($('ticketFormTitle')) $('ticketFormTitle').textContent='تعديل تكت '+ticketNo(t);
    window.scrollTo({top:0,behavior:'smooth'});
  };

  window.setTicketStatus = async function(id,status){
    const row={status, updated_at:new Date().toISOString(), closed_at: status==='closed'?new Date().toISOString():null};
    const {error}=await sb.from('tickets').update(row).eq('id',id);
    if(error) return msg(error.message,'err');
    msg(status==='closed'?'تم إغلاق التكت':(status==='processing'?'تم تحويل التكت للمعالجة':'تم إعادة فتح التكت'));
    const u=session();
    if(u?.role==='supervisor') await window.initSupervisor(); else await refreshAll();
  };

  const oldInitSupervisorV11 = window.initSupervisor;
  window.initSupervisor = async function(){
    await oldInitSupervisorV11();
    if($('supTicketFilterProject')) fillSelect('supTicketFilterProject', data.projects||[], 'name', 'كل المشاريع');
    renderTickets();
  };
})();
