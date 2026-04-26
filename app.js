// Tasneef HTML App - Vanilla JS + Supabase
// ضع بيانات Supabase هنا
const SUPABASE_URL = "https://zmjdqiswytxlbfgnfjfv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ADsAC5MtBCusDgX62c8NaQ_LyyuTPeb";

let sb;
try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch(e) { console.error(e); }

const $ = (id)=>document.getElementById(id);
const q = (sel)=>document.querySelector(sel);
const qa = (sel)=>Array.from(document.querySelectorAll(sel));
const today = ()=> new Date().toISOString().slice(0,10);
const nowIso = ()=> new Date().toISOString();
const fmt = (d)=> d ? new Date(d).toLocaleString('ar-SA') : '-';
const session = ()=> JSON.parse(localStorage.getItem('tasneef_user') || 'null');
const setSession = (u)=> localStorage.setItem('tasneef_user', JSON.stringify(u));
const clearSession = ()=> localStorage.removeItem('tasneef_user');
const msg = (el, text, type='ok')=>{ if(!el) return; el.className = type; el.textContent = text; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),3500); };

function requireLogin(role){
  const u = session();
  if(!u){ location.href = 'index.html'; return null; }
  if(role && u.role !== role){ location.href = u.role === 'admin' ? 'admin.html' : 'supervisor.html'; return null; }
  return u;
}
function logout(){ clearSession(); location.href='index.html'; }

async function db(table){ return sb.from(table); }
async function selectAll(table, cols='*'){
  const {data,error}= await sb.from(table).select(cols).order('created_at',{ascending:false});
  if(error) throw error; return data || [];
}
async function insertRow(table, payload){ const {data,error}= await sb.from(table).insert(payload).select().single(); if(error) throw error; return data; }
async function updateRow(table, id, payload){ const {error}= await sb.from(table).update(payload).eq('id',id); if(error) throw error; }
async function deleteRow(table, id){ const {error}= await sb.from(table).delete().eq('id',id); if(error) throw error; }

async function login(){
  const username = $('username').value.trim();
  const password = $('password').value.trim();
  const box = $('loginMsg');
  if(!username || !password) return msg(box,'اكتب اسم المستخدم وكلمة المرور','error');
  if(!sb || SUPABASE_URL.includes('ضع-')) return msg(box,'ضع رابط Supabase والمفتاح داخل ملف app.js أولاً','error');
  const {data,error}= await sb.from('app_users').select('*').eq('username',username).eq('password',password).eq('is_active',true).maybeSingle();
  if(error) return msg(box,error.message,'error');
  if(!data) return msg(box,'بيانات الدخول غير صحيحة أو المستخدم موقوف','error');
  setSession(data);
  location.href = data.role === 'admin' ? 'admin.html' : 'supervisor.html';
}

