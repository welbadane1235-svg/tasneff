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
async function initAdmin(){ requireRole('admin'); await refreshAll(); }
async function refreshAll(){ await loadAll(); hydrateForms(); renderAll(); }
function hydrateForms(){
  const sups = data.supervisors; const pros = data.projects; const workers = data.workers;
  ['logSupervisor','dailySupervisor','projectSupervisor','workerSupervisor','workerFilterSupervisor','attendanceSupervisor','attendanceFilterSupervisor','ticketSupervisor','monthlySupervisor'].forEach(id=>fillSelect(id,sups,'full_name','الكل'));
  ['logProject','dailyProject','attendanceProject','ticketProject','workerProject','workerFilterProject'].forEach(id=>fillSelect(id,pros,'name','الكل'));
  fillSelect('projectSupervisor',sups,'full_name','بدون مشرف'); fillSelect('workerSupervisor',sups,'full_name','بدون مشرف'); fillSelect('attendanceWorker',workers,'name','اختر العامل');
  if($('logDate')&&!$('logDate').value) $('logDate').value=today(); if($('dailyDate')&&!$('dailyDate').value) $('dailyDate').value=today(); if($('attendanceDate')&&!$('attendanceDate').value) $('attendanceDate').value=today(); if($('attendanceFilterDate')&&!$('attendanceFilterDate').value) $('attendanceFilterDate').value=today(); if($('monthlyMonth')&&!$('monthlyMonth').value) $('monthlyMonth').value=today().slice(0,7);
}
function renderAll(){ renderDashboard(); renderTimeLogs(); renderUsers(); renderProjects(); renderWorkers(); renderAttendance(); renderMonthly(); renderTickets(); renderAlerts(); }
function showPage(id, btn){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); $(id)?.classList.remove('hidden'); document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active')); btn?.classList.add('active'); renderAll(); }
function renderDashboard(){ if(!$('kpiUsers')) return; $('kpiUsers').textContent=data.users.length; $('kpiProjects').textContent=data.projects.length; $('kpiWorkers').textContent=data.workers.length; $('kpiTodayLogs').textContent=data.logs.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===today()).length; const div=$('todaySummary'); if(div) div.innerHTML = data.supervisors.map(s=>{ const logs=data.logs.filter(l=>String(l.supervisor_id)===String(s.id)&&(l.log_date||String(l.check_in||'').slice(0,10))===today()); const mins=logs.reduce((a,l)=>a+(l.duration_minutes||minutesBetween(l.check_in,l.check_out)),0); return `<div class="summary-item"><b>${esc(s.full_name)}</b><br>عدد التسجيلات: ${logs.length}<br>إجمالي الوقت: ${minsToText(mins)}</div>`; }).join('') || '<div class="summary-item">لا توجد تسجيلات اليوم</div>'; }
function setNow(id){ $(id).value=nowTime(); }
function clearLogForm(){ ['logId','logIn','logOut','logTravel','logNotes'].forEach(id=>{ if($(id)) $(id).value=id==='logTravel'?'0':''; }); if($('logDate')) $('logDate').value=today(); $('logFormTitle') && ($('logFormTitle').textContent='تسجيل دخول / خروج'); }
async function saveTimeLog(){ const u=session(); const id=$('logId')?.value; const date=$('logDate')?.value || today(); let sup=$('logSupervisor')?.value || (u.role==='supervisor'?u.id:''); const project=$('logProject')?.value; if(!sup && project) sup=getProjectSupervisorId(project); const check_in=dateTime(date,$('logIn')?.value), check_out=dateTime(date,$('logOut')?.value); if(!project||!check_in) return msg('المشروع ووقت الدخول مطلوبان','err'); const row={user_id:u.id, supervisor_id:Number(sup)||null, project_id:Number(project), check_in, check_out, log_date:date, duration_minutes:minutesBetween(check_in,check_out), travel_minutes:Number($('logTravel')?.value||0), notes:$('logNotes')?.value||''}; const res=id ? await sb.from('time_logs').update(row).eq('id',id) : await sb.from('time_logs').insert(row); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ التسجيل'); clearLogForm(); await refreshAll(); }
function filterLogs(){ let rows=[...data.logs]; const d=$('dailyDate')?.value, s=$('dailySupervisor')?.value, p=$('dailyProject')?.value, q=($('dailySearch')?.value||'').trim(); if(d) rows=rows.filter(l=>(l.log_date||String(l.check_in||'').slice(0,10))===d); if(s) rows=rows.filter(l=>String(l.supervisor_id)===String(s)); if(p) rows=rows.filter(l=>String(l.project_id)===String(p)); if(q) rows=rows.filter(l=>[supervisorName(l.supervisor_id),projectName(l.project_id),l.notes].join(' ').includes(q)); return rows; }
function renderTimeLogs(){ const body=$('logsBody'); if(!body) return; body.innerHTML = filterLogs().map(l=>`<tr><td>${esc(l.log_date||String(l.check_in||'').slice(0,10))}</td><td>${esc(supervisorName(l.supervisor_id))}</td><td>${esc(projectName(l.project_id))}</td><td>${timeOnly(l.check_in)}</td><td>${timeOnly(l.check_out)}</td><td>${minsToText(l.duration_minutes||minutesBetween(l.check_in,l.check_out))}</td><td>${l.travel_minutes||0}</td><td>${esc(l.notes)}</td><td class="row-actions"><button onclick="editTimeLog(${l.id})">تعديل</button><button class="danger" onclick="deleteRow('time_logs',${l.id})">حذف</button></td></tr>`).join('') || '<tr><td colspan="9">لا توجد بيانات</td></tr>'; }
function editTimeLog(id){ const l=data.logs.find(x=>x.id===id); if(!l) return; $('logId').value=l.id; $('logDate').value=l.log_date||String(l.check_in||'').slice(0,10); if($('logSupervisor')) $('logSupervisor').value=l.supervisor_id||''; $('logProject').value=l.project_id||''; $('logIn').value=l.check_in?new Date(l.check_in).toTimeString().slice(0,5):''; $('logOut').value=l.check_out?new Date(l.check_out).toTimeString().slice(0,5):''; $('logTravel').value=l.travel_minutes||0; $('logNotes').value=l.notes||''; $('logFormTitle') && ($('logFormTitle').textContent='تعديل تسجيل'); window.scrollTo({top:0,behavior:'smooth'}); }
async function deleteRow(table,id){ if(!confirm('تأكيد الحذف؟')) return; const {error}=await sb.from(table).delete().eq('id',id); if(error) return msg(error.message,'err'); msg('تم الحذف'); await refreshAll(); }
function clearUserForm(){ ['userId','userFullName','userUsername','userPassword'].forEach(id=>$(id)&&($(id).value='')); if($('userRole')) $('userRole').value='supervisor'; if($('userActive')) $('userActive').value='true'; $('userFormTitle')&&($('userFormTitle').textContent='إضافة مستخدم'); }
async function saveUser(){ const id=$('userId').value; const row={full_name:$('userFullName').value.trim(), username:$('userUsername').value.trim(), password:$('userPassword').value.trim()||'123456', role:$('userRole').value, is_active:$('userActive').value==='true'}; if(!row.full_name||!row.username) return msg('الاسم واسم المستخدم مطلوبان','err'); const res=id?await sb.from('app_users').update(row).eq('id',id):await sb.from('app_users').insert(row); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ المستخدم'); clearUserForm(); await refreshAll(); }
function renderUsers(){ const b=$('usersBody'); if(!b) return; b.innerHTML=data.users.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><span class="badge">${u.role==='admin'?'مدير':'مشرف'}</span></td><td><span class="badge ${u.is_active?'green':'red'}">${u.is_active?'نشط':'موقوف'}</span></td><td class="row-actions"><button onclick="editUser(${u.id})">تعديل</button><button class="danger" onclick="deleteRow('app_users',${u.id})">حذف</button></td></tr>`).join(''); }
function editUser(id){ const u=data.users.find(x=>x.id===id); if(!u)return; $('userId').value=u.id; $('userFullName').value=u.full_name||''; $('userUsername').value=u.username||''; $('userPassword').value=u.password||''; $('userRole').value=u.role; $('userActive').value=String(u.is_active!==false); $('userFormTitle').textContent='تعديل مستخدم'; }
function clearProjectForm(){ ['projectId','projectName','projectLocation','projectNotes'].forEach(id=>$(id)&&($(id).value='')); if($('projectSupervisor')) $('projectSupervisor').value=''; if($('projectStatus')) $('projectStatus').value='active'; $('projectFormTitle')&&($('projectFormTitle').textContent='إضافة مشروع'); }
async function saveProject(){ const id=$('projectId').value; const row={name:$('projectName').value.trim(), location:$('projectLocation').value.trim(), supervisor_id:Number($('projectSupervisor').value)||null, status:$('projectStatus').value, notes:$('projectNotes').value}; if(!row.name) return msg('اسم المشروع مطلوب','err'); const res=id?await sb.from('projects').update(row).eq('id',id):await sb.from('projects').insert(row); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ المشروع'); clearProjectForm(); await refreshAll(); }
function renderProjects(){ const b=$('projectsBody'); if(!b) return; const q=($('projectSearch')?.value||'').trim(); let rows=data.projects.filter(p=>!q||[p.name,p.location,supervisorName(p.supervisor_id)].join(' ').includes(q)); b.innerHTML=rows.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(supervisorName(p.supervisor_id))}</td><td>${esc(p.location)}</td><td><span class="badge ${p.status==='inactive'?'red':'green'}">${p.status==='inactive'?'متوقف':'نشط'}</span></td><td class="row-actions"><button onclick="editProject(${p.id})">تعديل</button><button class="danger" onclick="deleteRow('projects',${p.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="5">لا توجد بيانات</td></tr>'; }
function editProject(id){ const p=data.projects.find(x=>x.id===id); if(!p)return; $('projectId').value=p.id; $('projectName').value=p.name||''; $('projectLocation').value=p.location||''; $('projectSupervisor').value=p.supervisor_id||''; $('projectStatus').value=p.status||'active'; $('projectNotes').value=p.notes||''; $('projectFormTitle').textContent='تعديل مشروع'; }
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
function renderMonthly(){ const body=$('monthlyBody'); if(!body) return; const month=$('monthlyMonth')?.value || today().slice(0,7), sid=$('monthlySupervisor')?.value; let rows=data.logs.filter(l=>(l.log_date||String(l.check_in||'').slice(0,7)).slice(0,7)===month); if(sid) rows=rows.filter(l=>String(l.supervisor_id)===String(sid)); const map={}; rows.forEach(l=>{ const k=(l.supervisor_id||'')+'_'+(l.project_id||''); if(!map[k]) map[k]={s:l.supervisor_id,p:l.project_id,c:0,m:0,t:0}; map[k].c++; map[k].m+=l.duration_minutes||minutesBetween(l.check_in,l.check_out); map[k].t+=l.travel_minutes||0; }); const vals=Object.values(map); body.innerHTML=vals.map(r=>`<tr><td>${esc(supervisorName(r.s))}</td><td>${esc(projectName(r.p))}</td><td>${r.c}</td><td>${minsToText(r.m)}</td><td>${r.t} دقيقة</td></tr>`).join('')||'<tr><td colspan="5">لا توجد بيانات</td></tr>'; const total=vals.reduce((a,r)=>a+r.m,0), travel=vals.reduce((a,r)=>a+r.t,0); if($('monthlySummary')) $('monthlySummary').innerHTML=`<div class="kpi"><small>عدد التسجيلات</small><b>${rows.length}</b></div><div class="kpi"><small>ساعات العمل</small><b>${minsToText(total)}</b></div><div class="kpi"><small>وقت الانتقال</small><b>${travel}</b></div>`; }
function clearTicketForm(){ ['ticketId','ticketTitle','ticketDescription'].forEach(id=>$(id)&&($(id).value='')); if($('ticketStatus')) $('ticketStatus').value='open'; if($('ticketPriority')) $('ticketPriority').value='normal'; $('ticketFormTitle')&&($('ticketFormTitle').textContent='إضافة تكت'); }
async function saveTicket(){ const u=session(); const row={project_id:Number($('ticketProject').value)||null, supervisor_id:Number($('ticketSupervisor')?.value || (u.role==='supervisor'?u.id:''))||null, title:$('ticketTitle').value.trim(), description:$('ticketDescription').value, priority:$('ticketPriority').value, status:$('ticketStatus')?.value || 'open'}; if(!row.title) return msg('عنوان التكت مطلوب','err'); if(row.status==='closed') row.closed_at=new Date().toISOString(); const id=$('ticketId')?.value; const res=id?await sb.from('tickets').update(row).eq('id',id):await sb.from('tickets').insert(row); if(res.error) return msg(res.error.message,'err'); msg('تم حفظ التكت'); clearTicketForm(); await refreshAll(); }
function renderTickets(){ const b=$('ticketsBody'); if(!b) return; const st=$('ticketFilterStatus')?.value, q=($('ticketSearch')?.value||'').trim(); let rows=data.tickets; if(st) rows=rows.filter(t=>t.status===st); if(q) rows=rows.filter(t=>[t.title,t.description,projectName(t.project_id),supervisorName(t.supervisor_id)].join(' ').includes(q)); b.innerHTML=rows.map(t=>`<tr><td>${esc(projectName(t.project_id))}</td><td>${esc(supervisorName(t.supervisor_id))}</td><td>${esc(t.title)}</td><td><span class="badge ${t.priority==='high'?'red':'amber'}">${t.priority||'normal'}</span></td><td><span class="badge ${t.status==='closed'?'green':'red'}">${t.status==='closed'?'مغلق':'مفتوح'}</span></td><td class="row-actions"><button onclick="editTicket(${t.id})">تعديل</button><button class="danger" onclick="deleteRow('tickets',${t.id})">حذف</button></td></tr>`).join('')||'<tr><td colspan="6">لا توجد بيانات</td></tr>'; }
function editTicket(id){ const t=data.tickets.find(x=>x.id===id); if(!t)return; $('ticketId').value=t.id; $('ticketProject').value=t.project_id||''; if($('ticketSupervisor')) $('ticketSupervisor').value=t.supervisor_id||''; $('ticketTitle').value=t.title||''; $('ticketPriority').value=t.priority||'normal'; if($('ticketStatus')) $('ticketStatus').value=t.status||'open'; $('ticketDescription').value=t.description||''; $('ticketFormTitle')&&($('ticketFormTitle').textContent='تعديل تكت'); }
function renderAlerts(){ const div=$('alertsList'); if(!div) return; const alerts=[]; data.projects.filter(p=>!p.supervisor_id).forEach(p=>alerts.push(['warn',`مشروع بدون مشرف: ${p.name}`])); data.workers.filter(w=>!workerSupId(w)).forEach(w=>alerts.push(['warn',`عامل بدون مشرف: ${w.name}`])); data.logs.filter(l=>!l.check_out).forEach(l=>alerts.push(['danger',`تسجيل دخول بدون خروج: ${projectName(l.project_id)} - ${supervisorName(l.supervisor_id)}`])); data.tickets.filter(t=>t.status==='open').forEach(t=>alerts.push(['warn',`تكت مفتوح: ${t.title} - ${projectName(t.project_id)}`])); div.innerHTML=alerts.map(a=>`<div class="alert-item ${a[0]}">${esc(a[1])}</div>`).join('')||'<div class="alert-item">لا توجد تنبيهات حالياً</div>'; }
function toCSV(rows){ if(!rows.length) return ''; const keys=Object.keys(rows[0]); return [keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\n'); }
function download(name,text){ const blob=new Blob([text],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
async function exportTable(table){ const {data:rows,error}=await sb.from(table).select('*'); if(error) return msg(error.message,'err'); download(`${table}.csv`, toCSV(rows||[])); }
function exportMonthlyCSV(){ const rows=[...document.querySelectorAll('#monthlyBody tr')].map(tr=>[...tr.children].map(td=>td.textContent)); const csv=['المشرف,المشروع,عدد السجلات,ساعات العمل,وقت الانتقال',...rows.map(r=>r.map(x=>'"'+x+'"').join(','))].join('\n'); download('monthly.csv',csv); }
async function initSupervisor(){ const u=requireRole('supervisor'); if(!u) return; await loadAll(); data.projects=data.projects.filter(p=>String(p.supervisor_id)===String(u.id)); data.workers=data.workers.filter(w=>String(workerSupId(w))===String(u.id)); data.logs=data.logs.filter(l=>String(l.supervisor_id)===String(u.id)); data.tickets=data.tickets.filter(t=>String(t.supervisor_id)===String(u.id)); $('supTitle').textContent=`لوحة المشرف - ${u.full_name}`; fillSelect('logProject',data.projects,'name','اختر المشروع'); fillSelect('attendanceProject',data.projects,'name','اختر المشروع'); fillSelect('ticketProject',data.projects,'name','اختر المشروع'); if($('logDate')) $('logDate').value=today(); if($('attendanceDate')) $('attendanceDate').value=today(); renderSupervisorAttendanceList(); renderTimeLogs(); }
async function supervisorCheckIn(){ if(!$('logProject').value) return msg('اختر المشروع','err'); $('logDate').value=today(); $('logIn').value=nowTime(); $('logOut').value=''; await saveTimeLog(); await initSupervisor(); }
async function supervisorCheckOut(){ const u=session(); const pid=$('logProject').value; const open=data.logs.find(l=>String(l.project_id)===String(pid)&&!l.check_out); if(open) editTimeLog(open.id); $('logOut').value=nowTime(); await saveTimeLog(); await initSupervisor(); }
function renderSupervisorAttendanceList(){ const div=$('supervisorAttendanceList'); if(!div) return; div.innerHTML=data.workers.map(w=>`<div class="quick-item"><b>${esc(w.name)}</b><select data-worker="${w.id}"><option value="present">حاضر</option><option value="absent">غائب</option></select></div>`).join('')||'<div class="quick-item">لا يوجد عمال مرتبطين بك</div>'; }
async function saveSupervisorAttendance(){ const u=session(); const date=$('attendanceDate').value||today(), project=Number($('attendanceProject').value)||null; const rows=[...document.querySelectorAll('#supervisorAttendanceList select')].map(s=>({attendance_date:date, worker_id:Number(s.dataset.worker), supervisor_id:u.id, project_id:project, status:s.value, created_by:u.id})); if(!rows.length) return; const {error}=await sb.from('attendance').upsert(rows,{onConflict:'attendance_date,worker_id'}); if(error) return msg(error.message,'err'); msg('تم حفظ التحضير'); await initSupervisor(); }