function initNav(){
  qa('[data-section]').forEach(btn=>btn.addEventListener('click',()=>{
    qa('[data-section]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    qa('.section').forEach(s=>s.classList.remove('active'));
    $(btn.dataset.section).classList.add('active');
  }));
}

let adminState = {users:[], supervisors:[], projects:[], workers:[], attendance:[], logs:[], tickets:[]};
async function initAdmin(){
  const u = requireLogin('admin'); if(!u) return;
  $('currentUser').textContent = u.full_name;
  initNav();
  await loadAdminData();
  bindAdminForms();
}
async function loadAdminData(){
  try{
    adminState.users = await selectAll('app_users');
    adminState.supervisors = adminState.users.filter(x=>x.role==='supervisor');
    adminState.projects = await selectAll('projects');
    adminState.workers = await selectAll('workers');
    adminState.attendance = await selectAll('attendance');
    adminState.logs = await selectAll('time_logs');
    adminState.tickets = await selectAll('tickets');
    fillAdminSelects(); renderDashboard(); renderUsers(); renderProjects(); renderWorkers(); renderAttendance(); renderDailyLogs(); renderLogs(); renderTickets();
  }catch(e){ alert('خطأ تحميل البيانات: '+ e.message); }
}
function supName(id){ return (adminState.supervisors.find(x=>x.id===id)||{}).full_name || '-'; }
function projectName(id){ return (adminState.projects.find(x=>x.id===id)||{}).name || '-'; }
function workerName(id){ return (adminState.workers.find(x=>x.id===id)||{}).name || '-'; }
function fillSelect(el, arr, label='name', empty='اختر'){
  if(!el) return;
  el.innerHTML = `<option value="">${empty}</option>` + arr.map(x=>`<option value="${x.id}">${x[label]||x.full_name}</option>`).join('');
}
function fillAdminSelects(){
  ['userLinkedSupervisor','projectSupervisor','workerSupervisor','filterSupervisor','attendanceSupervisor','dailySupervisor','ticketSupervisor'].forEach(id=>fillSelect($(id),adminState.supervisors,'full_name','الكل / اختر'));
  ['attendanceProject','ticketProject'].forEach(id=>fillSelect($(id),adminState.projects,'name','الكل / اختر'));
  fillSelect($('attendanceWorker'),adminState.workers,'name','اختر العامل');
}
function renderDashboard(){
  $('countUsers').textContent = adminState.users.length;
  $('countProjects').textContent = adminState.projects.filter(x=>x.status==='active').length;
  $('countWorkers').textContent = adminState.workers.filter(x=>x.status==='active').length;
  $('countTickets').textContent = adminState.tickets.filter(x=>x.status!=='closed').length;
}
function renderUsers(){
  $('usersBody').innerHTML = adminState.users.map(u=>`<tr><td>${u.full_name}</td><td>${u.username}</td><td>${u.role==='admin'?'مدير':'مشرف'}</td><td>${u.linked_supervisor_id?supName(u.linked_supervisor_id):'-'}</td><td>${u.is_active?'<span class="pill green">نشط</span>':'<span class="pill red">موقوف</span>'}</td><td><button class="btn light" onclick="toggleUser('${u.id}',${!u.is_active})">${u.is_active?'إيقاف':'تفعيل'}</button> <button class="btn danger" onclick="removeRow('app_users','${u.id}')">حذف</button></td></tr>`).join('');
}
function renderProjects(){
  const f = $('filterSupervisor')?.value || '';
  const rows = adminState.projects.filter(p=>!f || p.supervisor_id===f);
  $('projectsBody').innerHTML = rows.map(p=>`<tr><td>${p.name}</td><td>${supName(p.supervisor_id)}</td><td>${p.status==='active'?'<span class="pill green">نشط</span>':'<span class="pill red">موقوف</span>'}</td><td>${p.notes||'-'}</td><td><button class="btn danger" onclick="removeRow('projects','${p.id}')">حذف</button></td></tr>`).join('');
}
function renderWorkers(){
  const f = $('filterSupervisor')?.value || '';
  const rows = adminState.workers.filter(w=>!f || w.supervisor_id===f);
  $('workersBody').innerHTML = rows.map(w=>`<tr><td>${w.name}</td><td>${supName(w.supervisor_id)}</td><td>${w.salary}</td><td>${w.status==='active'?'<span class="pill green">نشط</span>':'<span class="pill red">موقوف</span>'}</td><td>${w.notes||'-'}</td><td><button class="btn danger" onclick="removeRow('workers','${w.id}')">حذف</button></td></tr>`).join('');
}
function renderAttendance(){
  $('attendanceBody').innerHTML = adminState.attendance.slice(0,200).map(a=>`<tr><td>${a.attendance_date}</td><td>${workerName(a.worker_id)}</td><td>${supName(a.supervisor_id)}</td><td>${projectName(a.project_id)}</td><td>${a.status==='present'?'<span class="pill green">حاضر</span>':'<span class="pill red">غائب</span>'}</td><td>${a.notes||'-'}</td></tr>`).join('');
}
function renderDailyLogs(){
  const date = $('dailyDate')?.value || today();
  const sup = $('dailySupervisor')?.value || '';
  const sameDay = (v)=> (v ? new Date(v).toISOString().slice(0,10) : '') === date;
  const logRows = adminState.logs.filter(l=>(l.log_date===date || sameDay(l.check_in) || sameDay(l.created_at)) && (!sup || String(l.supervisor_id)===String(sup)));
  const attRows = adminState.attendance.filter(a=>a.attendance_date===date && (!sup || String(a.supervisor_id)===String(sup)));
  const ticketRows = adminState.tickets.filter(t=>sameDay(t.created_at) && (!sup || String(t.supervisor_id)===String(sup)));
  const rows = [];
  logRows.forEach(l=>rows.push({type:'وقت', date:l.log_date||date, sup:supName(l.supervisor_id), project:projectName(l.project_id), detail:'دخول / خروج', status:l.check_out?'مكتمل':'مفتوح', time:`${fmt(l.check_in)} - ${fmt(l.check_out)}`, notes:l.notes||'-'}));
  attRows.forEach(a=>rows.push({type:'حضور', date:a.attendance_date, sup:supName(a.supervisor_id), project:projectName(a.project_id), detail:workerName(a.worker_id), status:a.status==='present'?'حاضر':'غائب', time:'-', notes:a.notes||'-'}));
  ticketRows.forEach(t=>rows.push({type:'تكت', date:new Date(t.created_at).toISOString().slice(0,10), sup:supName(t.supervisor_id), project:projectName(t.project_id), detail:t.title, status:t.status==='closed'?'مقفل':'مفتوح', time:fmt(t.created_at), notes:t.description||'-'}));
  if($('dailyTimeCount')) $('dailyTimeCount').textContent = logRows.length;
  if($('dailyPresentCount')) $('dailyPresentCount').textContent = attRows.filter(a=>a.status==='present').length;
  if($('dailyAbsentCount')) $('dailyAbsentCount').textContent = attRows.filter(a=>a.status==='absent').length;
  if($('dailyTicketsCount')) $('dailyTicketsCount').textContent = ticketRows.length;
  if($('dailyBody')) $('dailyBody').innerHTML = rows.slice(0,300).map(r=>`<tr><td>${r.type}</td><td>${r.date}</td><td>${r.sup}</td><td>${r.project}</td><td>${r.detail}</td><td>${r.status}</td><td>${r.time}</td><td>${r.notes}</td></tr>`).join('') || `<tr><td colspan="8">لا توجد تسجيلات لهذا اليوم</td></tr>`;
}

function renderLogs(){
  $('logsBody').innerHTML = adminState.logs.slice(0,200).map(l=>`<tr><td>${l.log_date}</td><td>${supName(l.supervisor_id)}</td><td>${projectName(l.project_id)}</td><td>${fmt(l.check_in)}</td><td>${fmt(l.check_out)}</td><td>${Math.round((l.duration_minutes||0)/60*10)/10}</td><td>${l.travel_minutes||0}</td></tr>`).join('');
}
function renderTickets(){
  $('ticketsBody').innerHTML = adminState.tickets.slice(0,200).map(t=>`<tr><td>#${t.ticket_no||'-'}</td><td>${projectName(t.project_id)}</td><td>${supName(t.supervisor_id)}</td><td>${t.title}</td><td>${ticketStatus(t.status)}</td><td>${t.priority}</td><td>${fmt(t.created_at)}</td><td><button class="btn secondary" onclick="closeTicket('${t.id}')">تقفيل</button></td></tr>`).join('');
}
function ticketStatus(s){ return s==='closed'?'<span class="pill green">مقفل</span>':s==='in_progress'?'<span class="pill orange">جاري</span>':'<span class="pill blue">مفتوح</span>'; }
function bindAdminForms(){
  $('filterSupervisor')?.addEventListener('change',()=>{renderProjects(); renderWorkers();});
  $('dailyDate')?.addEventListener('change',renderDailyLogs);
  $('dailySupervisor')?.addEventListener('change',renderDailyLogs);
  $('addUserBtn')?.addEventListener('click', async()=>{
    const payload={full_name:$('userFullName').value.trim(), username:$('userName').value.trim(), password:$('userPassword').value.trim()||'123456', role:$('userRole').value, linked_supervisor_id:$('userLinkedSupervisor').value||null, is_active:true};
    if(!payload.full_name || !payload.username) return alert('اكتب الاسم واسم المستخدم');
    await insertRow('app_users',payload); clearForm(['userFullName','userName','userPassword']); await loadAdminData();
  });
  $('addProjectBtn')?.addEventListener('click', async()=>{
    const supervisor_id=$('projectSupervisor').value||null;
    const payload={name:$('projectName').value.trim(), supervisor_id, status:'active', notes:$('projectNotes').value.trim()||null};
    if(!payload.name) return alert('اكتب اسم المشروع');
    const p = await insertRow('projects',payload);
    if(supervisor_id) await insertRow('supervisor_projects',{supervisor_id,project_id:p.id});
    clearForm(['projectName','projectNotes']); await loadAdminData();
  });
  $('addWorkerBtn')?.addEventListener('click', async()=>{
    const payload={name:$('workerName').value.trim(), supervisor_id:$('workerSupervisor').value||null, salary:Number($('workerSalary').value||1500), status:'active', notes:$('workerNotes').value.trim()||null};
    if(!payload.name) return alert('اكتب اسم العامل');
    const w = await insertRow('workers',payload);
    if(payload.supervisor_id) await insertRow('worker_assignments',{worker_id:w.id, supervisor_id:payload.supervisor_id, project_id:null});
    clearForm(['workerName','workerSalary','workerNotes']); await loadAdminData();
  });
  $('addAttendanceBtn')?.addEventListener('click', async()=>{
    const payload={attendance_date:$('attendanceDate').value||today(), worker_id:$('attendanceWorker').value, supervisor_id:$('attendanceSupervisor').value, project_id:$('attendanceProject').value||null, status:$('attendanceStatus').value, notes:$('attendanceNotes').value.trim()||null, created_by:session().id};
    if(!payload.worker_id || !payload.supervisor_id) return alert('اختر العامل والمشرف');
    const {error}= await sb.from('attendance').upsert(payload,{onConflict:'attendance_date,worker_id'});
    if(error) return alert(error.message); clearForm(['attendanceNotes']); await loadAdminData();
  });
}
function clearForm(ids){ ids.forEach(id=>{if($(id)) $(id).value='';}); }
async function toggleUser(id, active){ await updateRow('app_users',id,{is_active:active}); await loadAdminData(); }
async function removeRow(table,id){ if(!confirm('تأكيد الحذف؟')) return; await deleteRow(table,id); await loadAdminData(); }
async function closeTicket(id){ await updateRow('tickets',id,{status:'closed',closed_at:nowIso()}); await loadAdminData(); }
function exportTable(tableId, fileName){
  const table = $(tableId); if(!table) return;
  let csv = Array.from(table.rows).map(r=>Array.from(r.cells).map(c=>'"'+c.innerText.replaceAll('"','""')+'"').join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fileName+'.csv'; a.click();
}
function printPage(){ window.print(); }

let supState = {me:null, projects:[], workers:[], logs:[], tickets:[], activeLog:null, lang:'ar'};
const dict = {
  ar:{dash:'لوحة المشرف',projects:'مشاريعي',workers:'عمالي',attendance:'التحضير',tickets:'التكتات',time:'تسجيل الوقت',present:'حاضر',absent:'غائب',save:'حفظ'},
  en:{dash:'Supervisor Dashboard',projects:'My Projects',workers:'My Workers',attendance:'Attendance',tickets:'Tickets',time:'Time Log',present:'Present',absent:'Absent',save:'Save'},
  hi:{dash:'सुपरवाइजर डैशबोर्ड',projects:'मेरे प्रोजेक्ट',workers:'मेरे कर्मचारी',attendance:'हाजिरी',tickets:'टिकट',time:'समय रिकॉर्ड',present:'उपस्थित',absent:'अनुपस्थित',save:'सेव'},
  bn:{dash:'সুপারভাইজার ড্যাশবোর্ড',projects:'আমার প্রজেক্ট',workers:'আমার কর্মী',attendance:'হাজিরা',tickets:'টিকিট',time:'সময় লগ',present:'উপস্থিত',absent:'অনুপস্থিত',save:'সেভ'}
};
async function initSupervisor(){
  const u=requireLogin('supervisor'); if(!u) return;
  supState.me=u; $('currentUser').textContent=u.full_name; initNav(); await loadSupervisorData(); bindSupervisorForms(); setLang('ar');
}
async function loadSupervisorData(){
  const id=supState.me.id;
  const {data:projects,error:pErr}= await sb.from('projects').select('*').eq('supervisor_id',id).order('created_at',{ascending:false}); if(pErr) alert(pErr.message);
  const {data:workers,error:wErr}= await sb.from('workers').select('*').eq('supervisor_id',id).order('created_at',{ascending:false}); if(wErr) alert(wErr.message);
  const {data:logs}= await sb.from('time_logs').select('*').eq('supervisor_id',id).order('created_at',{ascending:false});
  const {data:tickets}= await sb.from('tickets').select('*').eq('supervisor_id',id).order('created_at',{ascending:false});
  supState.projects=projects||[]; supState.workers=workers||[]; supState.logs=logs||[]; supState.tickets=tickets||[];
  fillSelect($('supProjectSelect'),supState.projects,'name','اختر المشروع'); fillSelect($('ticketProjectSelect'),supState.projects,'name','اختر المشروع');
  renderSupervisor();
}
function renderSupervisor(){
  $('supCountProjects').textContent=supState.projects.length; $('supCountWorkers').textContent=supState.workers.length; $('supCountTickets').textContent=supState.tickets.filter(t=>t.status!=='closed').length;
  $('supProjectsBody').innerHTML=supState.projects.map(p=>`<tr><td>${p.name}</td><td>${p.status==='active'?'<span class="pill green">نشط</span>':'<span class="pill red">موقوف</span>'}</td><td>${p.notes||'-'}</td></tr>`).join('');
  $('supWorkersBody').innerHTML=supState.workers.map(w=>`<tr><td>${w.name}</td><td>${w.status==='active'?'<span class="pill green">نشط</span>':'<span class="pill red">موقوف</span>'}</td><td><button class="btn secondary" onclick="quickAttendance('${w.id}','present')">حاضر</button> <button class="btn danger" onclick="quickAttendance('${w.id}','absent')">غائب</button></td></tr>`).join('');
  $('supLogsBody').innerHTML=supState.logs.map(l=>`<tr><td>${l.log_date}</td><td>${supState.projects.find(p=>p.id===l.project_id)?.name||'-'}</td><td>${fmt(l.check_in)}</td><td>${fmt(l.check_out)}</td><td>${Math.round((l.duration_minutes||0)/60*10)/10}</td></tr>`).join('');
  $('supTicketsBody').innerHTML=supState.tickets.map(t=>`<tr><td>#${t.ticket_no||'-'}</td><td>${supState.projects.find(p=>p.id===t.project_id)?.name||'-'}</td><td>${t.title}</td><td>${ticketStatus(t.status)}</td><td>${fmt(t.created_at)}</td></tr>`).join('');
}
function bindSupervisorForms(){
  $('checkInBtn')?.addEventListener('click',async()=>{
    const project_id=$('supProjectSelect').value; if(!project_id) return alert('اختر المشروع');
    const log=await insertRow('time_logs',{log_date:today(), supervisor_id:supState.me.id, project_id, check_in:nowIso(), notes:'تسجيل دخول من المشرف'});
    supState.activeLog=log; await loadSupervisorData(); alert('تم تسجيل الدخول');
  });
  $('checkOutBtn')?.addEventListener('click',async()=>{
    const last = supState.activeLog || supState.logs.find(l=>l.check_in && !l.check_out);
    if(!last) return alert('لا يوجد دخول مفتوح');
    const mins=Math.max(0,Math.round((new Date()-new Date(last.check_in))/60000));
    await updateRow('time_logs',last.id,{check_out:nowIso(),duration_minutes:mins}); supState.activeLog=null; await loadSupervisorData(); alert('تم تسجيل الخروج');
  });
  $('createTicketBtn')?.addEventListener('click',async()=>{
    const payload={project_id:$('ticketProjectSelect').value, supervisor_id:supState.me.id, title:$('ticketTitle').value.trim(), description:$('ticketDesc').value.trim()||null, priority:$('ticketPriority').value, status:'open'};
    if(!payload.project_id || !payload.title) return alert('اختر المشروع واكتب عنوان التكت');
    await insertRow('tickets',payload); clearForm(['ticketTitle','ticketDesc']); await loadSupervisorData(); alert('تم إنشاء التكت');
  });
}
async function quickAttendance(worker_id,status){
  const project_id = $('supProjectSelect')?.value || (supState.projects[0]?.id || null);
  const payload={attendance_date:today(), worker_id, supervisor_id:supState.me.id, project_id, status, created_by:supState.me.id};
  const {error}= await sb.from('attendance').upsert(payload,{onConflict:'attendance_date,worker_id'});
  if(error) return alert(error.message); alert('تم حفظ التحضير');
}
function setLang(lang){
  supState.lang=lang; qa('.langbar button').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
  qa('[data-i18n]').forEach(el=>{ const key=el.dataset.i18n; el.textContent=(dict[lang]&&dict[lang][key])||dict.ar[key]||el.textContent; });
}
window.login=login; window.logout=logout; window.initAdmin=initAdmin; window.initSupervisor=initSupervisor; window.toggleUser=toggleUser; window.removeRow=removeRow; window.closeTicket=closeTicket; window.exportTable=exportTable; window.printPage=printPage; window.renderDailyLogs=renderDailyLogs; window.quickAttendance=quickAttendance; window.setLang=setLang;
